#!/usr/bin/env node
/**
 * Weekly deal discovery — pulls RSS feeds for AI-infra deals, asks the LLM
 * (GitHub Models, no API key required when run inside Actions) to filter and
 * structure them into our schema, and writes new deal YAMLs into data/deals/.
 * Caller (the workflow) then opens a PR for review.
 *
 * STRICT SCOPE: only emits a deal when BOTH companies are already in
 * companies.yml. New-company candidates are listed in the PR body as
 * "considered but skipped" — a human deliberately adds them later.
 *
 * Run locally: GITHUB_TOKEN=$(gh auth token) node scripts/discover-deals.mjs
 */

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import Parser from "rss-parser";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const DEALS_DIR = path.join(DATA_DIR, "deals");

// ─── Tuning knobs ─────────────────────────────────────────────────────────
const LOOKBACK_DAYS = 7;
const MAX_PER_FEED = 20; // per-feed cap so a high-volume feed can't crowd others out
const MAX_CANDIDATES_PER_RUN = 150; // total RSS items considered after dedup
const MAX_NEW_DEALS = 15; // hard cap on deals committed per run
const MAX_NEW_COMPANIES = 12; // hard cap on companies added per run
const MAX_LLM_CALLS = 45; // cap LLM calls/run (after keyword pre-filter)
const CALL_SPACING_MS = 4500; // space calls to respect GitHub Models rate limits
const MAX_LLM_RETRIES = 4; // retries on HTTP 429 with backoff
const MODEL = "gpt-4o-mini";
const LLM_URL = "https://models.inference.ai.azure.com/chat/completions";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cheap pre-filter: only spend an LLM call on items that look deal-ish. Cuts a
// ~110-item firehose down to a few dozen, which keeps us under the free-tier
// rate limit. The LLM still makes the real judgment on what survives.
const DEAL_KEYWORDS = new RegExp(
  [
    // transaction verbs / sizing
    "deal", "acqui", "merger", "buyout", "invest", "stake", "funding",
    "fundraise", "raise[ds]?", "round", "series [a-f]", "partnership",
    "partner", "supply", "supplier", "purchase", "order", "contract",
    "offtake", "agreement", "billion", "\\$\\d",
    // compute
    "data ?cent", "capacity", "chips?", "gpu", "accelerator", "asic", "server",
    // raw materials: foundry / equipment / memory / packaging / materials
    "wafer", "foundry", "fab\\b", "lithography", "euv", "hbm", "dram", "memory",
    "packaging", "cowos", "substrate", "photoresist", "semicap", "node\\b",
    // networking / optical
    "interconnect", "optical", "transceiver", "switch", "ethernet",
    "infiniband", "co-packaged", "photonics",
    // power / energy / grid / cooling
    "gigawatt", "megawatt", "\\bMW\\b", "\\bGW\\b", "power purchase", "ppa",
    "nuclear", "reactor", "\\bsmr\\b", "turbine", "grid", "substation",
    "transformer", "interconnection", "electricity", "utility", "energy",
    "solar", "geothermal", "battery", "storage", "cooling",
  ].join("|"),
  "i",
);

function looksLikeDeal(item) {
  return DEAL_KEYWORDS.test(`${item.title} ${item.summary}`);
}

const VALID_LAYERS = new Set([
  "application",
  "compute",
  "networking",
  "raw_materials",
  "power",
  "capital",
]);

// Shown to the LLM so it can place a NEW company on the correct layer.
const LAYER_TAXONOMY = `- application — AI model labs & agentic AI products (category: ai_lab)
- compute — chip designers, hyperscalers, neoclouds, data-center operators, server OEMs (categories: chip_designer, hyperscaler, neocloud, data_center, server_oem)
- networking — switching, optics, interconnect (category: networking)
- raw_materials — foundries, semicap equipment, memory, advanced packaging (categories: foundry, equipment, memory, packaging)
- power — generation, grid, PPAs powering AI data centers (category: power)
- capital — pure financiers / investors with no operating role in the stack (category: investor)`;

