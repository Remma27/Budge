"use client";

import { useActionState, useEffect, useState } from "react";
import { btnPrimaryCls, FormError, inputCls, labelCls } from "@/components/ui";
import type { ActionResult } from "@/lib/validations";

export type TransactionAction = (
  prev: ActionResult,
  formData: FormData,
) => Promise<ActionResult>;

export interface TransactionInitial {
  type: string;
  amount: string;
  currency: string;
  date: string;
  note: string;
  categoryId: string;
}

const MONEDAS = ["MXN", "USD", "EUR", "COP", "ARS", "CLP", "PEN"];

export function TransactionForm({
  action,
  categories,
  initial,
  submitLabel,
  resetOnSuccess = false,
  workspaceId = null,
}: {
  action: TransactionAction;
  categories: { id: string; name: string }[];
  initial?: TransactionInitial;
  submitLabel: string;
  resetOnSuccess?: boolean;
  workspaceId?: string | null;
}) {
  // ponytail: al guardar con éxito se remonta el form (key) en vez de
  // resetearlo en un effect (evita set-state-in-effect).
  const [formKey, setFormKey] = useState(0);
  const [offline, setOffline] = useState(false);
  const sync = async () => {
    if (!navigator.onLine) return;
    const db = await openQueue(); const tx = db.transaction("queue", "readonly");
    const rows = await new Promise<Queued[]>((resolve) => { const r = tx.objectStore("queue").getAll(); r.onsuccess = () => resolve(r.result); });
    if (!rows.length) return;
    const response = await fetch("/api/sync/transactions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ transactions: rows.map(({ id: _id, ...row }) => ({ id: _id, ...row })) }) });
    if (response.ok) { const write = db.transaction("queue", "readwrite").objectStore("queue"); rows.forEach((row) => write.delete(row.id)); setOffline(false); }
  };
  useEffect(() => {
    const initialSync = window.setTimeout(() => void sync(), 0);
    window.addEventListener("online", sync);
    navigator.serviceWorker?.addEventListener("message", sync);
    return () => { window.clearTimeout(initialSync); window.removeEventListener("online", sync); navigator.serviceWorker?.removeEventListener("message", sync); };
  }, []);
  const [state, formAction, pending] = useActionState(
    async (prev: ActionResult, fd: FormData) => {
      const res = await action(prev, fd);
      if (res.ok && resetOnSuccess) setFormKey((k) => k + 1);
      return res;
    },
    { ok: true },
  );

  return (
    <form key={formKey} action={formAction} className="grid gap-3" onSubmit={(event) => {
      if (navigator.onLine) return;
      event.preventDefault(); const fd = new FormData(event.currentTarget); const id = crypto.randomUUID();
      void enqueue({ id, type: String(fd.get("type")), amount: String(fd.get("amount")), currency: String(fd.get("currency")), date: String(fd.get("date")), note: String(fd.get("note") || ""), categoryId: String(fd.get("categoryId") || "") });
      setOffline(true); setFormKey((key) => key + 1);
    }}>
      <input type="hidden" name="workspaceId" value={workspaceId ?? ""} /><FormError message={state.ok ? null : state.error} />
      {offline && <p className="text-sm text-amber-600">Guardado sin conexión. Se sincronizará automáticamente.</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="type">
            Tipo
          </label>
          <select
            id="type"
            name="type"
            className={inputCls}
            defaultValue={initial?.type ?? "EXPENSE"}
            required
          >
            <option value="EXPENSE">Gasto</option>
            <option value="INCOME">Ingreso</option>
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="amount">
            Monto
          </label>
          <input
            id="amount"
            name="amount"
            className={inputCls}
            inputMode="decimal"
            placeholder="150.50"
            defaultValue={initial?.amount ?? ""}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="currency">
            Moneda
          </label>
          <input
            id="currency"
            name="currency"
            className={inputCls}
            list="monedas"
            defaultValue={initial?.currency ?? "MXN"}
            maxLength={3}
            required
          />
          <datalist id="monedas">
            {MONEDAS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelCls} htmlFor="date">
            Fecha
          </label>
          <input
            id="date"
            name="date"
            type="date"
            className={inputCls}
            defaultValue={initial?.date ?? ""}
            required
          />
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="categoryId">
          Categoría
        </label>
        <select
          id="categoryId"
          name="categoryId"
          className={inputCls}
          defaultValue={initial?.categoryId ?? ""}
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="note">
          Nota (opcional)
        </label>
        <input
          id="note"
          name="note"
          className={inputCls}
          maxLength={280}
          placeholder="Ej. Súper de la semana"
          defaultValue={initial?.note ?? ""}
        />
      </div>
      <button type="submit" className={btnPrimaryCls} disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}

type Queued = { id: string; type: string; amount: string; currency: string; date: string; note: string; categoryId: string };
function openQueue() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("budge-offline", 1); request.onupgradeneeded = () => request.result.createObjectStore("queue", { keyPath: "id" }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function enqueue(row: Queued) {
  const db = await openQueue(); db.transaction("queue", "readwrite").objectStore("queue").put(row);
  const registration = await navigator.serviceWorker?.ready;
  if (registration && "sync" in registration) await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register("budge-sync");
}
