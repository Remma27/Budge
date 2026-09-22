import { describe, expect, it } from "vitest";
import { closingDates, computePaymentBalance, paymentDueDate, paymentKindLabel, type PaymentMethodInfo } from "./payment-balances";

const debit: PaymentMethodInfo = { type: "DEBIT", creditLimit: null, openingBalance: null, closingDay: null, paymentDay: null };
const card: PaymentMethodInfo = { type: "CREDIT_CARD", creditLimit: 100000, openingBalance: null, closingDay: 15, paymentDay: 25 };
const spend = (amount: number, date: Date) => ({ type: "EXPENSE" as const, amount, date });
const payment = (amount: number, date: Date) => ({ type: "INCOME" as const, amount, date });

describe("payment balances", () => {
  it("computes debit and cash balance as opening balance plus income minus expenses", () => {
    const balance = computePaymentBalance(
      { ...debit, openingBalance: 1000 },
      [payment(500, new Date(2026, 8, 1)), spend(200, new Date(2026, 8, 2))],
      new Date(2026, 8, 22, 12),
    );
    expect(balance.balance).toBe(1300);
    expect(balance.income).toBe(500);
    expect(balance.expense).toBe(200);
    expect(balance.available).toBeNull();
    expect(balance.statementAmount).toBeNull();
  });

  it("splits a credit card into the statement at cutoff and the new cycle", () => {
    const now = new Date(2026, 8, 22, 12);
    const balance = computePaymentBalance(card, [
      spend(1000, new Date(2026, 7, 10, 12)), // estado anterior (asumido pagado)
      spend(3000, new Date(2026, 8, 10, 12)), // dentro del estado vigente
      spend(4000, new Date(2026, 8, 15, 12)), // día de corte: entra al estado
      spend(500, new Date(2026, 8, 20, 12)),  // ciclo nuevo
      payment(3000, new Date(2026, 8, 21, 12)), // abono tras el corte
    ], now);
    expect(balance.statementAmount).toBe(7000);
    expect(balance.statementStart).toEqual(new Date(2026, 7, 16));
    expect(balance.statementEnd).toEqual(new Date(2026, 8, 15));
    expect(balance.cycleExpense).toBe(500);
    expect(balance.cyclePayments).toBe(3000);
    expect(balance.balance).toBe(7000 + 500 - 3000);
    expect(balance.available).toBe(100000 - 4500);
    expect(balance.lastClose).toEqual(new Date(2026, 8, 15));
    expect(balance.nextClose).toEqual(new Date(2026, 9, 15));
    expect(balance.dueDate).toEqual(new Date(2026, 8, 25));
  });

  it("treats today's cutoff as pending and reports due dates after the last cutoff", () => {
    const onCutoffDay = closingDates(15, new Date(2026, 8, 15, 10));
    expect(onCutoffDay.last).toEqual(new Date(2026, 7, 15));
    expect(onCutoffDay.next).toEqual(new Date(2026, 8, 15));
    // Corte 25 y pago el 5: el vencimiento cae en el mes siguiente.
    expect(paymentDueDate(5, new Date(2026, 8, 25), new Date(2026, 8, 30))).toEqual(new Date(2026, 9, 5));
  });

  it("clamps cutoff day 31 to the last day of short months", () => {
    const dates = closingDates(31, new Date(2026, 1, 10, 12));
    expect(dates.last).toEqual(new Date(2026, 0, 31));
    expect(dates.prev).toEqual(new Date(2025, 11, 31));
    expect(dates.next).toEqual(new Date(2026, 1, 28));
  });

  it("falls back to lifetime totals when a credit card has no cutoff configured", () => {
    const balance = computePaymentBalance({ ...card, closingDay: null, paymentDay: null }, [
      spend(1000, new Date(2026, 7, 10, 12)),
      payment(400, new Date(2026, 8, 10, 12)),
    ], new Date(2026, 8, 22, 12));
    expect(balance.balance).toBe(600);
    expect(balance.statementAmount).toBeNull();
    expect(balance.dueDate).toBeNull();
    expect(balance.nextClose).toBeNull();
  });

  it("labels payment method kinds in Spanish", () => {
    expect(paymentKindLabel("DEBIT")).toBe("Débito");
    expect(paymentKindLabel("CASH")).toBe("Efectivo");
    expect(paymentKindLabel("CREDIT_CARD")).toBe("Crédito");
  });
});
