export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
      <div className="max-w-2xl text-center space-y-6">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
          Situational Unawareness
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold leading-tight tracking-tight text-zinc-50">
          A live map of the AI stack.
        </h1>
        <p className="text-lg leading-relaxed text-zinc-400">
          Deals pile up across the stack faster than public markets price them
          in. This site is a tool for finding where that gap is widening — the
          next bottlenecks before they show up in headlines.
        </p>
        <p className="text-sm text-zinc-500 pt-8">
          The map is coming online. Stand by.
        </p>
      </div>
    </main>
  );
}
