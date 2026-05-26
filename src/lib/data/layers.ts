/**
 * The five-layer AI stack from the project plan, plus a "capital" plane for
 * pure financiers that don't sit in the physical stack.
 *
 * Layer assignment is derived from each company's `category` by default
 * (CATEGORY_TO_LAYER below). The data-repo fork can later override per company
 * via an explicit `layer` field; that override should win over this mapping.
 *
 * NOTE: this default mapping is a product decision, not gospel. In particular
 * chip designers (Nvidia, AMD, Broadcom...) are placed in `compute` because the
 * accelerator *is* the compute primitive, even though they're fabless. Revisit
 * with the team.
 */

export type Layer =
  | "application"
  | "compute"
  | "networking"
  | "raw_materials"
  | "power"
  | "capital";

/** Top-to-bottom stacking order (index 0 renders highest). */
export const LAYER_ORDER: Layer[] = [
  "application",
  "compute",
  "networking",
  "raw_materials",
  "power",
  "capital",
];

export const LAYER_META: Record<
  Layer,
  { label: string; color: string; blurb: string }
> = {
  application: {
    label: "Application",
    color: "#34d399",
    blurb: "Frontier labs & agentic AI",
  },
  compute: {
    label: "Compute",
    color: "#60a5fa",
    blurb: "Chips, clouds, neoclouds, data centers, servers",
  },
  networking: {
    label: "Networking / Interconnect",
    color: "#a78bfa",
    blurb: "Switching, optics, interconnect",
  },
  raw_materials: {
    label: "Raw Materials / Enablers",
    color: "#fbbf24",
    blurb: "Foundries, semicap, memory, packaging",
  },
  power: {
    label: "Power / Energy",
    color: "#f87171",
    blurb: "Generation, grid, PPAs",
  },
  capital: {
    label: "Capital",
    color: "#a1a1aa",
    blurb: "Financiers & pure-play investors",
  },
};

const CATEGORY_TO_LAYER: Record<string, Layer> = {
  ai_lab: "application",
  chip_designer: "compute",
  hyperscaler: "compute",
  neocloud: "compute",
  data_center: "compute",
  server_oem: "compute",
  networking: "networking",
  foundry: "raw_materials",
  equipment: "raw_materials",
  memory: "raw_materials",
  packaging: "raw_materials",
  power: "power",
  investor: "capital",
};

export function layerForCategory(category: string): Layer {
  return CATEGORY_TO_LAYER[category] ?? "compute";
}

/** Vertical spacing between layer planes (graph units). */
export const PLANE_SPACING = 190;

/** Fixed y-coordinate for a layer's plane (top positive, bottom negative). */
export function layerY(layer: Layer): number {
  const idx = LAYER_ORDER.indexOf(layer);
  const mid = (LAYER_ORDER.length - 1) / 2;
  return (mid - idx) * PLANE_SPACING;
}
