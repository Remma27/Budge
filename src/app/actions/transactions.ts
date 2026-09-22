"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { parseFechaLocal, toInputDate } from "@/lib/format";
import {
  emptyToUndefined,
  firstError,
  transactionSchema,
  type ActionResult,
} from "@/lib/validations";
import { getActionWorkspace, requireWorkspaceRole, scopeWorkspace } from "@/lib/workspace";

function parseForm(formData: FormData) {
  return transactionSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    currency: emptyToUndefined(formData.get("currency")) ?? "CRC",
    date: formData.get("date"),
    note: emptyToUndefined(formData.get("note")),
    categoryId: emptyToUndefined(formData.get("categoryId")),
    paymentMethodId: emptyToUndefined(formData.get("paymentMethodId")),
  });
}

async function assertCategory(userId: string, categoryId: string, workspaceId: string | null) {
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, ...scopeWorkspace(userId, workspaceId) },
  });
  return !!cat;
}
async function assertPaymentMethod(userId: string, id: string, workspaceId: string | null) {
  return !!(await prisma.paymentMethod.findFirst({ where: { id, ...scopeWorkspace(userId, workspaceId) } }));
}

export async function createTransaction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const workspaceId = await getActionWorkspace(userId, String(formData.get("workspaceId") || ""));
  const parsed = parseForm(formData);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  if (d.categoryId && !(await assertCategory(userId, d.categoryId, workspaceId))) {
    return { ok: false, error: "Categoría inválida" };
  }
  if (d.paymentMethodId && !(await assertPaymentMethod(userId, d.paymentMethodId, workspaceId))) return { ok: false, error: "Medio de pago inválido" };
  await prisma.transaction.create({
    data: {
      userId, workspaceId,
      type: d.type,
      amount: d.amount,
      currency: d.currency,
      date: parseFechaLocal(d.date),
      note: d.note ?? null,
      categoryId: d.categoryId ?? null,
      paymentMethodId: d.paymentMethodId ?? null,
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
  const workspaceId = await getActionWorkspace(userId, String(formData.get("workspaceId") || ""));
  const parsed = parseForm(formData);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const existing = await prisma.transaction.findFirst({
    where: { id, userId, workspaceId },
  });
  if (!existing) return { ok: false, error: "Movimiento no encontrado" };
  if (d.categoryId && !(await assertCategory(userId, d.categoryId, workspaceId))) {
    return { ok: false, error: "Categoría inválida" };
  }
  if (d.paymentMethodId && !(await assertPaymentMethod(userId, d.paymentMethodId, workspaceId))) return { ok: false, error: "Medio de pago inválido" };
  await prisma.transaction.update({
    where: { id },
    data: {
      type: d.type,
      amount: d.amount,
      currency: d.currency,
      date: parseFechaLocal(d.date),
      note: d.note ?? null,
      categoryId: d.categoryId ?? null,
      paymentMethodId: d.paymentMethodId ?? null,
    },
  });
  revalidatePath("/");
  redirect("/");
}

export async function deleteTransaction(id: string): Promise<DeleteSnapshot | null> {
  const userId = await requireUserId();
  const existing = await prisma.transaction.findFirst({
    where: { id, userId },
  });
  if (!existing) return null;
  if (existing.workspaceId) await requireWorkspaceRole(userId, existing.workspaceId, (await import("@/generated/prisma/client")).WorkspaceRole.EDITOR);
  await prisma.transaction.delete({ where: { id } });
  revalidatePath("/");
  return {
    id: existing.id,
    type: existing.type,
    amount: existing.amount.toString(),
    currency: existing.currency,
    date: toInputDate(existing.date),
    note: existing.note,
    categoryId: existing.categoryId,
    paymentMethodId: existing.paymentMethodId,
    workspaceId: existing.workspaceId,
  };
}

const restoreSchema = transactionSchema.extend({
  id: z.string().trim().min(1).max(100),
  workspaceId: z.string().trim().min(1).nullable().optional(),
  // La fila borrada trae null donde el formulario trae undefined.
  note: transactionSchema.shape.note.nullish(),
  categoryId: transactionSchema.shape.categoryId.nullish(),
  paymentMethodId: transactionSchema.shape.paymentMethodId.nullish(),
});

export type DeleteSnapshot = z.infer<typeof restoreSchema>;

// Restaura un movimiento borrado (deshacer). Idempotente: si el id ya existe, no duplica.
export async function restoreTransaction(snap: DeleteSnapshot): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = restoreSchema.safeParse(snap);
  if (!parsed.success) return { ok: false, error: "No se pudo restaurar el movimiento" };
  const d = parsed.data;
  const workspaceId = await getActionWorkspace(userId, d.workspaceId ?? null);
  if (d.categoryId && !(await assertCategory(userId, d.categoryId, workspaceId))) {
    return { ok: false, error: "Categoría inválida" };
  }
  if (d.paymentMethodId && !(await assertPaymentMethod(userId, d.paymentMethodId, workspaceId))) {
    return { ok: false, error: "Medio de pago inválido" };
  }
  try {
    await prisma.transaction.create({
      data: {
        id: d.id, userId, workspaceId,
        type: d.type,
        amount: d.amount,
        currency: d.currency,
        date: parseFechaLocal(d.date),
        note: d.note ?? null,
        categoryId: d.categoryId ?? null,
        paymentMethodId: d.paymentMethodId ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: true };
    }
    return { ok: false, error: "No se pudo restaurar el movimiento" };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function importTransactions(rows: unknown[], requestedWorkspaceId?: string | null): Promise<ActionResult> {
  const userId = await requireUserId();
  const workspaceId = await getActionWorkspace(userId, requestedWorkspaceId);
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 1000) return { ok: false, error: "El CSV debe contener entre 1 y 1,000 movimientos" };
  for (const row of rows) {
    const r = row as Record<string, string>;
     const parsed = transactionSchema.safeParse({ type: r.type, amount: r.amount, currency: r.currency, date: r.date, note: r.note, categoryId: r.categoryId, paymentMethodId: r.paymentMethodId });
    if (!parsed.success) return { ok: false, error: `Fila inválida: ${firstError(parsed.error)}` };
    const d = parsed.data;
  if (d.categoryId && !(await assertCategory(userId, d.categoryId, workspaceId))) return { ok: false, error: "Categoría inválida" };
     if (d.paymentMethodId && !(await assertPaymentMethod(userId, d.paymentMethodId, workspaceId))) return { ok: false, error: "Medio de pago inválido" };
     await prisma.transaction.create({ data: { userId, workspaceId, type: d.type, amount: d.amount, currency: d.currency, date: parseFechaLocal(d.date), note: d.note ?? null, categoryId: d.categoryId ?? null, paymentMethodId: d.paymentMethodId ?? null } });
  }
  revalidatePath("/");
  return { ok: true };
}
