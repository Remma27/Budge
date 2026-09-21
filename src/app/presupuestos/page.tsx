import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { Card, btnDangerCls } from "@/components/ui";
import { SimpleForm, inputCls, labelCls } from "@/components/simple-form";
import { createBudget, deleteBudget } from "@/app/actions/budgets";
import { getWorkspaceContext, scopeWorkspace } from "@/lib/workspace";
import { findBudgets } from "@/lib/budgets";

export default async function Page({ searchParams }: { searchParams: Promise<{ workspaceId?: string }> }) {
  const userId = await requireUserId();
  const { workspaceId } = await getWorkspaceContext(userId, (await searchParams).workspaceId);
  const scope = scopeWorkspace(userId, workspaceId);
  const [categories, budgets, owner] = await Promise.all([
    prisma.category.findMany({ where: scope, orderBy: { name: "asc" } }),
    findBudgets(userId, workspaceId),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { primaryCurrency: true } }),
  ]);
  return <div className="grid gap-6"><h1 className="text-xl font-bold">Presupuestos</h1><Card><SimpleForm action={createBudget}><input type="hidden" name="workspaceId" value={workspaceId ?? ""} /><div><label className={labelCls}>Categoría</label><select name="categoryId" className={inputCls} required><option value="">Selecciona...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label className={labelCls}>Tipo</label><select name="mode" className={inputCls} defaultValue="FIXED"><option value="FIXED">Monto fijo</option><option value="PERCENTAGE">Porcentaje de ingresos</option></select></div><div><label className={labelCls}>Monto fijo o porcentaje</label><input name="amount" className={inputCls} placeholder="Monto fijo" /><input name="percentage" type="number" min="1" max="100" className={inputCls} placeholder="Porcentaje (1-100)" /></div><div><label className={labelCls}>Moneda</label><input name="currency" defaultValue={owner.primaryCurrency} className={inputCls} required /></div><div><label className={labelCls}>Mes (opcional)</label><input name="month" type="month" className={inputCls} /></div></SimpleForm></Card>{budgets.map(b => <Card key={b.id}><div className="flex justify-between"><span>{b.category.name} · {b.budgetMode === "PERCENTAGE" ? `${String(b.percentage)}%` : b.month ?? "Fijo"}</span><span>{b.budgetMode === "PERCENTAGE" ? `${String(b.percentage)}%` : `${String(b.amount)} ${b.currency}`}</span><form action={deleteBudget.bind(null, b.id, workspaceId ?? undefined)}><button className={btnDangerCls}>Eliminar</button></form></div></Card>)}</div>;
}
