"use client";

import { useActionState, useState } from "react";
import {
  btnDangerCls,
  btnPrimaryCls,
  FormError,
  inputCls,
  labelCls,
} from "@/components/ui";
import type { ActionResult } from "@/lib/validations";
import {
  createCategory,
  deleteCategory,
  renameCategory,
} from "@/app/actions/categories";

export function NewCategoryForm({ workspaceId }: { workspaceId: string | null }) {
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(
    async (prev: ActionResult, fd: FormData) => {
      const res = await createCategory(prev, fd);
      if (res.ok) setFormKey((k) => k + 1);
      return res;
    },
    { ok: true },
  );

  return (
    <form key={formKey} action={formAction} className="grid gap-3"><input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
      <FormError message={state.ok ? null : state.error} />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelCls} htmlFor="name">
            Nombre
          </label>
          <input
            id="name"
            name="name"
            className={inputCls}
            maxLength={60}
            placeholder="Ej. Mascotas"
            required
          />
        </div>
        <div className="w-24">
          <label className={labelCls} htmlFor="color">
            Color
          </label>
          <input
            id="color"
            name="color"
            type="color"
            className={`${inputCls} h-10 cursor-pointer p-1`}
            defaultValue="#6366f1"
          />
        </div>
      </div>
      <button type="submit" className={btnPrimaryCls} disabled={pending}>
        {pending ? "Creando…" : "Crear categoría"}
      </button>
    </form>
  );
}

export function CategoryRow({
  id,
  name,
  color,
  count,
  workspaceId,
}: {
  id: string;
  name: string;
  color: string;
  count: number;
  workspaceId: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: ActionResult, fd: FormData) => {
      const res = await renameCategory(id, prev, fd);
      if (res.ok) setEditing(false);
      return res;
    },
    { ok: true },
  );

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {editing ? (
        <form action={formAction} className="flex flex-1 items-center gap-2"><input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
          <input
            name="name"
            defaultValue={name}
            maxLength={60}
            required
            className={inputCls}
          />
          <input
            name="color"
            type="color"
            defaultValue={color}
            className={`${inputCls} h-10 w-14 cursor-pointer p-1`}
          />
          <button
            type="submit"
            disabled={pending}
            className="text-sm font-medium underline underline-offset-4"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-zinc-500"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <>
          <div className="flex-1">
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-zinc-500">
              {count === 0
                ? "Sin movimientos"
                : `${count} movimiento${count === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-zinc-500 underline underline-offset-4"
          >
            Renombrar
          </button>
          <form action={deleteCategory.bind(null, id, workspaceId ?? undefined)}>
            <button type="submit" className={btnDangerCls}>
              Eliminar
            </button>
          </form>
        </>
      )}
      {!state.ok && <FormError message={state.error} />}
    </div>
  );
}
