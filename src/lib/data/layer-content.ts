import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import type { Layer } from "./layers";

/**
 * Editorial deep-dive content per layer, loaded from data/layers.yml at build
 * time. Stats + the recent-developments feed are derived from the deal data in
 * the component; this is just the prose + market sizing.
 */

const LayerContentSchema = z.object({
  tagline: z.string(),
  market_size: z.string(),
  market_size_note: z.string(),
  summary: z.string(),
  interconnect: z.string(),
  watch: z.string(),
});
export type LayerContent = z.infer<typeof LayerContentSchema>;

export type LayerContentMap = Partial<Record<Layer, LayerContent>>;

let cached: LayerContentMap | null = null;

export function loadLayerContent(): LayerContentMap {
  if (cached) return cached;
  const raw = yaml.load(
    fs.readFileSync(path.join(process.cwd(), "data", "layers.yml"), "utf8"),
  );
  const out: LayerContentMap = {};
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const parsed = LayerContentSchema.safeParse(value);
      if (parsed.success) out[key as Layer] = parsed.data;
      else console.warn(`[data] skipping malformed layer content: ${key}`);
    }
  }
  cached = out;
  return cached;
}
