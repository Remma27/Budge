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
import { btnDangerCls } from "@/components/ui";
import { getWorkspaceContext, scopeWorkspace } from "@/lib/workspace";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; moneda?: string; categoria?: string; tipo?: string; q?: string; pagina?: string; workspaceId?: string }>;
}) {
  const userId = await requireUserId();
  const params = await searchParams;
  const { workspaceId } = await getWorkspaceContext(userId, params.workspaceId);
  const scope = scopeWorkspace(userId, workspaceId);
  const mes = normalizarMes(params?.mes);
  const moneda = params?.moneda?.toUpperCase() || "";
  const tipo = params?.tipo === "INCOME" || params?.tipo === "EXPENSE" ? params.tipo : "";
  const categoria = params?.categoria || "";
  const q = params?.q?.trim() || "";
  const pagina = Math.max(1, Number(params?.pagina) || 1);
  const { inicio, fin, etiqueta } = rangoMes(mes);

  const [categories, txs, budgets, user, rates] = await Promise.all([
    prisma.category.findMany({
      where: scope,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.transaction.findMany({
      where: { ...scope, date: { gte: inicio, lt: fin }, ...(moneda && { currency: moneda }), ...(tipo && { type: tipo }), ...(categoria && { categoryId: categoria }), ...(q && { OR: [{ note: { contains: q, mode: "insensitive" } }, { category: { name: { contains: q, mode: "insensitive" } } }] }) },
      include: { category: { select: { id: true, name: true, color: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.budget.findMany({ where: { ...scope, month: mes }, include: { category: true }, orderBy: { category: { name: "asc" } } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { primaryCurrency: true } }),
    prisma.exchangeRate.findMany({ where: { userId }, select: { from: true, to: true, rate: true } }),
  ]);
  const pageSize = 20;
  const visibleTxs = txs.slice((pagina - 1) * pageSize, pagina * pageSize);
  const months = Array.from({ length: 6 }, (_, i) => moverMes(mes, i - 5));
  const trend = await Promise.all(months.map(async (m) => { const r = rangoMes(m); const rows = await prisma.transaction.findMany({ where: { ...scope, type: "EXPENSE", date: { gte: r.inicio, lt: r.fin }, ...(moneda && { currency: moneda }) }, select: { amount: true, currency: true } }); return { month: m.slice(5), total: rows.reduce((n, x) => n + Number(x.amount), 0), currency: moneda || rows[0]?.currency || "MXN" }; }));
  const categoryTotals = new Map<string, number>();
  for (const t of txs) if (t.type === "EXPENSE") categoryTotals.set(t.category?.name || "Sin categoría", (categoryTotals.get(t.category?.name || "Sin categoría") || 0) + Number(t.amount));
  const maxCategory = Math.max(...categoryTotals.values(), 1);
  const primaryCurrency = user.primaryCurrency;
  const rateMap = new Map(rates.map((r) => [`${r.from}:${r.to}`, Number(r.rate)]));
  const consolidated = { income: 0, expense: 0 };
  const unconverted = new Set<string>();
  for (const t of txs) {
    const factor = t.currency === primaryCurrency ? 1 : rateMap.get(`${t.currency}:${primaryCurrency}`);
    if (!factor) { unconverted.add(t.currency); continue; }
    consolidated[t.type === "INCOME" ? "income" : "expense"] += Number(t.amount) * factor;
  }

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
      <div className="flex items-center justify-between">
        <Link
          href={`/?mes=${moverMes(mes, -1)}`}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
        >
          ← Anterior
        </Link>
        <h1 className="text-xl font-bold capitalize">{etiqueta}</h1>
        <Link
          href={`/?mes=${moverMes(mes, 1)}`}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
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
        <Card><h2 className="mb-4 font-bold">Gastos por categoría</h2><div className="grid gap-3 text-sm">{[...categoryTotals.entries()].map(([name, total]) => <div key={name}><div className="flex justify-between"><span>{name}</span><span>{formatMoney(total, moneda || "MXN")}</span></div><div className="mt-1 h-2 rounded bg-zinc-200 dark:bg-zinc-800"><div className="h-2 rounded bg-indigo-500" style={{ width: `${total / maxCategory * 100}%` }} /></div></div>)}{categoryTotals.size === 0 && <p className="text-zinc-500">Aún no hay gastos categorizados.</p>}</div></Card>
        <Card><h2 className="mb-4 font-bold">Evolución mensual</h2><div className="flex h-32 items-end gap-2">{trend.map(t => <div key={t.month} className="flex min-w-0 flex-1 flex-col items-center gap-1"><div className="w-full rounded-t bg-emerald-500" style={{ height: `${Math.max(4, t.total / Math.max(...trend.map(x => x.total), 1) * 100)}%` }} title={formatMoney(t.total, t.currency)} /><span className="text-xs text-zinc-500">{t.month}</span></div>)}</div></Card>
      </div>
       <div className="flex flex-wrap gap-3 text-sm"><Link className="underline" href={`/api/export?format=csv${workspaceId ? `&workspaceId=${workspaceId}` : ""}`}>Exportar CSV</Link><Link className="underline" href={`/api/export?format=backup${workspaceId ? `&workspaceId=${workspaceId}` : ""}`}>Descargar respaldo completo</Link></div>

      {totals.size === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sin movimientos este mes. Agrega el primero abajo.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card><p className="mb-3 text-sm font-medium text-zinc-500">Consolidado en {primaryCurrency}</p><dl className="grid gap-1 text-sm"><div className="flex justify-between"><dt>Ingresos</dt><dd className="font-medium text-green-600">+{formatMoney(consolidated.income, primaryCurrency)}</dd></div><div className="flex justify-between"><dt>Gastos</dt><dd className="font-medium text-red-600">−{formatMoney(consolidated.expense, primaryCurrency)}</dd></div><div className="flex justify-between border-t border-zinc-200 pt-1 font-bold dark:border-zinc-800"><dt>Balance</dt><dd>{formatMoney(consolidated.income - consolidated.expense, primaryCurrency)}</dd></div></dl>{unconverted.size > 0 && <p className="mt-3 text-xs text-amber-600">Sin tasa para: {[...unconverted].join(", ")}. Esas monedas no se mezclaron.</p>}</Card>
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
      {budgets.length > 0 && <Card><h2 className="mb-3 font-bold">Presupuesto del mes</h2><div className="grid gap-3 text-sm">{budgets.map(b => { const spent = txs.filter(t => t.type === "EXPENSE" && t.categoryId === b.categoryId && t.currency === b.currency).reduce((sum, t) => sum + Number(t.amount), 0); const pct = Math.min(100, Math.round(spent / Number(b.amount) * 100)); return <div key={b.id}><div className="flex justify-between"><span>{b.category.name} · {b.currency}</span><span className="font-medium">{formatMoney(spent, b.currency)} / {formatMoney(b.amount, b.currency)}</span></div><div className="mt-1 h-2 rounded bg-zinc-200"><div className={`h-2 rounded ${pct >= 100 ? "bg-red-600" : pct >= 80 ? "bg-amber-500" : "bg-green-600"}`} style={{ width: `${pct}%` }} /></div>{pct >= 80 && <p className={`mt-1 text-xs ${pct >= 100 ? "text-red-600" : "text-amber-600"}`}>{pct >= 100 ? "Presupuesto excedido" : "Alerta: alcanzaste 80%"}</p>}</div>})}</div></Card>}

      <Card>
        <h2 className="mb-4 font-bold">Nuevo movimiento</h2>
        <TransactionForm
          action={createTransaction}
          categories={categories}
          initial={
            {
              type: "EXPENSE",
              amount: "",
              currency: "MXN",
              date: toInputDate(new Date()),
              note: "",
              categoryId: "",
            } satisfies TransactionInitial
          }
          submitLabel="Agregar"
           resetOnSuccess
           workspaceId={workspaceId}
        />
      </Card>

      <div className="grid gap-2">
        {visibleTxs.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
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
              className={`text-sm font-bold ${t.type === "INCOME" ? "text-green-600" : "text-red-600"}`}
            >
              {t.type === "INCOME" ? "+" : "−"}
              {formatMoney(t.amount, t.currency)}
            </p>
            <Link
               href={`/transacciones/${t.id}/editar${workspaceId ? `?workspaceId=${workspaceId}` : ""}`}
              className="text-sm text-zinc-500 underline underline-offset-4"
            >
              Editar
            </Link>
            <form action={deleteTransaction.bind(null, t.id)}>
              <button type="submit" className={btnDangerCls} onClick={(e) => { if (!confirm("¿Eliminar este movimiento? Esta acción no se puede deshacer.")) e.preventDefault(); }}>
                Eliminar
              </button>
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
