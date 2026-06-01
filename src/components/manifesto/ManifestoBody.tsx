"use client";

import { useState } from "react";
import Link from "next/link";
import MethodologyPanel from "../graph/MethodologyPanel";

/**
 * The manifesto article. Core argument is static prose; the heavier material
 * (backtest table, data caveats, the live ranking's failure modes) is tucked
 * into inline disclosures, and the scoring method opens the shared methodology
 * modal. Two small inline charts carry the result.
 */
export default function ManifestoBody() {
  const [showMethod, setShowMethod] = useState(false);

  return (
    <article className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
        Manifesto
      </p>
      <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-5xl">
        Situational Unawareness
      </h1>

      {/* ── Intro ── */}
      <div className="mt-7 space-y-5 text-lg leading-relaxed text-zinc-300">
        <p>
          The most load-bearing idea in AI right now is that the future is
          already legible. <em>Situational Awareness</em>, the 2024 essay that
          named the era, argued that a small circle in San Francisco could see
          what was coming just by taking the compute trendlines seriously. On
          the big thing, they were right. AI scaled, and believing the chart
          paid.
        </p>
        <p>
          But reading the model is not the same as reading the supply chain.
          Consensus prices AI&rsquo;s future off two variables, compute and
          memory, and quietly assumes the rest of the stack shows up on time. It
          won&rsquo;t, not all of it, not at once. The constraints that decide
          the next phase are forming several layers down, in raw materials,
          interconnect, power, and the capital that wires them together. Most of
          them are sitting in public deal flow long before they reach a price.
        </p>
        <p>
          We call that blind spot Situational Unawareness: what you miss when
          you watch the frontier so closely you stop watching the ground it
          stands on. This is a map of the blind spot.
        </p>
      </div>

      {/* ── The bet ── */}
      <Section title="The bet">
        <p>
          Deal flow leads, public valuation lags. When capital and capacity pile
          onto a layer faster than the market reprices it, that layer is the
          next bottleneck: the next GPUs, the next HBM. The edge was never
          predicting that AI gets bigger. It is knowing <em>which layer</em>{" "}
          binds next, while the multiple still says otherwise.
        </p>
      </Section>

      {/* ── What this is ── */}
      <Section title="What this is">
        <p>
          We scraped public announcements of deals between companies and drew an
          edge for every one. The result is the AI economy as a graph, stacked
          across six layers from Capital at the floor to Application at the top,
          with the timeline replaying how the web thickened from 2020 to now.
          It&rsquo;s meant to be wandered through.
        </p>
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Link
            href="/"
            className="font-medium text-zinc-200 underline-offset-4 hover:underline"
          >
            Open the map →
          </Link>
          <Link
            href="/dashboard"
            className="font-medium text-zinc-200 underline-offset-4 hover:underline"
          >
            See the layer dashboard →
          </Link>
        </p>
        <Disclosure summary="On the data, and what it can't see">
          <p>
            This is a high-level read by necessity. Granular supply-chain data
            (who actually ships what to whom, in what volume) is expensive and
            slow to assemble, so we use a company&rsquo;s public deal count as a
            proxy for how entrenched it is. That is directional, not gospel: it
            sees announced partnerships, not private ones, and it over-weights
            companies that issue press releases. Six layers, eight deal types,
            announced deals only.
          </p>
        </Disclosure>
      </Section>

      {/* ── The indicator ── */}
      <Section title="The indicator">
        <p>
          To find the next bottleneck we score each supply-side company on three
          things and multiply them: how fast deals are converging on it, how
          little the market has already repriced it, and whether the demand
          behind it is real rather than just a cheap stock. High only when all
          three line up.
        </p>
        <p>
          <button
            onClick={() => setShowMethod(true)}
            className="text-sm font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-4 hover:decoration-zinc-300"
          >
            How the score works ⓘ
          </button>
        </p>
      </Section>

      {/* ── The test ── */}
      <Section title="The test">
        <p>
          The only honest test of a predictor is whether it would have called
          something <em>before</em> it happened. So we froze the model in
          January 2025, fed it nothing but deals and prices from on or before
          that date, and asked for the next bottleneck. It put SK&nbsp;Hynix
          third, at a moment the stock had gone nowhere for a year.
        </p>
        <HynixChart />
        <p>
          Then memory became the story, and it ran about twelve-fold. As it ran,
          its score decayed toward zero. The model goes quiet exactly when the
          trade becomes consensus, which is the point.
        </p>
        <Disclosure summary="See the backtest (no look-ahead)">
          <p className="mb-3">
            Point-in-time, re-scored as of each date using only deals and prices
            available then. The January 2025 run saw SK&nbsp;Hynix at ₩187,853,
            not the post-run number.
          </p>
          <BacktestTable />
          <p className="mt-3 text-zinc-500">
            Honest caveat: our company universe was assembled with hindsight, so
            this shows the <em>mechanism</em> works through a real repricing, not
            an out-of-sample track record. The demand signal is held out of the
            historical runs because it reflects what we know today.
          </p>
        </Disclosure>
      </Section>

      {/* ── Where it points now ── */}
      <Section title="Where it points now">
        <p>
          Run it on today&rsquo;s data and the signal has moved off the chips.
          The highest scores cluster around the buildout&rsquo;s physical limits,
          and the cleanest <em>unrepriced</em> weight is in power: the megawatts
          to run the data centers, not the GPUs inside them.
        </p>
        <BottleneckBars />
        <Disclosure summary="Read the ranking honestly">
          <p>
            CoreWeave tops the raw score, but it is the model&rsquo;s known weak
            spot: a financing intermediary whose deal flow reflects circular
            capital as much as scarce supply. The gap term reads
            &ldquo;underperformed,&rdquo; which demand confirmation only partly
            corrects, and the whole thing only sees what&rsquo;s in the deal
            data. Treat it as a place to point a flashlight, not a buy list. The{" "}
            <Link
              href="/dashboard"
              className="text-zinc-300 underline underline-offset-2 hover:text-zinc-100"
            >
              dashboard
            </Link>{" "}
            has the live, per-layer version.
          </p>
        </Disclosure>
      </Section>

      {/* ── Close ── */}
      <Section title="The takeaway">
        <p>
          Every buildout has a layer the story skips over until it&rsquo;s the
          only thing that matters. Last cycle it was memory, and almost nobody
          watching the frontier was looking at DRAM. This cycle the smart money
          says compute. The deals say power.
        </p>
        <p className="text-zinc-200">
          Situational Awareness watches the frontier. We built this to watch the
          floor it stands on, and to make the next bottleneck impossible to miss
          while it&rsquo;s still cheap to see.
        </p>
      </Section>

      <hr className="my-14 border-zinc-900" />
      <p className="text-sm text-zinc-600">
        A class project. Deal graph hand-curated from public announcements;
        prices and per-layer financials from public market data. Numbers are
        estimates, the method is the message.
      </p>

      {showMethod && <MethodologyPanel onClose={() => setShowMethod(false)} />}
    </article>
  );
}

