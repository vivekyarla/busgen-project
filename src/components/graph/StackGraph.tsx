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
const NODE_COLOR = "#fafafa"; // white nodes by default (no layer color-coding)
const LABEL_COLOR = "#f4f4f5";
const LABEL_FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";
// Reference distances for constant-on-screen label sizing (larger = smaller text).
const NODE_LABEL_REF = 560;
const LAYER_LABEL_REF = 2600;
// Screen-space label declutter: estimated on-screen label box (constant size).
const LABEL_PX_PER_CHAR = 6.4;
const LABEL_PX_HEIGHT = 13;

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
  /** When this changes, fly the camera to the given coords. */
  focusTarget: { x: number; y: number; z: number; nonce: number } | null;
}

export default function StackGraph({
  data,
  colorMode,
  maxActivity,
  selectedId,
  onSelect,
  focusTarget,
}: StackGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Fall back to window size when the container measures 0 (cold-load race),
    // so the graph never gets stuck unrendered behind the `dims.width > 0` gate.
    const measure = () => {
      const el = containerRef.current;
      const width = el?.clientWidth || window.innerWidth;
      const height = el?.clientHeight || window.innerHeight;
      setDims((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    };
    measure();
    // Re-measure after the first paint in case layout wasn't ready on mount.
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
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
      const color = dim
        ? DIM_NODE
        : colorMode === "heat"
          ? heatColor(maxActivity > 0 ? nodeActivity(n) / maxActivity : 0)
          : NODE_COLOR;

      const group = new THREE.Group();
      const orad = nodeRadius(n.val) * 1.7;

      // Faceted octahedron ("crystal") — flat-shaded for a modern, geometric read.
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(orad, 0),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          emissive: new THREE.Color(color),
          emissiveIntensity: dim ? 0.05 : 0.18,
          roughness: 0.42,
          metalness: 0.12,
          flatShading: true,
          transparent: true,
          opacity: dim ? 0.4 : 0.95,
        }),
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      mesh.userData.kind = "nodeMesh";
      group.add(mesh);

      const label = new SpriteText(n.name);
      label.color = dim ? "#52525b" : LABEL_COLOR;
      label.textHeight = 5;
      label.fontFace = LABEL_FONT;
      label.fontWeight = "400";
      label.strokeWidth = 0; // no heavy outline — cleaner, less "glitchy"
      label.backgroundColor = false as unknown as string;
      label.padding = 0;
      label.position.set(0, orad + 5, 0);
      // Render labels on top, depth-test off, so overlapping sprites don't flicker.
      label.material.depthTest = false;
      label.material.depthWrite = false;
      label.renderOrder = 10;
      // Captured base scale + reference distance drive constant-on-screen sizing;
      // kind/activity/nodeId drive level-of-detail visibility in the loop.
      label.userData.baseScale = label.scale.clone();
      label.userData.refDist = NODE_LABEL_REF;
      label.userData.kind = "nodeLabel";
      label.userData.activity = nodeActivity(n);
      label.userData.nodeId = n.id;
      label.userData.textLen = n.name.length;
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
    const proj = new THREE.Vector3();
    type Cand = { obj: THREE.Object3D; sx: number; sy: number; w: number; pr: number };

    const scaleLabels = () => {
      const fg = fgRef.current;
      const cam = fg?.camera?.();
      const scene = fg?.scene?.();
      const cont = containerRef.current;
      if (cam && scene && cont) {
        const W = cont.clientWidth;
        const H = cont.clientHeight;
        const sel = selRef.current.ids;
        const cands: Cand[] = [];

        scene.traverse((obj: THREE.Object3D) => {
          // Gentle idle spin on the node crystals.
          if (obj.userData?.kind === "nodeMesh") {
            obj.rotation.y += 0.004;
            return;
          }
          const base = obj.userData?.baseScale as THREE.Vector3 | undefined;
          const ref = obj.userData?.refDist as number | undefined;
          if (!base || !ref) return;

          // Constant on-screen size: scale ∝ distance to camera.
          obj.getWorldPosition(tmp);
          const f = cam.position.distanceTo(tmp) / ref;
          obj.scale.set(base.x * f, base.y * f, base.z * f);

          if (obj.userData.kind === "layerLabel") {
            obj.visible = true;
            return;
          }
          if (obj.userData.kind !== "nodeLabel") return;

          // Project to screen; cull off-screen / behind camera.
          proj.copy(tmp).project(cam);
          if (
            proj.z >= 1 ||
            proj.x < -1.1 ||
            proj.x > 1.1 ||
            proj.y < -1.1 ||
            proj.y > 1.1
          ) {
            obj.visible = false;
            return;
          }
          const act = (obj.userData.activity as number) ?? 0;
          const nid = obj.userData.nodeId as string;
          const tl = (obj.userData.textLen as number) ?? 6;
          cands.push({
            obj,
            sx: (proj.x * 0.5 + 0.5) * W,
            sy: (-proj.y * 0.5 + 0.5) * H,
            w: Math.max(24, tl * LABEL_PX_PER_CHAR),
            // Selected node + neighbors always win; otherwise rank by activity.
            pr: sel.has(nid) ? 1e9 + act : act,
          });
        });

        // Greedy screen-space declutter: highest priority first, hide overlaps.
        cands.sort((a, b) => b.pr - a.pr);
        const placed: Cand[] = [];
        for (const c of cands) {
          let overlap = false;
          for (const p of placed) {
            if (
              Math.abs(p.sx - c.sx) < (p.w + c.w) / 2 &&
              Math.abs(p.sy - c.sy) < LABEL_PX_HEIGHT + 3
            ) {
              overlap = true;
              break;
            }
          }
          c.obj.visible = !overlap;
          if (!overlap) placed.push(c);
        }
      }
      loopRaf = requestAnimationFrame(scaleLabels);
    };

    const setup = () => {
      const fg = fgRef.current;
      if (!fg || typeof fg.scene !== "function") {
        if (tries++ < 180) raf = requestAnimationFrame(setup);
        return;
      }

      fg.d3Force("charge")?.strength(-600);
      fg.d3Force("link")?.distance(115).strength(0.14);
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
              color: new THREE.Color("#ffffff"),
              transparent: true,
              opacity: 0.025,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          );
          plane.rotation.x = Math.PI / 2;
          plane.position.set(0, y, 0);
          plane.renderOrder = -2;
          scene.add(plane);

          const text = new SpriteText(meta.label.toUpperCase());
          text.color = "#d4d4d8";
          text.textHeight = 22;
          text.fontFace = LABEL_FONT;
          text.fontWeight = "600";
          text.strokeWidth = 0;
          text.backgroundColor = false as unknown as string;
          text.padding = 0;
          // Anchored to the right edge so it clears the left-side control panel.
          text.position.set(PLANE_HALF_W - 60, y + 30, 0);
          text.material.depthTest = false;
          text.material.depthWrite = false;
          text.renderOrder = 9;
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

  // Fly the camera to a searched node.
  useEffect(() => {
    if (!focusTarget) return;
    const fg = fgRef.current;
    if (!fg?.cameraPosition) return;
    const { x, y, z } = focusTarget;
    if (![x, y, z].every((v) => Number.isFinite(v))) return;
    fg.cameraPosition(
      { x, y: y + 30, z: z + 240 },
      { x, y, z },
      800,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget?.nonce]);

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
