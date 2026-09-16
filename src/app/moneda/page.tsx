import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { Card, btnDangerCls, inputCls, labelCls } from "@/components/ui";
import { SimpleForm } from "@/components/simple-form";
import { deleteExchangeRate, updatePrimaryCurrency, upsertExchangeRate } from "@/app/actions/currency";

export default async function CurrencyPage() {
  const userId = await requireUserId();
  const [user, rates] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { primaryCurrency: true } }), prisma.exchangeRate.findMany({ where: { userId }, orderBy: [{ to: "asc" }, { from: "asc" }] })]);
  return <div className="grid gap-6"><h1 className="text-xl font-bold">Moneda y tasas</h1><Card><h2 className="mb-3 font-bold">Moneda principal</h2><SimpleForm action={updatePrimaryCurrency}><label className={labelCls}>Código ISO de 3 letras</label><input name="primaryCurrency" className={inputCls} defaultValue={user.primaryCurrency} maxLength={3} required /></SimpleForm><p className="mt-3 text-xs text-zinc-500">Las tasas son manuales: no se envían datos a proveedores externos.</p></Card><Card><h2 className="mb-3 font-bold">Agregar o actualizar tasa</h2><SimpleForm action={upsertExchangeRate}><div className="grid gap-3 sm:grid-cols-3"><div><label className={labelCls}>Desde</label><input name="from" className={inputCls} placeholder="USD" maxLength={3} required /></div><div><label className={labelCls}>Hacia</label><input name="to" className={inputCls} defaultValue={user.primaryCurrency} maxLength={3} required /></div><div><label className={labelCls}>Equivalencia</label><input name="rate" className={inputCls} placeholder="17.25" required /></div></div></SimpleForm><div className="mt-5 grid gap-2">{rates.map((r) => <div key={r.id} className="flex items-center justify-between border-t border-zinc-200 pt-2 text-sm dark:border-zinc-800"><span>1 {r.from} = {String(r.rate)} {r.to}</span><form action={deleteExchangeRate.bind(null, r.id)}><button className={btnDangerCls}>Eliminar</button></form></div>)}{rates.length === 0 && <p className="text-sm text-zinc-500">Aún no hay tasas manuales.</p>}</div></Card></div>;
}
