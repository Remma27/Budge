import { requireUserId } from "@/lib/get-user";
import { Card, btnDangerCls } from "@/components/ui";
import { SimpleForm, inputCls, labelCls } from "@/components/simple-form";
import { createRecurring, deleteRecurring, generateDueRecurring, toggleRecurring, updateRecurring } from "@/app/actions/recurring";
import { formatMoney, toInputDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, scopeWorkspace } from "@/lib/workspace";
import { advanceRecurring, frequencyLabels } from "@/lib/recurring-schedule";

export default async function Page({ searchParams }: { searchParams: Promise<{ workspaceId?: string }> }) {
  const userId = await requireUserId();
  const { workspaceId } = await getWorkspaceContext(userId, (await searchParams).workspaceId);
  const scope = scopeWorkspace(userId, workspaceId);
  const [categories, rules, paymentMethods, owner] = await Promise.all([
    prisma.category.findMany({ where: scope, orderBy: { name: "asc" } }),
    prisma.recurringRule.findMany({ where: scope, include: { category: true, paymentMethod: true, recurringRuns: { orderBy: { scheduledDate: "desc" }, take: 10 } }, orderBy: { nextRun: "asc" } }),
    prisma.paymentMethod.findMany({ where: scope, orderBy: { name: "asc" } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { primaryCurrency: true } }),
  ]);
  const now = new Date();
  const projection = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() + index, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const total = rules.filter(r => r.isActive && r.type === "EXPENSE" && r.currency === owner.primaryCurrency).reduce((sum, rule) => {
      let date = rule.nextRun;
      while (date < end) {
        if (date >= start) sum += Number(rule.amount);
        date = advanceRecurring(date, rule.frequency, rule.chargeDay);
      }
      return sum;
    }, 0);
    return { label: start.toLocaleDateString("es", { month: "short" }), total };
  });
  return <div className="grid gap-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-bold">Recurrentes</h1><p className="mt-1 text-sm text-zinc-600">Gastos e ingresos que se repiten automáticamente.</p></div>
      <form action={generateDueRecurring}><input type="hidden" name="workspaceId" value={workspaceId ?? ""} /><button className="min-h-11 rounded-lg border px-3 py-2 text-sm">Registrar vencidos</button></form>
    </div>
    <Card><h2 className="mb-4 font-semibold">Nuevo recurrente</h2><SimpleForm action={createRecurring} submitLabel="Crear recurrente" successMessage="Recurrente creado."><input type="hidden" name="workspaceId" value={workspaceId ?? ""} /><RuleFields categories={categories} paymentMethods={paymentMethods} currency={owner.primaryCurrency} /></SimpleForm></Card>
    {rules.map(r => <Card key={r.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="break-words font-semibold">{r.note || r.provider || "Recurrente"}</h2>
          <p className="mt-1 text-sm text-zinc-600">{r.type === "INCOME" ? "Ingreso" : "Gasto"} · {frequencyLabels[r.frequency]} · {formatMoney(r.amount, r.currency)}</p>
          <p className="mt-1 text-sm">Categoría: <strong>{r.category?.name ?? "Sin categoría"}</strong></p>
          <p className="mt-1 text-sm text-zinc-600">{r.paymentMethod?.name ?? "Sin medio de pago"} · Próximo: {toInputDate(r.nextRun)} · {r.isActive ? "Activo" : "Pausado"}</p>
        </div>
        <div className="flex flex-wrap gap-2"><form action={toggleRecurring.bind(null, r.id, workspaceId ?? undefined)}><button className="min-h-11 rounded-lg border px-3 py-2 text-sm">{r.isActive ? "Pausar" : "Activar"}</button></form><form action={deleteRecurring.bind(null, r.id, workspaceId ?? undefined)}><button className={`${btnDangerCls} min-h-11`}>Eliminar</button></form></div>
      </div>
      <details className="mt-4"><summary className="cursor-pointer py-2 text-sm font-medium underline underline-offset-4">Editar recurrente</summary>
        <div className="mt-3"><SimpleForm action={updateRecurring.bind(null, r.id)} submitLabel="Guardar cambios" successMessage="Recurrente actualizado. La categoría se usará en los próximos movimientos.">
          <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
          <RuleFields key={r.updatedAt.toISOString()} categories={categories} paymentMethods={paymentMethods} currency={owner.primaryCurrency} initial={r} />
        </SimpleForm></div>
      </details>
      <details className="mt-2"><summary className="cursor-pointer py-2 text-sm text-zinc-600">Últimos movimientos generados ({r.recurringRuns.length})</summary><ol className="mt-2 grid gap-2 text-sm">{r.recurringRuns.map(run => <li key={run.id} className="flex flex-wrap justify-between gap-1"><span>Programado: {toInputDate(run.scheduledDate)}</span><span>Registrado: {toInputDate(run.createdAt)}</span></li>)}</ol></details>
    </Card>)}
    <Card><h2 className="font-semibold">Próximos 12 meses de gastos</h2><p className="mt-1 text-sm text-zinc-600">Solo recurrentes activos en {owner.primaryCurrency}.</p>
      <div className="mt-5 overflow-x-auto"><div className="grid min-w-[36rem] grid-cols-12 gap-2">{projection.map((item, i) => <div key={i} className="grid gap-2 text-center"><span className="text-xs tabular-nums">{Math.round(item.total).toLocaleString("es")}</span><div className="flex h-28 items-end rounded-t bg-zinc-100"><div className="w-full rounded-t bg-indigo-600" style={{ height: `${item.total / Math.max(...projection.map(p => p.total), 1) * 100}%` }} /></div><span className="text-xs capitalize">{item.label}</span></div>)}</div></div>
    </Card>
  </div>;
}

