import type { GraphData } from "./load";
import { LAYER_ORDER, type Layer } from "./layers";
import type { SectorIndicesFile } from "./sectorIndices";
import type { NodeFinancials } from "./financials";

/**
 * Per-layer roll-up for the financial dashboard.
 *
 * Two independent signals are combined per layer:
 *  - Deal velocity / momentum — the proprietary, *leading* signal, derived from
 *    the curated map graph (companies + deals).
 *  - Valuation + returns — the *lagging* confirmation, derived from the broad
 *    market-data universe (the sector-index constituents, which include public
 *    names that never appear on the map). This is why a few dozen tickers feed
 *    the per-layer financials without cluttering the graph.
 *
 * The story is the divergence: a layer with accelerating deal velocity but a
 * flat 1-year return is a "not yet priced in" candidate.
 */

export interface LayerStats {
  layer: Layer;
  /** Companies feeding this layer's financials (index constituents, or map
   *  nodes for layers with no index). */
  companyCount: number;
  /** Of those, how many have usable market data. */
  trackedCount: number;
  /** Summed market cap (USD) across tracked companies. */
  totalMarketCapUsd: number | null;
  /** Median forward P/E across tracked companies that report one. */
  medianForwardPE: number | null;
  /** Median 1-year return (fraction) across tracked companies. */
  medianReturn1y: number | null;
  /** Deals touching this layer in the trailing 12 months. */
  deals12mo: number;
  /** Deals in the prior 12-month window (months 13–24 back). */
  dealsPrior12mo: number;
  /** Velocity momentum: deals12mo − dealsPrior12mo. */
  dealMomentum: number;
}

/** A recent deal touching a layer, with endpoints pre-resolved to names. */
export interface LayerDealRow {
  id: string;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  dealType: string;
  valueBillions: number | null;
  dateDisplay: string;
  sourceUrl?: string;
}

export interface LayerKeyPlayer {
  id: string;
  name: string;
  deals: number;
}

