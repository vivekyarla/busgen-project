"use client";

import { useEffect, useState } from "react";
import type { GraphData } from "@/lib/data/load";
import GraphExplorer from "@/components/graph/GraphExplorer";
import Landing from "@/components/Landing";

const ENTERED_KEY = "su-entered";

/**
 * Gates the home page behind a landing screen. The graph mounts as the landing
 * fades out, so entering crossfades straight into the map.
 *
 * The landing is skipped when arriving with a `?focus=<slug>` deep-link (e.g.
 * from the dashboard) or when the visitor has already entered earlier this
 * session — so round-trips to /dashboard don't replay the intro.
 */
export default function HomeShell({ data }: { data: GraphData }) {
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [focusSlug, setFocusSlug] = useState<string | null>(null);

  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (focus) setFocusSlug(focus);
    if (focus || sessionStorage.getItem(ENTERED_KEY) === "1") {
      setEntered(true);
    }
  }, []);

  const handleEnter = () => {
    try {
      sessionStorage.setItem(ENTERED_KEY, "1");
    } catch {}
    setExiting(true); // start the landing fade + mount the graph behind it
    window.setTimeout(() => setEntered(true), 650); // unmount landing after fade
  };

  return (
    <div className="relative flex h-full flex-1 flex-col">
      {(exiting || entered) && (
        <GraphExplorer data={data} focusSlug={focusSlug} />
      )}

      {!entered && (
        <div
          className={`absolute inset-0 z-30 transition-opacity duration-[600ms] ease-out ${
            exiting ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <Landing onEnter={handleEnter} />
        </div>
      )}
    </div>
  );
}
