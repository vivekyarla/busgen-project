# Adding deals & companies — the dataset behind the map

This folder is the **single source of truth** for the Situational Unawareness
map. Edit files here, commit, push — Vercel redeploys and the change is live.
No build step, no database, no submodule.

- `companies.yml` — every company (node on the map). One YAML list.
- `deals/*.yml` — one file per deal (edge between two companies).

When a teammate says *"add the NVIDIA–xAI deal"*, follow the steps below.

---

## How to add a deal

1. **Make sure both companies exist** in `companies.yml` (match by `slug`). If
   either is missing, add it first (see "Adding a new company" below). A deal
   that references a slug not in `companies.yml` still renders, but as a bare
   "synthetic" node with no ticker/layer info — avoid that.
2. **Create a new file** `deals/<source>-<target>-<type>-<year>.yml`. The
   filename is just a convention; what matters is a unique `id`.
3. Fill in the fields (template below). `id` must be unique across all deals —
   use the filename without `.yml`.
4. **Verify**: run `npm run dev` (or `npm run build`) from the repo root and
   open the map. The header company/deal counts should go up, and there must be
   **no `[data] skipping malformed deal: …`** warning in the terminal (that
   means a schema error). Search the company to confirm the new edge.

### Deal file template

```yaml
id: nvda-xai-colossus-2025          # unique; match the filename
source_slug: nvidia                  # who gives / sells / invests (must exist)
source_name: NVIDIA                  # display name
target_slug: xai                     # who receives / buys (must exist)
target_name: xAI
deal_type: gpu_purchase              # see deal types below
value_billions: 5                    # number in USD billions; 0.221 = $221M; null if unknown
value_display: ~$5B (est.)           # human string shown in the panel; null if unknown
date: "2025-07"                      # "YYYY-MM" — REQUIRED format (quotes matter)
date_display: Jul 2025               # human string
description: >-
  One or two sentences on what the deal is and why it matters. Plain text;
  this shows in the node detail panel.
source_url: https://example.com/...  # link to a credible source
```

- **Direction matters**: `source → target` is the flow (supplier → customer,
  investor → investee). The map animates particles along this direction.
- `value_billions` is a **number in billions**: `12` = $12B, `0.5` = $500M,
  `null` if undisclosed.
- `date` **must** be `"YYYY-MM"` (quoted). The time slider parses it; a bad date
  makes the deal "undated" (always shown, never animated in).

### Deal types (`deal_type`)