/** Deal-centric drill-down for a layer (migrated from the old LayerPanel). */
export interface LayerDetail {
  dealCount: number;
  inboundValue: number;
  recent: LayerDealRow[];
  keyPlayers: LayerKeyPlayer[];
  /** Other layers that send deals into this one: [layer, count]. */
  flowsIn: [Layer, number][];
  /** Other layers this one sends deals to: [layer, count]. */
  flowsOut: [Layer, number][];
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Aggregate market data from an explicit set of financial records. */
function aggregateFinancials(records: (NodeFinancials | undefined)[]): {
  trackedCount: number;
  totalMarketCapUsd: number | null;
  medianForwardPE: number | null;
  medianReturn1y: number | null;
} {
  const caps: number[] = [];
  const pes: number[] = [];
  const rets: number[] = [];
  let tracked = 0;
  for (const f of records) {
    if (!f) continue;
    tracked += 1;
    if (f.marketCapUsd != null) caps.push(f.marketCapUsd);
    if (f.forwardPE != null && f.forwardPE > 0) pes.push(f.forwardPE);
    if (f.return1y != null) rets.push(f.return1y);
  }
  return {
    trackedCount: tracked,
    totalMarketCapUsd: caps.length ? caps.reduce((s, v) => s + v, 0) : null,
    medianForwardPE: median(pes),
    medianReturn1y: median(rets),
  };
}

export function computeLayerStats(
  data: GraphData,
  indices: SectorIndicesFile["layers"],
  quotes: Record<string, NodeFinancials>,
): LayerStats[] {
  const layerOf = new Map<string, Layer>();
  for (const n of data.nodes) layerOf.set(n.id, n.layer);

  // Deal-velocity windows are anchored to the latest dated deal in the set.
  const maxMonth = data.meta.maxMonth;
  const inTrailing = (m: number) => m > maxMonth - 12 && m <= maxMonth;
  const inPrior = (m: number) => m > maxMonth - 24 && m <= maxMonth - 12;

  const dealCounts = new Map<Layer, { d12: number; dPrior: number }>();
  for (const l of LAYER_ORDER) dealCounts.set(l, { d12: 0, dPrior: 0 });

  // A deal counts toward every distinct layer its two endpoints touch.
  for (const link of data.links) {
    if (link.month == null) continue;
    const trailing = inTrailing(link.month);
    const prior = inPrior(link.month);
    if (!trailing && !prior) continue;
    const ls = new Set<Layer>();
    const sl = layerOf.get(link.source);
    const tl = layerOf.get(link.target);
    if (sl) ls.add(sl);
    if (tl) ls.add(tl);
    for (const l of ls) {
      const a = dealCounts.get(l);
      if (!a) continue;
      if (trailing) a.d12 += 1;
      else if (prior) a.dPrior += 1;
    }
  }

  return LAYER_ORDER.map((layer) => {
    const counts = dealCounts.get(layer)!;
    const idx = indices[layer];

    let companyCount: number;
    let fin: ReturnType<typeof aggregateFinancials>;

    if (idx && idx.constituents.length) {
      // Broad financial universe: the layer's index constituents (includes
      // public names that aren't on the map).
      companyCount = idx.constituents.length;
      fin = aggregateFinancials(idx.constituents.map((c) => quotes[c.ticker]));
      // Constituents carry their own market cap even when the live quote lacks
      // one — prefer the index's summed cap so the table matches the chart.
      const idxCap = idx.constituents.reduce(
        (s, c) => s + (c.marketCapUsd ?? 0),
        0,
      );
      if (idxCap > 0) fin.totalMarketCapUsd = idxCap;
    } else {
      // No index (e.g. capital, application): fall back to map nodes' financials.
      const inLayer = data.nodes.filter((n) => n.layer === layer);
      companyCount = inLayer.length;
      fin = aggregateFinancials(inLayer.map((n) => n.financial));
    }

    return {
      layer,
      companyCount,
      trackedCount: fin.trackedCount,
      totalMarketCapUsd: fin.totalMarketCapUsd,
      medianForwardPE: fin.medianForwardPE,
      medianReturn1y: fin.medianReturn1y,
      deals12mo: counts.d12,
      dealsPrior12mo: counts.dPrior,
      dealMomentum: counts.d12 - counts.dPrior,
    };
  });
}

/**
 * Per-layer deal drill-down (cross-layer flows, recent developments, most
 * active companies, inbound value) — the deal-centric content migrated out of
 * the old in-map LayerPanel into the dashboard. Endpoints are pre-resolved to
 * names so the result is serializable for the client table.
 */
export function computeLayerDetails(
  data: GraphData,
): Partial<Record<Layer, LayerDetail>> {
  const layerById = new Map<string, Layer>();
  const nameById = new Map<string, string>();
  for (const n of data.nodes) {
    layerById.set(n.id, n.layer);
    nameById.set(n.id, n.name);
  }

  const out: Partial<Record<Layer, LayerDetail>> = {};

  for (const layer of LAYER_ORDER) {
    const flowsIn = new Map<Layer, number>();
    const flowsOut = new Map<Layer, number>();
    const touching: typeof data.links = [];
    let inboundValue = 0;

    for (const l of data.links) {
      const sl = layerById.get(l.source);
      const tl = layerById.get(l.target);
      const touchesSource = sl === layer;
      const touchesTarget = tl === layer;
      if (!touchesSource && !touchesTarget) continue;
      touching.push(l);
      if (touchesTarget && typeof l.value_billions === "number")
        inboundValue += l.value_billions;
      if (touchesSource && tl && tl !== layer)
        flowsOut.set(tl, (flowsOut.get(tl) ?? 0) + 1);
      if (touchesTarget && sl && sl !== layer)
        flowsIn.set(sl, (flowsIn.get(sl) ?? 0) + 1);
    }

    const recent: LayerDealRow[] = [...touching]
      .sort((a, b) => (b.month ?? -1) - (a.month ?? -1))
      .slice(0, 7)
      .map((d) => ({
        id: d.id,
        sourceId: d.source,
        targetId: d.target,
        sourceName: nameById.get(d.source) ?? d.source,
        targetName: nameById.get(d.target) ?? d.target,
        dealType: d.deal_type,
        valueBillions: d.value_billions ?? null,
        dateDisplay: d.date_display || d.date || "",
        sourceUrl: d.source_url,
      }));

    const keyPlayers: LayerKeyPlayer[] = data.nodes
      .filter((n) => n.layer === layer)
      .sort(
        (a, b) =>
          b.inboundDeals + b.outboundDeals - (a.inboundDeals + a.outboundDeals),
      )
      .slice(0, 8)
      .map((n) => ({
        id: n.id,
        name: n.name,
        deals: n.inboundDeals + n.outboundDeals,
      }));

    const sortFlows = (m: Map<Layer, number>): [Layer, number][] =>
      [...m.entries()].sort((a, b) => b[1] - a[1]);

    out[layer] = {
      dealCount: touching.length,
      inboundValue,
      recent,
      keyPlayers,
      flowsIn: sortFlows(flowsIn),
      flowsOut: sortFlows(flowsOut),
    };
  }

  return out;
}
