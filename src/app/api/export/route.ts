import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { getWorkspaceContext, scopeWorkspace } from "@/lib/workspace";

export async function GET(request: Request) {
  const userId = await requireUserId();
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  const { workspaceId: selected } = await getWorkspaceContext(userId, workspaceId);
  const scope = scopeWorkspace(userId, selected);
  const rows = await prisma.transaction.findMany({ where: scope, include: { category: true }, orderBy: { date: "asc" } });
  if (new URL(request.url).searchParams.get("format") === "backup") {
    const [categories, budgets, recurring] = await Promise.all([prisma.category.findMany({ where: scope }), prisma.budget.findMany({ where: scope }), prisma.recurringRule.findMany({ where: scope })]);
    return NextResponse.json({ version: 1, exportedAt: new Date().toISOString(), categories, transactions: rows, budgets, recurring });
  }
  const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = ["date,type,amount,currency,category,note", ...rows.map(t => [t.date.toISOString().slice(0, 10), t.type, t.amount, t.currency, t.category?.name, t.note].map(escape).join(","))].join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=budge-movimientos.csv" } });
}
