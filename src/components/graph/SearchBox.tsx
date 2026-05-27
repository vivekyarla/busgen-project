"use client";

import { useMemo, useRef, useState } from "react";
import type { GraphNode } from "@/lib/data/load";
import { LAYER_META, type Layer } from "@/lib/data/layers";

interface SearchBoxProps {
  nodes: GraphNode[];
  onPick: (id: string) => void;
}

export default function SearchBox({ nodes, onPick }: SearchBoxProps) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const scored: { n: GraphNode; score: number }[] = [];
    for (const n of nodes) {
      const name = n.name.toLowerCase();
      const ticker = (n.ticker ?? "").toLowerCase();
      let score = -1;
      if (name.startsWith(s)) score = 0;
      else if (ticker && ticker.startsWith(s)) score = 1;
      else if (name.includes(s)) score = 2;
      else if (ticker.includes(s)) score = 3;
      if (score >= 0) scored.push({ n, score });
    }
    scored.sort(
      (a, b) => a.score - b.score || a.n.name.localeCompare(b.n.name),
    );
    return scored.slice(0, 8).map((x) => x.n);
  }, [q, nodes]);

  const pick = (id: string) => {
    onPick(id);
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="pointer-events-auto w-72">
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((h) => Math.min(h + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            if (results[hi]) pick(results[hi].id);
          } else if (e.key === "Escape") {
            setQ("");
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder="Search companies…"
        className="w-full rounded-full border border-zinc-800/80 bg-zinc-950/85 px-4 py-2 text-sm text-zinc-100 outline-none backdrop-blur-sm placeholder:text-zinc-500 focus:border-zinc-600"
      />
      {open && results.length > 0 && (
        <ul className="mt-1.5 overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm">
          {results.map((n, i) => (
            <li key={n.id}>
              <button
                onMouseEnter={() => setHi(i)}
                // onMouseDown (not onClick) so the pick fires before input blur.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(n.id);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left ${
                  i === hi ? "bg-zinc-800/70" : ""
                }`}
              >
                <span className="truncate text-sm text-zinc-200">
                  {n.name}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] text-zinc-500">
                    {LAYER_META[n.layer as Layer]?.label.split(" ")[0]}
                  </span>
                  {n.ticker && (
                    <span className="font-mono text-[11px] text-zinc-400">
                      {n.ticker}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
