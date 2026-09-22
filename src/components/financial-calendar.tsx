"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/format";

type Event = { day: number; kind: "transaction" | "recurring" | "cutoff" | "payment"; label: string; amount?: string; currency?: string };

export function FinancialCalendar({ year, month, events, previous, next }: { year: number; month: number; events: Event[]; previous: string; next: string }) {
  const first = new Date(year, month - 1, 1).getDay();
  const offset = (first + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  const byDay = new Map<number, Event[]>();
  events.forEach((event) => byDay.set(event.day, [...(byDay.get(event.day) ?? []), event]));
  return <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_18px_50px_-28px_rgba(15,23,42,.35)] sm:p-6">
    <div className="mb-5 flex items-center justify-between gap-3"><Link href={`/calendario?mes=${previous}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">Anterior</Link><h1 className="text-center text-xl font-bold capitalize tracking-tight text-slate-900">{monthLabel}</h1><Link href={`/calendario?mes=${next}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">Siguiente</Link></div>
    <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-600"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-500" />Movimientos</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Recurrentes</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />Tarjetas</span></div>
    <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-slate-200"><div className="col-span-7 grid grid-cols-7 bg-slate-50">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(day => <div key={day} className="p-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{day}</div>)}</div>{Array.from({ length: offset + days }, (_, index) => { const day = index - offset + 1; const dayEvents = day > 0 ? byDay.get(day) ?? [] : []; return <div key={index} className={`min-h-28 border-t border-slate-200 p-1.5 sm:min-h-36 sm:p-2 ${day < 1 ? "bg-slate-50/60" : "bg-white"}`}><span className={day === new Date().getDate() && month === new Date().getMonth() + 1 && year === new Date().getFullYear() ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white" : "text-xs font-semibold text-slate-500"}>{day > 0 ? day : ""}</span><div className="mt-1 grid gap-1">{dayEvents.map((event, eventIndex) => <div key={`${event.kind}-${eventIndex}`} className={`truncate rounded-md px-1.5 py-1 text-xs font-medium ${event.kind === "transaction" ? "bg-indigo-50 text-indigo-700" : event.kind === "recurring" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`} title={event.label}>{event.label}{event.amount && <span className="hidden sm:inline"> · {formatMoney(event.amount, event.currency ?? "MXN")}</span>}</div>)}</div></div>; })}</div>
  </section>;
}
