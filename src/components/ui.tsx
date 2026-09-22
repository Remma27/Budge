import type { ReactNode } from "react";

export const inputCls =
  "w-full min-w-0 min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export const labelCls =
  "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export const btnPrimaryCls =
  "w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";

export const btnDangerCls =
  "min-h-11 rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400";

export const btnGhostCls =
  "min-h-11 rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

export const linkCls =
  "text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100";

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
      {children}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {message}
    </p>
  );
}
