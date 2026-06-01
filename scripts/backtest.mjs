#!/usr/bin/env node
// One-off: recompute the bottleneck score AS OF past dates to backtest whether
// the indicator would have flagged a node (e.g. SK Hynix) before its stock ran.
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const DATA = path.join(process.cwd(), "data");
const prices = JSON.parse(fs.readFileSync(path.join(DATA, "prices.json"), "utf8"));
const companies = yaml.load(fs.readFileSync(path.join(DATA, "companies.yml"), "utf8"));
const deals = fs
  .readdirSync(path.join(DATA, "deals"))
  .filter((f) => f.endsWith(".yml"))
  .map((f) => yaml.load(fs.readFileSync(path.join(DATA, "deals", f), "utf8")));

const CAT2LAYER = {
  ai_lab: "application", chip_designer: "compute", hyperscaler: "compute",
  neocloud: "compute", data_center: "compute", server_oem: "compute",
  networking: "networking", foundry: "raw_materials", equipment: "raw_materials",
  memory: "raw_materials", packaging: "raw_materials", power: "power", investor: "capital",
};
const BOTTLENECK = new Set(["compute", "networking", "raw_materials", "power"]);
const TAU = 18, R_STAR = 2.0, UNMEASURED = 0.4;
const mi = (d) => { const m = /^(\d{4})-(\d{1,2})/.exec(d || ""); return m ? +m[1] * 12 + (+m[2] - 1) : null; };
const layerOf = (c) => (BOTTLENECK.has(c.layer) || c.layer === "application" || c.layer === "capital" ? c.layer : CAT2LAYER[c.category] || "compute");
const bySlug = new Map(companies.map((c) => [c.slug, c]));

function closeAsOf(series, T) { if (!series) return null; let best = null, bm = -Infinity; for (const k of Object.keys(series)) { const m = +k; if (m <= T && m > bm) { bm = m; best = series[k]; } } return best; }
function closeAtOrAfter(series, m0) { if (!series) return null; let best = null, bm = Infinity; for (const k of Object.keys(series)) { const m = +k; if (m >= m0 && m < bm) { bm = m; best = series[k]; } } return best ?? closeAsOf(series, Infinity); }

function scoresAsOf(T) {
  const vel = new Map(), first = new Map();
  for (const d of deals) {
    const m = mi(d.date); if (m == null || m > T) continue;
    for (const slug of [d.source_slug, d.target_slug]) first.set(slug, Math.min(first.get(slug) ?? Infinity, m));
    const w = Math.exp(-(T - m) / TAU) * (1 + Math.log1p(d.value_billions ?? 0));
    vel.set(d.target_slug, (vel.get(d.target_slug) ?? 0) + w);
    vel.set(d.source_slug, (vel.get(d.source_slug) ?? 0) + w);
  }
  const bench = prices.series[prices.benchmark];
  const rows = [];
  for (const c of companies) {
    const v = vel.get(c.slug) ?? 0, fm = first.get(c.slug);
    let gap = UNMEASURED, measured = false, ret = null, bret = null;
    const s = c.ticker ? prices.series[c.ticker] : null;
    if (s && fm != null) {
      const ps = closeAtOrAfter(s, fm), pn = closeAsOf(s, T), bs = closeAtOrAfter(bench, fm), bn = closeAsOf(bench, T);
      if (ps && pn && bs && bn) { ret = pn / ps - 1; bret = bn / bs - 1; gap = Math.max(0, Math.min(1, 1 - (ret - bret) / R_STAR)); measured = true; }
    }
    const layer = layerOf(c);
    const eligible = BOTTLENECK.has(layer) && c.category !== "hyperscaler";
    const raw = eligible ? v * gap : 0;
    rows.push({ slug: c.slug, name: c.name, layer, v, gap, measured, ret, raw });
  }
  const maxRaw = Math.max(...rows.map((r) => r.raw), 1e-9);
  rows.forEach((r) => (r.score = Math.round((r.raw / maxRaw) * 100)));
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

// Detailed CURRENT ranking (today's prices + all deals).
console.log("=== CURRENT bottleneck ranking (latest data) ===");
const now = scoresAsOf(mi("2026-05"));
for (const r of now.filter((r) => r.score > 0).slice(0, 14)) {
  const pr = r.measured ? `${(r.ret * 100).toFixed(0)}% vs S&P` : "unmeasured";
  console.log(
    `  ${String(r.score).padStart(3)} | ${r.name.padEnd(22)} [${r.layer}] vel ${r.v.toFixed(1).padStart(5)} | gap ${String(Math.round(r.gap * 100)).padStart(3)} | ${pr}`,
  );
}

for (const label of ["2024-06", "2025-01", "2025-06", "2026-05"]) {
  const T = mi(label);
  const rows = scoresAsOf(T);
  const hy = rows.find((r) => r.slug === "sk-hynix");
  const rank = rows.filter((r) => r.score > 0).findIndex((r) => r.slug === "sk-hynix") + 1;
  console.log(`\n=== as of ${label} ===`);
  console.log(`SK Hynix: score ${hy.score} | rank #${rank || "—"} | velocity ${hy.v.toFixed(1)} | gap ${(hy.gap * 100).toFixed(0)}${hy.measured ? ` | return-since-first ${(hy.ret * 100).toFixed(0)}%` : " (unmeasured)"}`);
  console.log("  top 5 bottleneck:", rows.slice(0, 5).map((r) => `${r.name} ${r.score}`).join(" · "));
}
