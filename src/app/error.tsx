"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto grid max-w-md gap-3 py-10 text-center">
      <h1 className="text-xl font-bold">Algo salió mal</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No pudimos cargar esta sección. Revisa tu conexión e inténtalo de nuevo.
      </p>
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="min-h-11 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
