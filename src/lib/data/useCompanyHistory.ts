"use client";

import { useEffect, useState } from "react";
import type { CompanyHistoryFile } from "./sectorIndices";

/**
 * Lazily fetch the per-company price history from /public (it's ~0.8MB, so we
 * don't inline it into the page). Cached at module scope so it loads at most
 * once per session, the first time any company chart is expanded.
 */

let cache: CompanyHistoryFile | null = null;
let inflight: Promise<CompanyHistoryFile> | null = null;

function load(): Promise<CompanyHistoryFile> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch("/data/company-history.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: CompanyHistoryFile) => {
        cache = data;
        return data;
      })
      .catch((err) => {
        inflight = null; // allow retry on next mount
        throw err;
      });
  }
  return inflight;
}

/** Returns the history map (or null while loading), plus error state. */
export function useCompanyHistory(enabled: boolean) {
  const [file, setFile] = useState<CompanyHistoryFile | null>(cache);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled || file) return;
    let active = true;
    load()
      .then((data) => active && setFile(data))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [enabled, file]);

  return { companies: file?.companies ?? null, error };
}
