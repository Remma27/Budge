"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { btnDangerCls } from "@/components/ui";
import {
  deleteTransaction,
  restoreTransaction,
  type DeleteSnapshot,
} from "@/app/actions/transactions";

export function DeleteTransactionButton({
  id,
  message = "¿Eliminar este movimiento?",
}: {
  id: string;
  message?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [snapshot, setSnapshot] = useState<DeleteSnapshot | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function onDelete() {
    if (!window.confirm(`${message} Esta acción no se puede deshacer.`)) return;
    setPending(true);
    const snap = await deleteTransaction(id);
    setPending(false);
    router.refresh();
    if (!snap) return;
    setSnapshot(snap);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSnapshot(null), 8000);
  }

  async function onUndo() {
    if (!snapshot) return;
    window.clearTimeout(timer.current);
    setPending(true);
    const res = await restoreTransaction(snapshot);
    setPending(false);
    setSnapshot(null);
    if (res.ok) router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className={btnDangerCls}
        disabled={pending}
        onClick={() => void onDelete()}
      >
        {pending ? "Procesando..." : "Eliminar"}
      </button>
      {snapshot && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <span className="text-sm">Movimiento eliminado.</span>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            onClick={() => void onUndo()}
          >
            Deshacer
          </button>
        </div>
      )}
    </>
  );
}
