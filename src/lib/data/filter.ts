import type { GraphData, GraphNode, GraphLink } from "./load";

export type ColorMode = "layer" | "heat";

/** Human labels for the raw deal_type slugs in the dataset. */
export const DEAL_TYPE_META: Record<string, { label: string }> = {
  custom_asic: { label: "Custom ASIC" },
  equipment_supply: { label: "Equipment supply" },
  cloud_capacity: { label: "Cloud capacity" },
  gpu_purchase: { label: "GPU purchase" },
  equity_investment: { label: "Equity investment" },
  power_ppa: { label: "Power PPA" },
  m_and_a: { label: "M&A" },
  funding_round: { label: "Funding round" },
};

export function dealTypeLabel(t: string): string {
  return DEAL_TYPE_META[t]?.label ?? t.replace(/_/g, " ");
}

/** react-force-graph mutates link.source/target from string id to node object. */
export function endpointId(end: unknown): string {
  if (end && typeof end === "object" && "id" in end) {
    return String((end as { id: unknown }).id);
  }
  return String(end);
}

export interface Filters {
  // Layer values are the Layer union, but stored as Set<string> so the generic
  // filter UI (which works in strings) stays type-compatible.
  layers: Set<string>;
  dealTypes: Set<string>;
}

/**
 * Returns a subset of the graph: nodes whose layer is active, and links whose
 * deal_type is active and both endpoints are visible. Reuses the original node
 * and link object references so react-force-graph preserves positions.
 */
export function applyFilters(data: GraphData, filters: Filters): GraphData {
  const nodes = data.nodes.filter((n) => filters.layers.has(n.layer));
  const visible = new Set(nodes.map((n) => n.id));
  const links = data.links.filter(
    (l) =>
      filters.dealTypes.has(l.deal_type) &&
      visible.has(endpointId(l.source)) &&
      visible.has(endpointId(l.target)),
  );
  return { nodes, links, meta: data.meta };
}

/** Total deal involvement of a node (inbound + outbound). */
export function nodeActivity(n: GraphNode): number {
  return n.inboundDeals + n.outboundDeals;
}

/** Max activity across a set of nodes, for heat normalization. */
export function maxActivity(nodes: GraphNode[]): number {
  return nodes.reduce((m, n) => Math.max(m, nodeActivity(n)), 0);
}

const HEAT_STOPS: { t: number; c: [number, number, number] }[] = [
  { t: 0, c: [82, 82, 91] }, // zinc-500 (cool / quiet)
  { t: 0.45, c: [250, 204, 21] }, // amber-400
  { t: 0.75, c: [249, 115, 22] }, // orange-500
  { t: 1, c: [239, 68, 68] }, // red-500 (hot)
];

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** Map a normalized [0,1] activity value to an rgb() heat color. */
export function heatColor(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const lo = HEAT_STOPS[i - 1];
    const hi = HEAT_STOPS[i];
    if (x <= hi.t) {
      const span = hi.t - lo.t || 1;
      const k = (x - lo.t) / span;
      return `rgb(${lerp(lo.c[0], hi.c[0], k)}, ${lerp(lo.c[1], hi.c[1], k)}, ${lerp(lo.c[2], hi.c[2], k)})`;
    }
  }
  const last = HEAT_STOPS[HEAT_STOPS.length - 1].c;
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}

/** Deals where the given node is an endpoint, split by direction. */
export function dealsForNode(
  data: GraphData,
  nodeId: string,
): { inbound: GraphLink[]; outbound: GraphLink[] } {
  const inbound: GraphLink[] = [];
  const outbound: GraphLink[] = [];
  for (const l of data.links) {
    if (endpointId(l.target) === nodeId) inbound.push(l);
    else if (endpointId(l.source) === nodeId) outbound.push(l);
  }
  return { inbound, outbound };
}
