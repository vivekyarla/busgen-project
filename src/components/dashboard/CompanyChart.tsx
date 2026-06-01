"use client";

import { useState } from "react";
import {
  WINDOW_KEYS,
  type CompanyHistory,
  type WindowKey,
} from "@/lib/data/sectorIndices";
import TraceChart from "./TraceChart";

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  KRW: "₩",
  TWD: "NT$",
  HKD: "HK$",
};

function makePriceFmt(currency: string | null) {
  const sym = currency ? (CURRENCY_SYMBOL[currency] ?? "") : "";
  return (v: number) => {
    const digits = Math.abs(v) >= 1000 ? 0 : 2;
    const num = v.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    return sym ? `${sym}${num}` : `${num}${currency ? " " + currency : ""}`;
  };
}

function fmtPct(frac: number | null | undefined): string {
  if (frac == null) return "—";
  const pct = frac * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export default function CompanyChart({ history }: { history: CompanyHistory }) {
  const available = WINDOW_KEYS.filter((k) => history.windows[k]);
  const [win, setWin] = useState<WindowKey>(
    available.includes("1Y") ? "1Y" : available[available.length - 1],
  );
  const w = history.windows[win];
  const priceFmt = makePriceFmt(history.currency);

  return (
    <div className="rounded-md border border-zinc-800/80 bg-zinc-950/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex rounded-md border border-zinc-800 p-0.5 text-[11px]">
          {WINDOW_KEYS.map((k) => {
            const has = !!history.windows[k];
            return (
              <button
                key={k}
                disabled={!has}
                onClick={() => setWin(k)}
                className={`rounded px-2 py-0.5 font-mono transition-colors ${
                  win === k
                    ? "bg-zinc-200 text-zinc-900"
                    : has
                      ? "text-zinc-400 hover:text-zinc-100"
                      : "cursor-not-allowed text-zinc-700"
                }`}
              >
                {k}
              </button>
            );
          })}
        </div>
        {w && (
          <div
            className={`font-mono text-sm ${w.ret >= 0 ? "text-emerald-400" : "text-rose-400"}`}
          >
            {fmtPct(w.ret)}
            <span className="ml-1 text-[10px] uppercase tracking-wider text-zinc-600">
              {win}
            </span>
          </div>
        )}
      </div>

      {w ? (
        <TraceChart
          key={win}
          series={w.series}
          baseline={null}
          valueFmt={priceFmt}
        />
      ) : (
        <p className="py-6 text-center text-xs text-zinc-600">
          No price data for this window.
        </p>
      )}
      <p className="mt-1 text-[10px] text-zinc-600">
        Price in {history.currency ?? "native currency"} · press &amp; drag to
        measure between two points
      </p>
    </div>
  );
}
