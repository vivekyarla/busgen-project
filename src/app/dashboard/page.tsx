import type { Metadata } from "next";
import Link from "next/link";
import { loadGraph } from "@/lib/data/load";
import { loadFinancials } from "@/lib/data/financials";
import { loadLayerContent } from "@/lib/data/layer-content";
import { computeLayerStats, computeLayerDetails } from "@/lib/data/dashboard";
import { loadSectorIndices } from "@/lib/data/sectorIndices.server";
import { LAYER_ORDER, type Layer } from "@/lib/data/layers";
import LayerTable from "@/components/dashboard/LayerTable";

export const metadata: Metadata = {
  title: "Layer dashboard — Situational Unawareness",
  description:
    "Per-layer market data and deal velocity across the AI stack — where capital is moving vs. where the market has already re-rated.",
};

function fmtCapUsd(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ layer?: string }>;
}) {
  const { layer: layerParam } = await searchParams;
  const initialOpen = LAYER_ORDER.includes(layerParam as Layer)
    ? (layerParam as Layer)
    : null;

  const data = loadGraph();
  const fin = loadFinancials();
  const sectors = loadSectorIndices();
  const content = loadLayerContent();
  const details = computeLayerDetails(data);
  // Financials come from the broad index universe; deal velocity from the map.
  const stats = computeLayerStats(data, sectors.layers, fin.quotes);

  // Headline numbers count only layers that actually carry market data.
  const financialStats = stats.filter((s) => s.trackedCount > 0);
  const tracked = financialStats.reduce((s, r) => s + r.trackedCount, 0);
  const totalCap = financialStats.reduce(
    (s, r) => s + (r.totalMarketCapUsd ?? 0),
    0,
  );
  const returns = stats
    .map((s) => s.medianReturn1y)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  const medianOfReturns = returns.length
    ? returns[Math.floor(returns.length / 2)]
    : null;

  const asOf = fin.generatedAt
    ? new Date(fin.generatedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-full w-full">
      <header className="sticky top-0 z-10 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">
            Situational Unawareness
          </p>
          <Link
            href="/"
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            ← Back to the map
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
          Layer dashboard
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Where Capital is Moving
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Every layer of the stack, side by side: deal velocity (the leading
          signal from the map) against valuation and returns (the lagging
          market read). Click a layer to open its index, holdings, and what to
          watch.
        </p>

        {/* Summary stats */}
        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800/40 sm:grid-cols-4">
          <SummaryStat label="Tracked companies" value={String(tracked)} />
          <SummaryStat label="Total market cap" value={fmtCapUsd(totalCap)} />
          <SummaryStat
            label="Deal touches (12mo)"
            value={String(stats.reduce((s, r) => s + r.deals12mo, 0))}
          />
          <SummaryStat label="Layers" value={String(stats.length)} />
        </div>

        {/* Layer table — click a row to expand its index + drill-down */}
        <div className="mt-6">
          <LayerTable
            stats={stats}
            medianOfReturns={medianOfReturns}
            indices={sectors.layers}
            details={details}
            content={content}
            initialOpen={initialOpen}
          />
        </div>

        <div className="mt-6 space-y-1.5 text-xs leading-relaxed text-zinc-600">
          <p>
            <span className="text-zinc-400">Momentum</span> = deals touching the
            layer in the trailing 12 months minus the prior 12 months.{" "}
            <span className="text-zinc-400">Read</span> is a heuristic: an
            accelerating layer whose 1-year return trails the cross-layer median
            is flagged <span className="text-emerald-400">Early?</span> — a
            prompt to investigate, not a recommendation. Expanded rows show the
            layer as a synthetic cap-weighted index (rebased to 100 at each
            window&rsquo;s start; currency cancels out via price ratios).
          </p>
          <p>
            Deal velocity is computed from the curated map; per-layer financials
            come from a broader public universe of {tracked} tracked tickers,
            most of which never appear on the map. Market data
            {asOf ? ` as of ${asOf}` : ""} · source: {fin.source} · market caps
            converted to USD at snapshot FX. Re-run{" "}
            <code className="text-zinc-500">npm run fetch:financials</code> and{" "}
            <code className="text-zinc-500">npm run fetch:history</code> to
            refresh.
          </p>
        </div>
      </main>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-950 px-4 py-4">
      <div className="font-mono text-xl text-zinc-100">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </div>
  );
}
