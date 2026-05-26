"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import type { GraphData, GraphNode } from "@/lib/data/load";
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

const NODE_REL_SIZE = 4;
const DIM_NODE = "#3f3f46"; // zinc-700
const DIM_LINK = "rgba(82,82,91,0.05)";
const IDLE_LINK = "rgba(161,161,170,0.16)";
const HOT_LINK = "rgba(244,244,245,0.6)";
const PLANE_HALF_W = 760; // x half-extent for planes + layer labels
// Reference distances for constant-on-screen label sizing (smaller = bigger).
const NODE_LABEL_REF = 380;
const LAYER_LABEL_REF = 2600;
// Level-of-detail: at the overview only high-activity hubs are labeled; as the
// camera nears, the activity cutoff drops toward 0 and every label appears.
const LOD_NEAR = 340; // camera distance at/below which all labels show
const LOD_FAR = 1050; // camera distance at/above which only top hubs show
const LOD_MAX_CUTOFF = 9; // min deal-activity to be labeled at the overview

function lodCutoff(camDist: number): number {
  const t = (camDist - LOD_NEAR) / (LOD_FAR - LOD_NEAR);
  return Math.max(0, Math.min(1, t)) * LOD_MAX_CUTOFF;
}

/** Approximate sphere radius react-force-graph renders for a given val. */
function nodeRadius(val: number): number {
  return NODE_REL_SIZE * Math.cbrt(Math.max(val, 1));
}

interface StackGraphProps {
  data: GraphData;
  colorMode: ColorMode;
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

  // Selection mirror for the (deps-free) render loop to read without staleness.
  const selRef = useRef<{ ids: Set<string> }>({ ids: new Set() });
  selRef.current = { ids: hiNodes };

