export default function Loading() {
  return (
    <div className="grid animate-pulse gap-4" aria-label="Cargando">
      <div className="h-8 w-40 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-28 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-3 h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="grid gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          />
        ))}
      </div>
    </div>
  );
}
