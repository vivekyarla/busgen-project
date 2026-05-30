#!/usr/bin/env node
/**
 * Refresh data/prices.json — monthly adjusted closes for every ticker in
 * companies.yml plus the S&P 500 benchmark, from the Yahoo Finance chart API
 * (no key required). Run manually when you want fresh prices:
 *
 *     npm run refresh-prices
 *
 * The app reads the committed JSON at build time (no build-time network), so
 * the Opportunity Indicator is deterministic and demo-safe.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const BENCHMARK = "^GSPC"; // S&P 500
const RANGE = "6y";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Unix seconds → month index (year*12 + month-1), matching src/lib/data/time.ts. */
function monthIndexFromTs(ts) {
  const d = new Date(ts * 1000);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

// Map a companies.yml ticker to the symbol Yahoo expects (e.g. HK tickers are
// zero-padded to 4 digits: 981.HK → 0981.HK).
function yahooSymbol(ticker) {
  const hk = /^(\d{1,4})\.HK$/i.exec(ticker);
  if (hk) return `${hk[1].padStart(4, "0")}.HK`;
  return ticker;
}

async function fetchMonthly(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol(ticker),
  )}?interval=1mo&range=${RANGE}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  if (!r?.timestamp) throw new Error("no data");
  const closes =
    r.indicators?.adjclose?.[0]?.adjclose ?? r.indicators?.quote?.[0]?.close;
  if (!closes) throw new Error("no closes");
  const series = {};
  for (let i = 0; i < r.timestamp.length; i++) {
    const c = closes[i];
    if (typeof c === "number" && isFinite(c)) {
      series[monthIndexFromTs(r.timestamp[i])] = Math.round(c * 100) / 100;
    }
  }
  if (Object.keys(series).length === 0) throw new Error("empty series");
  return series;
}

const companies = yaml.load(
  fs.readFileSync(path.join(DATA_DIR, "companies.yml"), "utf8"),
);
const tickers = [
  ...new Set(
    (Array.isArray(companies) ? companies : [])
      .map((c) => c?.ticker)
      .filter((t) => typeof t === "string" && t.trim()),
  ),
];

console.log(`[prices] fetching ${tickers.length} tickers + benchmark…`);

const out = { generatedAt: new Date().toISOString(), benchmark: BENCHMARK, series: {} };
const failed = [];

for (const t of [BENCHMARK, ...tickers]) {
  try {
    out.series[t] = await fetchMonthly(t);
    process.stdout.write(`  ✓ ${t} (${Object.keys(out.series[t]).length} mo)\n`);
  } catch (e) {
    failed.push(`${t}: ${e.message}`);
    process.stdout.write(`  ✗ ${t} — ${e.message}\n`);
  }
  await sleep(250); // be polite to Yahoo
}

fs.writeFileSync(
  path.join(DATA_DIR, "prices.json"),
  JSON.stringify(out, null, 0) + "\n",
);
console.log(
  `[prices] wrote data/prices.json — ${Object.keys(out.series).length} series, ${failed.length} failed`,
);
if (failed.length) console.log(`[prices] failed: ${failed.join(" | ")}`);
