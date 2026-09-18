import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { getWorkspaceContext, scopeWorkspace } from "@/lib/workspace";

export async function GET(request: Request) {
  const userId = await requireUserId();
  const params = new URL(request.url).searchParams;
  const workspaceId = params.get("workspaceId");
  const { workspaceId: selected } = await getWorkspaceContext(userId, workspaceId);
  const scope = scopeWorkspace(userId, selected);
  const type = params.get("tipo");
  const rows = await prisma.transaction.findMany({ where: { ...scope, ...(params.get("moneda") && { currency: params.get("moneda")!.toUpperCase() }), ...(type === "INCOME" || type === "EXPENSE" ? { type } : {}), ...(params.get("categoria") && { categoryId: params.get("categoria")! }), ...(params.get("q") && { OR: [{ note: { contains: params.get("q")!, mode: "insensitive" } }, { category: { name: { contains: params.get("q")!, mode: "insensitive" } } }] }) }, include: { category: true }, orderBy: { date: "asc" } });
  if (params.get("format") === "backup") {
    const [categories, budgets, recurring] = await Promise.all([prisma.category.findMany({ where: scope }), prisma.budget.findMany({ where: scope }), prisma.recurringRule.findMany({ where: scope })]);
    return NextResponse.json({ version: 1, exportedAt: new Date().toISOString(), categories, transactions: rows, budgets, recurring });
  }
  const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = ["date,type,amount,currency,category,note", ...rows.map(t => [t.date.toISOString().slice(0, 10), t.type, t.amount, t.currency, t.category?.name, t.note].map(escape).join(","))].join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=budge-movimientos.csv" } });
}
