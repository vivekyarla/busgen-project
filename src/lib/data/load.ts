import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { CompanySchema, DealSchema, type Company, type Deal } from "./types";
import { layerForCategory, layerY, LAYER_META, type Layer } from "./layers";
import { monthIndex } from "./time";

/**
 * Build-time loader. Reads the curated dataset from /data (companies.yml +
 * deals/*.yml), validates it, and joins companies + deals into a graph shape
 * ready for react-force-graph. See data/AGENTS.md for the contribution guide.
 *
 * Runs on the server only (uses node:fs). The result is plain-serializable so
 * it can be handed to a Client Component as props.
 */

const DATA_DIR = path.join(process.cwd(), "data");

export interface GraphNode {
  id: string; // company slug
  name: string;
  ticker: string | null;
  category: string;
  layer: Layer;
  subline?: string;
  acquired?: boolean;
  /** Fixed y so the node locks to its layer plane; x/z are free. */
  fy: number;
  /** Number of deals where this company is the target (inbound demand). */
  inboundDeals: number;
  /** Number of deals where this company is the source. */
  outboundDeals: number;
  /** Sum of value_billions across inbound deals (USD billions). */
  inboundValue: number;
  /** Node size hint for the graph. */
  val: number;
  /** True if this node was referenced by a deal but missing from companies.yml. */
  synthetic?: boolean;
}

export interface GraphLink {
  id: string;
  source: string; // source slug
  target: string; // target slug
  deal_type: string;
  value_billions: number | null;
  value_display?: string;
  date?: string;
  date_display?: string;
  /** Parsed month index (year*12 + month-1), or null if no/unparseable date. */
  month: number | null;
  description?: string;
  source_url?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  meta: {
    companyCount: number;
    dealCount: number;
    syntheticCount: number;
    generatedAt: string;
    /** Min/max dated-deal month index across the dataset (for the time slider). */
    minMonth: number;
    maxMonth: number;
  };
}

let cached: GraphData | null = null;

function readCompanies(): Company[] {
  const raw = yaml.load(
    fs.readFileSync(path.join(DATA_DIR, "companies.yml"), "utf8"),
  );
  if (!Array.isArray(raw)) return [];
  const out: Company[] = [];
  for (const entry of raw) {
    const parsed = CompanySchema.safeParse(entry);
    if (parsed.success) out.push(parsed.data);
    else
      console.warn(
        `[data] skipping malformed company: ${JSON.stringify(entry)?.slice(0, 80)}`,
      );
  }
  return out;
}

function readDeals(): Deal[] {
  const dir = path.join(DATA_DIR, "deals");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yml"));
  const out: Deal[] = [];
  for (const file of files) {
    const raw = yaml.load(fs.readFileSync(path.join(dir, file), "utf8"));
    const parsed = DealSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data);
    else console.warn(`[data] skipping malformed deal: ${file}`);
  }
  return out;
}

export function loadGraph(): GraphData {
  if (cached) return cached;

  const companies = readCompanies();
  const deals = readDeals();

  const nodeMap = new Map<string, GraphNode>();

  const makeNode = (
    slug: string,
    fallbackName: string,
    company?: Company,
  ): GraphNode => {
    const category = company?.category ?? "unknown";
    // Explicit `layer` on the company wins (if valid); else derive from category.
    const explicit = company?.layer;
    const layer: Layer =
      explicit && explicit in LAYER_META
        ? (explicit as Layer)
        : company
          ? layerForCategory(company.category)
          : "capital";
    return {
      id: slug,
      name: company?.name ?? fallbackName ?? slug,
      ticker: company?.ticker ?? null,
      category,
      layer,
      subline: company?.subline,
      acquired: company?.acquired,
      fy: layerY(layer),
      inboundDeals: 0,
      outboundDeals: 0,
      inboundValue: 0,
      val: 2,
      synthetic: company ? undefined : true,
    };
  };

  for (const c of companies) {
    nodeMap.set(c.slug, makeNode(c.slug, c.name, c));
  }

  const links: GraphLink[] = [];
  for (const d of deals) {
    // Ensure both endpoints exist as nodes (react-force-graph errors otherwise).
    if (!nodeMap.has(d.source_slug)) {
      nodeMap.set(
        d.source_slug,
        makeNode(d.source_slug, d.source_name ?? d.source_slug),
      );
    }
    if (!nodeMap.has(d.target_slug)) {
      nodeMap.set(
        d.target_slug,
        makeNode(d.target_slug, d.target_name ?? d.target_slug),
      );
    }

    const src = nodeMap.get(d.source_slug)!;
    const tgt = nodeMap.get(d.target_slug)!;
    src.outboundDeals += 1;
    tgt.inboundDeals += 1;
    if (typeof d.value_billions === "number") {
      tgt.inboundValue += d.value_billions;
    }

    links.push({
      id: d.id,
      source: d.source_slug,
      target: d.target_slug,
      deal_type: d.deal_type,
      value_billions: d.value_billions ?? null,
      value_display: d.value_display ?? undefined,
      date: d.date ?? undefined,
      date_display: d.date_display ?? undefined,
      month: monthIndex(d.date),
      description: d.description ?? undefined,
      source_url: d.source_url ?? undefined,
    });
  }

  // Size nodes by inbound demand (deal count), with a floor.
  const nodes = [...nodeMap.values()];
  for (const n of nodes) {
    n.val = Math.max(2, n.inboundDeals + n.outboundDeals * 0.4);
  }

  const months = links
    .map((l) => l.month)
    .filter((m): m is number => m != null);
  const minMonth = months.length ? Math.min(...months) : 0;
  const maxMonth = months.length ? Math.max(...months) : 0;

  cached = {
    nodes,
    links,
    meta: {
      companyCount: companies.length,
      dealCount: deals.length,
      syntheticCount: nodes.filter((n) => n.synthetic).length,
      generatedAt: new Date().toISOString(),
      minMonth,
      maxMonth,
    },
  };
  return cached;
}
