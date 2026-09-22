import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { getWorkspaceContext } from "@/lib/workspace";
import { Card, inputCls, labelCls, btnDangerCls } from "@/components/ui";
import { SimpleForm } from "@/components/simple-form";
import { createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from "@/app/actions/payment-methods";
import type { ActionResult } from "@/lib/validations";
import { loadPaymentBalances, type PaymentBalanceSummary } from "@/lib/payment-balances-summary";
import { formatFecha, formatMoney } from "@/lib/format";

const TYPE_OPTIONS: [PaymentBalanceSummary["type"], string][] = [
  ["DEBIT", "Cuenta débito"],
  ["CASH", "Efectivo"],
  ["CREDIT_CARD", "Tarjeta de crédito"],
];

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "positive" | "negative" | "muted" }) {
  const color = tone === "positive" ? "text-green-600" : tone === "negative" ? "text-red-600" : "";
  return (
    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-base font-bold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function MethodStats({ method, currency }: { method: PaymentBalanceSummary; currency: string }) {
  const { balance } = method;
  const isCredit = method.type === "CREDIT_CARD";
  const shortDay = (d: Date | null) => (d ? formatFecha(d) : "-");

  if (!isCredit) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Saldo actual" value={formatMoney(balance.balance, currency)} hint={`Saldo inicial: ${formatMoney(method.openingBalance ?? 0, currency)}`} tone={balance.balance < 0 ? "negative" : "positive"} />
        <Stat label="Ingresos" value={`+${formatMoney(balance.income, currency)}`} hint="Depósitos registrados en este medio" />
        <Stat label="Gastos" value={`−${formatMoney(balance.expense, currency)}`} hint="Gastos registrados en este medio" />
      </div>
    );
  }

  const overdue = balance.dueDate !== null && balance.dueDate.getTime() < new Date().setHours(0, 0, 0, 0);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        label="Pago al corte"
        value={balance.statementAmount === null ? "Sin corte" : formatMoney(balance.statementAmount, currency)}
        hint={balance.statementStart && balance.statementEnd ? `Del ${shortDay(balance.statementStart)} al ${shortDay(balance.statementEnd)}` : "Configura el día de corte"}
      />
      <Stat
        label="Vencimiento"
        value={balance.dueDate ? formatFecha(balance.dueDate) : "Sin día de pago"}
        hint={overdue ? "Vencido: revisa si ya pagaste" : balance.dueDate ? "Próximo pago del estado" : "Configura el día de pago"}
        tone={overdue ? "negative" : undefined}
      />
      <Stat
        label="Ciclo actual"
        value={formatMoney(balance.cycleExpense - balance.cyclePayments, currency)}
        hint={balance.lastClose ? `Consumos desde el ${shortDay(balance.lastClose)} · abonos: ${formatMoney(balance.cyclePayments, currency)}` : "Sin corte configurado"}
      />
      <Stat
        label="Saldo por pagar"
        value={formatMoney(balance.balance, currency)}
        hint={balance.available !== null ? `Disponible: ${formatMoney(balance.available, currency)} de ${formatMoney(method.creditLimit ?? 0, currency)}` : balance.balance < 0 ? "Saldo a favor" : "Deuda estimada"}
        tone={balance.balance < 0 ? "positive" : "negative"}
      />
    </div>
  );
}

