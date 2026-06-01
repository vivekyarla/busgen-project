import type { Metadata } from "next";
import Link from "next/link";
import ManifestoBody from "@/components/manifesto/ManifestoBody";

export const metadata: Metadata = {
  title: "Manifesto — Situational Unawareness",
  description:
    "Consensus prices AI off compute and memory. The next bottleneck is forming in the layers it ignores. A backtest that flagged SK Hynix before it ran, and where the signal points now.",
};

export default function Manifesto() {
  return (
    <div className="min-h-full w-full">
      <header className="sticky top-0 z-10 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">
            Situational Unawareness
          </p>
          <Link
            href="/"
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            ← Back to the map
          </Link>
        </div>
      </header>

      <ManifestoBody />
    </div>
  );
}