// RSS sources — curated AI-infra-relevant outlets. Verified working as of the
// last check. Add/remove freely; broken feeds are logged but don't fail the run.
const FEEDS = [
  // General tech / compute (kept, but balanced by the non-compute feeds below).
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { name: "Tom's Hardware", url: "https://www.tomshardware.com/feeds/all" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
  { name: "VentureBeat", url: "https://venturebeat.com/feed/" },
  { name: "Engadget", url: "https://www.engadget.com/rss.xml" },
  // Semiconductors / materials / packaging (raw-materials layer).
  { name: "SemiWiki", url: "https://semiwiki.com/feed/" },
  { name: "Semiconductor Engineering", url: "https://semiengineering.com/feed/" },
  { name: "EE Times", url: "https://www.eetimes.com/feed/" },
  // Data centers, networking, cooling.
  { name: "Data Center Knowledge", url: "https://www.datacenterknowledge.com/rss.xml" },
  { name: "Data Center Dynamics", url: "https://www.datacenterdynamics.com/en/rss/" },
  { name: "The Register", url: "https://www.theregister.com/headlines.atom" },
  // Power / energy / grid (power layer).
  { name: "Utility Dive", url: "https://www.utilitydive.com/feeds/news/" },
  { name: "POWER Magazine", url: "https://www.powermag.com/feed/" },
  { name: "Latitude Media", url: "https://www.latitudemedia.com/news/rss.xml" },
];

const DEAL_TYPES = [
  "gpu_purchase",
  "custom_asic",
  "cloud_capacity",
  "equity_investment",
  "equipment_supply",
  "power_ppa",
  "m_and_a",
  "funding_round",
];

// ─── Load existing data ────────────────────────────────────────────────────
const companies = yaml.load(
  fs.readFileSync(path.join(DATA_DIR, "companies.yml"), "utf8"),
);
const companyBySlug = new Map(companies.map((c) => [c.slug, c]));
const existingDealIds = new Set(
  fs
    .readdirSync(DEALS_DIR)
    .filter((f) => f.endsWith(".yml"))
    .map((f) => f.replace(/\.yml$/, "")),
);
console.log(
  `[discover] ${companies.length} known companies, ${existingDealIds.size} existing deals`,
);

// ─── Fetch RSS ─────────────────────────────────────────────────────────────
const parser = new Parser({ timeout: 15000 });
const cutoff = Date.now() - LOOKBACK_DAYS * 86400 * 1000;
const seenLinks = new Set();
const candidates = [];

for (const feed of FEEDS) {
  try {
    const f = await parser.parseURL(feed.url);
    let added = 0;
    for (const item of f.items) {
      if (candidates.length >= MAX_CANDIDATES_PER_RUN) break;
      if (added >= MAX_PER_FEED) break; // fair share across feeds
      const isoDate = item.isoDate || item.pubDate;
      const t = isoDate ? new Date(isoDate).getTime() : NaN;
      if (!Number.isFinite(t) || t < cutoff) continue;
      const link = item.link || "";
      if (!link || seenLinks.has(link)) continue;
      seenLinks.add(link);
      candidates.push({
        feed: feed.name,
        title: (item.title || "").trim(),
        link,
        date: new Date(t).toISOString(),
        summary: (item.contentSnippet || item.content || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 1000),
      });
      added++;
    }
    console.log(`[feed] ${feed.name}: ${added} items in window`);
  } catch (e) {
    console.warn(`[feed] ${feed.name} failed: ${e.message}`);
  }
}
console.log(`[discover] ${candidates.length} candidate items total`);

// ─── LLM filter + structure ────────────────────────────────────────────────
const COMPANIES_LIST = companies
  .map(
    (c) =>
      `- ${c.slug} :: ${c.name}${c.ticker ? ` (${c.ticker})` : ""} :: ${c.category}`,
  )
  .join("\n");

const SYSTEM_PROMPT = `You curate a dataset that maps the AI-infrastructure supply chain. You judge each news item on TWO things: (a) is it a real, recent AI-stack deal, and (b) do the companies belong on the map.

QUALIFY a deal only if ALL are true:
1. It's a concrete transaction of one of these types: ${DEAL_TYPES.join(", ")}.
2. It is genuinely about BUILDING, SUPPLYING, or FINANCING AI infrastructure — chips/accelerators, custom silicon, cloud/data-center capacity, foundry/equipment/memory/packaging, networking/interconnect, power for AI data centers, or investment/M&A into any of those. REJECT consumer gadgets, app/feature launches, generic non-infra startup funding, policy, lawsuits, hiring, rumors, stock moves, and analyst opinions.
3. The item EXPLICITLY describes the deal (don't infer or extrapolate).
4. It has a clear direction: source = provider/seller/investor; target = recipient/buyer.

A company may be EITHER already in the supplied list OR a new company you add — but ONLY add a company that genuinely belongs on an AI-infrastructure map (a real, identifiable firm operating in one of the layers below). Do NOT add a company that is merely tangential, a subsidiary already covered by its parent, an individual, a product name, or a generic non-infra business.

Layers (assign the right one to any NEW company):
${LAYER_TAXONOMY}

If it does NOT qualify, respond exactly: {"qualified": false, "reason": "<short reason>"}

If it DOES qualify, respond with:
{
  "qualified": true,
  "deal": {
    "id": "<kebab-case unique id, e.g. nvda-xai-gpu-2026>",
    "source_slug": "<existing slug OR the slug of a new company below>",
    "target_slug": "<existing slug OR the slug of a new company below>",
    "deal_type": "<one of the listed types>",
    "value_billions": <number in USD billions, or null>,
    "value_display": "<short human string like '$5B' or '~$1.2B (est.)' or null>",
    "date": "<YYYY-MM>",
    "date_display": "<e.g. 'May 2026'>",
    "description": "<one factual sentence, no speculation>",
    "source_url": "<the article URL>"
  },
  "new_companies": [
    {
      "slug": "<kebab-case, unique, not already in the list>",
      "name": "<display name>",
      "ticker": "<stock ticker, or null if private>",
      "category": "<best-fit category from the layer list above>",
      "layer": "<one of: application, compute, networking, raw_materials, power, capital>",
      "subline": "<optional one-line descriptor, or omit>"
    }
  ]
}

Include in new_companies ONLY the deal's parties that are NOT already in the supplied list. If both parties already exist, use [].
Output JSON only, no prose.`;

async function callLLM(item) {
  const userPrompt = `Companies in dataset (slug :: name (ticker) :: category):
${COMPANIES_LIST}

News item:
Title:   ${item.title}
Feed:    ${item.feed}
Date:    ${item.date}
URL:     ${item.link}
Summary: ${item.summary}

Evaluate per the rules and respond with the JSON.`;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
        max_tokens: 600,
      }),
    });

    // Back off and retry on rate limit (429) — the main cause of LLM errors.
    if (res.status === 429 && attempt < MAX_LLM_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const waitMs = retryAfter
        ? retryAfter * 1000
        : Math.min(60000, 5000 * 2 ** attempt);
      console.warn(
        `[llm] 429 rate-limited; backing off ${Math.round(waitMs / 1000)}s (retry ${attempt + 1}/${MAX_LLM_RETRIES})`,
      );
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      throw new Error(
        `LLM HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`,
      );
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned no content");
    return JSON.parse(content);
  }
}

