"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { parseFechaLocal } from "@/lib/format";
import {
  emptyToUndefined,
  firstError,
  transactionSchema,
  type ActionResult,
} from "@/lib/validations";

function parseForm(formData: FormData) {
  return transactionSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    currency: emptyToUndefined(formData.get("currency")) ?? "MXN",
    date: formData.get("date"),
    note: emptyToUndefined(formData.get("note")),
    categoryId: emptyToUndefined(formData.get("categoryId")),
  });
}

async function assertCategory(userId: string, categoryId: string) {
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, userId },
  });
  return !!cat;
}

export async function createTransaction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = parseForm(formData);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  if (d.categoryId && !(await assertCategory(userId, d.categoryId))) {
    return { ok: false, error: "Categoría inválida" };
  }
  await prisma.transaction.create({
    data: {
      userId,
      type: d.type,
      amount: d.amount,
      currency: d.currency,
      date: parseFechaLocal(d.date),
      note: d.note ?? null,
      categoryId: d.categoryId ?? null,
    },
  });
  revalidatePath("/");
  return { ok: true };
}

export async function updateTransaction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = parseForm(formData);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const existing = await prisma.transaction.findFirst({
    where: { id, userId },
  });
  if (!existing) return { ok: false, error: "Movimiento no encontrado" };
  if (d.categoryId && !(await assertCategory(userId, d.categoryId))) {
    return { ok: false, error: "Categoría inválida" };
  }
  await prisma.transaction.update({
    where: { id },
    data: {
      type: d.type,
      amount: d.amount,
      currency: d.currency,
      date: parseFechaLocal(d.date),
      note: d.note ?? null,
      categoryId: d.categoryId ?? null,
    },
  });
  revalidatePath("/");
  redirect("/");
}

export async function deleteTransaction(id: string): Promise<void> {
  const userId = await requireUserId();
  const existing = await prisma.transaction.findFirst({
    where: { id, userId },
  });
  if (!existing) return;
  await prisma.transaction.delete({ where: { id } });
  revalidatePath("/");
}
