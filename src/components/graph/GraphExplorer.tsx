"use client";

import { useEffect, useMemo, useState } from "react";
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
import TimeBar from "./TimeBar";

const TIMELINE_FLOOR = 2020 * 12; // focus the slider on the AI-boom era

export default function GraphExplorer({ data }: { data: GraphData }) {
  // Deal types ordered by frequency in the dataset.
  const dealTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of data.links)
      counts.set(l.deal_type, (counts.get(l.deal_type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [data.links]);

  const maxActivity = useMemo(
    () => computeMaxActivity(data.nodes),
    [data.nodes],
  );

  // Slider spans the boom era; deals before the floor are always present.
  const sliderMin = Math.max(data.meta.minMonth, TIMELINE_FLOOR);
  const sliderMax = data.meta.maxMonth;

  const [filters, setFilters] = useState<Filters>(() => ({
    layers: new Set<string>(LAYER_ORDER),
    dealTypes: new Set<string>(dealTypes),
  }));
  const [colorMode, setColorMode] = useState<ColorMode>("layer");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [maxMonth, setMaxMonth] = useState<number>(sliderMax);
  const [playing, setPlaying] = useState(false);

  // Advance the timeline while playing.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setMaxMonth((m) => Math.min(m + 1, sliderMax));
    }, 110);
    return () => clearInterval(id);
  }, [playing, sliderMax]);

  // Stop at the end of the timeline.
  useEffect(() => {
    if (playing && maxMonth >= sliderMax) setPlaying(false);
  }, [playing, maxMonth, sliderMax]);

  const handlePlayToggle = () => {
    if (!playing && maxMonth >= sliderMax) setMaxMonth(sliderMin); // restart
    setPlaying((p) => !p);
  };

  const filtered = useMemo(
    () => applyFilters(data, filters, maxMonth),
    [data, filters, maxMonth],
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

      {/* Bottom-center: time slider */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 z-10 -translate-x-1/2 p-4">
        <TimeBar
          min={sliderMin}
          max={sliderMax}
          value={maxMonth}
          onChange={(v) => {
            setPlaying(false);
            setMaxMonth(v);
          }}
          playing={playing}
          onPlayToggle={handlePlayToggle}
          visibleDeals={filtered.links.length}
          totalDeals={data.meta.dealCount}
        />
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
