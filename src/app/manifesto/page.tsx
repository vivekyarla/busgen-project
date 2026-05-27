import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Manifesto — Situational Unawareness",
  description:
    "Our view on where the next bottleneck in the AI stack is forming, and how to read the market from a full-stack perspective.",
};

// NOTE: placeholder copy. Sections mirror the project brief's two questions
// (market implications + full-stack perspective). Replace the [DRAFT] blocks.
export default function Manifesto() {
  return (
    <div className="min-h-full w-full">
      {/* Top bar */}
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

      <article className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
          Manifesto
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-5xl">
          Everyone is watching the wrong layer.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-zinc-300">
          The AI boom is narrated through a handful of names at the top of the
          stack. But the constraints that decide who wins are forming several
          layers down — in memory, power, packaging, interconnect — long before
          the market prices them. This is a tool for seeing that gap.
        </p>

        <Section title="The claim">
          <Placeholder>
            Deal flow is a leading indicator and public-market attention is a
            lagging one. When capital and capacity commitments pile onto a layer
            faster than its public valuation moves, that layer is the next
            bottleneck — the next “GPUs,” the next “HBM.” Situational
            Unawareness is the state of not seeing it coming.
          </Placeholder>
          <Placeholder>
            [DRAFT: state the thesis crisply in 2–3 sentences. What is the one
            claim a reader should leave with? Tie the name to Aschenbrenner&rsquo;s
            “Situational Awareness” and the inversion we&rsquo;re making.]
          </Placeholder>
        </Section>

        <Section title="Market implications">
          <Placeholder>
            [DRAFT — Question 1 from the brief: what is our view on the market
            implications of this information? Cover where we think value
            accrues next, which layers are over- vs. under-priced relative to
            their inbound deal flow, and what signals would confirm or break the
            thesis.]
          </Placeholder>
          <ul className="mt-4 space-y-2 text-zinc-400">
            <Bullet>[Layer we think is mispriced #1 — and the deals that say so]</Bullet>
            <Bullet>[Layer #2 — implied demand vs. realized revenue]</Bullet>
            <Bullet>[What a skeptic would say, and our answer]</Bullet>
          </ul>
        </Section>

        <Section title="A full-stack perspective">
          <Placeholder>
            [DRAFT — Question 2 from the brief: how can operators and investors
            approach the industry from a full-stack perspective? Argue that
            single-layer analysis misses the cross-layer dependencies the map
            makes visible, and lay out how to use the stack view to find
            leverage.]
          </Placeholder>
          <Placeholder>
            [DRAFT: a short “how an operator should act” paragraph and a short
            “how an investor should act” paragraph.]
          </Placeholder>
        </Section>

        <Section title="How to read the map">
          <Placeholder>
            The map opposite is the argument made spatial. Each layer of the
            stack is a plane; each deal is an edge between two companies; the
            <span className="text-zinc-300"> Deal heat </span>
            view weights nodes by how much activity is converging on them. Drag
            the timeline to watch the web densify, and search any company to
            jump to it.
          </Placeholder>
          <p className="mt-6">
            <Link
              href="/"
              className="text-sm font-medium text-zinc-200 underline-offset-4 hover:underline"
            >
              Open the map →
            </Link>
          </p>
        </Section>

        <hr className="my-16 border-zinc-900" />
        <p className="text-sm text-zinc-600">
          Draft — a class project. Data adapted from the open
          compute-deal-map dataset. Methodology and sources to follow.
        </p>
      </article>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      <div className="mt-4 space-y-5 text-base leading-relaxed text-zinc-300">
        {children}
      </div>
    </section>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
      <span>{children}</span>
    </li>
  );
}
