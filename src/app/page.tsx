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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const userId = await requireUserId();
  const mes = normalizarMes((await searchParams)?.mes);
  const { inicio, fin, etiqueta } = rangoMes(mes);

  const [categories, txs, budgets] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: inicio, lt: fin } },
      include: { category: { select: { id: true, name: true, color: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.budget.findMany({ where: { userId, month: mes }, include: { category: true }, orderBy: { category: { name: "asc" } } }),
  ]);

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

      {totals.size === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sin movimientos este mes. Agrega el primero abajo.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
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
      {budgets.length > 0 && <Card><h2 className="mb-3 font-bold">Presupuesto del mes</h2><div className="grid gap-2 text-sm">{budgets.map(b => <div key={b.id} className="flex justify-between"><span>{b.category.name}</span><span className="font-medium">{formatMoney(b.amount, b.currency)}</span></div>)}</div></Card>}

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
        />
      </Card>

      <div className="grid gap-2">
        {txs.map((t) => (
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
              href={`/transacciones/${t.id}/editar`}
              className="text-sm text-zinc-500 underline underline-offset-4"
            >
              Editar
            </Link>
            <form action={deleteTransaction.bind(null, t.id)}>
              <button type="submit" className={btnDangerCls}>
                Eliminar
              </button>
            </form>
          </div>
        ))}
        {txs.length === 0 && totals.size > 0 && (
          <p className="text-sm text-zinc-500">No hay movimientos para mostrar.</p>
        )}
      </div>
    </div>
  );
}
