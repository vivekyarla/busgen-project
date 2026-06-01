"use client";

import { useState } from "react";
import Link from "next/link";
import {
  WINDOW_KEYS,
  type SectorIndex,
  type WindowKey,
} from "@/lib/data/sectorIndices";
import { LAYER_META, type Layer } from "@/lib/data/layers";
import type { LayerContent } from "@/lib/data/layer-content";
import type { LayerDetail } from "@/lib/data/dashboard";
import { dealTypeLabel } from "@/lib/data/filter";
import { useCompanyHistory } from "@/lib/data/useCompanyHistory";
import TraceChart from "./TraceChart";
import CompanyChart from "./CompanyChart";

function fmtPct(frac: number | null | undefined, digits = 1): string {
  if (frac == null) return "—";
  const pct = frac * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(digits)}%`;
}

function fmtCapUsd(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

function fmtValue(v: number | null): string {
  if (v == null || v === 0) return "—";
  if (v >= 1) return `$${v.toFixed(v >= 10 ? 0 : 1)}B`;
  return `$${Math.round(v * 1000)}M`;
}

export default function SectorDetail({
  layer,
  index,
  detail,
  content,
}: {
  layer: Layer;
  index?: SectorIndex;
  detail?: LayerDetail;
  content?: LayerContent;
}) {
  const meta = LAYER_META[layer];

  // Window state for the cap-weighted index (hooks must run unconditionally).
  const [win, setWin] = useState<WindowKey>(() => {
    if (!index) return "1Y";
    const av = WINDOW_KEYS.filter((k) => index.windows[k]);
    return av.includes("1Y") ? "1Y" : (av[av.length - 1] ?? "1Y");
  });
  const w = index?.windows[win];

  // Per-holding expandable price charts (history fetched lazily on first open).
  const [openTicker, setOpenTicker] = useState<string | null>(null);
  const { companies, error: histError } = useCompanyHistory(openTicker != null);

  const hasFlows = !!detail && (detail.flowsIn.length > 0 || detail.flowsOut.length > 0);

  return (
    <div className="space-y-6 px-4 py-5">
      {/* ── Editorial: what this layer is + market sizing ── */}
      {(content || detail) && (
        <div>
          {content?.tagline && (
            <p className="text-sm text-zinc-300">{content.tagline}</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-800/40 sm:grid-cols-4">
            {content?.market_size && (
              <MiniStat
                label="Market size"
                value={content.market_size}
                note={content.market_size_note}
              />
            )}
            {detail && (
              <MiniStat label="Deals" value={String(detail.dealCount)} />
            )}
            {detail && (
              <MiniStat
                label="Inbound value"
                value={fmtValue(detail.inboundValue)}
              />
            )}
            {index && (
              <MiniStat
                label="Holdings"
                value={String(index.constituents.length)}
              />
            )}
          </div>
          {content?.summary && (
            <Section title="The industry">
              <p>{content.summary}</p>
            </Section>
          )}
        </div>
      )}

      {/* ── Market index (cap-weighted) — only where we have public names ── */}
      {index ? (
        <div>
          <SectionHeading>Market index · cap-weighted</SectionHeading>
          {/* Window tabs + headline return */}
          <div className="mb-3 mt-2 flex items-center justify-between gap-2">
            <div className="flex rounded-md border border-zinc-800 p-0.5 text-xs">
              {WINDOW_KEYS.map((k) => {
                const has = !!index.windows[k];
                return (
                  <button
                    key={k}
                    disabled={!has}
                    onClick={() => setWin(k)}
                    className={`rounded px-2.5 py-1 font-mono transition-colors ${
                      win === k
                        ? "bg-zinc-200 text-zinc-900"
                        : has
                          ? "text-zinc-400 hover:text-zinc-100"
                          : "cursor-not-allowed text-zinc-700"
                    }`}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
            {w && (
              <div
                className={`font-mono text-lg ${w.indexReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}
              >
                {fmtPct(w.indexReturn)}
                <span className="ml-1 text-[10px] uppercase tracking-wider text-zinc-600">
                  {win}
                </span>
              </div>
            )}
          </div>

          {w ? (
            <>
              <TraceChart key={win} series={w.series} />
              <p className="mt-1 text-[10px] text-zinc-600">
                Hover to trace · press and drag across the chart to measure the %
                change between two points
              </p>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
                {w.best && (
                  <span className="text-zinc-500">
                    Top:{" "}
                    <span className="font-mono text-emerald-400">
                      {w.best} {fmtPct(w.returns[w.best])}
                    </span>
                  </span>
                )}
                {w.worst && w.worst !== w.best && (
                  <span className="text-zinc-500">
                    Laggard:{" "}
                    <span className="font-mono text-rose-400">
                      {w.worst} {fmtPct(w.returns[w.worst])}
                    </span>
                  </span>
                )}
                {w.includedCount < index.constituents.length && (
                  <span className="text-zinc-600">
                    {w.includedCount}/{index.constituents.length} holdings have{" "}
                    {win} history
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-xs text-zinc-600">
              No index data for this window.
            </p>
          )}

          {/* Holdings */}
          <div className="mt-4">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Holdings · cap-weighted
            </p>
            <div className="flex items-center gap-3 border-b border-zinc-800 px-1 pb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-600">
              <span className="w-14 shrink-0">Weight</span>
              <span className="min-w-0 flex-1">Company</span>
              <span className="w-16 shrink-0 text-right">Mkt cap</span>
              <span className="w-16 shrink-0 text-right">{win} ret</span>
            </div>
            <ul>
              {index.constituents.map((c) => {
                const ret = w?.returns[c.ticker];
                const isOpen = openTicker === c.ticker;
                const hist = companies?.[c.ticker];
                return (
                  <li
                    key={c.slug}
                    className="border-b border-zinc-800/40 last:border-0"
                  >
                    <button
                      onClick={() =>
                        setOpenTicker((cur) =>
                          cur === c.ticker ? null : c.ticker,
                        )
                      }
                      className={`flex w-full items-center gap-3 px-1 py-1.5 text-left text-xs hover:bg-zinc-900/50 ${
                        isOpen ? "bg-zinc-900/40" : ""
                      }`}
                    >
                      <span className="w-14 shrink-0">
                        <span className="font-mono text-[11px] text-zinc-400">
                          {c.weightPct.toFixed(1)}%
                        </span>
                        <span className="relative mt-0.5 block h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{
                              width: `${Math.min(100, c.weightPct)}%`,
                              background: meta.color,
                              opacity: 0.7,
                            }}
                          />
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-zinc-200">
                        <span
                          className={`shrink-0 text-[9px] text-zinc-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        >
                          ▾
                        </span>
                        <span className="truncate">{c.name}</span>
                        <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                          {c.ticker}
                        </span>
                        {c.limitedHistory && (
                          <span
                            title={`Listed ${c.firstDate ?? "recently"} — limited history; longer-window returns are unreliable`}
                            className="shrink-0 cursor-help text-amber-500/80"
                          >
                            ⚠
                          </span>
                        )}
                      </span>
                      <span className="w-16 shrink-0 text-right font-mono text-[11px] text-zinc-500">
                        {fmtCapUsd(c.marketCapUsd)}
                      </span>
                      <span
                        className={`w-16 shrink-0 text-right font-mono text-[11px] ${
                          ret == null
                            ? "text-zinc-600"
                            : ret >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                        }`}
                      >
                        {fmtPct(ret, 0)}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-1 pb-3 pt-1">
                        {hist ? (
                          <CompanyChart history={hist} />
                        ) : histError ? (
                          <p className="py-4 text-center text-[11px] text-zinc-600">
                            Couldn&rsquo;t load price history.
                          </p>
                        ) : companies ? (
                          <p className="py-4 text-center text-[11px] text-zinc-600">
                            No price history for {c.ticker}.
                          </p>
                        ) : (
                          <p className="py-4 text-center text-[11px] text-zinc-600">
                            Loading price history…
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {index.constituents.some((c) => c.limitedHistory) && (
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
                <span className="text-amber-500/80">⚠</span> listed within ~2
                years (recent IPO/spinoff) — its longer-window return reflects a
                partial, often depressed starting base, so read it with caution.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-600">
          No public-market index for this layer (mostly private companies).
        </p>
      )}

      {/* ── How it connects ── */}
      {(content?.interconnect || hasFlows) && (
        <Section title="How it connects">
          {content?.interconnect && <p className="mb-3">{content.interconnect}</p>}
          {hasFlows && (
            <div className="flex flex-wrap gap-1.5">
              {detail!.flowsIn.map(([l, n]) => (
                <Flow key={`in-${l}`} dir="in" layer={l} n={n} />
              ))}
              {detail!.flowsOut.map(([l, n]) => (
                <Flow key={`out-${l}`} dir="out" layer={l} n={n} />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── What to watch ── */}
      {content?.watch && (
        <Section title="What to watch">
          <p className="text-zinc-300">{content.watch}</p>
        </Section>
      )}

      {/* ── Recent developments ── */}
      {detail && detail.recent.length > 0 && (
        <Section title="Recent developments">
          <ul className="space-y-2.5">
            {detail.recent.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-0.5 border-l border-zinc-800 pl-3"
              >
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-zinc-200">
                    <CompanyLink id={d.sourceId} name={d.sourceName} />
                    <span className="text-zinc-600"> → </span>
                    <CompanyLink id={d.targetId} name={d.targetName} />
                  </span>
                  <span className="shrink-0 font-mono text-zinc-500">
                    {d.dateDisplay}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                  <span>{dealTypeLabel(d.dealType)}</span>
                  <span className="font-mono text-zinc-400">
                    {fmtValue(d.valueBillions)}
                  </span>
                  {d.sourceUrl && (
                    <a
                      href={d.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-zinc-600 underline-offset-2 hover:text-zinc-300 hover:underline"
                    >
                      source
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── Most active companies ── */}
      {detail && detail.keyPlayers.length > 0 && (
        <Section title="Most active companies">
          <div className="flex flex-wrap gap-1.5">
            {detail.keyPlayers.map((p) => (
              <Link
                key={p.id}
                href={`/?focus=${p.id}`}
                className="rounded-full border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-white"
              >
                {p.name}
                <span className="ml-1.5 font-mono text-[10px] text-zinc-500">
                  {p.deals}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function CompanyLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/?focus=${id}`} className="hover:text-white hover:underline">
      {name}
    </Link>
  );
}

function MiniStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="bg-zinc-950 px-3 py-2.5">
      <div className="font-mono text-sm text-zinc-100">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      {note && <div className="mt-0.5 text-[10px] text-zinc-600">{note}</div>}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
      {children}
    </h4>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <SectionHeading>{title}</SectionHeading>
      <div className="mt-2 text-sm leading-relaxed text-zinc-400">
        {children}
      </div>
    </div>
  );
}

function Flow({
  dir,
  layer,
  n,
}: {
  dir: "in" | "out";
  layer: Layer;
  n: number;
}) {
  const meta = LAYER_META[layer];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-400">
      <span className="text-zinc-600">{dir === "in" ? "←" : "→"}</span>
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: meta.color }}
      />
      {meta.label.split(" ")[0]}
      <span className="font-mono text-[10px] text-zinc-500">{n}</span>
    </span>
  );
}
