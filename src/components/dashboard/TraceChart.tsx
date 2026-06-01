"use client";

import { useMemo, useState } from "react";

/**
 * Interactive line chart shared by the layer index and per-company price views.
 * Hover to trace (crosshair + dot + floating label). Press & drag to measure
 * the % change between two points (Google-Finance style), with a shaded band.
 *
 * - baseline: dashed reference line + included in the y-range (100 for a rebased
 *   index). Pass null for raw prices (no reference line).
 * - valueFmt: formats the value shown in the tooltip (index level vs. price).
 */

function fmtPct(frac: number | null | undefined, digits = 1): string {
  if (frac == null) return "—";
  const pct = frac * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(digits)}%`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function TraceChart({
  series,
  baseline = 100,
  valueFmt = (v: number) => v.toFixed(2),
}: {
  series: { t: string; v: number }[];
  baseline?: number | null;
  valueFmt?: (v: number) => string;
}) {
  const W = 640;
  const H = 200;
  const PAD = { top: 12, right: 12, bottom: 22, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = series.length;

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [anchorIdx, setAnchorIdx] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const { path, area, baseY, first, last, ticks, minV, span } = useMemo(() => {
    const vs = series.map((p) => p.v);
    const extra = baseline != null ? [baseline] : [];
    const minV = Math.min(...vs, ...extra);
    const maxV = Math.max(...vs, ...extra);
    const span = maxV - minV || 1;
    const x = (i: number) => PAD.left + (n === 1 ? 0 : (i / (n - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - minV) / span) * innerH;
    const path = series.map((p, i) => `${x(i)},${y(p.v)}`).join(" ");
    const area = `${PAD.left},${PAD.top + innerH} ${path} ${PAD.left + innerW},${PAD.top + innerH}`;
    const tickVals = baseline != null ? [minV, baseline, maxV] : [minV, maxV];
    const ticks = tickVals
      .filter((v, i, a) => a.indexOf(v) === i)
      .map((v) => ({ v, y: y(v) }));
    return {
      path,
      area,
      baseY: baseline != null ? y(baseline) : null,
      first: series[0],
      last: series[series.length - 1],
      ticks,
      minV,
      span,
    };
  }, [series, innerW, innerH, n, baseline]);

  const stroke = last.v >= first.v ? "#34d399" : "#f87171";

  const fxFrac = (i: number) =>
    (PAD.left + (n === 1 ? 0 : (i / (n - 1)) * innerW)) / W;
  const topFrac = (v: number) =>
    (PAD.top + innerH - ((v - minV) / span) * innerH) / H;

  const idxFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    const frac = (vbX - PAD.left) / innerW;
    return Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
  };

  const hovered = hoverIdx != null ? series[hoverIdx] : null;
  const anchored = anchorIdx != null ? series[anchorIdx] : null;
  const baseVal = anchored ? anchored.v : first.v;
  const changeFrac = hovered ? hovered.v / baseVal - 1 : null;
  const changeColor =
    changeFrac == null
      ? "text-zinc-300"
      : changeFrac >= 0
        ? "text-emerald-400"
        : "text-rose-400";

  const hx = hoverIdx != null ? fxFrac(hoverIdx) * 100 : 0;
  const tipAlign =
    hx < 20
      ? "translateX(0)"
      : hx > 80
        ? "translateX(-100%)"
        : "translateX(-50%)";

  return (
    <div className="relative h-44 w-full select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="tc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {baseY != null && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={baseY}
            y2={baseY}
            stroke="#3f3f46"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}
        {ticks.map((t) => (
          <text
            key={t.v}
            x={PAD.left - 6}
            y={t.y + 3}
            textAnchor="end"
            className="fill-zinc-600"
            fontSize="9"
            fontFamily="monospace"
          >
            {valueFmt(t.v)}
          </text>
        ))}
        <polyline points={area} fill="url(#tc-fill)" stroke="none" />
        <polyline
          points={path}
          fill="none"
          stroke={stroke}
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <text
          x={PAD.left}
          y={H - 6}
          className="fill-zinc-600"
          fontSize="9"
          fontFamily="monospace"
        >
          {first.t}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          textAnchor="end"
          className="fill-zinc-600"
          fontSize="9"
          fontFamily="monospace"
        >
          {last.t}
        </text>
      </svg>

      {anchored && hovered && anchorIdx !== hoverIdx && (
        <div
          className="pointer-events-none absolute top-0 bottom-5"
          style={{
            left: `${Math.min(fxFrac(anchorIdx!), fxFrac(hoverIdx!)) * 100}%`,
            width: `${Math.abs(fxFrac(hoverIdx!) - fxFrac(anchorIdx!)) * 100}%`,
            background:
              changeFrac != null && changeFrac >= 0
                ? "rgba(52,211,153,0.10)"
                : "rgba(248,113,113,0.10)",
          }}
        />
      )}

      {anchored && (
        <>
          <div
            className="pointer-events-none absolute top-0 bottom-5 w-px bg-zinc-600/50"
            style={{ left: `${fxFrac(anchorIdx!) * 100}%` }}
          />
          <div
            className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-300 bg-zinc-950"
            style={{
              left: `${fxFrac(anchorIdx!) * 100}%`,
              top: `${topFrac(anchored.v) * 100}%`,
            }}
          />
        </>
      )}

      {hovered && (
        <>
          <div
            className="pointer-events-none absolute top-0 bottom-5 w-px bg-zinc-400/60"
            style={{ left: `${hx}%` }}
          />
          <div
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-zinc-950"
            style={{
              left: `${hx}%`,
              top: `${topFrac(hovered.v) * 100}%`,
              background: stroke,
            }}
          />
          <div
            className="pointer-events-none absolute top-1 z-10 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900/95 px-2 py-1 shadow-lg"
            style={{ left: `${hx}%`, transform: tipAlign }}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm text-zinc-100">
                {valueFmt(hovered.v)}
              </span>
              <span className={`font-mono text-xs ${changeColor}`}>
                {fmtPct(changeFrac)}
              </span>
            </div>
            <div className="text-[10px] text-zinc-500">
              {anchored && anchorIdx !== hoverIdx ? (
                <span>
                  {fmtDateShort(anchored.t)} → {fmtDateShort(hovered.t)}
                </span>
              ) : (
                <span>
                  {fmtDate(hovered.t)}
                  <span className="ml-1 text-zinc-600">
                    {anchored ? "vs anchor" : "vs start"}
                  </span>
                </span>
              )}
            </div>
          </div>
        </>
      )}

      <div
        className="absolute inset-0 cursor-crosshair touch-none"
        onPointerDown={(e) => {
          const i = idxFromEvent(e);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* pointer capture unsupported — drag still works via move events */
          }
          setDragging(true);
          setAnchorIdx(i);
          setHoverIdx(i);
        }}
        onPointerMove={(e) => setHoverIdx(idxFromEvent(e))}
        onPointerUp={(e) => {
          const i = idxFromEvent(e);
          if (anchorIdx === i) setAnchorIdx(null);
          setDragging(false);
        }}
        onPointerLeave={() => {
          if (!dragging) setHoverIdx(null);
        }}
      />
    </div>
  );
}
