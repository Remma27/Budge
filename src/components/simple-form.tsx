"use client";
import { useActionState } from "react";
import { btnPrimaryCls, FormError, inputCls, labelCls } from "@/components/ui";
import type { ActionResult } from "@/lib/validations";

export function SimpleForm({ action, children, submitLabel = "Guardar", successMessage = "Cambios guardados." }: {
  action: (p: ActionResult, f: FormData) => Promise<ActionResult>;
  children: React.ReactNode; submitLabel?: string; successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(async (prev: ActionResult, data: FormData): Promise<ActionResult> => {
    const result = await action(prev, data);
    return result.ok ? { ...result, message: result.message ?? successMessage } : result;
  }, { ok: true });
  return <form action={formAction} className="grid min-w-0 gap-4">
    {children}
    <FormError message={state.ok ? null : state.error} />
    {state.ok && state.message && <p role="status" className="text-sm text-green-700 dark:text-green-400">{state.message}</p>}
    <button className={btnPrimaryCls} disabled={pending}>{pending ? "Guardando…" : submitLabel}</button>
  </form>;
}
export { inputCls, labelCls };
