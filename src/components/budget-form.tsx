"use client";
import { useState } from "react";
import { SimpleForm } from "@/components/simple-form";
import { inputCls, labelCls } from "@/components/ui";
import { createBudget } from "@/app/actions/budgets";
import { formatMoney } from "@/lib/format";

export function BudgetForm({ categories, workspaceId, currency, month, income }: {
  categories: { id: string; name: string }[]; workspaceId: string | null; currency: string; month: string; income: number;
}) {
  const [mode, setMode] = useState("PERCENTAGE");
  const [value, setValue] = useState("");
  const amount = mode === "PERCENTAGE" ? Math.round(income * Number(value)) / 100 : Number(value);
  return <SimpleForm action={createBudget} submitLabel="Asignar presupuesto" successMessage="Presupuesto guardado. La distribución ya está actualizada.">
    <input type="hidden" name="workspaceId" value={workspaceId ?? ""} /><input type="hidden" name="currency" value={currency} /><input type="hidden" name="month" value={month} />
    <label><span className={labelCls}>Categoría</span><select name="categoryId" className={inputCls} required><option value="">Selecciona una categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label><span className={labelCls}>Asignar por</span><select name="mode" className={inputCls} value={mode} onChange={e => { setMode(e.target.value); setValue(""); }}><option value="PERCENTAGE">Porcentaje de mis ingresos</option><option value="FIXED">Monto fijo</option></select></label>
      <label><span className={labelCls}>{mode === "PERCENTAGE" ? "Porcentaje (%)" : `Monto (${currency})`}</span><input name={mode === "PERCENTAGE" ? "percentage" : "amount"} type="number" inputMode="decimal" min="0.01" max={mode === "PERCENTAGE" ? "100" : "9999999999.99"} step="0.01" className={inputCls} value={value} onChange={e => setValue(e.target.value)} placeholder={mode === "PERCENTAGE" ? "Ej. 30" : "Ej. 150000"} required /></label>
    </div>
    <p aria-live="polite" className="text-sm text-zinc-600">{mode === "PERCENTAGE" ? `${value || 0}% de ${formatMoney(income, currency)} = ${formatMoney(Number.isFinite(amount) ? amount : 0, currency)}` : `Se asignarán ${formatMoney(Number.isFinite(amount) ? amount : 0, currency)}.`}</p>
  </SimpleForm>;
}
