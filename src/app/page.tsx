import { loadGraph } from "@/lib/data/load";
import HomeShell from "@/components/HomeShell";

export default function Home() {
  const data = loadGraph();
  return <HomeShell data={data} />;
}
