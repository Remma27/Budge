import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { FinancialCalendar } from "@/components/financial-calendar";
import { moverMes, normalizarMes, rangoMes } from "@/lib/format";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const userId = await requireUserId();
  const mes = normalizarMes((await searchParams).mes);
  const [year, month] = mes.split("-").map(Number);
  const { inicio, fin } = rangoMes(mes);
  const [transactions, recurring, methods] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, workspaceId: null, date: { gte: inicio, lt: fin } }, include: { category: true }, orderBy: { date: "asc" } }),
    prisma.recurringRule.findMany({ where: { userId, workspaceId: null, isActive: true, nextRun: { gte: inicio, lt: fin } }, include: { category: true } }),
    prisma.paymentMethod.findMany({ where: { userId, workspaceId: null }, select: { name: true, type: true, closingDay: true, paymentDay: true } }),
  ]);
  const cardEvents = methods.flatMap(method => {
    const result: { day: number; kind: "cutoff" | "payment"; label: string }[] = [];
    if (method.closingDay) result.push({ day: method.closingDay, kind: "cutoff", label: `Corte · ${method.name}` });
    if (method.paymentDay) result.push({ day: method.paymentDay, kind: "payment", label: `Pago · ${method.name}` });
    return result;
  });
  const events = [
    ...transactions.map(t => ({ day: t.date.getDate(), kind: "transaction" as const, label: t.category?.name ?? t.note ?? "Movimiento", amount: String(t.amount), currency: t.currency })),
    ...recurring.map(r => ({ day: r.nextRun.getDate(), kind: "recurring" as const, label: r.note ?? r.category?.name ?? "Recurrente", amount: String(r.amount), currency: r.currency })),
    ...cardEvents,
  ];
  return <div className="grid gap-5"><div><p className="text-sm font-medium text-indigo-600">Organiza tu dinero</p><p className="mt-1 text-sm text-slate-500">Movimientos, cargos programados y fechas importantes en un solo lugar.</p></div><FinancialCalendar year={year} month={month} events={events} previous={moverMes(mes, -1)} next={moverMes(mes, 1)} /><p className="text-xs text-slate-500">Los días de corte y pago se muestran según la configuración de tus medios de pago.</p></div>;
}
