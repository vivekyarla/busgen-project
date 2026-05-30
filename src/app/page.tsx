import { loadGraph } from "@/lib/data/load";
import { loadLayerContent } from "@/lib/data/layer-content";
import GraphExplorer from "@/components/graph/GraphExplorer";

export default function Home() {
  const data = loadGraph();
  const layerContent = loadLayerContent();
  return <GraphExplorer data={data} layerContent={layerContent} />;
}
