/**
 * Fetch a snapshot of market data for every ticker in companies.yml and cache
 * it to data/financials/quotes.json.
 *
 * Usage:  node scripts/fetch-financials.mjs   (or: npm run fetch:financials)
 *
 * This is a build-time / on-demand fetch — NOT a live API call from the app.
 * The committed JSON is what the site renders, so the graph works offline and
 * is reproducible. Re-run this script to refresh the snapshot.
 *
 * Data source: Yahoo Finance (via yahoo-finance2). The Yahoo ticker suffixes
 * already used in companies.yml (.KS, .T, .TW, .HK) resolve directly.
 *
 * SWAPPING IN REFINITIV/LSEG: the only contract the website depends on is the
 * JSON shape below (a map of ticker -> NodeFinancials). A CodeBook export that
 * writes the same shape is a drop-in replacement — keep the keys identical.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import YahooFinance from "yahoo-finance2";

// yahoo-finance2 v3 ships a class — instantiate it.
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// companies.yml ticker -> the symbol Yahoo actually expects. Output stays keyed
// by the companies.yml ticker so the website lookup matches.
const TICKER_OVERRIDES = {
  "981.HK": "0981.HK", // SMIC — Yahoo zero-pads HK codes to 4 digits
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const COMPANIES = path.join(ROOT, "data", "companies.yml");
const OUT_DIR = path.join(ROOT, "data", "financials");
const OUT_FILE = path.join(OUT_DIR, "quotes.json");

function readTickers() {
  const raw = yaml.load(fs.readFileSync(COMPANIES, "utf8"));
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const tickers = [];
  for (const c of raw) {
    const t = c?.ticker;
    if (typeof t === "string" && t.trim() && !seen.has(t)) {
      seen.add(t);
      tickers.push(t.trim());
    }
  }
  return tickers;
}

/** Map a Yahoo quote object to our stable NodeFinancials shape. */
function toFinancials(q, asOf) {
  if (!q) return null;
  const oneY =
    typeof q.fiftyTwoWeekChangePercent === "number"
      ? q.fiftyTwoWeekChangePercent / 100
      : null;
  let nextEarnings = null;
  const e = q.earningsTimestampStart ?? q.earningsTimestamp;
  if (e instanceof Date) nextEarnings = e.toISOString().slice(0, 10);
  else if (typeof e === "number")
    nextEarnings = new Date(e * 1000).toISOString().slice(0, 10);
  else if (typeof e === "string") nextEarnings = e.slice(0, 10);

  return {
    ticker: q.symbol ?? null,
    price: numOrNull(q.regularMarketPrice),
    currency: q.currency ?? null,
    marketCap: numOrNull(q.marketCap),
    // marketCapUsd is filled in after FX rates are fetched (see main()).
    marketCapUsd: null,
    forwardPE: numOrNull(q.forwardPE),
    trailingPE: numOrNull(q.trailingPE),
    return1y: oneY,
    changePct: numOrNull(q.regularMarketChangePercent),
    nextEarnings,
    asOf,
  };
}

/** Fetch <CUR>USD=X rates for every non-USD currency seen in the quotes. */
async function fetchFxRates(currencies) {
  const rates = { USD: 1 };
  for (const cur of currencies) {
    if (cur === "USD" || rates[cur] != null) continue;
    try {
      const q = await yahooFinance.quote(`${cur}USD=X`);
      const r = numOrNull(q?.regularMarketPrice);
      if (r != null) rates[cur] = r;
    } catch {
      /* leave missing — marketCapUsd stays null for that currency */
    }
  }
  return rates;
}

function numOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch one quote with retries — Yahoo intermittently rate-limits (crumb). */
async function quoteWithRetry(symbol, asOf, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const q = await yahooFinance.quote(symbol);
      const fin = toFinancials(q, asOf);
      if (fin) return fin;
    } catch {
      /* retry */
    }
    if (i < attempts - 1) await sleep(400 * (i + 1));
  }
  return null;
}

async function main() {
  const tickers = readTickers();
  console.log(`Fetching ${tickers.length} tickers from Yahoo Finance...`);

  // We pass a fixed asOf so re-runs in the same session are deterministic.
  const asOf = new Date().toISOString();
  const quotes = {};
  const failed = [];

  // Fetch one at a time — retries absorb transient rate limits; a single bad
  // ticker fails without taking down the batch.
  for (const t of tickers) {
    const fin = await quoteWithRetry(TICKER_OVERRIDES[t] ?? t, asOf);
    if (fin) {
      fin.ticker = t; // key by the companies.yml ticker
      quotes[t] = fin;
      process.stdout.write(".");
    } else {
      failed.push(t);
      process.stdout.write("x");
    }
  }
  process.stdout.write("\n");

  // Convert every market cap into USD so the dashboard can aggregate by layer.
  const currencies = new Set(
    Object.values(quotes)
      .map((q) => q.currency)
      .filter(Boolean),
  );
  const fxToUsd = await fetchFxRates(currencies);
  for (const q of Object.values(quotes)) {
    const rate = q.currency ? fxToUsd[q.currency] : 1;
    if (q.marketCap != null && rate != null) q.marketCapUsd = q.marketCap * rate;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      { generatedAt: asOf, source: "yahoo", fxToUsd, quotes },
      null,
      2,
    ) + "\n",
  );

  console.log(
    `Wrote ${Object.keys(quotes).length}/${tickers.length} quotes to ${path.relative(ROOT, OUT_FILE)}`,
  );
  if (failed.length) console.log(`Failed to resolve: ${failed.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
