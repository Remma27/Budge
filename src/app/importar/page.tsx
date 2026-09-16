import Link from "next/link";
import { CsvImport } from "@/components/csv-import";
import { requireUserId } from "@/lib/get-user";
import { getWorkspaceContext } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
export default async function ImportarPage({ searchParams }: { searchParams: Promise<{ workspaceId?: string }> }) { const userId=await requireUserId(); const {workspaceId}=await getWorkspaceContext(userId,(await searchParams).workspaceId); const paymentMethods=await prisma.paymentMethod.findMany({where:{userId,workspaceId},orderBy:{name:"asc"},select:{id:true,name:true}}); return <div className="grid gap-4"><Link href="/" className="text-sm underline">← Volver al dashboard</Link><h1 className="text-xl font-bold">Importar datos</h1><CsvImport workspaceId={workspaceId} paymentMethods={paymentMethods} /></div>; }
