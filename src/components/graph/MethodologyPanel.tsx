"use client";

import { useEffect } from "react";

const VEL = "#60a5fa"; // blue
const GAP = "#fbbf24"; // amber
const DEM = "#34d399"; // green

/**
 * Explainer overlay for the Opportunity Indicator. Constants in the copy mirror
 * src/lib/data/score.ts (TAU 18mo, R_STAR 2.0, unmeasured gap 0.4, default
 * demand 0.45) — kept as plain text so this client component doesn't import the
 * server-only score module.
 */
export default function MethodologyPanel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 p-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Methodology
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-zinc-50">
              The Opportunity Indicator
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Formula hero */}
          <div className="border-b border-zinc-800/70 bg-zinc-900/30 px-5 py-6 text-center">
            <p className="text-sm text-zinc-400">
              Which layer of the stack is the <em>next</em> bottleneck?
            </p>
            <p className="mt-3 font-mono text-sm sm:text-base">
              <span className="text-zinc-500">Score = </span>
              <span style={{ color: VEL }}>Deal&nbsp;Velocity</span>
              <span className="text-zinc-600"> × </span>
              <span style={{ color: GAP }}>Unrealized&nbsp;Gap</span>
              <span className="text-zinc-600"> × </span>
              <span style={{ color: DEM }}>Demand</span>
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-zinc-500">
              A node scores high only when all three line up: capital is rushing
              in, the market hasn&rsquo;t repriced it yet, and the demand is real.
            </p>
          </div>

          {/* Term cards */}
          <div className="space-y-3 p-5">
            <Card color={VEL} title="Deal Velocity" plain="How much recent deal flow is converging on this company.">
              Recency-weighted sum of every deal it&rsquo;s party to (inbound +
              outbound), decaying with a ~18-month half-scale and boosted by deal
              size. Normalized 0–100 across the map. Counting outbound matters: a
              supplier&rsquo;s signal is the demand pulling on its output, not just
              capital flowing in.
            </Card>
            <Card color={GAP} title="Unrealized Gap" plain="How little the public market has already priced it in.">
              <code className="text-zinc-300">
                1 − (stock return − S&amp;P return) ÷ 2
              </code>
              , measured since the company&rsquo;s first deal and clamped to 0–1. A
              name that has crushed the market (NVIDIA, SK&nbsp;Hynix) → gap ≈ 0
              (the story is priced in). Private / no-ticker companies can&rsquo;t be
              measured, so they default to 0.4.
            </Card>
            <Card color={DEM} title="Demand" plain="Whether real demand is confirmed — not just a cheap stock.">
              A 0–1 signal from filings & news (backlog, &ldquo;sold out,&rdquo;
              book-to-bill, lead times). It separates <em>cheap because
              constrained</em> (SK&nbsp;Hynix, sold out → 1.0) from <em>cheap
              because struggling</em> (Intel foundry, no external backlog → 0.2).
              Absent → 0.45.
            </Card>
          </div>

          {/* How to read */}
          <div className="border-t border-zinc-800/70 px-5 py-4">
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              How to read it
            </h3>
            <p className="text-sm leading-relaxed text-zinc-400">
              Bright = a supply node where deals are piling up, the market
              hasn&rsquo;t caught up, and demand is confirmed — a candidate for the
              next GPUs / next HBM. Dark = either nothing&rsquo;s happening, or
              it&rsquo;s already priced in. Only the supply layers (compute,
              networking, raw materials, power) are scored; the application
              (demand) and capital (finance) layers are excluded, so a hot buyer
              like OpenAI is correctly <em>not</em> flagged as a bottleneck.
            </p>
          </div>

          {/* Caveats */}
          <div className="border-t border-zinc-800/70 px-5 py-4">
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              What it&rsquo;s not
            </h3>
            <ul className="space-y-1.5 text-sm leading-relaxed text-zinc-500">
              <Bullet>
                It can over-rate financial intermediaries (e.g. CoreWeave) whose
                deal flow reflects circular financing more than scarce supply.
              </Bullet>
              <Bullet>
                The gap reads &ldquo;underperformed&rdquo; — demand confirmation
                tempers that, but a low stock can still mean justified pessimism.
              </Bullet>
              <Bullet>
                Demand values are a first-pass read from public sources, hand-
                editable — directional, not gospel.
              </Bullet>
              <Bullet>
                It only sees what&rsquo;s in the deal data; thinly-covered layers
                (grid, transformers) are under-represented.
              </Bullet>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  color,
  title,
  plain,
  children,
}: {
  color: string;
  title: string;
  plain: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-4">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: color }}
        />
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      </div>
      <p className="mt-1 text-xs font-medium text-zinc-300">{plain}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{children}</p>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
      <span>{children}</span>
    </li>
  );
}
