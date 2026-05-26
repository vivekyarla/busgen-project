"use client";

import { LAYER_ORDER, LAYER_META, type Layer } from "@/lib/data/layers";
import { heatColor, type ColorMode } from "@/lib/data/filter";

export default function Legend({
  colorMode,
  maxActivity,
}: {
  colorMode: ColorMode;
  maxActivity: number;
}) {
  if (colorMode === "heat") {
    const ramp = `linear-gradient(to right, ${heatColor(0)}, ${heatColor(
      0.45,
    )}, ${heatColor(0.75)}, ${heatColor(1)})`;
    return (
      <div className="pointer-events-none rounded-lg border border-zinc-800/80 bg-zinc-950/70 p-3 backdrop-blur-sm">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          Deal activity
        </p>
        <div
          className="h-2 w-40 rounded-full"
          style={{ background: ramp }}
        />
        <div className="mt-1 flex w-40 justify-between text-[10px] text-zinc-500">
          <span>quiet</span>
          <span>{maxActivity} deals</span>
        </div>
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