function MethodForm({ action, workspaceId, initial }: {
  action: (p: ActionResult, f: FormData) => Promise<ActionResult>;
  workspaceId: string | null;
  initial?: PaymentBalanceSummary;
}) {
  return (
    <SimpleForm action={action} submitLabel={initial ? "Guardar cambios" : "Agregar medio"} successMessage={initial ? "Medio de pago actualizado." : "Medio de pago agregado."}>
      <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className={labelCls}>Nombre</span><input name="name" className={inputCls} placeholder="Visa, efectivo..." defaultValue={initial?.name} required /></label>
        <label><span className={labelCls}>Tipo</span>
          <select name="type" className={inputCls} defaultValue={initial?.type ?? "DEBIT"}>
            {TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label><span className={labelCls}>Saldo inicial (opcional)</span><input name="openingBalance" className={inputCls} inputMode="decimal" placeholder="0.00" defaultValue={initial?.openingBalance ?? ""} /></label>
        <label><span className={labelCls}>Límite de crédito (opcional)</span><input name="creditLimit" className={inputCls} inputMode="decimal" placeholder="Sin límite" defaultValue={initial?.creditLimit ?? ""} /></label>
        <label><span className={labelCls}>Día de corte (1-31)</span><input name="closingDay" className={inputCls} type="number" min="1" max="31" placeholder="Sin corte" defaultValue={initial?.closingDay ?? ""} /></label>
        <label><span className={labelCls}>Día de pago (1-31)</span><input name="paymentDay" className={inputCls} type="number" min="1" max="31" placeholder="Sin día de pago" defaultValue={initial?.paymentDay ?? ""} /></label>
      </div>
    </SimpleForm>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ workspaceId?: string }> }) {
  const userId = await requireUserId();
  const { workspaceId } = await getWorkspaceContext(userId, (await searchParams).workspaceId);
  const owner = workspaceId
    ? await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { primaryCurrency: true } })
    : await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { primaryCurrency: true } });
  const currency = owner.primaryCurrency;
  const { summaries, cashBalance, creditDebt, creditAvailable, unconverted } = await loadPaymentBalances({ userId, workspaceId }, currency);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold">Medios de pago</h1>
        <p className="mt-1 text-sm text-zinc-600">Saldos actuales de tus cuentas y tarjetas, con el pago al corte para organizarte.</p>
      </div>

      <Card>
        <h2 className="mb-4 font-bold">Resumen</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Efectivo y débito" value={formatMoney(cashBalance, currency)} hint="Saldo inicial + ingresos − gastos" tone={cashBalance < 0 ? "negative" : "positive"} />
          <Stat label="Tarjetas de crédito" value={formatMoney(creditDebt, currency)} hint="Corte vigente + ciclo nuevo − abonos" tone={creditDebt > 0 ? "negative" : "positive"} />
          <Stat label="Disponible en tarjetas" value={creditAvailable === null ? "Sin límites" : formatMoney(creditAvailable, currency)} hint="Límites configurados menos deudas" />
        </div>
        {unconverted.length > 0 && <p className="mt-3 text-xs text-amber-600">Sin tasa para {unconverted.join(", ")}: esos movimientos no entran en los saldos.</p>}
      </Card>

      <Card>
        <h2 className="mb-4 font-bold">Nuevo medio de pago</h2>
        <MethodForm action={createPaymentMethod} workspaceId={workspaceId} />
      </Card>

      {summaries.length === 0 && <Card><p className="text-sm text-zinc-500">Aún no tienes medios de pago. Agrega tu cuenta de débito, efectivo o una tarjeta para ver sus saldos.</p></Card>}

      {summaries.map((method) => (
        <Card key={method.id}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{method.name}</h2>
              <p className="text-sm text-zinc-500">{method.kindLabel}{method.type === "CREDIT_CARD" && ` · corte día ${method.closingDay ?? "-"} · pago día ${method.paymentDay ?? "-"}`}</p>
            </div>
            <div className="flex items-center gap-3">
              <details className="text-sm">
                <summary className="cursor-pointer underline underline-offset-4">Editar</summary>
                <div className="mt-3 w-72 max-w-full sm:w-96">
                  <MethodForm action={updatePaymentMethod} workspaceId={workspaceId} initial={method} />
                </div>
              </details>
              <form action={deletePaymentMethod.bind(null, method.id)}>
                <button className={btnDangerCls}>Eliminar</button>
              </form>
            </div>
          </div>
          <MethodStats method={method} currency={currency} />
          {method.type === "CREDIT_CARD" && (
            <p className="mt-3 text-xs text-zinc-500">
              {method.balance.nextClose ? `Próximo corte: ${formatFecha(method.balance.nextClose)}` : "Configura el día de corte para ver el estado de cuenta."}
              {" · "}Los consumos y abonos se toman de tus movimientos; registra el pago a la tarjeta como ingreso con su medio de pago.
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
