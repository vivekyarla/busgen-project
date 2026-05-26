"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { GraphData } from "@/lib/data/load";
import { LAYER_META, type Layer } from "@/lib/data/layers";

// WebGL / three.js — client only. ssr:false must live inside a Client Component.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">
      Initializing map…
    </div>
  ),
});

export default function StackGraph({ data }: { data: GraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () =>
      setDims({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {dims.width > 0 && (
        <ForceGraph3D
          width={dims.width}
          height={dims.height}
          graphData={data}
          backgroundColor="#09090b"
          showNavInfo={false}
          nodeId="id"
          nodeVal="val"
          nodeRelSize={4}
          nodeOpacity={0.92}
          nodeResolution={12}
          nodeColor={(n) => LAYER_META[n.layer as Layer]?.color ?? "#888888"}
          nodeLabel={(n) =>
            `${n.name}${n.ticker ? ` · ${n.ticker}` : ""} — ${
              LAYER_META[n.layer as Layer]?.label ?? n.category
            }`
          }
          linkColor={() => "rgba(161,161,170,0.18)"}
          linkWidth={0.4}
          linkOpacity={0.4}
          enableNodeDrag={false}
          cooldownTicks={120}
        />
      )}
    </div>
  );
}
