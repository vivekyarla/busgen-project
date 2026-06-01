import fs from "node:fs";
import path from "node:path";
import type { SectorIndicesFile } from "./sectorIndices";

/**
 * Server-only filesystem loader for the per-layer index snapshot. Kept separate
 * from sectorIndices.ts so Client Components can import the types/constants
 * there without pulling in node:fs. Degrades to an empty map if absent.
 */

const FILE = path.join(
  process.cwd(),
  "data",
  "financials",
  "sector-indices.json",
);

let cached: SectorIndicesFile | null = null;

export function loadSectorIndices(): SectorIndicesFile {
  if (cached) return cached;
  try {
    const parsed = JSON.parse(
      fs.readFileSync(FILE, "utf8"),
    ) as SectorIndicesFile;
    cached = {
      generatedAt: parsed.generatedAt ?? "",
      source: parsed.source ?? "unknown",
      layers: parsed.layers ?? {},
    };
  } catch {
    cached = { generatedAt: "", source: "none", layers: {} };
  }
  return cached;
}