function RuleFields({ categories, paymentMethods, currency, initial }: {
  categories: { id: string; name: string }[]; paymentMethods: { id: string; name: string }[]; currency: string;
  initial?: { type: string; amount: unknown; currency: string; frequency: string; nextRun: Date; note: string | null; categoryId: string | null; paymentMethodId: string | null; kind: string; provider: string | null; chargeDay: number | null };
}) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <label><span className={labelCls}>Tipo de movimiento</span><select name="type" className={inputCls} defaultValue={initial?.type ?? "EXPENSE"}><option value="EXPENSE">Gasto</option><option value="INCOME">Ingreso</option></select></label>
    <label><span className={labelCls}>Monto por movimiento</span><input name="amount" className={inputCls} inputMode="decimal" placeholder="Ej. 25000" defaultValue={String(initial?.amount ?? "")} required /></label>
    <label><span className={labelCls}>Moneda</span><input name="currency" className={inputCls} maxLength={3} defaultValue={initial?.currency ?? currency} required /></label>
    <label><span className={labelCls}>Periodicidad</span><select name="frequency" className={inputCls} defaultValue={initial?.frequency ?? "MONTHLY"}>{Object.entries(frequencyLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
    <label><span className={labelCls}>Clase</span><select name="kind" className={inputCls} defaultValue={initial?.kind ?? "SERVICE"}><option value="SERVICE">Servicio / otro</option><option value="MEMBERSHIP">Membresía</option></select></label>
    <label><span className={labelCls}>Proveedor (opcional)</span><input name="provider" className={inputCls} defaultValue={initial?.provider ?? ""} /></label>
    <label><span className={labelCls}>Día mensual (opcional)</span><input name="chargeDay" type="number" min="1" max="31" step="1" className={inputCls} defaultValue={initial?.chargeDay ?? ""} /></label>
    <label><span className={labelCls}>Próximo movimiento</span><input name="nextRun" type="date" className={inputCls} defaultValue={toInputDate(initial?.nextRun ?? new Date())} required /></label>
    <label><span className={labelCls}>Categoría</span><select name="categoryId" className={inputCls} defaultValue={initial?.categoryId ?? ""}><option value="">Sin categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label><span className={labelCls}>Medio de pago</span><select name="paymentMethodId" className={inputCls} defaultValue={initial?.paymentMethodId ?? ""}><option value="">Sin medio de pago</option>{paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    <label className="sm:col-span-2"><span className={labelCls}>Descripción (opcional)</span><input name="note" className={inputCls} maxLength={280} placeholder="Ej. Internet, alquiler, salario" defaultValue={initial?.note ?? ""} /></label>
  </div>;
}
