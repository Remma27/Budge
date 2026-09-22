// Saldos por medio de pago. Todo se calcula en la moneda primaria del usuario
// (el loader convierte los movimientos antes de llamar estas funciones).
//
// Reglas:
// - Débito/efectivo: saldo = saldo inicial + ingresos - gastos.
// - Crédito: se asume que los estados anteriores ya se pagaron; el estado
//   vigente es la ventana (corte anterior, último corte] y los consumos desde
//   el último corte forman el ciclo nuevo. Un ingreso registrado en la tarjeta
//   cuenta como abono y reduce la deuda desde el último corte.

export type PaymentKind = "DEBIT" | "CASH" | "CREDIT_CARD";

export interface PaymentMethodInfo {
  type: PaymentKind;
  creditLimit: number | null;
  openingBalance: number | null;
  closingDay: number | null;
  paymentDay: number | null;
}

export interface MethodMovement {
  type: "INCOME" | "EXPENSE";
  amount: number;
  date: Date;
}

export interface PaymentBalance {
  /** Ingresos históricos en el medio (depósitos o abonos). */
  income: number;
  /** Gastos/consumos históricos en el medio. */
  expense: number;
  /** Saldo actual (débito/efectivo) o deuda estimada (crédito, negativa = a favor). */
  balance: number;
  /** Límite - deuda. Solo tarjetas con límite configurado. */
  available: number | null;
  /** Monto del estado de cuenta vigente. Null sin día de corte. */
  statementAmount: number | null;
  /** Inicio de la ventana del estado (día después del corte anterior). */
  statementStart: Date | null;
  /** Fin de la ventana del estado (último corte). */
  statementEnd: Date | null;
  /** Consumos del ciclo nuevo (desde el último corte). */
  cycleExpense: number;
  /** Abonos del ciclo nuevo (desde el último corte). */
  cyclePayments: number;
  /** Último corte ocurrido. */
  lastClose: Date | null;
  /** Próximo corte. */
  nextClose: Date | null;
  /** Vencimiento del estado vigente (puede estar vencido). */
  dueDate: Date | null;
}

const KIND_LABELS: Record<PaymentKind, string> = {
  DEBIT: "Débito",
  CASH: "Efectivo",
  CREDIT_CARD: "Crédito",
};

export function paymentKindLabel(type: PaymentKind): string {
  return KIND_LABELS[type] ?? type;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

// Día de corte válido para el mes (31 → último día de febrero en años bisiestos).
function closeDate(year: number, month0: number, day: number): Date {
  const lastDayOfMonth = new Date(year, month0 + 1, 0).getDate();
  return new Date(year, month0, Math.min(day, lastDayOfMonth));
}

function shiftMonth(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

/**
 * Cortes alrededor de `now`: los dos cortes ya ocurridos (más reciente primero)
 * y el próximo. Un corte ocurrió cuando terminó su día, así que si hoy es día
 * de corte el último corte es el del mes anterior.
 */
export function closingDates(day: number, now: Date): { last: Date | null; prev: Date | null; next: Date | null } {
  const passed: Date[] = [];
  let cursor = startOfDay(now);
  for (let i = 0; i < 24 && passed.length < 2; i++) {
    const candidate = closeDate(cursor.getFullYear(), cursor.getMonth(), day);
    if (endOfDay(candidate) <= now) passed.push(candidate);
    cursor = shiftMonth(cursor, -1);
  }
  let next: Date | null = null;
  cursor = startOfDay(now);
  for (let i = 0; i < 24 && !next; i++) {
    const candidate = closeDate(cursor.getFullYear(), cursor.getMonth(), day);
    if (candidate.getTime() >= startOfDay(now).getTime()) next = candidate;
    cursor = shiftMonth(cursor, 1);
  }
  return { last: passed[0] ?? null, prev: passed[1] ?? null, next };
}

/** Primer día de pago posterior al último corte (vencimiento del estado vigente). */
export function paymentDueDate(day: number, lastClose: Date, now: Date): Date | null {
  let cursor = lastClose ? startOfDay(lastClose) : startOfDay(now);
  cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  for (let i = 0; i < 24; i++) {
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(day, daysInMonth));
    if (candidate.getTime() > lastClose.getTime()) return candidate;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return null;
}

const sum = (rows: MethodMovement[]) => rows.reduce((n, row) => n + row.amount, 0);

export function computePaymentBalance(method: PaymentMethodInfo, movements: MethodMovement[], now: Date): PaymentBalance {
  const income = sum(movements.filter((m) => m.type === "INCOME"));
  const expense = sum(movements.filter((m) => m.type === "EXPENSE"));

  const base = { income, expense, available: null, statementAmount: null, statementStart: null, statementEnd: null, cycleExpense: 0, cyclePayments: 0, lastClose: null, nextClose: null, dueDate: null } as PaymentBalance;

  if (method.type !== "CREDIT_CARD") {
    return { ...base, balance: (method.openingBalance ?? 0) + income - expense };
  }

  if (!method.closingDay) {
    return { ...base, balance: expense - income };
  }

  const { last, prev, next } = closingDates(method.closingDay, now);
  if (!last) return { ...base, balance: expense - income };

  const statementRows = movements.filter((m) => m.date > endOfDay(prev ?? last) && m.date <= endOfDay(last));
  const cycleRows = movements.filter((m) => m.date > endOfDay(last));
  const cycleExpense = sum(cycleRows.filter((m) => m.type === "EXPENSE"));
  const cyclePayments = sum(cycleRows.filter((m) => m.type === "INCOME"));
  const statementAmount = sum(statementRows.filter((m) => m.type === "EXPENSE"));
  const balance = statementAmount + cycleExpense - cyclePayments;

  return {
    ...base,
    balance,
    available: method.creditLimit === null ? null : method.creditLimit - balance,
    statementAmount,
    statementStart: prev ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1) : null,
    statementEnd: last,
    cycleExpense,
    cyclePayments,
    lastClose: last,
    nextClose: next,
    dueDate: method.paymentDay ? paymentDueDate(method.paymentDay, last, now) : null,
  };
}
