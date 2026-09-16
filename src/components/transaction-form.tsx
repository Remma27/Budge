"use client";

import { useActionState, useState } from "react";
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
}: {
  action: TransactionAction;
  categories: { id: string; name: string }[];
  initial?: TransactionInitial;
  submitLabel: string;
  resetOnSuccess?: boolean;
}) {
  // ponytail: al guardar con éxito se remonta el form (key) en vez de
  // resetearlo en un effect (evita set-state-in-effect).
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(
    async (prev: ActionResult, fd: FormData) => {
      const res = await action(prev, fd);
      if (res.ok && resetOnSuccess) setFormKey((k) => k + 1);
      return res;
    },
    { ok: true },
  );

  return (
    <form key={formKey} action={formAction} className="grid gap-3">
      <FormError message={state.ok ? null : state.error} />
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
