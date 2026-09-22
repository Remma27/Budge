"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { getActionWorkspace } from "@/lib/workspace";
import { parseFechaLocal } from "@/lib/format";
import { savingsSchema, emptyToUndefined, firstError, type ActionResult } from "@/lib/validations";

export async function createSavings(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const workspaceId = await getActionWorkspace(userId, String(f.get("workspaceId") || ""));
  const parsed = savingsSchema.safeParse({
    name: f.get("name"), target: emptyToUndefined(f.get("target")),
    initialAmount: emptyToUndefined(f.get("initialAmount")) ?? "0",
    currency: emptyToUndefined(f.get("currency")) ?? "CRC",
    frequency: emptyToUndefined(f.get("frequency")), targetDate: emptyToUndefined(f.get("targetDate")),
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    await prisma.savingsGoal.create({ data: {
      userId, workspaceId, name: d.name, target: d.target ?? null, balance: d.initialAmount,
      currency: d.currency, frequency: d.frequency ?? null,
      targetDate: d.targetDate ? parseFechaLocal(d.targetDate) : null,
    } });
  } catch (error) {
    console.error("createSavings failed", error);
    return { ok: false, error: "No se pudo crear el ahorro. Tus datos no se guardaron; intenta de nuevo." };
  }
  revalidatePath("/ahorros"); revalidatePath("/");
  return { ok: true };
}
export async function addContribution(id:string,_p:ActionResult,f:FormData):Promise<ActionResult>{const userId=await requireUserId();const workspaceId=await getActionWorkspace(userId,String(f.get("workspaceId")||""));const amount=Number(f.get("amount"));const goal=await prisma.savingsGoal.findFirst({where:{id,userId,workspaceId}});if(!goal||!Number.isFinite(amount)||amount<=0)return{ok:false,error:"Aporte inválido"};await prisma.$transaction([prisma.savingsContribution.create({data:{goalId:id,amount,note:String(f.get("note")||"")||null}}),prisma.savingsGoal.update({where:{id},data:{balance:{increment:amount}}})]);revalidatePath("/ahorros");revalidatePath("/");return{ok:true};}
export async function deleteSavings(id:string){const userId=await requireUserId();await prisma.savingsGoal.deleteMany({where:{id,userId}});revalidatePath("/ahorros");}