/* ────────────────────────── inline charts ────────────────────────── */

// SK Hynix monthly close (₩), Jun 2024 → Jun 2026, from data/prices.json.
const HYNIX: [string, number][] = [
  ["Jun24", 191879],
  ["Jul", 171272],
  ["Aug", 172159],
  ["Sep", 184001],
  ["Oct", 157926],
  ["Nov", 171754],
  ["Dec", 196741],
  ["Jan25", 187853], // ← flagged #3 here
  ["Feb", 189564],
  ["Mar", 176443],
  ["Apr", 203282],
  ["May", 290785],
  ["Jun", 272362],
  ["Jul", 267881],
  ["Aug", 346554],
  ["Sep", 557478],
  ["Oct", 528557],
  ["Nov", 649692],
  ["Dec", 907174],
  ["Jan26", 1058869],
  ["Feb", 806865],
  ["Mar", 1285785],
  ["Apr", 2332610],
  ["Jun", 2335000],
];
const HYNIX_FLAGGED = 7;

function HynixChart() {
  const W = 520;
  const H = 150;
  const padL = 6;
  const padR = 6;
  const padT = 22;
  const padB = 18;
  const vals = HYNIX.map((d) => d[1]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const n = HYNIX.length;
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) =>
    H - padB - ((v - min) / (max - min)) * (H - padB - padT);
  const line = HYNIX.map(
    (d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[1]).toFixed(1)}`,
  ).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${H - padB} L${x(0).toFixed(1)},${H - padB} Z`;

  return (
    <figure className="my-6">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="SK Hynix monthly share price from mid-2024 to 2026, flagged in January 2025 then up roughly twelvefold"
      >
        <defs>
          <linearGradient id="hy" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#hy)" />
        <path d={line} fill="none" stroke="#34d399" strokeWidth="1.5" />
        {/* flagged marker */}
        <line
          x1={x(HYNIX_FLAGGED)}
          x2={x(HYNIX_FLAGGED)}
          y1={padT - 8}
          y2={H - padB}
          stroke="#a1a1aa"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.5"
        />
        <circle
          cx={x(HYNIX_FLAGGED)}
          cy={y(HYNIX[HYNIX_FLAGGED][1])}
          r="3"
          fill="#fafafa"
        />
        <text
          x={x(HYNIX_FLAGGED) + 5}
          y={padT - 2}
          fontSize="9"
          fill="#d4d4d8"
          fontFamily="monospace"
        >
          flagged · Jan &rsquo;25 · #3
        </text>
        <text
          x={x(n - 1)}
          y={y(HYNIX[n - 1][1]) - 5}
          fontSize="10"
          fill="#34d399"
          fontFamily="monospace"
          textAnchor="end"
        >
          ≈12× ↑
        </text>
      </svg>
      <figcaption className="mt-1 flex justify-between font-mono text-[10px] text-zinc-600">
        <span>SK Hynix · ₩ · Jun &rsquo;24</span>
        <span>Jun &rsquo;26</span>
      </figcaption>
    </figure>
  );
}