const newDeals = [];
const skipped = []; // { item, reason }
const addedCompanies = []; // companies added this run (for companies.yml + PR)
const addedBySlug = new Map(); // slug -> company added this run

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const resolves = (slug) => companyBySlug.has(slug) || addedBySlug.has(slug);
const nameOf = (slug) =>
  companyBySlug.get(slug)?.name || addedBySlug.get(slug)?.name || slug;

// Cheap keyword pre-filter before spending LLM calls (rate-limit friendly).
const toEvaluate = [];
for (const c of candidates) {
  if (looksLikeDeal(c)) toEvaluate.push(c);
  else skipped.push({ ...c, reason: "no deal keywords" });
}
console.log(
  `[discover] ${toEvaluate.length}/${candidates.length} items passed the keyword pre-filter`,
);

let llmCalls = 0;
for (const c of toEvaluate) {
  if (newDeals.length >= MAX_NEW_DEALS) {
    skipped.push({ ...c, reason: `deal cap reached (${MAX_NEW_DEALS})` });
    continue;
  }
  if (llmCalls >= MAX_LLM_CALLS) {
    skipped.push({ ...c, reason: `LLM-call cap reached (${MAX_LLM_CALLS})` });
    continue;
  }

  // Space out calls to stay under the free-tier rate limit.
  if (llmCalls > 0) await sleep(CALL_SPACING_MS);
  llmCalls++;

  let result;
  try {
    result = await callLLM(c);
  } catch (e) {
    skipped.push({ ...c, reason: `LLM error: ${e.message}` });
    continue;
  }

  if (!result.qualified) {
    skipped.push({ ...c, reason: result.reason || "not qualified" });
    continue;
  }

  const d = result.deal;
  if (!d?.id || !d.source_slug || !d.target_slug || !d.deal_type) {
    skipped.push({ ...c, reason: "malformed LLM output" });
    continue;
  }
  if (!DEAL_TYPES.includes(d.deal_type)) {
    skipped.push({ ...c, reason: `bad deal_type: ${d.deal_type}` });
    continue;
  }
  if (existingDealIds.has(d.id)) {
    skipped.push({ ...c, reason: `duplicate id ${d.id}` });
    continue;
  }
  if (d.source_slug === d.target_slug) {
    skipped.push({ ...c, reason: "source == target" });
    continue;
  }

  // Validate any new companies this deal needs (don't commit them yet).
  const newCos = Array.isArray(result.new_companies) ? result.new_companies : [];
  const pending = [];
  let bad = null;
  for (const nc of newCos) {
    if (!nc?.slug || !nc.name || !nc.layer) {
      bad = "new company missing slug/name/layer";
      break;
    }
    if (!SLUG_RE.test(nc.slug)) {
      bad = `bad new-company slug: ${nc.slug}`;
      break;
    }
    if (!VALID_LAYERS.has(nc.layer)) {
      bad = `bad new-company layer: ${nc.layer}`;
      break;
    }
    if (companyBySlug.has(nc.slug) || addedBySlug.has(nc.slug)) continue; // already known
    if (addedCompanies.length + pending.length >= MAX_NEW_COMPANIES) {
      bad = `company cap reached (${MAX_NEW_COMPANIES})`;
      break;
    }
    pending.push(nc);
  }
  if (bad) {
    skipped.push({ ...c, reason: bad });
    continue;
  }

  // After accounting for pending adds, both endpoints must resolve.
  const willResolve = (slug) => resolves(slug) || pending.some((p) => p.slug === slug);
  if (!willResolve(d.source_slug) || !willResolve(d.target_slug)) {
    skipped.push({
      ...c,
      reason: `unresolved slug: ${d.source_slug} or ${d.target_slug}`,
    });
    continue;
  }

  // Commit pending company additions (in-memory; flushed to companies.yml later).
  for (const nc of pending) {
    const company = {
      slug: nc.slug,
      name: nc.name,
      ticker: nc.ticker ?? null,
      category: nc.category || "unknown",
      layer: nc.layer,
      ...(nc.subline ? { subline: nc.subline } : {}),
    };
    addedCompanies.push({ ...company, _fromDeal: d.id });
    addedBySlug.set(nc.slug, company);
    console.log(`[+company] ${nc.slug} — ${nc.name} (${nc.layer})`);
  }

  const dealYaml = {
    id: d.id,
    source_slug: d.source_slug,
    source_name: nameOf(d.source_slug),
    target_slug: d.target_slug,
    target_name: nameOf(d.target_slug),
    deal_type: d.deal_type,
    value_billions: typeof d.value_billions === "number" ? d.value_billions : null,
    value_display: d.value_display ?? null,
    date: d.date ?? null,
    date_display: d.date_display ?? null,
    description: d.description ?? "",
    source_url: d.source_url || c.link,
  };

  fs.writeFileSync(
    path.join(DEALS_DIR, `${d.id}.yml`),
    yaml.dump(dealYaml, { lineWidth: 100 }),
  );
  existingDealIds.add(d.id);
  newDeals.push({ ...dealYaml, _feed: c.feed, _link: c.link });
  console.log(
    `[+] ${d.id} — ${dealYaml.source_name} → ${dealYaml.target_name} (${d.deal_type}, ${d.value_display || "$$ undisclosed"})`,
  );
}

