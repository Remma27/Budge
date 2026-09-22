import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, scopeWorkspace } from "@/lib/workspace";

export async function GET(request: Request) {
  // 401 JSON (no redirect): los clientes fetch deben distinguir "sin sesión" de un CSV.
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
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
  // Neutraliza fórmulas de hoja de cálculo (=, +, -, @): Excel/Sheets las ejecutarían al abrir el CSV.
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const csv = ["date,type,amount,currency,category,note", ...rows.map(t => [t.date.toISOString().slice(0, 10), t.type, t.amount, t.currency, t.category?.name, t.note].map(escape).join(","))].join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=budge-movimientos.csv" } });
}
