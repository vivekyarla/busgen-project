import { loadGraph } from "@/lib/data/load";
import { LAYER_ORDER, LAYER_META } from "@/lib/data/layers";
import StackGraph from "@/components/graph/StackGraph";

export default function Home() {
  const data = loadGraph();

  return (
    <div className="relative flex-1 h-full overflow-hidden">
      <StackGraph data={data} />

      <header className="pointer-events-none absolute left-0 top-0 z-10 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
          Situational Unawareness
        </p>
        <h1 className="mt-1 text-lg font-semibold text-zinc-100">
          The AI Stack
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          {data.meta.companyCount} companies · {data.meta.dealCount} deals
        </p>
      </header>

      <aside className="pointer-events-none absolute right-0 top-0 z-10 space-y-1.5 p-6">
        {LAYER_ORDER.map((l) => (
          <div
            key={l}
            className="flex items-center justify-end gap-2 text-xs text-zinc-400"
          >
            {LAYER_META[l].label}
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: LAYER_META[l].color }}
            />
          </div>
        ))}
      </aside>
    </div>
  );
}
