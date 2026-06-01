import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { CompanySchema, DealSchema, type Company, type Deal } from "./types";
import { layerForCategory, layerY, LAYER_META, type Layer } from "./layers";
import { monthIndex } from "./time";
import {
  loadPrices,
  loadDemand,
  gapFor,
  SCORE,
  isBottleneckCandidate,
} from "./score";

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

  // ── Opportunity Indicator (see src/lib/data/score.ts) ──
  /** Earliest deal month touching this node (price-window start). */
  firstMonth: number | null;
  /** Recency-weighted inbound deal activity, normalized 0..1. */
  dealVelocity: number;
  /** 1 − market response since first deal, 0..1; null if unmeasured (no ticker). */
  unrealizedGap: number | null;
  /** Demand-confirmation signal 0..1 (backlog/sold-out evidence). */
  demand: number;
  /** DealVelocity × UnrealizedGap × Demand, normalized 0..1. The bottleneck score. */
  bottleneckScore: number;
  /** Stock return since firstMonth (fractional), null if unmeasured. */
  priceReturn: number | null;
  /** S&P return over the same window, null if unmeasured. */
  benchmarkReturn: number | null;
  /** True if the gap was computed from real price data. */
  scoreMeasured: boolean;
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
      firstMonth: null,
      dealVelocity: 0,
      unrealizedGap: null,
      demand: SCORE.DEFAULT_DEMAND,
      bottleneckScore: 0,
      priceReturn: null,
      benchmarkReturn: null,
      scoreMeasured: false,
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

  // ── Opportunity Indicator: DealVelocity × UnrealizedGap × Demand per node ──
  const prices = loadPrices();
  const demandMap = loadDemand();
  const now = new Date();
  const NOW_MONTH = maxMonth || now.getFullYear() * 12 + now.getMonth();
  const velocityRaw = new Map<string, number>();
  for (const l of links) {
    const s = l.source as string;
    const t = l.target as string;
    if (l.month != null) {
      const sN = nodeMap.get(s)!;
      const tN = nodeMap.get(t)!;
      sN.firstMonth = sN.firstMonth == null ? l.month : Math.min(sN.firstMonth, l.month);
      tN.firstMonth = tN.firstMonth == null ? l.month : Math.min(tN.firstMonth, l.month);
    }
    // Recency-weighted + value-boosted deal gravity. Credit BOTH endpoints: a
    // supplier's bottleneck signal is demand pulling on its output (outbound),
    // not just capital flowing in — otherwise supplier→customer deals credit
    // only the (often compute) customer and supply layers never score.
    const w = l.month != null ? Math.exp(-(NOW_MONTH - l.month) / SCORE.TAU) : 0.3;
    const v = w * (1 + Math.log1p(l.value_billions ?? 0));
    velocityRaw.set(t, (velocityRaw.get(t) ?? 0) + v);
    velocityRaw.set(s, (velocityRaw.get(s) ?? 0) + v);
  }

  let maxVel = 0;
  let maxScore = 0;
  const rawScore = new Map<string, number>();
  for (const n of nodes) {
    const vr = velocityRaw.get(n.id) ?? 0;
    const { gap, priceReturn, benchmarkReturn, measured } = gapFor(
      { velocityRaw: vr, firstMonth: n.firstMonth, ticker: n.ticker },
      prices,
    );
    n.unrealizedGap = gap;
    n.priceReturn = priceReturn;
    n.benchmarkReturn = benchmarkReturn;
    n.scoreMeasured = measured;
    n.demand = demandMap[n.id] ?? SCORE.DEFAULT_DEMAND;
    // Only supply nodes can be bottlenecks; demand sinks (application labs,
    // hyperscalers) and capital are excluded. Demand-confirmation gates the
    // score so cheap-but-failing laggards (Intel foundry) don't read as
    // bottlenecks the way cheap-and-constrained suppliers (SK Hynix) do.
    const rs = isBottleneckCandidate(n.layer, n.category)
      ? vr * (gap ?? SCORE.UNMEASURED_GAP) * n.demand
      : 0;
    rawScore.set(n.id, rs);
    maxVel = Math.max(maxVel, vr);
    maxScore = Math.max(maxScore, rs);
  }
  for (const n of nodes) {
    n.dealVelocity = maxVel > 0 ? (velocityRaw.get(n.id) ?? 0) / maxVel : 0;
    n.bottleneckScore = maxScore > 0 ? (rawScore.get(n.id) ?? 0) / maxScore : 0;
  }

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
