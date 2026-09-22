"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { getActionWorkspace, scopeWorkspace } from "@/lib/workspace";
import type { ActionResult } from "@/lib/validations";

const TYPES = ["DEBIT", "CASH", "CREDIT_CARD"] as const;
type MethodType = (typeof TYPES)[number];

const parseMethodForm = (f: FormData) => {
  const name = String(f.get("name") || "").trim();
  const type = String(f.get("type")) as MethodType;
  if (!name || !TYPES.includes(type)) return { ok: false as const, error: "Medio de pago inválido" };
  const num = (key: string) => { const raw = String(f.get(key) || "").trim(); return raw === "" ? null : Number(raw); };
  const creditLimit = num("creditLimit");
  const openingBalance = num("openingBalance");
  const closingDay = num("closingDay");
  const paymentDay = num("paymentDay");
  const validAmount = (v: number | null) => v === null || (Number.isFinite(v) && Math.abs(v) <= 9999999999.99);
  const validDay = (v: number | null) => v === null || (Number.isInteger(v) && v >= 1 && v <= 31);
  if ((creditLimit !== null && (creditLimit < 0 || !validAmount(creditLimit))) || !validAmount(openingBalance) || ![closingDay, paymentDay].every(validDay)) {
    return { ok: false as const, error: "Datos de tarjeta inválidos" };
  }
  return { ok: true as const, data: { name, type, creditLimit, openingBalance, closingDay, paymentDay } };
};

export async function createPaymentMethod(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const workspaceId = await getActionWorkspace(userId, String(f.get("workspaceId") || ""));
  const parsed = parseMethodForm(f);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  await prisma.paymentMethod.create({ data: { userId, workspaceId, ...parsed.data } });
  revalidatePath("/medios-pago");
  return { ok: true };
}

export async function updatePaymentMethod(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const workspaceId = await getActionWorkspace(userId, String(f.get("workspaceId") || ""));
  const parsed = parseMethodForm(f);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const id = String(f.get("id") || "");
  if (!id) return { ok: false, error: "Medio de pago inválido" };
  const result = await prisma.paymentMethod.updateMany({ where: { id, ...scopeWorkspace(userId, workspaceId) }, data: parsed.data });
  if (result.count === 0) return { ok: false, error: "Medio de pago inválido" };
  revalidatePath("/medios-pago");
  return { ok: true };
}

export async function deletePaymentMethod(id: string) {
  const userId = await requireUserId();
  await prisma.paymentMethod.deleteMany({ where: { id, userId } });
  revalidatePath("/medios-pago");
}