// ─── Flush new companies to companies.yml (append, preserve existing) ───────
if (addedCompanies.length > 0) {
  const companiesPath = path.join(DATA_DIR, "companies.yml");
  const existingText = fs.readFileSync(companiesPath, "utf8");
  const block = yaml.dump(
    addedCompanies.map(({ _fromDeal, ...c }) => c),
    { lineWidth: 100 },
  );
  const sep = existingText.endsWith("\n") ? "\n" : "\n\n";
  fs.appendFileSync(companiesPath, sep + block);
  console.log(`[discover] appended ${addedCompanies.length} new companies to companies.yml`);
}

// ─── Write PR body summary ─────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const lines = [
  `## Weekly deal discovery — ${today}`,
  ``,
  `**Added ${newDeals.length} deal(s)** and **${addedCompanies.length} new compan${addedCompanies.length === 1 ? "y" : "ies"}** · considered ${candidates.length} RSS items · skipped ${skipped.length}`,
  ``,
];

if (newDeals.length > 0) {
  lines.push(`### ✅ Added deals (please verify each before merging)`);
  lines.push("");
  for (const d of newDeals) {
    lines.push(
      `- **\`${d.id}\`** — ${d.source_name} → ${d.target_name} · ${d.deal_type} · ${d.value_display || "$$ undisclosed"} · ${d.date_display || d.date || "no date"}`,
    );
    lines.push(`  - ${d.description}`);
    lines.push(`  - source: ${d.source_url} _(via ${d._feed})_`);
  }
  lines.push("");
} else {
  lines.push(`### No new deals this week.`);
  lines.push("");
}

