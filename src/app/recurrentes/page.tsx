import { requireUserId } from "@/lib/get-user";
import { Card, btnDangerCls } from "@/components/ui";
import { SimpleForm, inputCls } from "@/components/simple-form";
import { createRecurring, deleteRecurring, generateDueRecurring, toggleRecurring, updateRecurring } from "@/app/actions/recurring";
import { toInputDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, scopeWorkspace } from "@/lib/workspace";

export default async function Page({ searchParams }: { searchParams: Promise<{ workspaceId?: string }> }) {
  const userId = await requireUserId();
  const { workspaceId } = await getWorkspaceContext(userId, (await searchParams).workspaceId);
  const scope = scopeWorkspace(userId, workspaceId);
  const [categories, rules, owner] = await Promise.all([
    prisma.category.findMany({ where: scope, orderBy: { name: "asc" } }),
    prisma.recurringRule.findMany({ where: scope, include: { category: true, recurringRuns: { orderBy: { scheduledDate: "desc" }, take: 10 } }, orderBy: { nextRun: "asc" } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { primaryCurrency: true } }),
  ]);
  const projection = buildProjection(rules, owner.primaryCurrency);
  return <div className="grid gap-6"><div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-bold">Recurrentes</h1><form action={generateDueRecurring}><input type="hidden" name="workspaceId" value={workspaceId ?? ""} /><button className="rounded-lg border px-3 py-2 text-sm">Generar vencidos</button></form></div><ProjectionChart projection={projection} /><Card><SimpleForm action={createRecurring}><input type="hidden" name="workspaceId" value={workspaceId ?? ""} /><RuleFields categories={categories} currency={owner.primaryCurrency} /></SimpleForm></Card>{rules.map(r => <Card key={r.id}><div className="flex flex-wrap items-center justify-between gap-2"><span>{r.note || r.category?.name || "Sin categoría"} · {r.frequency} · {toInputDate(r.nextRun)} · {String(r.amount)} {r.currency} · {r.recurringRuns.length} generados</span><div className="flex gap-2"><form action={toggleRecurring.bind(null, r.id, workspaceId ?? undefined)}><button className="rounded-lg border px-2 py-1 text-sm">{r.isActive ? "Desactivar" : "Activar"}</button></form><form action={deleteRecurring.bind(null, r.id, workspaceId ?? undefined)}><button className={btnDangerCls}>Eliminar</button></form></div></div><details className="mt-3"><summary className="cursor-pointer text-sm underline">Historial detallado ({r.recurringRuns.length})</summary><ol className="mt-2 grid gap-1 text-sm text-zinc-600 dark:text-zinc-400">{r.recurringRuns.map(run => <li key={run.id} className="flex justify-between"><span>Programada: {toInputDate(run.scheduledDate)}</span><span>Generada: {run.createdAt.toLocaleString("es-MX")}</span></li>)}</ol></details><details className="mt-3"><summary className="cursor-pointer text-sm underline">Editar</summary><div className="mt-3"><SimpleForm action={updateRecurring.bind(null, r.id)}><input type="hidden" name="workspaceId" value={workspaceId ?? ""} /><RuleFields categories={categories} currency={owner.primaryCurrency} initial={r} /></SimpleForm></div></details></Card>)}</div>;
}

function buildProjection(rules: { type: string; amount: unknown; currency: string; frequency: string; nextRun: Date; note: string | null; category: { name: string } | null; isActive: boolean }[], currency: string) {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 1);
    const total = rules.filter(r => r.isActive && r.currency === currency).reduce((sum, rule) => {
      const start = new Date(rule.nextRun.getFullYear(), rule.nextRun.getMonth(), 1);
      const months = (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
      const due = months >= 0 && ((rule.frequency === "MONTHLY" && true) || (rule.frequency === "YEARLY" && months % 12 === 0) || (rule.frequency === "WEEKLY" && true));
      return due ? sum + Number(rule.amount) * (rule.frequency === "WEEKLY" ? 4.33 : 1) : sum;
    }, 0);
    return { label: date.toLocaleDateString("es-MX", { month: "short" }), total };
  });
}

function ProjectionChart({ projection }: { projection: { label: string; total: number }[] }) {
  const max = Math.max(...projection.map(item => item.total), 1);
  return <Card><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-bold">Proyección de pagos</h2><p className="mt-1 text-sm text-slate-500">Estimación de cargos recurrentes para los próximos 12 meses.</p></div><span className="text-xs text-slate-500">Solo moneda principal</span></div><div className="mt-6 grid grid-cols-12 items-end gap-1.5 sm:gap-2">{projection.map(item => <div key={item.label} className="grid gap-2 text-center"><div className="h-32 rounded-t-lg bg-slate-100 p-1"><div className="h-full rounded-md bg-indigo-500" style={{ height: `${Math.max(item.total ? 8 : 0, item.total / max * 100)}%`, marginTop: `${100 - Math.max(item.total ? 8 : 0, item.total / max * 100)}%` }} title={String(item.total)} /></div><span className="text-[10px] capitalize text-slate-500">{item.label}</span></div>)}</div><p className="mt-4 text-sm font-semibold text-slate-700">Total anual estimado: {projection.reduce((sum, item) => sum + item.total, 0).toLocaleString("es-MX", { maximumFractionDigits: 2 })}</p></Card>;
}

function RuleFields({ categories, currency, initial }: { categories: { id: string; name: string }[]; currency: string; initial?: { type: string; amount: unknown; currency: string; frequency: string; nextRun: Date; note: string | null; categoryId: string | null; kind?: string; provider?: string | null; chargeDay?: number | null } }) {
  return <><div className="grid gap-3 sm:grid-cols-2"><select name="type" className={inputCls} defaultValue={initial?.type ?? "EXPENSE"}><option value="EXPENSE">Gasto</option><option value="INCOME">Ingreso</option></select><input name="amount" className={inputCls} placeholder="Monto" defaultValue={String(initial?.amount ?? "")} required /></div><div className="grid gap-3 sm:grid-cols-2"><input name="currency" className={inputCls} defaultValue={initial?.currency ?? currency} required /><select name="frequency" className={inputCls} defaultValue={initial?.frequency ?? "MONTHLY"}><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensual</option><option value="YEARLY">Anual</option></select></div><div className="grid gap-3 sm:grid-cols-2"><select name="kind" className={inputCls} defaultValue={initial?.kind ?? "SERVICE"}><option value="SERVICE">Servicio</option><option value="MEMBERSHIP">Membresía</option></select><input name="provider" className={inputCls} placeholder="Proveedor" defaultValue={initial?.provider ?? ""} /></div><div className="grid gap-3 sm:grid-cols-2"><input name="chargeDay" type="number" min="1" max="31" className={inputCls} placeholder="Día de cobro" defaultValue={initial?.chargeDay ?? ""} /><input name="nextRun" type="date" className={inputCls} defaultValue={toInputDate(initial?.nextRun ?? new Date())} required /></div><select name="categoryId" className={inputCls} defaultValue={initial?.categoryId ?? ""}><option value="">Sin categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input name="note" className={inputCls} placeholder="Aviso (opcional)" defaultValue={initial?.note ?? ""} /></>;
}