type BLayer = "compute" | "power";
const BOTTLE: { name: string; score: number; layer: BLayer }[] = [
  { name: "CoreWeave", score: 100, layer: "compute" },
  { name: "IREN", score: 49, layer: "compute" },
  { name: "Constellation Energy", score: 34, layer: "power" },
  { name: "AMD", score: 28, layer: "compute" },
  { name: "Brookfield Renewable", score: 20, layer: "power" },
];
const B_COLOR: Record<BLayer, string> = {
  compute: "#60a5fa",
  power: "#34d399",
};

function BottleneckBars() {
  return (
    <figure className="my-6">
      <div className="space-y-2">
        {BOTTLE.map((d) => (
          <div key={d.name} className="flex items-center gap-3 text-xs">
            <span className="w-36 shrink-0 truncate text-zinc-300">
              {d.name}
            </span>
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${d.score}%`, background: B_COLOR[d.layer] }}
              />
            </span>
            <span className="w-7 shrink-0 text-right font-mono text-zinc-400">
              {d.score}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="mt-2.5 flex items-center gap-4 font-mono text-[10px] text-zinc-600">
        <span className="flex items-center gap-1.5">
          <Dot c={B_COLOR.compute} /> compute
        </span>
        <span className="flex items-center gap-1.5">
          <Dot c={B_COLOR.power} /> power
        </span>
        <span className="ml-auto">bottleneck score · today</span>
      </figcaption>
    </figure>
  );
}

function Dot({ c }: { c: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: c }}
    />
  );
}

function BacktestTable() {
  const rows = [
    ["Jun 2024", "#5", "tracking market"],
    ["Jan 2025", "#3", "flat for a year"],
    ["Jun 2025", "#10", "gap closing, +188%"],
    ["2026", "—", "priced in, score 0"],
  ];
  return (
    <table className="w-full border-collapse text-left text-xs">
      <thead>
        <tr className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          <th className="py-1 pr-3 font-normal">As of</th>
          <th className="py-1 pr-3 font-normal">Rank</th>
          <th className="py-1 font-normal">SK Hynix vs. market</th>
        </tr>
      </thead>
      <tbody className="text-zinc-400">
        {rows.map((r) => (
          <tr key={r[0]} className="border-t border-zinc-800/70">
            <td className="py-1.5 pr-3 font-mono text-zinc-300">{r[0]}</td>
            <td className="py-1.5 pr-3 font-mono">{r[1]}</td>
            <td className="py-1.5">{r[2]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ────────────────────────── layout helpers ────────────────────────── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      <div className="mt-4 space-y-5 text-base leading-relaxed text-zinc-300">
        {children}
      </div>
    </section>
  );
}

function Disclosure({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-zinc-300">{summary}</span>
        <span
          className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="border-t border-zinc-800 px-4 py-3 text-sm leading-relaxed text-zinc-400">
          {children}
        </div>
      )}
    </div>
  );
}
