"use client";

import { monthLabel } from "@/lib/data/time";

interface TimeBarProps {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
  visibleDeals: number;
  totalDeals: number;
}

export default function TimeBar({
  min,
  max,
  value,
  onChange,
  playing,
  onPlayToggle,
  visibleDeals,
  totalDeals,
}: TimeBarProps) {
  const atEnd = value >= max;
  return (
    <div className="pointer-events-auto flex w-[min(90vw,440px)] items-center gap-3 rounded-full border border-zinc-800/80 bg-zinc-950/85 px-4 py-2.5 backdrop-blur-sm">
      <button
        onClick={onPlayToggle}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-200 text-zinc-900 transition-colors hover:bg-white"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <span className="text-[11px]">❚❚</span>
        ) : (
          <span className="ml-0.5 text-xs">▶</span>
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between font-mono text-[11px]">
          <span className="text-zinc-200">
            {atEnd ? "Today" : monthLabel(value)}
          </span>
          <span className="text-zinc-500">
            {visibleDeals}/{totalDeals} deals
          </span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-zinc-200 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-100"
        />
      </div>
    </div>
  );
}
