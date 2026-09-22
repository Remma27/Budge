import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { getWorkspaceContext, scopeWorkspace } from "@/lib/workspace";
import { Card, inputCls, labelCls, linkCls } from "@/components/ui";
import { TransactionForm } from "@/components/transaction-form";
import { SimpleForm } from "@/components/simple-form";
import { createTransaction } from "@/app/actions/transactions";
import { createRecurring } from "@/app/actions/recurring";
import { normalizarMes, rangoMes, formatMoney, toInputDate } from "@/lib/format";
import { frequencyLabels } from "@/lib/recurring-schedule";

export default async function IngresosPage({ searchParams }: { searchParams: Promise<{ workspaceId?: string; mes?: string }> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const { workspaceId } = await getWorkspaceContext(userId, params.workspaceId);
  const scope = scopeWorkspace(userId, workspaceId);
  const mes = normalizarMes(params.mes);
  const { inicio, fin } = rangoMes(mes);
  const [user, categories, paymentMethods, income] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { primaryCurrency: true } }),
    prisma.category.findMany({ where: scope, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({ where: scope, select: { id: true, name: true } }),
    prisma.transaction.findMany({ where: { ...scope, type: "INCOME", date: { gte: inicio, lt: fin } }, orderBy: { date: "desc" } }),
  ]);
  const suffix = workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : "";
  return <div className="grid gap-6">
    <div><h1 className="text-xl font-bold">Salario e ingresos</h1><p className="mt-2 text-sm text-zinc-600">Registra el dinero que recibiste para distribuirlo entre tus presupuestos.</p></div>
    <Card><h2 className="mb-4 font-semibold">Registrar salario recibido</h2>
      <TransactionForm action={createTransaction} categories={categories} paymentMethods={paymentMethods} workspaceId={workspaceId} primaryCurrency={user.primaryCurrency} incomeOnly resetOnSuccess submitLabel="Registrar ingreso"
        initial={{ type: "INCOME", amount: "", currency: user.primaryCurrency, date: toInputDate(new Date()), note: "Salario", categoryId: "", paymentMethodId: "" }} />
    </Card>
    <Card><details><summary className="cursor-pointer py-2 font-semibold">Programar mi salario recurrente</summary>
      <p className="my-3 text-sm text-zinc-600">Se registrará automáticamente al vencer cada fecha. Usa como inicio el próximo pago que todavía no registraste para evitar duplicarlo.</p>
      <SimpleForm action={createRecurring} submitLabel="Programar salario" successMessage="Salario programado. Puedes editarlo en Recurrentes.">
        <input type="hidden" name="workspaceId" value={workspaceId ?? ""} /><input type="hidden" name="type" value="INCOME" /><input type="hidden" name="note" value="Salario" />
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={labelCls}>Monto de cada pago</span><input name="amount" className={inputCls} inputMode="decimal" required /></label>
          <label><span className={labelCls}>Moneda</span><input name="currency" className={inputCls} defaultValue={user.primaryCurrency} maxLength={3} required /></label>
          <label><span className={labelCls}>Periodicidad</span><select name="frequency" className={inputCls} defaultValue="MONTHLY">{Object.entries(frequencyLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
          <label><span className={labelCls}>Próximo pago no registrado</span><input name="nextRun" type="date" className={inputCls} required /></label>
        </div>
      </SimpleForm>
    </details></Card>
    <section><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Ingresos registrados · {mes}</h2><Link className={linkCls} href={`/presupuestos?mes=${mes}${suffix}`}>Distribuir en presupuestos</Link></div>
      <ul className="mt-4 divide-y divide-zinc-200">{income.map(t => <li key={t.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{t.note || "Ingreso"} · {toInputDate(t.date)}</span><span className="font-semibold tabular-nums">{formatMoney(t.amount, t.currency)}</span></li>)}</ul>
      {!income.length && <p className="text-sm text-zinc-600">Aún no hay ingresos registrados este mes.</p>}
    </section>
  </div>;
}
