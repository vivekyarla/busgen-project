"use client";

import { useMemo } from "react";
import type { GraphData, GraphLink } from "@/lib/data/load";
import { LAYER_META, type Layer } from "@/lib/data/layers";
import {
  dealsForNode,
  dealTypeLabel,
  endpointId,
  heatColor,
} from "@/lib/data/filter";
import { monthLabel } from "@/lib/data/time";

function fmtValue(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1) return `$${v.toFixed(v >= 10 ? 0 : 1)}B`;
  return `$${Math.round(v * 1000)}M`;
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  const p = Math.round(v * 100);
  return `${p >= 0 ? "+" : ""}${p}%`;
}

export default function NodeDetailPanel({
  data,
  nodeId,
  onSelect,
}: {
  data: GraphData;
  nodeId: string;
  onSelect: (id: string | null) => void;
}) {
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of data.nodes) m.set(n.id, n.name);
    return m;
  }, [data.nodes]);

  const node = useMemo(
    () => data.nodes.find((n) => n.id === nodeId),
    [data.nodes, nodeId],
  );
  const { inbound, outbound } = useMemo(
    () => dealsForNode(data, nodeId),
    [data, nodeId],
  );

  if (!node) return null;
  const layerMeta = LAYER_META[node.layer as Layer];

  const DealRow = ({
    deal,
    counterpartyId,
    direction,
  }: {
    deal: GraphLink;
    counterpartyId: string;
    direction: "in" | "out";
  }) => (
    <li>
      <button
        onClick={() => onSelect(counterpartyId)}
        className="group flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-zinc-800/60"
      >
        <span className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-zinc-200 group-hover:text-white">
            {direction === "in" ? "← " : "→ "}
            {nameById.get(counterpartyId) ?? counterpartyId}
          </span>
          <span className="shrink-0 font-mono text-zinc-400">
            {fmtValue(deal.value_billions)}
          </span>
        </span>
        <span className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span>{dealTypeLabel(deal.deal_type)}</span>
          {deal.date_display && <span>· {deal.date_display}</span>}
          {deal.source_url && (
            <a
              href={deal.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ml-auto text-zinc-600 underline-offset-2 hover:text-zinc-300 hover:underline"
            >
              source
            </a>
          )}
        </span>
      </button>
    </li>
  );

  return (
    <div className="pointer-events-auto flex max-h-[calc(100vh-3rem)] w-80 flex-col rounded-lg border border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800/70 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: layerMeta?.color }}
            />
            <h2 className="truncate text-base font-semibold text-zinc-50">
              {node.name}
            </h2>
            {node.ticker && (
              <span className="shrink-0 font-mono text-xs text-zinc-500">
                {node.ticker}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">{layerMeta?.label}</p>
          {node.subline && (
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
              {node.subline}
            </p>
          )}
        </div>
        <button
          onClick={() => onSelect(null)}
          className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-3 gap-px border-b border-zinc-800/70 bg-zinc-800/40 text-center">
        <Stat label="Inbound" value={String(node.inboundDeals)} />
        <Stat label="Outbound" value={String(node.outboundDeals)} />
        <Stat label="In value" value={fmtValue(node.inboundValue || null)} />
      </div>

      {/* Opportunity Indicator breakdown (transparent inputs, not a black box) */}
      <div className="border-b border-zinc-800/70 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Opportunity indicator
          </p>
          <span
            className="font-mono text-lg font-semibold"
            style={{ color: heatColor(node.bottleneckScore) }}
          >
            {Math.round(node.bottleneckScore * 100)}
          </span>
        </div>
        <div className="mt-2 space-y-2">
          <Meter label="Deal velocity" frac={node.dealVelocity} />
          <Meter
            label="Unrealized gap"
            frac={node.unrealizedGap}
            unmeasured={!node.scoreMeasured}
          />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-zinc-500">
          {node.layer === "application" || node.layer === "capital" ? (
            <>
              {node.layer === "application" ? "Demand layer" : "Capital layer"} —
              not scored as a bottleneck (bottlenecks are supply-side). Deal
              velocity shown for reference.
            </>
          ) : node.scoreMeasured ? (
            <>
              Stock{" "}
              <span className="text-zinc-300">{fmtPct(node.priceReturn)}</span>{" "}
              vs S&amp;P{" "}
              <span className="text-zinc-300">
                {fmtPct(node.benchmarkReturn)}
              </span>{" "}
              since{" "}
              {node.firstMonth != null
                ? monthLabel(node.firstMonth)
                : "its first deal"}
              .
            </>
          ) : (
            "No public ticker — market response unmeasured (private concentration)."
          )}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {inbound.length > 0 && (
          <Section title={`Inbound · ${inbound.length}`}>
            {inbound.map((d) => (
              <DealRow
                key={d.id}
                deal={d}
                counterpartyId={endpointId(d.source)}
                direction="in"
              />
            ))}
          </Section>
        )}
        {outbound.length > 0 && (
          <Section title={`Outbound · ${outbound.length}`}>
            {outbound.map((d) => (
              <DealRow
                key={d.id}
                deal={d}
                counterpartyId={endpointId(d.target)}
                direction="out"
              />
            ))}
          </Section>
        )}
        {inbound.length === 0 && outbound.length === 0 && (
          <p className="px-2 py-4 text-xs text-zinc-500">
            No deals in the current dataset.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-950 px-2 py-2.5">
      <div className="font-mono text-sm text-zinc-100">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </div>
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
    <div className="mb-1">
      <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {title}
      </p>
      <ul>{children}</ul>
    </div>
  );
}

function Meter({
  label,
  frac,
  unmeasured,
}: {
  label: string;
  frac: number | null;
  unmeasured?: boolean;
}) {
  const pct = Math.round((frac ?? 0) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-400">
          {unmeasured ? "unmeasured" : pct}
        </span>
      </div>
      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
        {!unmeasured && (
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: heatColor(frac ?? 0) }}
          />
        )}
      </div>
    </div>
  );
}
