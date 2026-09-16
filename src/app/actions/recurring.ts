"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { parseFechaLocal } from "@/lib/format";
 import { recurringSchema, emptyToUndefined, firstError, recurringChargeDaySchema, type ActionResult } from "@/lib/validations";
import { generateDueRecurring as generate } from "@/lib/recurring";
import { getActionWorkspace, scopeWorkspace } from "@/lib/workspace";

export async function createRecurring(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const workspaceId = await getActionWorkspace(userId, String(f.get("workspaceId") || ""));
  const p = recurringSchema.safeParse({ type: f.get("type"), amount: f.get("amount"), currency: emptyToUndefined(f.get("currency")) ?? "CRC", frequency: f.get("frequency"), nextRun: f.get("nextRun"), note: emptyToUndefined(f.get("note")), categoryId: emptyToUndefined(f.get("categoryId")) });
   if (!p.success) return { ok: false, error: firstError(p.error) };
   const chargeDay = f.get("chargeDay") ? Number(f.get("chargeDay")) : null;
   if (chargeDay !== null && !recurringChargeDaySchema.safeParse(chargeDay).success) return { ok: false, error: "Día de cobro inválido" };
  if (p.data.categoryId && !(await prisma.category.findFirst({ where: { id: p.data.categoryId, ...scopeWorkspace(userId, workspaceId) } }))) return { ok: false, error: "Categoría inválida" };
   await prisma.recurringRule.create({ data: { userId, workspaceId, ...p.data, kind: f.get("kind") === "MEMBERSHIP" ? "MEMBERSHIP" : "SERVICE", provider: emptyToUndefined(f.get("provider")) ?? null, chargeDay, nextRun: parseFechaLocal(p.data.nextRun), note: p.data.note ?? null, categoryId: p.data.categoryId ?? null } });
  revalidatePath("/recurrentes");
  return { ok: true };
}

export async function updateRecurring(id: string, _p: ActionResult, f: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const workspaceId = await getActionWorkspace(userId, String(f.get("workspaceId") || ""));
  const p = recurringSchema.safeParse({ type: f.get("type"), amount: f.get("amount"), currency: emptyToUndefined(f.get("currency")) ?? "CRC", frequency: f.get("frequency"), nextRun: f.get("nextRun"), note: emptyToUndefined(f.get("note")), categoryId: emptyToUndefined(f.get("categoryId")) });
   if (!p.success) return { ok: false, error: firstError(p.error) };
   const chargeDay = f.get("chargeDay") ? Number(f.get("chargeDay")) : null;
   if (chargeDay !== null && !recurringChargeDaySchema.safeParse(chargeDay).success) return { ok: false, error: "Día de cobro inválido" };
  if (p.data.categoryId && !(await prisma.category.findFirst({ where: { id: p.data.categoryId, ...scopeWorkspace(userId, workspaceId) } }))) return { ok: false, error: "Categoría inválida" };
   await prisma.recurringRule.updateMany({ where: { id, ...scopeWorkspace(userId, workspaceId) }, data: { ...p.data, kind: f.get("kind") === "MEMBERSHIP" ? "MEMBERSHIP" : "SERVICE", provider: emptyToUndefined(f.get("provider")) ?? null, chargeDay, nextRun: parseFechaLocal(p.data.nextRun), note: p.data.note ?? null, categoryId: p.data.categoryId ?? null } });
  revalidatePath("/recurrentes"); return { ok: true };
}

export async function toggleRecurring(id: string, workspaceId?: string) { const userId = await requireUserId(); const scope=scopeWorkspace(userId, await getActionWorkspace(userId,workspaceId)); const r = await prisma.recurringRule.findFirst({ where: { id, ...scope } }); if (r) await prisma.recurringRule.update({ where: { id }, data: { isActive: !r.isActive } }); revalidatePath("/recurrentes"); }

export async function deleteRecurring(id: string, workspaceId?: string) { const userId = await requireUserId(); await prisma.recurringRule.deleteMany({ where: { id, ...scopeWorkspace(userId, await getActionWorkspace(userId,workspaceId)) } }); revalidatePath("/recurrentes"); }
export async function generateDueRecurring(f?: FormData) { const userId = await requireUserId(); await getActionWorkspace(userId, String(f?.get("workspaceId") || "")); await generate(userId, String(f?.get("workspaceId") || "") || null); revalidatePath("/"); revalidatePath("/recurrentes"); }
