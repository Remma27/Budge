import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseFechaLocal } from "@/lib/format";
import { transactionSchema } from "@/lib/validations";
import { getActionWorkspace, scopeWorkspace } from "@/lib/workspace";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.transactions) || body.transactions.length > 100) {
    return NextResponse.json({ error: "Lote inválido" }, { status: 400 });
  }
  const rows = [];
  for (const row of body.transactions) {
    if (typeof row.id !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(row.id)) return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
    const parsed = transactionSchema.safeParse(row);
    if (!parsed.success) return NextResponse.json({ error: "Movimiento inválido" }, { status: 400 });
    const workspaceId = typeof row.workspaceId === "string" && row.workspaceId ? await getActionWorkspace(userId, row.workspaceId) : null;
    const scope = scopeWorkspace(userId, workspaceId);
    const categoryId = parsed.data.categoryId ?? null;
    if (categoryId && !(await prisma.category.findFirst({ where: { ...scope, id: categoryId }, select: { id: true } }))) return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    const paymentMethodId = parsed.data.paymentMethodId ?? null;
    if (paymentMethodId && !(await prisma.paymentMethod.findFirst({ where: { ...scope, id: paymentMethodId }, select: { id: true } }))) return NextResponse.json({ error: "Medio de pago inválido" }, { status: 400 });
    rows.push({ id: row.id, userId, ...parsed.data, amount: parsed.data.amount, date: parseFechaLocal(parsed.data.date), note: parsed.data.note ?? null, categoryId, paymentMethodId, workspaceId });
  }
  await prisma.transaction.createMany({ data: rows, skipDuplicates: true });
  return NextResponse.json({ ok: true });
}