  // Sphere + floating company label. Rebuilds only when color mode or the
  // selection (dimming) changes — react-force-graph keeps node positions.
  const buildNodeObject = useCallback(
    (n: GraphNode): THREE.Object3D => {
      const dim = selectedId != null && !hiNodes.has(n.id);
      const color =
        colorMode === "heat"
          ? heatColor(maxActivity > 0 ? nodeActivity(n) / maxActivity : 0)
          : (LAYER_META[n.layer]?.color ?? "#888888");

      const group = new THREE.Group();
      const r = nodeRadius(n.val);

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(r, 18, 14),
        new THREE.MeshLambertMaterial({
          color: new THREE.Color(dim ? DIM_NODE : color),
          transparent: true,
          opacity: dim ? 0.45 : 0.95,
        }),
      );
      group.add(sphere);

      const label = new SpriteText(n.name);
      label.color = dim ? "#52525b" : "#e4e4e7";
      label.textHeight = 6.5;
      label.fontWeight = "500";
      label.strokeColor = "#09090b";
      label.strokeWidth = 0.8;
      label.backgroundColor = false as unknown as string;
      label.position.set(0, r + 5, 0);
      // Captured base scale + reference distance drive constant-on-screen sizing;
      // kind/activity/nodeId drive level-of-detail visibility in the loop.
      label.userData.baseScale = label.scale.clone();
      label.userData.refDist = NODE_LABEL_REF;
      label.userData.kind = "nodeLabel";
      label.userData.activity = nodeActivity(n);
      label.userData.nodeId = n.id;
      group.add(label);

      return group;
    },
    [colorMode, maxActivity, selectedId, hiNodes],
  );

  // Instance setup: orbit controls with bounds, spread forces, planes + labels,
  // plus a persistent loop that keeps label sprites a constant on-screen size.
  useEffect(() => {
    let raf = 0;
    let loopRaf = 0;
    let tries = 0;
    const tmp = new THREE.Vector3();

    const scaleLabels = () => {
      const fg = fgRef.current;
      const cam = fg?.camera?.();
      const scene = fg?.scene?.();
      if (cam && scene) {
        const cutoff = lodCutoff(cam.position.length());
        const sel = selRef.current.ids;
        scene.traverse((obj: THREE.Object3D) => {
          const base = obj.userData?.baseScale as THREE.Vector3 | undefined;
          const ref = obj.userData?.refDist as number | undefined;
          if (!base || !ref) return;
          obj.getWorldPosition(tmp);
          const f = cam.position.distanceTo(tmp) / ref;
          obj.scale.set(base.x * f, base.y * f, base.z * f);
          // Level-of-detail: hide minor node labels at the overview, always show
          // selected/neighbor labels. Layer labels are exempt (always visible).
          if (obj.userData.kind === "nodeLabel") {
            const act = (obj.userData.activity as number) ?? 0;
            const nid = obj.userData.nodeId as string;
            obj.visible = act >= cutoff || sel.has(nid);
          }
        });
      }
      loopRaf = requestAnimationFrame(scaleLabels);
    };

    const setup = () => {
      const fg = fgRef.current;
      if (!fg || typeof fg.scene !== "function") {
        if (tries++ < 180) raf = requestAnimationFrame(setup);
        return;
      }

      fg.d3Force("charge")?.strength(-470);
      fg.d3Force("link")?.distance(100).strength(0.2);
      fg.d3ReheatSimulation?.();

      const scene = fg.scene();
      if (!scene.userData.__litAndLabeled) {
        scene.userData.__litAndLabeled = true;
        scene.add(new THREE.AmbientLight(0xffffff, 1.4));
        const dir = new THREE.DirectionalLight(0xffffff, 0.6);
        dir.position.set(200, 400, 300);
        scene.add(dir);

        for (const layer of LAYER_ORDER) {
          const meta = LAYER_META[layer as Layer];
          const y = layerY(layer as Layer);

          const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(PLANE_HALF_W * 2, 320),
            new THREE.MeshBasicMaterial({
              color: new THREE.Color(meta.color),
              transparent: true,
              opacity: 0.04,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          );
          plane.rotation.x = Math.PI / 2;
          plane.position.set(0, y, 0);
          plane.renderOrder = -2;
          scene.add(plane);

          const text = new SpriteText(meta.label.toUpperCase());
          text.color = meta.color;
          text.textHeight = 24;
          text.fontWeight = "700";
          text.strokeColor = "#09090b";
          text.strokeWidth = 0.6;
          text.backgroundColor = false as unknown as string;
          // Anchored to the right edge so it clears the left-side control panel.
          text.position.set(PLANE_HALF_W - 60, y + 30, 0);
          text.renderOrder = 1;
          text.userData.baseScale = text.scale.clone();
          text.userData.refDist = LAYER_LABEL_REF;
          text.userData.kind = "layerLabel";
          scene.add(text);
        }
      }

      const controls = fg.controls?.();
      if (controls) {
        controls.enablePan = false;
        controls.minDistance = 160;
        controls.maxDistance = 3000; // must exceed the zoomToFit distance
        controls.minPolarAngle = Math.PI * 0.16; // never fully top-down
        controls.maxPolarAngle = Math.PI * 0.74; // never go under the stack
        controls.rotateSpeed = 0.7;
        controls.zoomSpeed = 0.8;
        controls.target?.set?.(0, 0, 0);
        controls.update?.();
      }

      fg.cameraPosition?.({ x: 0, y: 150, z: 1100 }, { x: 0, y: 0, z: 0 }, 0);

      // Kick off the constant-size label loop now that the instance is live.
      if (!loopRaf) loopRaf = requestAnimationFrame(scaleLabels);
    };
    raf = requestAnimationFrame(setup);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(loopRaf);
    };
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
          controlType="orbit"
          nodeId="id"
          nodeRelSize={NODE_REL_SIZE}
          nodeThreeObject={(n) => buildNodeObject(n as GraphNode)}
          nodeLabel={(n) =>
            `${n.name}${n.ticker ? ` · ${n.ticker}` : ""} — ${nodeActivity(n as never)} deals`
          }
          linkColor={(l) => {
            if (!selectedId) return IDLE_LINK;
            return hiLinks.has(l.id as string) ? HOT_LINK : DIM_LINK;
          }}
          linkWidth={(l) =>
            selectedId && hiLinks.has(l.id as string) ? 1.6 : 0.4
          }
          linkDirectionalParticles={(l) =>
            selectedId && hiLinks.has(l.id as string) ? 3 : 0
          }
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleSpeed={0.006}
          enableNodeDrag={false}
          cooldownTicks={160}
          onEngineStop={() => {
            if (!fgRef.current?.__framed) {
              fgRef.current?.zoomToFit?.(700, 45);
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
