"use client";

import { useMemo, useState } from "react";
import type { GraphData } from "@/lib/data/load";
import { LAYER_ORDER } from "@/lib/data/layers";
import {
  applyFilters,
  maxActivity as computeMaxActivity,
  type ColorMode,
  type Filters,
} from "@/lib/data/filter";
import StackGraph from "./StackGraph";
import ControlPanel from "./ControlPanel";
import Legend from "./Legend";
import NodeDetailPanel from "./NodeDetailPanel";

export default function GraphExplorer({ data }: { data: GraphData }) {
  // Deal types ordered by frequency in the dataset.
  const dealTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of data.links)
      counts.set(l.deal_type, (counts.get(l.deal_type) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
  }, [data.links]);

  const maxActivity = useMemo(
    () => computeMaxActivity(data.nodes),
    [data.nodes],
  );

  const [filters, setFilters] = useState<Filters>(() => ({
    layers: new Set<string>(LAYER_ORDER),
    dealTypes: new Set<string>(dealTypes),
  }));
  const [colorMode, setColorMode] = useState<ColorMode>("layer");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => applyFilters(data, filters),
    [data, filters],
  );

  return (
    <div className="relative h-full flex-1 overflow-hidden">
      <StackGraph
        data={filtered}
        colorMode={colorMode}
        maxActivity={maxActivity}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* Top-left: title + controls */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 flex max-h-full flex-col gap-3 overflow-y-auto p-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">
            Situational Unawareness
          </p>
          <h1 className="mt-0.5 text-lg font-semibold text-zinc-100">
            The AI Stack
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {filtered.nodes.length}/{data.meta.companyCount} companies ·{" "}
            {filtered.links.length}/{data.meta.dealCount} deals
          </p>
        </div>
        <ControlPanel
          filters={filters}
          setFilters={setFilters}
          dealTypes={dealTypes}
          colorMode={colorMode}
          setColorMode={setColorMode}
        />
      </div>

      {/* Bottom-left: legend */}
      <div className="pointer-events-none absolute bottom-0 left-0 z-10 p-4">
        <Legend colorMode={colorMode} maxActivity={maxActivity} />
      </div>

      {/* Right: node detail */}
      {selectedId && (
        <div className="absolute right-0 top-0 z-20 p-4">
          <NodeDetailPanel
            data={data}
            nodeId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      )}
    </div>
  );
}
