import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-md gap-3 py-10 text-center">
      <h1 className="text-xl font-bold">Página no encontrada</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Lo que buscas no existe o fue movido.
      </p>
      <Link
        href="/"
        className="mx-auto inline-flex min-h-11 items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
