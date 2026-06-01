"use client";

import { LAYER_ORDER, LAYER_META, type Layer } from "@/lib/data/layers";
import { heatColor, type ColorMode } from "@/lib/data/filter";

export default function Legend({
  colorMode,
  maxActivity,
  onExplain,
}: {
  colorMode: ColorMode;
  maxActivity: number;
  onExplain?: () => void;
}) {
  if (colorMode === "heat" || colorMode === "bottleneck") {
    const ramp = `linear-gradient(to right, ${heatColor(0)}, ${heatColor(
      0.45,
    )}, ${heatColor(0.75)}, ${heatColor(1)})`;
    const isBottleneck = colorMode === "bottleneck";
    return (
      <div className="pointer-events-none rounded-lg border border-zinc-800/80 bg-zinc-950/70 p-3 backdrop-blur-sm">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          {isBottleneck ? "Bottleneck score" : "Deal activity"}
        </p>
        <div className="h-2 w-44 rounded-full" style={{ background: ramp }} />
        <div className="mt-1 flex w-44 justify-between text-[10px] text-zinc-500">
          <span>{isBottleneck ? "priced in" : "quiet"}</span>
          <span>{isBottleneck ? "next bottleneck" : `${maxActivity} deals`}</span>
        </div>
        {isBottleneck && (
          <>
            <p className="mt-1.5 w-44 text-[10px] leading-snug text-zinc-600">
              Velocity × unrealized gap × demand.
            </p>
            {onExplain && (
              <button
                onClick={onExplain}
                className="pointer-events-auto mt-1.5 text-[10px] text-zinc-400 underline-offset-2 hover:text-zinc-100 hover:underline"
              >
                How is this scored? ⓘ
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="pointer-events-none space-y-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/70 p-3 backdrop-blur-sm">
      {LAYER_ORDER.map((l) => (
        <div
          key={l}
          className="flex items-center gap-2 text-xs text-zinc-400"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: LAYER_META[l as Layer].color }}
          />
          {LAYER_META[l as Layer].label}
        </div>
      ))}
    </div>
  );
}
