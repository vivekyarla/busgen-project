"use client";

import { useState } from "react";
import type { GraphData } from "@/lib/data/load";
import type { LayerContentMap } from "@/lib/data/layer-content";
import GraphExplorer from "@/components/graph/GraphExplorer";
import Landing from "@/components/Landing";

/**
 * Gates the home page behind a landing screen. The graph mounts as the landing
 * fades out, so entering crossfades straight into the map.
 */
export default function HomeShell({
  data,
  layerContent,
}: {
  data: GraphData;
  layerContent: LayerContentMap;
}) {
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);

  const handleEnter = () => {
    setExiting(true); // start the landing fade + mount the graph behind it
    window.setTimeout(() => setEntered(true), 650); // unmount landing after fade
  };

  return (
    <div className="relative flex h-full flex-1 flex-col">
      {(exiting || entered) && (
        <GraphExplorer data={data} layerContent={layerContent} />
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
