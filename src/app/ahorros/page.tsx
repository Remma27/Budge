import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { getWorkspaceContext, scopeWorkspace } from "@/lib/workspace";
import { Card, inputCls, labelCls, btnDangerCls } from "@/components/ui";
import { SimpleForm } from "@/components/simple-form";
import { createSavings, addContribution, deleteSavings } from "@/app/actions/savings";
import { formatMoney, toInputDate } from "@/lib/format";

const frequencies: Record<string, string> = { DAILY: "Diario", WEEKLY: "Semanal", BIWEEKLY: "Quincenal", MONTHLY: "Mensual" };

export default async function Page({ searchParams }: { searchParams: Promise<{ workspaceId?: string }> }) {
  const userId = await requireUserId();
  const { workspaceId } = await getWorkspaceContext(userId, (await searchParams).workspaceId);
  const [goals, user] = await Promise.all([
    prisma.savingsGoal.findMany({ where: scopeWorkspace(userId, workspaceId), include: { contributions: { orderBy: { date: "desc" }, take: 3 } }, orderBy: { targetDate: "asc" } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { primaryCurrency: true } }),
  ]);
  return <div className="grid gap-6">
    <div><h1 className="text-xl font-bold">Ahorros</h1><p className="mt-2 text-sm text-zinc-600">Ahorra a tu ritmo, con una meta o sin límite de monto y fecha.</p></div>
    <Card><h2 className="mb-4 font-semibold">Crear un ahorro</h2><SimpleForm action={createSavings} submitLabel="Crear ahorro" successMessage="Ahorro creado. Ya puedes registrar aportes.">
      <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
      <label><span className={labelCls}>Nombre del ahorro</span><input name="name" className={inputCls} placeholder="Ej. Fondo de emergencia" maxLength={100} required /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className={labelCls}>Meta (opcional)</span><input name="target" className={inputCls} inputMode="decimal" placeholder="Sin límite si lo dejas vacío" /></label>
        <label><span className={labelCls}>Monto inicial (opcional)</span><input name="initialAmount" className={inputCls} inputMode="decimal" placeholder="0.00" /></label>
        <label><span className={labelCls}>Moneda</span><input name="currency" className={inputCls} defaultValue={user.primaryCurrency} maxLength={3} required /></label>
        <label><span className={labelCls}>Frecuencia de aporte</span><select name="frequency" className={inputCls} defaultValue=""><option value="">Cuando pueda</option>{Object.entries(frequencies).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span className={labelCls}>Fecha de meta (opcional)</span><input name="targetDate" type="date" className={inputCls} /></label>
      </div>
      <p className="text-sm text-zinc-600">La frecuencia organiza tu plan; los aportes se registran manualmente.</p>
    </SimpleForm></Card>
    {goals.map(g => <Card key={g.id}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold">{g.name}</h2><p className="mt-2 text-lg font-semibold tabular-nums">{formatMoney(g.balance, g.currency)}</p><p className="mt-1 text-sm text-zinc-600">{g.target === null ? "Sin meta de monto" : `Meta: ${formatMoney(g.target, g.currency)}`}{g.frequency ? ` · ${frequencies[g.frequency]}` : ""}{g.targetDate ? ` · ${toInputDate(g.targetDate)}` : " · Sin fecha límite"}</p></div>
        <form action={deleteSavings.bind(null, g.id)}><button className={`${btnDangerCls} min-h-11`}>Eliminar</button></form>
      </div>
      <SimpleForm action={addContribution.bind(null, g.id)} submitLabel="Registrar aporte" successMessage="Aporte registrado."><input type="hidden" name="workspaceId" value={workspaceId ?? ""} /><label><span className={labelCls}>Monto del aporte ({g.currency})</span><input name="amount" className={inputCls} inputMode="decimal" placeholder="Ej. 5000" required /></label></SimpleForm>
    </Card>)}
  </div>;
}
