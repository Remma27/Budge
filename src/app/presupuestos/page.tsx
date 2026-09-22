import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { Card, btnDangerCls, inputCls, labelCls, linkCls } from "@/components/ui";
import { BudgetForm } from "@/components/budget-form";
import { deleteBudget } from "@/app/actions/budgets";
import { getWorkspaceContext, scopeWorkspace } from "@/lib/workspace";
import { findBudgets } from "@/lib/budgets";
import { budgetsForMonth, effectiveBudgetAmount } from "@/lib/budget-amounts";
import { formatMoney, normalizarMes, rangoMes } from "@/lib/format";

export default async function Page({ searchParams }: { searchParams: Promise<{ workspaceId?: string; mes?: string; moneda?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const { workspaceId } = await getWorkspaceContext(userId, params.workspaceId);
  const scope = scopeWorkspace(userId, workspaceId);
  const month = normalizarMes(params.mes);
  const { inicio, fin } = rangoMes(month);
  const [categories, budgets, owner, incomes] = await Promise.all([
    prisma.category.findMany({ where: scope, orderBy: { name: "asc" } }),
    findBudgets(userId, workspaceId),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { primaryCurrency: true } }),
    prisma.transaction.findMany({ where: { ...scope, type: "INCOME", date: { gte: inicio, lt: fin } }, select: { amount: true, currency: true } }),
  ]);
  const currency = /^[A-Z]{3}$/.test(params.moneda ?? "") ? params.moneda! : owner.primaryCurrency;
  const currencies = [...new Set([owner.primaryCurrency, currency, ...incomes.map(i => i.currency), ...budgets.map(b => b.currency)])];
  const income = incomes.filter(i => i.currency === currency).reduce((sum, i) => sum + Number(i.amount), 0);
  const rows = budgetsForMonth(budgets, month).filter(b => b.currency === currency).map(b => ({ ...b, effective: effectiveBudgetAmount(b, income) }));
  const assigned = rows.reduce((sum, b) => sum + b.effective, 0);
  const percentage = income > 0 ? assigned / income * 100 : 0;
  const unassigned = Math.max(0, income - assigned);
  const suffix = workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : "";
  const colors = ["bg-indigo-600", "bg-teal-600", "bg-amber-600", "bg-purple-600", "bg-rose-600", "bg-sky-600"];
  return <div className="grid gap-6">
    <div><h1 className="text-xl font-bold">Distribuye tu salario</h1><p className="mt-2 text-sm text-zinc-600">Reparte el 100% de tus ingresos del mes entre tus categorías.</p></div>
    <form className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]" method="get">
      <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
      <label><span className={labelCls}>Mes</span><input name="mes" type="month" className={inputCls} defaultValue={month} required /></label>
      <label><span className={labelCls}>Moneda</span><select name="moneda" className={inputCls} defaultValue={currency}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label>
      <button className="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium">Ver periodo</button>
    </form>
    <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Salario e ingresos registrados</h2><p className="mt-2 text-2xl font-bold tabular-nums">{formatMoney(income, currency)}</p></div><Link className={linkCls} href={`/ingresos?mes=${month}${suffix}`}>Registrar salario</Link></div>
      <p className="mt-2 text-sm text-zinc-600">Base del mes: todos los ingresos recibidos en {currency}. Los pagos futuros no se cuentan todavía.</p>
      {income === 0 ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Registra un ingreso para calcular los montos porcentuales. Puedes dejar los porcentajes preparados.</p> : <>
        <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm font-medium"><span>{percentage.toFixed(1)}% asignado</span><span>{formatMoney(unassigned, currency)} por asignar</span></div>
        <div role="img" aria-label={`Distribución de ingresos: ${percentage.toFixed(1)}% asignado, ${formatMoney(unassigned, currency)} disponible`} className="mt-3 flex h-5 overflow-hidden rounded-full bg-zinc-100">
          {rows.map((b, index) => <div key={b.id} title={`${b.category.name}: ${formatMoney(b.effective, currency)}`} className={`h-full shrink-0 ${colors[index % colors.length]}`} style={{ width: `${b.effective / Math.max(income, assigned) * 100}%` }} />)}
        </div>
        {assigned > income && <p role="alert" className="mt-3 text-sm font-medium text-red-700">Asignaste {formatMoney(assigned - income, currency)} más que tus ingresos. Ajusta los presupuestos para llegar al 100%.</p>}
      </>}
      <ul className="mt-5 divide-y divide-zinc-200">{rows.map((b, index) => <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0"><p className="flex items-center gap-2 font-medium"><span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-sm ${colors[index % colors.length]}`} />{b.category.name}</p><p className="mt-1 text-sm text-zinc-600">{b.budgetMode === "PERCENTAGE" ? `${b.percentage}% de ingresos` : "Monto fijo"}{b.month === null ? " · Todos los meses" : ""}</p></div>
        <div className="flex flex-wrap items-center gap-3"><span className="font-semibold tabular-nums">{formatMoney(b.effective, currency)}</span><form action={deleteBudget.bind(null, b.id, workspaceId ?? undefined)}><button aria-label={`Eliminar presupuesto de ${b.category.name}`} className={`${btnDangerCls} min-h-11`}>Eliminar</button></form></div>
      </li>)}</ul>
      {income > 0 && <p className="mt-3 text-sm text-zinc-600">Sin asignar: {formatMoney(unassigned, currency)} ({Math.max(0, 100 - percentage).toFixed(1)}%).</p>}
    </Card>
    <Card><h2 className="mb-4 font-semibold">Asignar a una categoría</h2>{categories.length ? <BudgetForm key={`${month}-${currency}`} categories={categories} workspaceId={workspaceId} currency={currency} month={month} income={income} /> : <p className="text-sm">Primero <Link className={linkCls} href={`/categorias?${suffix.slice(1)}`}>crea una categoría</Link> para organizar tu salario.</p>}</Card>
  </div>;
}
