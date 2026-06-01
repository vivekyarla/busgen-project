"use client";

import { Fragment, useState } from "react";
import type { LayerStats, LayerDetail } from "@/lib/data/dashboard";
import type { SectorIndex } from "@/lib/data/sectorIndices";
import type { LayerContentMap } from "@/lib/data/layer-content";
import { LAYER_META, type Layer } from "@/lib/data/layers";
import SectorDetail from "./SectorDetail";

const COLSPAN = 8;

function fmtCapUsd(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}

function fmtPct(frac: number | null): string {
  if (frac == null) return "—";
  const pct = frac * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

function pricedInRead(
  s: LayerStats,
  medianOfReturns: number | null,
): { label: string; tone: "early" | "hot" | "cool" | "flat" } {
  const accelerating = s.dealMomentum > 0;
  const ret = s.medianReturn1y;
  if (!accelerating) return { label: "Cooling", tone: "cool" };
  if (ret == null || medianOfReturns == null)
    return { label: "Accelerating", tone: "flat" };
  if (ret < medianOfReturns) return { label: "Early?", tone: "early" };
  return { label: "Priced in", tone: "hot" };
}

const TONE_CLASS: Record<string, string> = {
  early: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  hot: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  cool: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
  flat: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
};

export default function LayerTable({
  stats,
  medianOfReturns,
  indices,
  details,
  content,
  initialOpen = null,
}: {
  stats: LayerStats[];
  medianOfReturns: number | null;
  indices: Partial<Record<Layer, SectorIndex>>;
  details: Partial<Record<Layer, LayerDetail>>;
  content: LayerContentMap;
  initialOpen?: Layer | null;
}) {
  const [openLayer, setOpenLayer] = useState<Layer | null>(initialOpen);

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full min-w-[800px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            <Th />
            <Th>Layer</Th>
            <Th right>Companies</Th>
            <Th right>Market cap</Th>
            <Th right>Median fwd P/E</Th>
            <Th right>Median 1Y</Th>
            <Th right>Deals 12mo</Th>
            <Th right>Momentum</Th>
            <Th right>Read</Th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const meta = LAYER_META[s.layer as Layer];
            const read = pricedInRead(s, medianOfReturns);
            const index = indices[s.layer];
            const detail = details[s.layer];
            const layerContent = content[s.layer];
            const hasIndex = !!index && index.constituents.length > 0;
            const expandable = hasIndex || !!detail || !!layerContent;
            const isOpen = openLayer === s.layer;
            const retColor =
              s.medianReturn1y == null
                ? "text-zinc-500"
                : s.medianReturn1y >= 0
                  ? "text-emerald-400"
                  : "text-rose-400";
            return (
              <Fragment key={s.layer}>
                <tr
                  onClick={() =>
                    expandable && setOpenLayer(isOpen ? null : s.layer)
                  }
                  className={`border-b border-zinc-900 last:border-0 ${
                    expandable ? "cursor-pointer hover:bg-zinc-900/40" : ""
                  } ${isOpen ? "bg-zinc-900/40" : ""}`}
                >
                  <td className="w-7 pl-3 text-zinc-500">
                    {expandable && (
                      <span
                        className={`inline-block transition-transform ${isOpen ? "rotate-180" : ""}`}
                      >
                        ▾
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: meta?.color }}
                      />
                      <div>
                        <div className="font-medium text-zinc-100">
                          {meta?.label}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {meta?.blurb}
                        </div>
                      </div>
                    </div>
                  </td>
                  <Td right mono className="text-zinc-300">
                    {s.trackedCount}
                    <span className="text-zinc-600">/{s.companyCount}</span>
                  </Td>
                  <Td right mono className="text-zinc-100">
                    {fmtCapUsd(s.totalMarketCapUsd)}
                  </Td>
                  <Td right mono className="text-zinc-300">
                    {s.medianForwardPE != null
                      ? s.medianForwardPE.toFixed(1)
                      : "—"}
                  </Td>
                  <Td right mono className={retColor}>
                    {fmtPct(s.medianReturn1y)}
                  </Td>
                  <Td right mono className="text-zinc-300">
                    {s.deals12mo}
                  </Td>
                  <Td right mono>
                    <span
                      className={
                        s.dealMomentum > 0
                          ? "text-emerald-400"
                          : s.dealMomentum < 0
                            ? "text-rose-400"
                            : "text-zinc-500"
                      }
                    >
                      {s.dealMomentum > 0 ? "▲" : s.dealMomentum < 0 ? "▼" : "—"}{" "}
                      {s.dealMomentum !== 0 ? Math.abs(s.dealMomentum) : ""}
                    </span>
                  </Td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE_CLASS[read.tone]}`}
                    >
                      {read.label}
                    </span>
                  </td>
                </tr>
                {isOpen && expandable && (
                  <tr className="bg-zinc-950/60">
                    <td colSpan={COLSPAN + 1} className="border-b border-zinc-800 p-0">
                      {/* Pin to the viewport width so the chart + holdings never
                          clip behind the table's min-width horizontal scroll. */}
                      <div className="sticky left-0 w-[calc(min(100vw,64rem)-3rem)]">
                        <SectorDetail
                          layer={s.layer}
                          index={index}
                          detail={detail}
                          content={layerContent}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  right,
}: {
  children?: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th className={`px-4 py-2.5 font-normal ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  mono,
  className = "",
}: {
  children: React.ReactNode;
  right?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-3 ${right ? "text-right" : ""} ${mono ? "font-mono" : ""} ${className}`}
    >
      {children}
    </td>
  );
}
