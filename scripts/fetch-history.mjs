/**
 * Build a synthetic cap-weighted price index for each layer of the stack — an
 * "ETF" per sub-sector — and cache it to data/financials/sector-indices.json.
 *
 * Usage:  node scripts/fetch-history.mjs   (or: npm run fetch:history)
 * Depends on data/financials/quotes.json (run `npm run fetch:financials` first)
 * for the market-cap weights.
 *
 * Method (documented because it's a modeling choice, not gospel):
 *   - Pull ~5y of adjusted-close history per ticker (adjclose => total-return-ish).
 *   - Weight constituents by their CURRENT USD market cap (a fixed-weight index;
 *     we don't reconstruct historical weights).
 *   - For each window, rebase every constituent to its price at the window start
 *     and take the weighted average, rebased to 100. Using price *ratios* means
 *     currency cancels out — no FX needed for the index itself.
 *   - A constituent with no data near a window's start (e.g. a recent IPO for the
 *     5Y window) is excluded from that window's index and noted.
 *
 * SWAPPING IN REFINITIV/LSEG: replace the history fetch with a CodeBook export
 * of adjusted closes keyed by the same tickers; the index math below is source-
 * agnostic.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const COMPANIES = path.join(ROOT, "data", "companies.yml");
const QUOTES = path.join(ROOT, "data", "financials", "quotes.json");
const OUT_FILE = path.join(ROOT, "data", "financials", "sector-indices.json");
// Per-company history is served from /public so the dashboard can fetch it
// lazily on demand instead of inlining megabytes into the prerendered page.
const OUT_COMPANIES = path.join(ROOT, "public", "data", "company-history.json");

const TICKER_OVERRIDES = { "981.HK": "0981.HK" };

// Mirror of CATEGORY_TO_LAYER in src/lib/data/layers.ts. Keep in sync.
const CATEGORY_TO_LAYER = {
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
const VALID_LAYERS = new Set([
  "application",
  "compute",
  "networking",
  "raw_materials",
  "power",
  "capital",
]);
const layerFor = (c) =>
  c?.layer && VALID_LAYERS.has(c.layer)
    ? c.layer
    : (CATEGORY_TO_LAYER[c?.category] ?? "compute");

// Window → {days back, sampling step in days}.
const WINDOWS = {
  "1M": { days: 31, step: 1 },
  "3M": { days: 92, step: 2 },
  "6M": { days: 183, step: 3 },
  "1Y": { days: 366, step: 7 },
  "5Y": { days: 1827, step: 30 },
};

const DAY = 86_400_000;
const iso = (d) => d.toISOString().slice(0, 10);

function readCompanies() {
  const raw = yaml.load(fs.readFileSync(COMPANIES, "utf8"));
  return Array.isArray(raw) ? raw : [];
}

/** Last close at or before `t` (forward-fill). series is sorted ascending. */
function priceAsOf(series, t) {
  let lo = 0,
    hi = series.length - 1,
    ans = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].t <= t) {
      ans = series[mid].c;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** First close at or after `t` (window entry). */
function firstFrom(series, t) {
  for (const p of series) if (p.t >= t) return p;
  return null;
}

async function fetchHistory(ticker) {
  const sym = TICKER_OVERRIDES[ticker] ?? ticker;
  const period1 = iso(new Date(Date.now() - WINDOWS["5Y"].days * DAY));
  const r = await yahooFinance.chart(sym, { period1, interval: "1d" });
  const out = [];
  for (const q of r?.quotes ?? []) {
    const c = q.adjclose ?? q.close;
    if (q.date && typeof c === "number" && Number.isFinite(c)) {
      out.push({ t: new Date(q.date).getTime(), c });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** Per-company window: raw price (native currency) sampled on the grid. */
function buildCompanyWindow(series, win) {
  const now = Date.now();
  const start = now - win.days * DAY;
  const tolerance = Math.max(win.step, 7) * DAY * 2;
  const entry = firstFrom(series, start);
  if (!entry || entry.t - start > tolerance) return null;

  const grid = [];
  for (let t = start; t <= now; t += win.step * DAY) grid.push(t);
  if (grid[grid.length - 1] !== now) grid.push(now);

  const out = [];
  for (const t of grid) {
    const p = priceAsOf(series, t);
    // Round to 6 significant figures to keep the JSON compact (drops float noise).
    if (p != null) out.push({ t: iso(new Date(t)), v: Number(p.toPrecision(6)) });
  }
  if (out.length < 2) return null;
  return { series: out, ret: out[out.length - 1].v / out[0].v - 1 };
}

function buildWindow(constituents, win) {
  const now = Date.now();
  const start = now - win.days * DAY;
  const tolerance = Math.max(win.step, 7) * DAY * 2;

  // Who has data near the window start?
  const included = [];
  for (const c of constituents) {
    const entry = firstFrom(c.series, start);
    if (entry && entry.t - start <= tolerance) {
      included.push({ ...c, p0: entry.c });
    }
  }
  if (!included.length) return null;

  const totalCap = included.reduce((s, c) => s + c.cap, 0);
  for (const c of included) c.weight = c.cap / totalCap;

  // Sampled date grid from start to now.
  const grid = [];
  for (let t = start; t <= now; t += win.step * DAY) grid.push(t);
  if (grid[grid.length - 1] !== now) grid.push(now);

  const series = [];
  for (const t of grid) {
    let acc = 0;
    let wsum = 0;
    for (const c of included) {
      const p = priceAsOf(c.series, t);
      if (p == null) continue;
      acc += c.weight * (p / c.p0);
      wsum += c.weight;
    }
    if (wsum > 0) series.push({ t: iso(new Date(t)), v: (acc / wsum) * 100 });
  }
  if (series.length < 2) return null;

  const indexReturn = series[series.length - 1].v / series[0].v - 1;

  // Per-constituent return over the window.
  const perf = included.map((c) => {
    const end = priceAsOf(c.series, now);
    return {
      ticker: c.ticker,
      ret: end != null ? end / c.p0 - 1 : null,
    };
  });
  const ranked = perf.filter((p) => p.ret != null).sort((a, b) => b.ret - a.ret);

  return {
    indexReturn,
    series,
    includedCount: included.length,
    best: ranked[0]?.ticker ?? null,
    worst: ranked[ranked.length - 1]?.ticker ?? null,
    returns: Object.fromEntries(perf.map((p) => [p.ticker, p.ret])),
  };
}

async function main() {
  const companies = readCompanies();
  const quotes = JSON.parse(fs.readFileSync(QUOTES, "utf8")).quotes;

  // Companies with a ticker + a USD market cap, grouped by layer.
  const byLayer = {};
  for (const c of companies) {
    if (!c.ticker) continue;
    const q = quotes[c.ticker];
    const cap = q?.marketCapUsd;
    if (cap == null) continue;
    const layer = layerFor(c);
    (byLayer[layer] ??= []).push({
      slug: c.slug,
      name: c.name,
      ticker: c.ticker,
      cap,
    });
  }

  console.log("Fetching 5y history per ticker...");
  // Fetch history once per ticker, cache on the constituent object.
  for (const list of Object.values(byLayer)) {
    for (const c of list) {
      try {
        c.series = await fetchHistory(c.ticker);
        process.stdout.write(c.series.length ? "." : "x");
      } catch {
        c.series = [];
        process.stdout.write("x");
      }
    }
  }
  process.stdout.write("\n");

  const layers = {};
  for (const [layer, list] of Object.entries(byLayer)) {
    const valid = list.filter((c) => c.series && c.series.length > 1);
    if (!valid.length) continue;

    const windows = {};
    for (const [name, win] of Object.entries(WINDOWS)) {
      const w = buildWindow(valid, win);
      if (w) windows[name] = w;
    }

    const totalCap = valid.reduce((s, c) => s + c.cap, 0);
    // A name listed within the last ~2 years has too little history for its
    // longer-window returns to be meaningful (recent IPO / spinoff, e.g.
    // SanDisk). Flag it so the UI can caveat the figure rather than hide it.
    const LIMITED_MS = 730 * DAY;
    const now = Date.now();
    const constituents = valid
      .map((c) => {
        const firstTs = c.series[0]?.t ?? now;
        return {
          slug: c.slug,
          name: c.name,
          ticker: c.ticker,
          weightPct: (c.cap / totalCap) * 100,
          marketCapUsd: c.cap,
          firstDate: iso(new Date(firstTs)),
          limitedHistory: firstTs > now - LIMITED_MS,
        };
      })
      .sort((a, b) => b.weightPct - a.weightPct);

    layers[layer] = { constituents, windows };
  }

  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), source: "yahoo", layers },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Wrote indices for ${Object.keys(layers).length} layers to ${path.relative(ROOT, OUT_FILE)}`,
  );

  // Per-company price history (native currency, raw price) for the per-holding
  // expandable charts. Keyed by ticker; one entry per unique tickered company.
  const companyHistory = {};
  const seen = new Set();
  for (const list of Object.values(byLayer)) {
    for (const c of list) {
      if (seen.has(c.ticker) || !c.series || c.series.length < 2) continue;
      seen.add(c.ticker);
      const windows = {};
      for (const [name, win] of Object.entries(WINDOWS)) {
        const w = buildCompanyWindow(c.series, win);
        if (w) windows[name] = w;
      }
      if (Object.keys(windows).length) {
        companyHistory[c.ticker] = {
          name: c.name,
          currency: quotes[c.ticker]?.currency ?? null,
          windows,
        };
      }
    }
  }
  fs.mkdirSync(path.dirname(OUT_COMPANIES), { recursive: true });
  fs.writeFileSync(
    OUT_COMPANIES,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: "yahoo",
      companies: companyHistory,
    }) + "\n",
  );
  console.log(
    `Wrote price history for ${Object.keys(companyHistory).length} companies to ${path.relative(ROOT, OUT_COMPANIES)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
