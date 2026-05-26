"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import type { GraphData } from "@/lib/data/load";
import { LAYER_META, LAYER_ORDER, layerY, type Layer } from "@/lib/data/layers";
import {
  heatColor,
  nodeActivity,
  endpointId,
  type ColorMode,
} from "@/lib/data/filter";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">
      Initializing map…
    </div>
  ),
});

const DIM_NODE = "#27272a"; // zinc-800
const DIM_LINK = "rgba(82,82,91,0.05)";
const IDLE_LINK = "rgba(161,161,170,0.16)";
const HOT_LINK = "rgba(244,244,245,0.55)";

interface StackGraphProps {
  data: GraphData;
  colorMode: ColorMode;
  /** Max activity across the full dataset, for a stable heat ramp. */
  maxActivity: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function StackGraph({
  data,
  colorMode,
  maxActivity,
  selectedId,
  onSelect,
}: StackGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  // Track container size.
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

  // Neighbors + connected links of the selected node, for highlighting.
  const { hiNodes, hiLinks } = useMemo(() => {
    const hiNodes = new Set<string>();
    const hiLinks = new Set<string>();
    if (selectedId) {
      hiNodes.add(selectedId);
      for (const l of data.links) {
        const s = endpointId(l.source);
        const t = endpointId(l.target);
        if (s === selectedId || t === selectedId) {
          hiLinks.add(l.id);
          hiNodes.add(s);
          hiNodes.add(t);
        }
      }
    }
    return { hiNodes, hiLinks };
  }, [selectedId, data.links]);

  // Once the graph instance is live: spread the layout, frame it, and lay down
  // faint horizontal planes behind each layer.
  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const setup = () => {
      const fg = fgRef.current;
      if (!fg || typeof fg.scene !== "function") {
        if (tries++ < 120) raf = requestAnimationFrame(setup);
        return;
      }
      // Spread nodes within each plane.
      fg.d3Force("charge")?.strength(-160);
      fg.d3Force("link")?.distance(36);
      fg.d3ReheatSimulation?.();

      // Layer backdrops (idempotent: tag and skip if already added).
      const scene = fg.scene();
      if (!scene.userData.__layerPlanes) {
        scene.userData.__layerPlanes = true;
        for (const layer of LAYER_ORDER) {
          const geo = new THREE.PlaneGeometry(720, 260);
          const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(LAYER_META[layer as Layer].color),
            transparent: true,
            opacity: 0.035,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.rotation.x = Math.PI / 2; // horizontal
          mesh.position.set(0, layerY(layer as Layer), 0);
          mesh.renderOrder = -1;
          scene.add(mesh);
        }
      }
    };
    raf = requestAnimationFrame(setup);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {dims.width > 0 && (
        <ForceGraph3D
          ref={fgRef}
          width={dims.width}
          height={dims.height}
          graphData={data}
          backgroundColor="#09090b"
          showNavInfo={false}
          nodeId="id"
          nodeVal="val"
          nodeRelSize={4}
          nodeOpacity={0.95}
          nodeResolution={14}
          nodeColor={(n) => {
            if (selectedId && !hiNodes.has(n.id as string)) return DIM_NODE;
            if (colorMode === "heat") {
              return heatColor(
                maxActivity > 0 ? nodeActivity(n as never) / maxActivity : 0,
              );
            }
            return LAYER_META[n.layer as Layer]?.color ?? "#888888";
          }}
          nodeLabel={(n) =>
            `${n.name}${n.ticker ? ` · ${n.ticker}` : ""} — ${
              LAYER_META[n.layer as Layer]?.label ?? n.category
            } · ${nodeActivity(n as never)} deals`
          }
          linkColor={(l) => {
            if (!selectedId) return IDLE_LINK;
            return hiLinks.has(l.id as string) ? HOT_LINK : DIM_LINK;
          }}
          linkWidth={(l) =>
            selectedId && hiLinks.has(l.id as string) ? 1.4 : 0.4
          }
          linkDirectionalParticles={(l) =>
            selectedId && hiLinks.has(l.id as string) ? 3 : 0
          }
          linkDirectionalParticleWidth={1.8}
          linkDirectionalParticleSpeed={0.006}
          enableNodeDrag={false}
          cooldownTicks={140}
          onEngineStop={() => {
            if (!fgRef.current?.__framed) {
              fgRef.current?.zoomToFit?.(500, 70);
              if (fgRef.current) fgRef.current.__framed = true;
            }
          }}
          onNodeClick={(n) => onSelect(n.id as string)}
          onBackgroundClick={() => onSelect(null)}
        />
      )}
    </div>
  );
}
