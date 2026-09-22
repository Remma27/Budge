import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import {
  formatFecha,
  formatMoney,
  moverMes,
  normalizarMes,
  rangoMes,
  toInputDate,
} from "@/lib/format";
import { Card } from "@/components/ui";
import {
  TransactionForm,
  type TransactionInitial,
} from "@/components/transaction-form";
import {
  createTransaction,
  deleteTransaction,
} from "@/app/actions/transactions";
import { DeleteButton } from "@/components/delete-button";
import { getWorkspaceContext, scopeWorkspace } from "@/lib/workspace";
import { generateDueRecurring } from "@/lib/recurring";
import { fetchExchangeRate } from "@/lib/exchange-rates";
import { findBudgets } from "@/lib/budgets";
import { budgetsForMonth, effectiveBudgetAmount } from "@/lib/budget-amounts";
import { loadPaymentBalances } from "@/lib/payment-balances-summary";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; moneda?: string; categoria?: string; tipo?: string; q?: string; pagina?: string; workspaceId?: string }>;
}) {
  const userId = await requireUserId();
  const params = await searchParams;
  const { workspaceId } = await getWorkspaceContext(userId, params.workspaceId);
  await generateDueRecurring(userId, workspaceId);
  const scope = scopeWorkspace(userId, workspaceId);
  const mes = normalizarMes(params?.mes);
  const moneda = params?.moneda?.toUpperCase() || "";
  const tipo = params?.tipo === "INCOME" || params?.tipo === "EXPENSE" ? params.tipo : "";
  const categoria = params?.categoria || "";
  const q = params?.q?.trim() || "";
  const pagina = Math.max(1, Number(params?.pagina) || 1);
  const { inicio, fin, etiqueta } = rangoMes(mes);

  const [categories, paymentMethods, txs, budgets, user, rates, periodTransactions] = await Promise.all([
    prisma.category.findMany({
      where: scope,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
     prisma.paymentMethod.findMany({ where: scope, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.transaction.findMany({
      where: { ...scope, date: { gte: inicio, lt: fin }, ...(moneda && { currency: moneda }), ...(tipo && { type: tipo }), ...(categoria && { categoryId: categoria }), ...(q && { OR: [{ note: { contains: q, mode: "insensitive" } }, { category: { name: { contains: q, mode: "insensitive" } } }] }) },
       include: { category: { select: { id: true, name: true, color: true } }, paymentMethod: { select: { id: true, name: true, type: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
     findBudgets(userId, workspaceId).then(rows => budgetsForMonth(rows, mes)),
     workspaceId ? prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { primaryCurrency: true } }) : prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { primaryCurrency: true } }),
    prisma.exchangeRate.findMany({ where: { userId }, select: { from: true, to: true, rate: true } }),
    prisma.transaction.findMany({ where: { ...scope, date: { gte: inicio, lt: fin } }, select: { type: true, amount: true, categoryId: true, currency: true } }),
  ]);
   const pageSize = 20;
   const visibleTxs = txs.slice((pagina - 1) * pageSize, pagina * pageSize);
   const months = Array.from({ length: 6 }, (_, i) => moverMes(mes, i - 5));
   const primaryCurrency = user.primaryCurrency;
   const rateMap = new Map(rates.map((r) => [`${r.from}:${r.to}`, Number(r.rate)]));
   const currencies = [...new Set(txs.map((t) => t.currency))].filter((currency) => currency !== primaryCurrency);
   await Promise.all(currencies.map(async (currency) => {
     const rate = await fetchExchangeRate(currency, primaryCurrency);
     if (rate) rateMap.set(`${currency}:${primaryCurrency}`, rate);
   }));
   const trend = await Promise.all(months.map(async (m) => { const r = rangoMes(m); const rows = await prisma.transaction.findMany({ where: { ...scope, type: "EXPENSE", date: { gte: r.inicio, lt: r.fin }, ...(moneda && { currency: moneda }) }, select: { amount: true, currency: true } }); const total = rows.reduce((n, x) => { const factor = x.currency === primaryCurrency ? 1 : rateMap.get(`${x.currency}:${primaryCurrency}`) ?? 0; return n + Number(x.amount) * factor; }, 0); return { month: m.slice(5), total, currency: primaryCurrency }; }));
  const categoryTotals = new Map<string, number>();
  for (const t of txs) if (t.type === "EXPENSE") categoryTotals.set(t.category?.name || "Sin categoría", (categoryTotals.get(t.category?.name || "Sin categoría") || 0) + Number(t.amount));
  const maxCategory = Math.max(...categoryTotals.values(), 1);
   const consolidated = { income: 0, expense: 0 };
  const unconverted = new Set<string>();
   for (const t of txs) {
    const factor = t.currency === primaryCurrency ? 1 : rateMap.get(`${t.currency}:${primaryCurrency}`);
    if (!factor) { unconverted.add(t.currency); continue; }
    consolidated[t.type === "INCOME" ? "income" : "expense"] += Number(t.amount) * factor;
   }

   const paymentTotals = new Map<string, { name: string; total: number; type: string }>();
   for (const t of txs) if (t.type === "EXPENSE") {
     const key = t.paymentMethod?.id ?? "none";
     const current = paymentTotals.get(key) ?? { name: t.paymentMethod?.name ?? "Sin medio de pago", total: 0, type: t.paymentMethod?.type ?? "NONE" };
     current.total += Number(t.amount);
     paymentTotals.set(key, current);
   }
   const maxPayment = Math.max(...[...paymentTotals.values()].map((x) => x.total), 1);
   const paymentBalances = await loadPaymentBalances(scope, primaryCurrency);

  const totals = new Map<string, { income: number; expense: number }>();
  for (const t of txs) {
    const e = totals.get(t.currency) ?? { income: 0, expense: 0 };
    const n = Number(t.amount);
    if (t.type === "INCOME") e.income += n;
    else e.expense += n;
    totals.set(t.currency, e);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 p-4"><p className="text-sm">¿Ya recibiste tu salario?</p><Link className="text-sm font-semibold text-indigo-700 underline underline-offset-4" href={`/ingresos?mes=${mes}${workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : ""}`}>Registrar salario o ingreso</Link></div>
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/?mes=${moverMes(mes, -1)}`}
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
        >
          ← Anterior
        </Link>
        <h1 className="text-center text-lg font-bold capitalize sm:text-xl">{etiqueta}</h1>
        <Link
          href={`/?mes=${moverMes(mes, 1)}`}
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
        >
          Siguiente →
        </Link>
      </div>

      <form className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-5 dark:border-zinc-800 dark:bg-zinc-950" method="get">
        <input type="hidden" name="mes" value={mes} />
        <input name="q" defaultValue={q} placeholder="Buscar movimientos..." className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-900" />
        <select name="moneda" defaultValue={moneda} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="">Todas las monedas</option>{[...new Set(txs.map(t => t.currency))].map(c => <option key={c}>{c}</option>)}</select>
        <select name="categoria" defaultValue={categoria} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="">Todas las categorías</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select name="tipo" defaultValue={tipo} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="">Todos los tipos</option><option value="EXPENSE">Gastos</option><option value="INCOME">Ingresos</option></select>
        <button className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white sm:col-span-5">Aplicar filtros</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><h2 className="mb-4 font-bold">Gastos por categoría</h2><div className="grid gap-3 text-sm">{[...categoryTotals.entries()].map(([name, total]) => <div key={name}><div className="flex justify-between"><span>{name}</span><span>{formatMoney(total, user.primaryCurrency)}</span></div><div className="mt-1 h-2 rounded bg-zinc-200 dark:bg-zinc-800"><div className="h-2 rounded bg-indigo-500" style={{ width: `${total / maxCategory * 100}%` }} /></div></div>)}{categoryTotals.size === 0 && <p className="text-zinc-500">Aún no hay gastos categorizados.</p>}</div></Card>
         <Card><h2 className="mb-4 font-bold">Evolución mensual</h2><div className="flex h-40 items-end gap-2 border-b border-zinc-200 pb-5 dark:border-zinc-800">{trend.map(t => <div key={t.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"><span className="text-[10px] text-zinc-600">{formatMoney(t.total, t.currency)}</span><div className="w-full rounded-t bg-emerald-500 transition-all" style={{ height: `${Math.max(8, t.total / Math.max(...trend.map(x => x.total), 1) * 120)}px` }} /><span className="text-xs text-zinc-500">{t.month}</span></div>)}</div><p className="mt-2 text-xs text-zinc-500">Gastos convertidos a {primaryCurrency}. Las barras vacías representan meses sin gastos.</p></Card>
      </div>
      {totals.size === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sin movimientos este mes. Agrega el primero abajo.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
           <Card><p className="mb-1 text-sm font-medium text-zinc-500">Balance consolidado</p><p className="mb-3 text-xs text-zinc-500">Todo convertido a {primaryCurrency} usando tus tasas configuradas.</p><dl className="grid gap-1 text-sm"><div className="flex justify-between"><dt>Ingresos</dt><dd className="font-medium text-green-600">+{formatMoney(consolidated.income, primaryCurrency)}</dd></div><div className="flex justify-between"><dt>Gastos</dt><dd className="font-medium text-red-600">−{formatMoney(consolidated.expense, primaryCurrency)}</dd></div><div className="flex justify-between border-t border-zinc-200 pt-1 font-bold dark:border-zinc-800"><dt>Balance</dt><dd>{formatMoney(consolidated.income - consolidated.expense, primaryCurrency)}</dd></div></dl>{unconverted.size > 0 && <p className="mt-3 text-xs text-amber-600">Sin tasa para: {[...unconverted].join(", ")}. Esas monedas no se mezclaron.</p>}</Card>
          {[...totals.entries()].map(([currency, t]) => (
            <Card key={currency}>
              <p className="mb-3 text-sm font-medium text-zinc-500">{currency}</p>
              <dl className="grid gap-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-600 dark:text-zinc-400">Ingresos</dt>
                  <dd className="font-medium text-green-600">
                    +{formatMoney(t.income, currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-600 dark:text-zinc-400">Gastos</dt>
                  <dd className="font-medium text-red-600">
                    −{formatMoney(t.expense, currency)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-1 font-bold dark:border-zinc-800">
                  <dt>Balance</dt>
                  <dd>{formatMoney(t.income - t.expense, currency)}</dd>
                </div>
              </dl>
            </Card>
          ))}
       </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><h2 className="mb-4 font-bold">Gastos por tipo de pago</h2><div className="grid gap-3 text-sm">{[...paymentTotals.values()].map((payment) => <div key={payment.name}><div className="flex justify-between"><span>{payment.name}</span><span>{formatMoney(payment.total, primaryCurrency)}</span></div><div className="mt-1 h-2 rounded bg-zinc-200 dark:bg-zinc-800"><div className="h-2 rounded bg-violet-500" style={{ width: `${payment.total / maxPayment * 100}%` }} /></div></div>)}{paymentTotals.size === 0 && <p className="text-zinc-500">Aún no hay gastos con medio de pago.</p>}</div></Card>
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Saldos de medios de pago</h2>
            <Link href={`/medios-pago${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""}`} className="text-sm text-indigo-700 underline underline-offset-4">Ver detalle</Link>
          </div>
          {paymentBalances.summaries.length ? (
            <div className="grid gap-3 text-sm">
              {paymentBalances.summaries.map((method) => {
                const { balance } = method;
                const isCredit = method.type === "CREDIT_CARD";
                const overdue = balance.dueDate !== null && balance.dueDate.getTime() < new Date().setHours(0, 0, 0, 0);
                return (
                  <div key={method.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="flex justify-between gap-2 font-medium">
                      <span className="min-w-0 truncate">{method.name} <span className="text-xs font-normal text-zinc-500">· {method.kindLabel}</span></span>
                      <span className={`shrink-0 tabular-nums ${isCredit && balance.balance > 0 ? "text-red-600" : ""}`}>{formatMoney(balance.balance, primaryCurrency)}</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {isCredit
                        ? balance.statementAmount === null
                          ? "Configura el día de corte en Medios de pago para ver el pago al corte."
                          : `Pago al corte: ${formatMoney(balance.statementAmount, primaryCurrency)} · ${balance.dueDate ? `${overdue ? "venció" : "vence"} ${formatFecha(balance.dueDate)}` : "sin día de pago"}${balance.available !== null ? ` · disponible ${formatMoney(balance.available, primaryCurrency)}` : ""}`
                        : `Ingresos +${formatMoney(balance.income, primaryCurrency)} · Gastos −${formatMoney(balance.expense, primaryCurrency)}`}
                    </p>
                  </div>
                );
              })}
              {paymentBalances.unconverted.length > 0 && <p className="text-xs text-amber-600">Sin tasa para {paymentBalances.unconverted.join(", ")}: esos movimientos no entran en los saldos.</p>}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Configura un medio de pago para ver aquí su saldo actual.</p>
          )}
        </Card>
      </div>
       {budgets.length > 0 && <Card><h2 className="mb-3 font-bold">Presupuesto del mes</h2><div className="grid gap-3 text-sm">{budgets.map(b => { const spent = periodTransactions.filter(t => t.type === "EXPENSE" && t.categoryId === b.categoryId && t.currency === b.currency).reduce((sum, t) => sum + Number(t.amount), 0); const income = periodTransactions.filter(t => t.type === "INCOME" && t.currency === b.currency).reduce((sum, t) => sum + Number(t.amount), 0); const effectiveAmount = effectiveBudgetAmount(b, income); const pct = effectiveAmount > 0 ? Math.min(100, spent / effectiveAmount * 100) : spent > 0 ? 100 : 0; return <div key={b.id}><div className="flex flex-wrap justify-between gap-2"><span>{b.category.name} · {b.currency}</span><span className="font-medium">{formatMoney(spent, b.currency)} / {formatMoney(effectiveAmount, b.currency)}</span></div>{b.budgetMode === "PERCENTAGE" && <p className="text-xs text-zinc-500">{String(b.percentage)}% de ingresos del periodo ({formatMoney(income, b.currency)})</p>}<div className="mt-1 h-2 rounded bg-zinc-200"><div className={`h-2 rounded ${pct >= 100 ? "bg-red-600" : pct >= 80 ? "bg-amber-500" : "bg-green-600"}`} style={{ width: `${pct}%` }} /></div>{pct >= 80 && <p className={`mt-1 text-xs ${pct >= 100 ? "text-red-600" : "text-amber-600"}`}>{spent > effectiveAmount ? "Presupuesto excedido" : pct >= 100 ? "Presupuesto alcanzado" : "Alerta: alcanzaste 80%"}</p>}</div>})}</div></Card>}

      <Card>
        <h2 className="mb-4 font-bold">Nuevo movimiento</h2>
        <TransactionForm
          action={createTransaction}
          categories={categories}
          initial={
            {
              type: "EXPENSE",
              amount: "",
               currency: user.primaryCurrency,
              date: toInputDate(new Date()),
              note: "",
               categoryId: "",
               paymentMethodId: "",
            } satisfies TransactionInitial
          }
          submitLabel="Agregar"
           resetOnSuccess
           workspaceId={workspaceId}
           primaryCurrency={user.primaryCurrency}
           paymentMethods={paymentMethods}
        />
      </Card>

      <div className="grid gap-2">
        {visibleTxs.map((t) => (
          <div
            key={t.id}
            className="flex min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-3 sm:gap-3 sm:px-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: t.category?.color ?? "#a1a1aa" }}
              title={t.category?.name ?? "Sin categoría"}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {t.note || t.category?.name || "Sin categoría"}
              </p>
              <p className="text-xs text-zinc-500">
                {formatFecha(t.date)}
                {t.note && t.category ? ` · ${t.category.name}` : ""}
              </p>
            </div>
            <p
              className={`shrink-0 text-right text-sm font-bold ${t.type === "INCOME" ? "text-green-600" : "text-red-600"}`}
            >
              {t.type === "INCOME" ? "+" : "−"}
              {formatMoney(t.amount, t.currency)}
            </p>
            <Link
               href={`/transacciones/${t.id}/editar${workspaceId ? `?workspaceId=${workspaceId}` : ""}`}
               className="shrink-0 text-sm text-zinc-500 underline underline-offset-4"
            >
              Editar
            </Link>
            <form action={deleteTransaction.bind(null, t.id)}>
              <DeleteButton />
            </form>
          </div>
        ))}
        {visibleTxs.length === 0 && (
          <p className="text-sm text-zinc-500">No hay movimientos para mostrar.</p>
        )}
        {txs.length > pageSize && <div className="flex justify-between text-sm"><span>Página {pagina} de {Math.ceil(txs.length / pageSize)}</span>{pagina > 1 && <Link className="underline" href={`/?mes=${mes}&pagina=${pagina - 1}`}>Anterior</Link>}{pagina * pageSize < txs.length && <Link className="underline" href={`/?mes=${mes}&pagina=${pagina + 1}`}>Siguiente</Link>}</div>}
      </div>
    </div>
  );
}
