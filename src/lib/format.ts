export function formatMoney(
  amount: number | string | { toString(): string },
  currency: string,
): string {
  const n = Number(amount);
  try {
    return new Intl.NumberFormat(currency === "CRC" ? "es-CR" : "es-MX", {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    // Moneda no estándar: formato neutro.
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function formatFecha(d: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

// "2026-09-16" -> Date al mediodía local (evita que el huso horario cambie el día).
export function parseFechaLocal(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day, 12, 0, 0);
}

export function toInputDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function mesActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function normalizarMes(mes: string | undefined): string {
  return mes && MES_RE.test(mes) ? mes : mesActual();
}

export function rangoMes(mes: string): {
  inicio: Date;
  fin: Date;
  etiqueta: string;
} {
  const [y, m] = mes.split("-").map(Number);
  const inicio = new Date(y, m - 1, 1, 0, 0, 0);
  const fin = new Date(y, m, 1, 0, 0, 0);
  const etiqueta = new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
  }).format(inicio);
  return { inicio, fin, etiqueta };
}

export function moverMes(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
