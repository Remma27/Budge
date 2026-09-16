"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { currencySchema, exchangeRateSchema, firstError, type ActionResult } from "@/lib/validations";

export async function updatePrimaryCurrency(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const value = currencySchema.safeParse(formData.get("primaryCurrency"));
  if (!value.success) return { ok: false, error: "Moneda principal inválida" };
  await prisma.user.update({ where: { id: userId }, data: { primaryCurrency: value.data } });
  revalidatePath("/"); revalidatePath("/moneda");
  return { ok: true };
}

function parseRate(formData: FormData) {
  return exchangeRateSchema.safeParse({ from: formData.get("from"), to: formData.get("to"), rate: formData.get("rate") });
}
export async function upsertExchangeRate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId(); const parsed = parseRate(formData);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { from, to, rate } = parsed.data;
  await prisma.exchangeRate.upsert({ where: { userId_from_to: { userId, from, to } }, update: { rate }, create: { userId, from, to, rate } });
  revalidatePath("/"); revalidatePath("/moneda"); return { ok: true };
}
export async function deleteExchangeRate(id: string) {
  const userId = await requireUserId(); await prisma.exchangeRate.deleteMany({ where: { id, userId } });
  revalidatePath("/"); revalidatePath("/moneda");
}
