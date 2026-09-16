import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { Card, btnDangerCls, inputCls, labelCls } from "@/components/ui";
import { SimpleForm } from "@/components/simple-form";
import { deleteExchangeRate, updatePrimaryCurrency, upsertExchangeRate } from "@/app/actions/currency";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function CurrencyPage({ searchParams }: { searchParams: Promise<{ workspaceId?: string }> }) {
  const userId = await requireUserId();
  const { workspaceId } = await getWorkspaceContext(userId, (await searchParams).workspaceId);
  const [owner, rates] = await Promise.all([
    workspaceId ? prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { primaryCurrency: true } }) : prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { primaryCurrency: true } }),
    prisma.exchangeRate.findMany({ where: { userId, workspaceId }, orderBy: [{ to: "asc" }, { from: "asc" }] }),
  ]);
  return <div className="grid gap-6"><h1 className="text-xl font-bold">Moneda y tasas</h1><Card><h2 className="mb-3 font-bold">Moneda principal</h2><SimpleForm action={updatePrimaryCurrency}><input type="hidden" name="workspaceId" value={workspaceId ?? ""}/><label className={labelCls}>Código ISO de 3 letras</label><input name="primaryCurrency" className={inputCls} defaultValue={owner.primaryCurrency} maxLength={3} required /></SimpleForm><p className="mt-3 text-xs text-zinc-500">Por defecto se usa CRC (colones) en cuentas nuevas.</p></Card><Card><h2 className="mb-3 font-bold">Agregar o actualizar tasa</h2><SimpleForm action={upsertExchangeRate}><div className="grid gap-3 sm:grid-cols-3"><div><label className={labelCls}>Desde</label><input name="from" className={inputCls} placeholder="USD" maxLength={3} required /></div><div><label className={labelCls}>Hacia</label><input name="to" className={inputCls} defaultValue={owner.primaryCurrency} maxLength={3} required /></div><div><label className={labelCls}>Equivalencia</label><input name="rate" className={inputCls} placeholder="17.25" required /></div></div></SimpleForm><div className="mt-5 grid gap-2">{rates.map(r => <div key={r.id} className="flex items-center justify-between border-t pt-2 text-sm"><span>1 {r.from} = {String(r.rate)} {r.to}</span><form action={deleteExchangeRate.bind(null, r.id)}><button className={btnDangerCls}>Eliminar</button></form></div>)}</div></Card></div>;
}
