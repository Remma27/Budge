// Carga los saldos de todos los movimientos con medio de pago, convirtiendo a la
// moneda primaria del usuario (tasas guardadas primero, luego Frankfurter).
import { prisma } from "@/lib/prisma";
import { fetchExchangeRate } from "@/lib/exchange-rates";
import {
  computePaymentBalance,
  paymentKindLabel,
  type MethodMovement,
  type PaymentBalance,
  type PaymentKind,
} from "@/lib/payment-balances";

export interface PaymentBalanceSummary {
  id: string;
  name: string;
  type: PaymentKind;
  kindLabel: string;
  creditLimit: number | null;
  openingBalance: number | null;
  closingDay: number | null;
  paymentDay: number | null;
  balance: PaymentBalance;
}

export interface PaymentBalancesResult {
  summaries: PaymentBalanceSummary[];
  /** Suma de saldos de débito y efectivo. */
  cashBalance: number;
  /** Deuda total de las tarjetas (positiva = por pagar). */
  creditDebt: number;
  /** Disponible de las tarjetas con límite; null si ninguna tiene límite. */
  creditAvailable: number | null;
  /** Monedas que no se pudieron convertir (se omitieron de los saldos). */
  unconverted: string[];
}

const decimal = (value: unknown): number | null => (value === null ? null : Number(value));

export async function loadPaymentBalances(
  scope: { userId: string; workspaceId: string | null },
  primaryCurrency: string,
): Promise<PaymentBalancesResult> {
  const [methods, rates, txs] = await Promise.all([
    prisma.paymentMethod.findMany({ where: scope, orderBy: { name: "asc" } }),
    prisma.exchangeRate.findMany({ where: { userId: scope.userId }, select: { from: true, to: true, rate: true } }),
    prisma.transaction.findMany({
      where: { ...scope, paymentMethodId: { not: null } },
      select: { paymentMethodId: true, type: true, amount: true, currency: true, date: true },
    }),
  ]);

  const rateMap = new Map(rates.map((r) => [`${r.from}:${r.to}`, Number(r.rate)]));
  const currencies = [...new Set(txs.map((t) => t.currency))].filter((c) => c !== primaryCurrency);
  await Promise.all(currencies.map(async (currency) => {
    const rate = await fetchExchangeRate(currency, primaryCurrency);
    if (rate) rateMap.set(`${currency}:${primaryCurrency}`, rate);
  }));

  const unconverted = new Set<string>();
  const byMethod = new Map<string, MethodMovement[]>();
  for (const t of txs) {
    if (!t.paymentMethodId) continue;
    const factor = t.currency === primaryCurrency ? 1 : rateMap.get(`${t.currency}:${primaryCurrency}`);
    if (!factor) { unconverted.add(t.currency); continue; }
    const rows = byMethod.get(t.paymentMethodId) ?? [];
    rows.push({ type: t.type, amount: Number(t.amount) * factor, date: t.date });
    byMethod.set(t.paymentMethodId, rows);
  }

  const now = new Date();
  const summaries: PaymentBalanceSummary[] = methods.map((m) => {
    const info = {
      type: m.type as PaymentKind,
      creditLimit: decimal(m.creditLimit),
      openingBalance: decimal(m.openingBalance),
      closingDay: m.closingDay,
      paymentDay: m.paymentDay,
    };
    return { id: m.id, name: m.name, kindLabel: paymentKindLabel(info.type), ...info, balance: computePaymentBalance(info, byMethod.get(m.id) ?? [], now) };
  });

  const cashBalance = summaries.filter((s) => s.type !== "CREDIT_CARD").reduce((n, s) => n + s.balance.balance, 0);
  const creditDebt = summaries.filter((s) => s.type === "CREDIT_CARD").reduce((n, s) => n + s.balance.balance, 0);
  const withLimit = summaries.filter((s) => s.type === "CREDIT_CARD" && s.creditLimit !== null);
  const creditAvailable = withLimit.length
    ? withLimit.reduce((n, s) => n + (s.creditLimit as number) - s.balance.balance, 0)
    : null;

  return { summaries, cashBalance, creditDebt, creditAvailable, unconverted: [...unconverted] };
}
