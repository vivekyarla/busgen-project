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
const MAX_CANDIDATES_PER_RUN = 80; // RSS items considered after dedup
const MAX_NEW_DEALS = 15; // hard cap on deals committed per run
const MODEL = "gpt-4o-mini";
const LLM_URL = "https://models.inference.ai.azure.com/chat/completions";

// RSS sources — curated AI-infra-relevant outlets. Verified working as of the
// last check. Add/remove freely; broken feeds are logged but don't fail the run.
const FEEDS = [
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { name: "Tom's Hardware", url: "https://www.tomshardware.com/feeds/all" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
  { name: "VentureBeat", url: "https://venturebeat.com/feed/" },
  { name: "SemiWiki", url: "https://semiwiki.com/feed/" },
  { name: "Data Center Knowledge", url: "https://www.datacenterknowledge.com/rss.xml" },
  { name: "Engadget", url: "https://www.engadget.com/rss.xml" },
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

const SYSTEM_PROMPT = `You evaluate news items for a curated dataset of AI-infrastructure deals.

A deal QUALIFIES only if ALL are true:
1. It's an AI-related transaction in one of these types: ${DEAL_TYPES.join(", ")}.
2. BOTH the source (provider/seller/investor) and target (recipient/buyer) match a company in the supplied list — by slug, name, or ticker.
3. The news item explicitly describes a real, recent deal — not a rumor, a tweet, a stock price move, an analyst note, or an inference.
4. The deal has a clear direction (who is the source, who is the target).

If it does NOT qualify, respond with: {"qualified": false, "reason": "<short reason>"}

If it DOES qualify, respond with:
{
  "qualified": true,
  "deal": {
    "id": "<kebab-case unique id, e.g. nvda-xai-gpu-2026>",
    "source_slug": "<slug from list>",
    "target_slug": "<slug from list>",
    "deal_type": "<one of the listed types>",
    "value_billions": <number in USD billions, or null>,
    "value_display": "<short human string like '$5B' or '~$1.2B (est.)' or null>",
    "date": "<YYYY-MM>",
    "date_display": "<e.g. 'May 2026'>",
    "description": "<one factual sentence, no speculation>",
    "source_url": "<the article URL>"
  }
}

Direction matters: source = who provides/sells/invests; target = who receives/buys.
Use only slugs from the list. Output JSON only, no prose.`;

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

  if (!res.ok) {
    throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned no content");
  return JSON.parse(content);
}

const newDeals = [];
const skipped = []; // { item, reason }
const candidatesForNewCompany = []; // potentially relevant but mentions a non-existent company

for (const c of candidates) {
  if (newDeals.length >= MAX_NEW_DEALS) {
    skipped.push({ ...c, reason: `cap reached (${MAX_NEW_DEALS})` });
    continue;
  }

  let result;
  try {
    result = await callLLM(c);
  } catch (e) {
    skipped.push({ ...c, reason: `LLM error: ${e.message}` });
    continue;
  }

  if (!result.qualified) {
    // If the reason mentions an unknown company, surface it as a candidate for
    // manual review (still don't add it — strict scope).
    const reason = result.reason || "not qualified";
    if (/not in|missing|unknown|new compan/i.test(reason)) {
      candidatesForNewCompany.push({ ...c, reason });
    } else {
      skipped.push({ ...c, reason });
    }
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
  if (!companyBySlug.has(d.source_slug) || !companyBySlug.has(d.target_slug)) {
    skipped.push({
      ...c,
      reason: `unknown slug: ${d.source_slug} or ${d.target_slug}`,
    });
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

  const src = companyBySlug.get(d.source_slug);
  const tgt = companyBySlug.get(d.target_slug);
  const dealYaml = {
    id: d.id,
    source_slug: d.source_slug,
    source_name: src.name,
    target_slug: d.target_slug,
    target_name: tgt.name,
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
    `[+] ${d.id} — ${src.name} → ${tgt.name} (${d.deal_type}, ${d.value_display || "$$ undisclosed"})`,
  );
}

// ─── Write PR body summary ─────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const lines = [
  `## Weekly deal discovery — ${today}`,
  ``,
  `**Added ${newDeals.length} deal(s)** · considered ${candidates.length} RSS items · skipped ${skipped.length} · ${candidatesForNewCompany.length} candidate(s) mention new companies`,
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

if (candidatesForNewCompany.length > 0) {
  lines.push(`### 🆕 Mentions of companies not yet in the dataset`);
  lines.push(`_Consider adding these companies manually if relevant._`);
  lines.push("");
  for (const c of candidatesForNewCompany.slice(0, 15)) {
    lines.push(`- [${c.title}](${c.link}) — ${c.reason}`);
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
    `| Skipped (not a deal / not in scope) | ${skipped.length} |`,
    `| Mentions of new companies (manual review) | ${candidatesForNewCompany.length} |`,
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

  if (candidatesForNewCompany.length > 0) {
    sum.push(`## 🆕 News mentioning new (out-of-dataset) companies`);
    for (const c of candidatesForNewCompany.slice(0, 10)) {
      sum.push(`- [${c.title}](${c.link})`);
    }
    sum.push(``);
  }

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, sum.join("\n"));
}
