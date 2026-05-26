import { loadGraph } from "@/lib/data/load";
import GraphExplorer from "@/components/graph/GraphExplorer";

export default function Home() {
  const data = loadGraph();
  return <GraphExplorer data={data} />;
}
