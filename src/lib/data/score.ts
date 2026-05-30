import fs from "node:fs";
import path from "node:path";

/**
 * Opportunity Indicator math.
 *
 *   BottleneckScore = DealVelocity × UnrealizedGap
 *
 * - DealVelocity: recency-weighted inbound deal activity — how much of the
 *   stack's capital is currently pointing at a node.
 * - UnrealizedGap: how little the public market has reacted to it — 1 minus the
 *   node's stock return vs. the S&P since its first deal (clamped). Private /
 *   no-ticker nodes are "unmeasured" (we can't see the public response) and get
 *   a high default gap, which is itself the thesis: unpriced concentration.
 *
 * Prices come from data/prices.json (refresh with `npm run refresh-prices`),
 * so scoring is deterministic at build time — no live API calls.
 */

export const SCORE = {
  TAU: 18, // months; deal-velocity recency half-scale
  R_STAR: 2.0, // relative outperformance (×) that fully "closes" the gap
  UNMEASURED_GAP: 0.85, // gap assigned when there's no public price window
};

export interface PriceData {
  benchmark: string;
  series: Record<string, Record<string, number>>; // ticker -> { monthIndex: close }
}

let cachedPrices: PriceData | null = null;

export function loadPrices(): PriceData {
  if (cachedPrices) return cachedPrices;
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "data", "prices.json"),
      "utf8",
    );
    cachedPrices = JSON.parse(raw) as PriceData;
  } catch {
    cachedPrices = { benchmark: "^GSPC", series: {} };
  }
  return cachedPrices;
}

/** Close at the first month >= target, else the latest month <= target, else null. */
export function closeAtMonth(
  series: Record<string, number> | undefined,
  month: number,
): number | null {
  if (!series) return null;
  const months = Object.keys(series)
    .map(Number)
    .sort((a, b) => a - b);
  if (months.length === 0) return null;
  for (const m of months) if (m >= month) return series[m];
  return series[months[months.length - 1]];
}

export function latestClose(
  series: Record<string, number> | undefined,
): number | null {
  if (!series) return null;
  let maxM = -Infinity;
  for (const k of Object.keys(series)) maxM = Math.max(maxM, Number(k));
  return maxM === -Infinity ? null : series[maxM];
}

export interface ScoreInputs {
  /** Recency-weighted inbound deal activity (raw, pre-normalization). */
  velocityRaw: number;
  /** Earliest month across all deals touching the node (price window start). */
  firstMonth: number | null;
  ticker: string | null;
}

export interface ScoreResult {
  dealVelocity: number; // normalized 0..1
  unrealizedGap: number | null; // 0..1, null if unmeasured
  bottleneckScore: number; // normalized 0..1
  priceReturn: number | null; // fractional return since firstMonth
  benchmarkReturn: number | null;
  measured: boolean;
}

/** Compute gap + raw score for one node (velocity normalized later, across all nodes). */
export function gapFor(
  input: ScoreInputs,
  prices: PriceData,
): {
  gap: number | null;
  priceReturn: number | null;
  benchmarkReturn: number | null;
  measured: boolean;
} {
  const { ticker, firstMonth } = input;
  if (!ticker || firstMonth == null) {
    return { gap: null, priceReturn: null, benchmarkReturn: null, measured: false };
  }
  const series = prices.series[ticker];
  const bench = prices.series[prices.benchmark];
  const pStart = closeAtMonth(series, firstMonth);
  const pNow = latestClose(series);
  const bStart = closeAtMonth(bench, firstMonth);
  const bNow = latestClose(bench);
  if (!pStart || !pNow || !bStart || !bNow) {
    return { gap: null, priceReturn: null, benchmarkReturn: null, measured: false };
  }
  const priceReturn = pNow / pStart - 1;
  const benchmarkReturn = bNow / bStart - 1;
  const relative = priceReturn - benchmarkReturn;
  const gap = Math.max(0, Math.min(1, 1 - relative / SCORE.R_STAR));
  return { gap, priceReturn, benchmarkReturn, measured: true };
}
