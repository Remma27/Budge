"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import {
  categorySchema,
  emptyToUndefined,
  firstError,
  type ActionResult,
} from "@/lib/validations";

function revalidate() {
  revalidatePath("/categorias");
  revalidatePath("/");
}

export async function createCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    color: emptyToUndefined(formData.get("color")) ?? "#6366f1",
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    await prisma.category.create({
      data: { userId, name: parsed.data.name, color: parsed.data.color },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, error: "Ya tienes una categoría con ese nombre" };
    }
    return { ok: false, error: "No se pudo crear la categoría" };
  }
  revalidate();
  return { ok: true };
}

export async function renameCategory(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    color: emptyToUndefined(formData.get("color")) ?? "#6366f1",
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const existing = await prisma.category.findFirst({
    where: { id, userId },
  });
  if (!existing) return { ok: false, error: "Categoría no encontrada" };
  try {
    await prisma.category.update({
      where: { id },
      data: { name: parsed.data.name, color: parsed.data.color },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, error: "Ya tienes una categoría con ese nombre" };
    }
    return { ok: false, error: "No se pudo guardar la categoría" };
  }
  revalidate();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<void> {
  const userId = await requireUserId();
  const existing = await prisma.category.findFirst({
    where: { id, userId },
  });
  // Los movimientos quedan con "Sin categoría" (onDelete: SetNull).
  if (!existing) return;
  await prisma.category.delete({ where: { id } });
  revalidate();
}