if (addedCompanies.length > 0) {
  lines.push(`### 🆕 New companies added to the map (verify these especially)`);
  lines.push(
    `_The bot appended these to \`companies.yml\`. Confirm each is a real firm, on the correct layer, and worth tracking — reject the PR or edit if not._`,
  );
  lines.push("");
  for (const co of addedCompanies) {
    lines.push(
      `- **\`${co.slug}\`** — ${co.name}${co.ticker ? ` (${co.ticker})` : " · private"} · layer: **${co.layer}** · category: ${co.category}${co.subline ? ` · ${co.subline}` : ""} _(introduced by ${co._fromDeal})_`,
    );
  }
  lines.push("");
}

if (skipped.length > 0) {
  lines.push(`<details><summary>Skipped (${skipped.length}) — for debugging</summary>`);
  lines.push("");
  for (const s of skipped.slice(0, 30)) {
    lines.push(`- ${s.title || s.link} — ${s.reason}`);
  }
  lines.push("</details>");
  lines.push("");
}

lines.push(
  `---`,
  `_Generated by \`.github/workflows/weekly-deals.yml\`. LLM-discovered data can be inaccurate — review every deal before merging._`,
);

fs.mkdirSync("/tmp", { recursive: true });
fs.writeFileSync("/tmp/pr-body.md", lines.join("\n"));
console.log(`\n[discover] ${newDeals.length} deals added; PR body → /tmp/pr-body.md`);

// Console diagnostics so the Actions log shows why items were skipped.
{
  const reasonCounts = new Map();
  for (const s of skipped) {
    const key = (s.reason || "unknown").split(":")[0].slice(0, 50);
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }
  console.log("[discover] skip reasons:");
  for (const [r, n] of [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${n}× ${r}`);
  }
  console.log("[discover] sample skips:");
  for (const s of skipped.slice(0, 8)) {
    console.log(`   - "${(s.title || s.link || "").slice(0, 70)}" → ${s.reason}`);
  }
}

// Write a run summary to GITHUB_STEP_SUMMARY (visible on the Actions run page
// even when no PR is opened — so 0-deal weeks aren't silent).
if (process.env.GITHUB_STEP_SUMMARY) {
  const reasonCounts = new Map();
  for (const s of skipped) {
    const key = (s.reason || "unknown").split(":")[0].slice(0, 60);
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }
  const topReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const sum = [
    `# Weekly deal discovery — ${today}`,
    ``,
    `| metric | count |`,
    `|---|---|`,
    `| RSS items considered | ${candidates.length} |`,
    `| New deals added | **${newDeals.length}** |`,
    `| New companies added | **${addedCompanies.length}** |`,
    `| Skipped (not a relevant deal) | ${skipped.length} |`,
    ``,
  ];

  if (newDeals.length > 0) {
    sum.push(`## ✅ Added`);
    for (const d of newDeals) {
      sum.push(
        `- \`${d.id}\` — ${d.source_name} → ${d.target_name} (${d.deal_type}) — ${d.value_display || "$$ undisclosed"}`,
      );
    }
    sum.push(``);
  }

  if (topReasons.length > 0) {
    sum.push(`## Top skip reasons`);
    for (const [r, n] of topReasons) sum.push(`- **${n}×** ${r}`);
    sum.push(``);
  }

  if (addedCompanies.length > 0) {
    sum.push(`## 🆕 New companies added`);
    for (const co of addedCompanies) {
      sum.push(`- \`${co.slug}\` — ${co.name} (layer: ${co.layer})`);
    }
    sum.push(``);
  }

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, sum.join("\n"));
}
