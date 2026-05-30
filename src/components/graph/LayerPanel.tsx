"use client";

import { useEffect, useMemo } from "react";
import type { GraphData } from "@/lib/data/load";
import { LAYER_META, type Layer } from "@/lib/data/layers";
import type { LayerContent } from "@/lib/data/layer-content";
import { endpointId, dealTypeLabel } from "@/lib/data/filter";

function fmtValue(v: number | null): string {
  if (v == null || v === 0) return "—";
  if (v >= 1) return `$${v.toFixed(v >= 10 ? 0 : 1)}B`;
  return `$${Math.round(v * 1000)}M`;
}

export default function LayerPanel({
  layer,
  content,
  data,
  onClose,
  onSelectNode,
}: {
  layer: Layer;
  content?: LayerContent;
  data: GraphData;
  onClose: () => void;
  onSelectNode: (id: string) => void;
}) {
  const meta = LAYER_META[layer];

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const derived = useMemo(() => {
    const layerBySlug = new Map(data.nodes.map((n) => [n.id, n.layer]));
    const inLayer = data.nodes.filter((n) => n.layer === layer);

    // Deals touching this layer; tally cross-layer flow + collect for feed.
    const flowsOut = new Map<Layer, number>(); // this layer is source → other
    const flowsIn = new Map<Layer, number>(); // other → this layer is target
    const touching: typeof data.links = [];
    let inboundValue = 0;

    for (const l of data.links) {
      const s = endpointId(l.source);
      const t = endpointId(l.target);
      const sl = layerBySlug.get(s);
      const tl = layerBySlug.get(t);
      const touchesSource = sl === layer;
      const touchesTarget = tl === layer;
      if (!touchesSource && !touchesTarget) continue;
      touching.push(l);
      if (touchesTarget && typeof l.value_billions === "number")
        inboundValue += l.value_billions;
      if (touchesSource && tl && tl !== layer)
        flowsOut.set(tl, (flowsOut.get(tl) ?? 0) + 1);
      if (touchesTarget && sl && sl !== layer)
        flowsIn.set(sl, (flowsIn.get(sl) ?? 0) + 1);
    }

    const recent = [...touching]
      .sort((a, b) => (b.month ?? -1) - (a.month ?? -1))
      .slice(0, 7);

    const keyPlayers = [...inLayer]
      .sort(
        (a, b) =>
          b.inboundDeals + b.outboundDeals - (a.inboundDeals + a.outboundDeals),
      )
      .slice(0, 8);

    const topFlows = (m: Map<Layer, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]);

    return {
      companyCount: inLayer.length,
      dealCount: touching.length,
      inboundValue,
      recent,
      keyPlayers,
      flowsIn: topFlows(flowsIn),
      flowsOut: topFlows(flowsOut),
      nameById: new Map(data.nodes.map((n) => [n.id, n.name])),
    };
  }, [data, layer]);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-30 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-4 border-b border-zinc-800 p-5"
          style={{ borderTop: `2px solid ${meta.color}` }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: meta.color }}
              />
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
                {meta.label}
              </h2>
            </div>
            {content?.tagline && (
              <p className="mt-1 text-sm text-zinc-400">{content.tagline}</p>
            )}
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
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-px bg-zinc-800/40 sm:grid-cols-4">
            <Stat
              label="Market size"
              value={content?.market_size ?? "—"}
              note={content?.market_size_note}
            />
            <Stat label="Companies tracked" value={String(derived.companyCount)} />
            <Stat label="Deals" value={String(derived.dealCount)} />
            <Stat label="Inbound value" value={fmtValue(derived.inboundValue)} />
          </div>

          <div className="space-y-5 p-5">
            {content?.summary && (
              <Section title="The industry">
                <p>{content.summary}</p>
              </Section>
            )}

            <Section title="How it connects">
              {content?.interconnect && (
                <p className="mb-3">{content.interconnect}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {derived.flowsIn.map(([l, n]) => (
                  <Flow key={`in-${l}`} dir="in" layer={l} n={n} />
                ))}
                {derived.flowsOut.map(([l, n]) => (
                  <Flow key={`out-${l}`} dir="out" layer={l} n={n} />
                ))}
              </div>
            </Section>

            {content?.watch && (
              <Section title="What to watch">
                <p className="text-zinc-300">{content.watch}</p>
              </Section>
            )}

            {/* Live feed of recent developments */}
            <Section title="Recent developments">
              {derived.recent.length === 0 ? (
                <p className="text-zinc-500">No deals recorded yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {derived.recent.map((d) => {
                    const s = endpointId(d.source);
                    const t = endpointId(d.target);
                    return (
                      <li
                        key={d.id}
                        className="flex flex-col gap-0.5 border-l border-zinc-800 pl-3"
                      >
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="text-zinc-200">
                            <button
                              onClick={() => onSelectNode(s)}
                              className="hover:text-white hover:underline"
                            >
                              {derived.nameById.get(s) ?? s}
                            </button>
                            <span className="text-zinc-600"> → </span>
                            <button
                              onClick={() => onSelectNode(t)}
                              className="hover:text-white hover:underline"
                            >
                              {derived.nameById.get(t) ?? t}
                            </button>
                          </span>
                          <span className="shrink-0 font-mono text-zinc-500">
                            {d.date_display || d.date || ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                          <span>{dealTypeLabel(d.deal_type)}</span>
                          <span className="font-mono text-zinc-400">
                            {fmtValue(d.value_billions)}
                          </span>
                          {d.source_url && (
                            <a
                              href={d.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto text-zinc-600 underline-offset-2 hover:text-zinc-300 hover:underline"
                            >
                              source
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            {/* Key players */}
            {derived.keyPlayers.length > 0 && (
              <Section title="Most active companies">
                <div className="flex flex-wrap gap-1.5">
                  {derived.keyPlayers.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onSelectNode(n.id)}
                      className="rounded-full border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-white"
                    >
                      {n.name}
                      <span className="ml-1.5 font-mono text-[10px] text-zinc-500">
                        {n.inboundDeals + n.outboundDeals}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="bg-zinc-950 px-4 py-3">
      <div className="font-mono text-sm text-zinc-100">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      {note && <div className="mt-0.5 text-[10px] text-zinc-600">{note}</div>}
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
    <div>
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {title}
      </h3>
      <div className="text-sm leading-relaxed text-zinc-400">{children}</div>
    </div>
  );
}

function Flow({ dir, layer, n }: { dir: "in" | "out"; layer: Layer; n: number }) {
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
