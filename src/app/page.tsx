import { loadGraph } from "@/lib/data/load";
import { loadLayerContent } from "@/lib/data/layer-content";
import HomeShell from "@/components/HomeShell";

export default function Home() {
  const data = loadGraph();
  const layerContent = loadLayerContent();
  return <HomeShell data={data} layerContent={layerContent} />;
}