Use one of these existing values (don't invent new ones without reason):

| value | meaning |
|-------|---------|
| `gpu_purchase` | buying GPUs/accelerators |
| `custom_asic` | custom silicon design/supply (e.g. TPUs, Trainium) |
| `cloud_capacity` | compute/cloud capacity commitment |
| `equity_investment` | equity stake / strategic investment |
| `equipment_supply` | fab equipment, memory, components |
| `power_ppa` | power purchase agreement / energy |
| `m_and_a` | acquisition |
| `funding_round` | venture/financing round |

If you genuinely need a new deal type, add a label for it in
`src/lib/data/filter.ts` → `DEAL_TYPE_META` so the filter UI shows a nice name.

---

## Adding a new company (and getting it on the right layer)

Append an entry to `companies.yml`:

```yaml
- slug: xai                          # unique, lowercase-hyphenated id
  name: xAI                          # display name
  ticker: null                       # stock ticker, or null if private
  category: ai_lab                   # drives the layer (table below)
  subline: "Grok; Colossus cluster"  # optional one-line tagline
  # layer: application               # OPTIONAL — only set to override the category mapping
```

The company's **layer** (which horizontal plane it sits on) is decided by its
`category` via this mapping:

| layer | categories |
|-------|------------|
| **application** | `ai_lab` |
| **compute** | `chip_designer`, `hyperscaler`, `neocloud`, `data_center`, `server_oem` |
| **networking** | `networking` |
| **raw_materials** | `foundry`, `equipment`, `memory`, `packaging` |
| **power** | `power` |
| **capital** | `investor` |

Pick the `category` that best fits and the company lands on the right layer
automatically. **Two escape hatches if nothing fits:**

1. **Quick (no code):** set an explicit `layer:` field on the company (one of
   `application | compute | networking | raw_materials | power | capital`). It
   overrides the category mapping. Use this for a one-off oddball.
2. **Proper (if it's a recurring kind of company):** add the new `category →
   layer` pair to `CATEGORY_TO_LAYER` in `src/lib/data/layers.ts`.

Unknown categories with no explicit layer fall back to **compute** — so always
double-check the new node landed where you expect.

---

## Rules of thumb / gotchas

- **Slugs are the join key.** A deal's `source_slug`/`target_slug` must exactly
  match a company `slug`. Typos create phantom nodes.
- **One deal per file** keeps PRs clean and avoids merge conflicts — never batch
  many deals into one file.
- **Don't duplicate `id`s.** Two deals with the same `id` will collide.
- **`null` is fine** for `ticker`, `value_billions`, `value_display` when truly
  unknown — but a real value is always better.
- **Verify before pushing**: `npm run build` from the repo root. It validates
  every record; watch for `[data] skipping …` warnings and check the on-map
  counts. If it builds clean and the node/edge appear, you're good to commit.
- Keep `description` factual and sourced — this is a class project making an
  argument; credibility matters.

---

## The Opportunity Indicator (bottleneck score)

The "Bottleneck" color mode scores each node by `DealVelocity × UnrealizedGap`:
- **DealVelocity** — recency-weighted inbound deal activity (from the deal data).
- **UnrealizedGap** — `1 − (stock return vs S&P since the node's first deal)`,
  clamped. Public companies with a `ticker` are measured; private / no-ticker
  nodes are "unmeasured" and get a modest default gap.
- **Supply-side only** — bottlenecks are supply constraints, so only the
  `compute`, `networking`, `raw_materials`, and `power` layers are scored. The
  `application` (demand) and `capital` (finance) layers score 0 even when their
  deal velocity is high (so a hot demand sink like OpenAI isn't flagged as a
  bottleneck). See `BOTTLENECK_LAYERS` in `src/lib/data/score.ts`.

Prices live in **`data/prices.json`** (monthly adjusted closes + S&P benchmark).
Refresh them with:

```
npm run refresh-prices
```

That fetches every ticker in `companies.yml` from Yahoo Finance (no key) and
rewrites the JSON — commit it. The app reads the cached file at build time, so
scoring is deterministic (no live API on the demo). Re-run it periodically (or
after adding tickers) to keep returns current. Tuning constants
(`TAU`, `R_STAR`, `UNMEASURED_GAP`) live in `src/lib/data/score.ts`.

---

## Editing layer deep-dives

Clicking a layer label (or its ⓘ in the control panel) opens a deep-dive
pop-up. Its prose + market sizing live in **`data/layers.yml`** — one block per
layer id (`application`, `compute`, `networking`, `raw_materials`, `power`,
`capital`), each with `tagline`, `market_size`, `market_size_note`, `summary`,
`interconnect`, and `watch`. The stats, cross-layer flow chips, and
"recent developments" feed are derived from the deal data automatically — only
the prose is hand-edited here. Edit, commit, push.

---

## Automated weekly discovery

A GitHub Action (`.github/workflows/weekly-deals.yml`) runs every **Sunday at
14:00 UTC (6 AM PT)** and:

1. Pulls recent items from a curated set of tech-news RSS feeds.
2. Calls GitHub Models (gpt-4o-mini, no API key needed — uses the workflow's
   built-in token) to judge each item on two things: *is it a real AI-stack
   deal*, and *do the companies belong on the map*.
3. Writes valid new deals into `data/deals/*.yml`. **If a deal involves a
   company not yet in the dataset, the bot evaluates whether it genuinely
   belongs on the AI-infra map and, if so, adds it to `companies.yml` on the
   correct layer** (it picks the category + layer from the taxonomy above).
   Companies that are merely tangential / non-infra are rejected.
4. Runs `npm run build` as a sanity check.
5. Opens a **pull request** labeled `automation` + `needs-review`.

The PR is **never auto-merged.** Every weekly run is a draft you read,
fix/reject as needed, and merge if accurate. The PR body lists each added deal
with its source URL, and **separately highlights any newly-added companies**
(slug, layer, category, source) so you can scrutinize those especially — a
wrong new company is the most likely thing to need fixing.

To trigger a run on-demand (e.g. before a class presentation): go to the
repo's **Actions** tab → "Weekly deal discovery" → "Run workflow."

**Tuning knobs** are at the top of `scripts/discover-deals.mjs`:
`LOOKBACK_DAYS`, `MAX_NEW_DEALS`, the `FEEDS` list, and the `MODEL`. Add new
RSS sources by appending to `FEEDS`.
