"use client";

import { LAYER_ORDER, LAYER_META, type Layer } from "@/lib/data/layers";
import { dealTypeLabel, type ColorMode, type Filters } from "@/lib/data/filter";

interface ControlPanelProps {
  filters: Filters;
  setFilters: (f: Filters) => void;
  dealTypes: string[];
  colorMode: ColorMode;
  setColorMode: (m: ColorMode) => void;
  onLayerInfo: (l: Layer) => void;
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export default function ControlPanel({
  filters,
  setFilters,
  dealTypes,
  colorMode,
  setColorMode,
  onLayerInfo,
}: ControlPanelProps) {
  return (
    <div className="pointer-events-auto w-60 rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-3 backdrop-blur-sm">
      {/* Color mode */}
      <div className="mb-3">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          Color by
        </p>
        <div className="flex rounded-md border border-zinc-800 p-0.5 text-[11px]">
          {(["layer", "heat", "bottleneck"] as ColorMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setColorMode(m)}
              className={`flex-1 rounded px-1.5 py-1 transition-colors ${
                colorMode === m
                  ? "bg-zinc-200 text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {m === "heat" ? "Heat" : m === "bottleneck" ? "Bottleneck" : "Plain"}
            </button>
          ))}
        </div>
      </div>

      {/* Layers */}
      <FilterGroup
        title="Layers"
        allValues={LAYER_ORDER}
        active={filters.layers}
        onToggleAll={(all) =>
          setFilters({
            ...filters,
            layers: all ? new Set<string>(LAYER_ORDER) : new Set<string>(),
          })
        }
        onToggle={(v) =>
          setFilters({ ...filters, layers: toggle(filters.layers, v) })
        }
        renderLabel={(l) => LAYER_META[l as Layer].label}
        onInfo={(v) => onLayerInfo(v as Layer)}
      />

      {/* Deal types */}
      <FilterGroup
        title="Deal types"
        allValues={dealTypes}
        active={filters.dealTypes}
        onToggleAll={(all) =>
          setFilters({
            ...filters,
            dealTypes: all ? new Set(dealTypes) : new Set(),
          })
        }
        onToggle={(v) =>
          setFilters({ ...filters, dealTypes: toggle(filters.dealTypes, v) })
        }
        renderLabel={(t) => dealTypeLabel(t)}
      />
    </div>
  );
}

interface FilterGroupProps {
  title: string;
  allValues: readonly string[];
  active: Set<string>;
  onToggle: (v: string) => void;
  onToggleAll: (all: boolean) => void;
  renderLabel: (v: string) => React.ReactNode;
  /** When set, renders an info button per row (e.g. open a layer deep-dive). */
  onInfo?: (v: string) => void;
}

function FilterGroup({
  title,
  allValues,
  active,
  onToggle,
  onToggleAll,
  renderLabel,
  onInfo,
}: FilterGroupProps) {
  const allOn = allValues.every((v) => active.has(v));
  return (
    <div className="mt-3 border-t border-zinc-800/70 pt-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          {title}
        </p>
        <button
          onClick={() => onToggleAll(!allOn)}
          className="text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          {allOn ? "none" : "all"}
        </button>
      </div>
      <div className="space-y-1">
        {allValues.map((v) => {
          const on = active.has(v);
          return (
            <div key={v} className="flex items-center gap-1">
              <button
                onClick={() => onToggle(v)}
                className={`flex min-w-0 flex-1 items-center gap-2 text-left text-xs transition-opacity ${
                  on ? "text-zinc-300" : "text-zinc-600"
                }`}
              >
                <span
                  className={`grid h-3 w-3 shrink-0 place-items-center rounded-sm border ${
                    on
                      ? "border-zinc-400 bg-zinc-400/20"
                      : "border-zinc-700 bg-transparent"
                  }`}
                >
                  {on && (
                    <span className="h-1.5 w-1.5 rounded-[1px] bg-zinc-300" />
                  )}
                </span>
                <span className="truncate">{renderLabel(v)}</span>
              </button>
              {onInfo && (
                <button
                  onClick={() => onInfo(v)}
                  title="Layer details"
                  aria-label="Layer details"
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-zinc-700 text-[9px] text-zinc-500 hover:border-zinc-500 hover:text-zinc-200"
                >
                  i
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
