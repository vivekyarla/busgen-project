"use client";

import { useEffect, useRef } from "react";

type P = { x: number; y: number; vx: number; vy: number };

/**
 * Full-screen landing gate. A drifting constellation of unmarked nodes +
 * connecting lines (echoing the map's aesthetic) sits behind the title, with a
 * button to enter the site. Aesthetic mirrors StackGraph: zinc-950 ground,
 * faint blue-grey links like IDLE_LINK.
 */
export default function Landing({ onEnter }: { onEnter: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let pts: P[] = [];

    const LINK_DIST = 150; // px within which two nodes are joined
    const SPEED = 0.18;

    const seed = () => {
      // density scales with viewport area, capped for perf
      const count = Math.min(90, Math.round((w * h) / 18000));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * SPEED,
        vy: (Math.random() - 0.5) * SPEED,
      }));
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // advance + bounce off edges
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      // links — opacity falls off with distance
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < LINK_DIST) {
            const o = (1 - d / LINK_DIST) * 0.28;
            ctx.strokeStyle = `rgba(180,182,194,${o})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // nodes
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(228,228,231,0.7)";
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-950">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden
      />
      {/* radial vignette to lift the title off the constellation */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(9,9,11,0.85) 0%, rgba(9,9,11,0.55) 45%, rgba(9,9,11,0) 80%)",
        }}
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-zinc-500 sm:text-xs">
          An interactive map of the AI stack
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-zinc-50 sm:text-7xl md:text-8xl">
          Situational Unawareness
        </h1>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-zinc-400 sm:text-base">
          Where deal flow is piling up but the market hasn&rsquo;t caught up.
          The next GPUs, the next memory, the next bottleneck.
        </p>
        <button
          onClick={onEnter}
          className="group mt-9 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-100/5 px-7 py-2.5 text-sm font-medium text-zinc-100 backdrop-blur-sm transition-colors hover:border-zinc-400 hover:bg-zinc-100/10"
        >
          Enter the map
          <span className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
      </div>
    </div>
  );
}
