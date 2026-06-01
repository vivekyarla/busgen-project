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
              Three things have to be true at once: money is pouring in, the
              market hasn&rsquo;t woken up yet, and the demand is actually real.
              Miss any one of them and the score collapses.
            </p>
          </div>

          {/* Term cards */}
          <div className="space-y-3 p-5">
            <Card color={VEL} title="Deal Velocity" plain="How hard recent deal flow is pointing at one company.">
              We add up every deal a company touches, the ones it buys and the
              ones it sells. Recent deals count for more (the weight roughly halves
              every 18 months), and bigger deals count for more. Then we scale it 0
              to 100 across the map. Outbound counts as much as inbound: when
              everyone is buying from you, that pull is the signal, not just the
              cash flowing in.
            </Card>
            <Card color={GAP} title="Unrealized Gap" plain="How much the market still hasn't priced in.">
              <code className="text-zinc-300">
                1 − (stock return − S&amp;P return) ÷ 2
              </code>
              , measured from the company&rsquo;s first deal and capped between 0
              and 1. If a stock has already crushed the market (think NVIDIA,
              SK&nbsp;Hynix), the gap sits near 0. The story is out, everyone knows.
              No ticker means we can&rsquo;t measure it, so those default to 0.4.
            </Card>
            <Card color={DEM} title="Demand" plain="Is the demand real, or is the stock just cheap?">
              A 0 to 1 read from filings and news: backlog, &ldquo;sold
              out,&rdquo; book-to-bill, lead times. This is the line between{" "}
              <em>cheap because you can&rsquo;t make enough</em> (SK&nbsp;Hynix,
              sold out, 1.0) and <em>cheap because nobody&rsquo;s buying</em>
              (Intel&rsquo;s foundry, no outside backlog, 0.2). No signal either
              way lands at 0.45.
            </Card>
          </div>

          {/* How to read */}
          <div className="border-t border-zinc-800/70 px-5 py-4">
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              How to read it
            </h3>
            <p className="text-sm leading-relaxed text-zinc-400">
              Bright means deals are stacking up, the market hasn&rsquo;t caught
              on, and the demand checks out. That&rsquo;s your candidate for the
              next GPUs, the next HBM. Dark means either nothing is happening or
              it&rsquo;s already priced in. We only score the supply layers
              (compute, networking, raw materials, power). The demand and capital
              layers sit out, so a hungry buyer like OpenAI never gets flagged. It
              is the thing everyone wants, <em>not</em> the thing that&rsquo;s
              scarce.
            </p>
          </div>

          {/* Caveats */}
          <div className="border-t border-zinc-800/70 px-5 py-4">
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              What it&rsquo;s not
            </h3>
            <ul className="space-y-1.5 text-sm leading-relaxed text-zinc-500">
              <Bullet>
                It can over-rate the middlemen. CoreWeave looks busy, but a lot
                of that flow is circular financing, not scarce supply.
              </Bullet>
              <Bullet>
                A big gap just means the stock lagged. Demand sanity-checks that,
                but sometimes a cheap stock is cheap for a good reason.
              </Bullet>
              <Bullet>
                Demand is a first pass from public sources, editable by hand.
                Treat it as directional, not gospel.
              </Bullet>
              <Bullet>
                It only knows what&rsquo;s in the deal data. Thinly covered
                corners like the grid and transformers are under-represented.
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
