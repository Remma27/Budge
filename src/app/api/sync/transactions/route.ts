import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseFechaLocal } from "@/lib/format";
import { transactionSchema } from "@/lib/validations";

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
    const categoryId = parsed.data.categoryId ?? null;
    if (categoryId && !(await prisma.category.findFirst({ where: { id: categoryId, userId }, select: { id: true } }))) return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    rows.push({ id: row.id, userId, ...parsed.data, amount: parsed.data.amount, date: parseFechaLocal(parsed.data.date), note: parsed.data.note ?? null, categoryId });
  }
  await prisma.transaction.createMany({ data: rows, skipDuplicates: true });
  return NextResponse.json({ ok: true });
}
