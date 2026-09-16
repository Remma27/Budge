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
import { getActionWorkspace, scopeWorkspace } from "@/lib/workspace";

function revalidate() {
  revalidatePath("/categorias");
  revalidatePath("/");
}

export async function createCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const workspaceId = await getActionWorkspace(userId, String(formData.get("workspaceId") || ""));
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    color: emptyToUndefined(formData.get("color")) ?? "#6366f1",
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    await prisma.category.create({
      data: { userId, workspaceId, name: parsed.data.name, color: parsed.data.color },
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
  const workspaceId = await getActionWorkspace(userId, String(formData.get("workspaceId") || ""));
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    color: emptyToUndefined(formData.get("color")) ?? "#6366f1",
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const existing = await prisma.category.findFirst({
    where: { id, ...scopeWorkspace(userId, workspaceId) },
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

export async function deleteCategory(id: string, requestedWorkspaceId?: string): Promise<void> {
  const userId = await requireUserId();
  const workspaceId = await getActionWorkspace(userId, requestedWorkspaceId);
  const existing = await prisma.category.findFirst({
    where: { id, ...scopeWorkspace(userId, workspaceId) },
  });
  // Los movimientos quedan con "Sin categoría" (onDelete: SetNull).
  if (!existing) return;
  await prisma.category.delete({ where: { id } });
  revalidate();
}
