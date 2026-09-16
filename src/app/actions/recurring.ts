"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { parseFechaLocal } from "@/lib/format";
import { recurringSchema, emptyToUndefined, firstError, type ActionResult } from "@/lib/validations";
import { generateDueRecurring as generate } from "@/lib/recurring";

export async function createRecurring(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const p = recurringSchema.safeParse({ type: f.get("type"), amount: f.get("amount"), currency: emptyToUndefined(f.get("currency")) ?? "MXN", frequency: f.get("frequency"), nextRun: f.get("nextRun"), note: emptyToUndefined(f.get("note")), categoryId: emptyToUndefined(f.get("categoryId")) });
  if (!p.success) return { ok: false, error: firstError(p.error) };
  if (p.data.categoryId && !(await prisma.category.findFirst({ where: { id: p.data.categoryId, userId } }))) return { ok: false, error: "Categoría inválida" };
  await prisma.recurringRule.create({ data: { userId, ...p.data, nextRun: parseFechaLocal(p.data.nextRun), note: p.data.note ?? null, categoryId: p.data.categoryId ?? null } });
  revalidatePath("/recurrentes");
  return { ok: true };
}

export async function deleteRecurring(id: string) { const userId = await requireUserId(); await prisma.recurringRule.deleteMany({ where: { id, userId } }); revalidatePath("/recurrentes"); }
export async function generateDueRecurring() { const userId = await requireUserId(); await generate(userId); revalidatePath("/"); revalidatePath("/recurrentes"); }
