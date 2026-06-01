import fs from "node:fs";
import path from "node:path";

/**
 * Reads the cached market-data snapshot produced by
 * `npm run fetch:financials` (scripts/fetch-financials.mjs) and exposes it as a
 * ticker -> NodeFinancials map for the graph loader to join onto company nodes.
 *
 * The website never calls a market-data API at runtime; it renders this
 * committed JSON. To refresh, re-run the fetch script and commit the result.
 * A Refinitiv/LSEG CodeBook export writing the same shape is a drop-in source.
 *
 * Missing file = no financials (the UI degrades gracefully), so the app builds
 * fine before the first fetch has ever run.
 */

export interface NodeFinancials {
  ticker: string;
  /** Last price in the instrument's native currency. */
  price: number | null;
  currency: string | null;
  /** Market cap in native currency. */
  marketCap: number | null;
  /** Market cap converted to USD via the snapshot's FX rates (for aggregation). */
  marketCapUsd: number | null;
  forwardPE: number | null;
  trailingPE: number | null;
  /** 1-year price return as a fraction (0.58 = +58%). */
  return1y: number | null;
  /** Most recent session's change as a percent (-1.45 = -1.45%). */
  changePct: number | null;
  /** Next earnings date, ISO yyyy-mm-dd, if known. */
  nextEarnings: string | null;
  /** ISO timestamp of when this snapshot was fetched. */
  asOf: string;
}

interface FinancialsFile {
  generatedAt: string;
  source: string;
  fxToUsd: Record<string, number>;
  quotes: Record<string, NodeFinancials>;
}

const FILE = path.join(process.cwd(), "data", "financials", "quotes.json");

let cached: FinancialsFile | null = null;

export function loadFinancials(): FinancialsFile {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as FinancialsFile;
    cached = {
      generatedAt: parsed.generatedAt ?? "",
      source: parsed.source ?? "unknown",
      fxToUsd: parsed.fxToUsd ?? { USD: 1 },
      quotes: parsed.quotes ?? {},
    };
  } catch {
    // No snapshot yet — degrade gracefully.
    cached = { generatedAt: "", source: "none", fxToUsd: { USD: 1 }, quotes: {} };
  }
  return cached;
}
