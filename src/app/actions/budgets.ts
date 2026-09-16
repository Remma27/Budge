"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma"; import { requireUserId } from "@/lib/get-user";
import { budgetSchema, emptyToUndefined, firstError, type ActionResult } from "@/lib/validations";
export async function createBudget(_p: ActionResult, f: FormData): Promise<ActionResult> { const userId=await requireUserId(); const p=budgetSchema.safeParse({categoryId:f.get("categoryId"),amount:f.get("amount"),currency:emptyToUndefined(f.get("currency"))??"MXN",month:f.get("month")}); if(!p.success)return{ok:false,error:firstError(p.error)}; if(!(await prisma.category.findFirst({where:{id:p.data.categoryId,userId}})))return{ok:false,error:"Categoría inválida"}; try{await prisma.budget.create({data:{userId,...p.data}})}catch{return{ok:false,error:"Ya existe ese presupuesto"}} revalidatePath("/presupuestos"); revalidatePath("/"); return{ok:true}; }
export async function deleteBudget(id:string){const userId=await requireUserId();await prisma.budget.deleteMany({where:{id,userId}});revalidatePath("/presupuestos");revalidatePath("/");}
