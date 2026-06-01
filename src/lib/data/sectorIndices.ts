import type { Layer } from "./layers";

/**
 * Types + constants for the synthetic per-layer price indices produced by
 * `npm run fetch:history` (scripts/fetch-history.mjs). Each layer is a
 * cap-weighted "ETF" of its constituent stocks; see that script for the method.
 *
 * NOTE: this file is import-safe from Client Components (no node:fs). The
 * filesystem loader lives in sectorIndices.server.ts.
 */

export type WindowKey = "1M" | "3M" | "6M" | "1Y" | "5Y";
export const WINDOW_KEYS: WindowKey[] = ["1M", "3M", "6M", "1Y", "5Y"];

export interface IndexPoint {
  t: string; // ISO yyyy-mm-dd
  v: number; // index level, rebased to 100 at window start
}

export interface WindowIndex {
  indexReturn: number; // fraction over the window
  series: IndexPoint[];
  includedCount: number;
  best: string | null; // ticker
  worst: string | null; // ticker
  returns: Record<string, number | null>; // ticker -> window return
}

export interface Constituent {
  slug: string;
  name: string;
  ticker: string;
  weightPct: number;
  marketCapUsd: number;
  /** First date we have price history for (ISO yyyy-mm-dd). */
  firstDate?: string;
  /** True if listed within ~2y — long-window returns are unreliable. */
  limitedHistory?: boolean;
}

export interface SectorIndex {
  constituents: Constituent[];
  windows: Partial<Record<WindowKey, WindowIndex>>;
}

export interface SectorIndicesFile {
  generatedAt: string;
  source: string;
  layers: Partial<Record<Layer, SectorIndex>>;
}

/** Per-company price history (native currency), lazily fetched client-side. */
export interface CompanyWindow {
  series: IndexPoint[];
  ret: number;
}

export interface CompanyHistory {
  name: string;
  currency: string | null;
  windows: Partial<Record<WindowKey, CompanyWindow>>;
}

export interface CompanyHistoryFile {
  generatedAt: string;
  source: string;
  companies: Record<string, CompanyHistory>; // keyed by ticker
}
