import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function findBudgets(userId: string, workspaceId: string | null) {
  const workspace = workspaceId === null ? Prisma.sql`IS NULL` : Prisma.sql`= ${workspaceId}`;
  return prisma.$queryRaw<Array<{ id: string; userId: string; workspaceId: string | null; categoryId: string; amount: string; budgetMode: string; percentage: string | null; currency: string; month: string | null; category: { id: string; name: string; color: string } }>>`
    SELECT b."id", b."userId", b."workspaceId", b."categoryId", b."amount", b."mode" AS "budgetMode", b."percentage", b."currency", b."month",
           json_build_object('id', c."id", 'name', c."name", 'color', c."color") AS "category"
    FROM "Budget" b
    JOIN "Category" c ON c."id" = b."categoryId"
    WHERE b."userId" = ${userId} AND b."workspaceId" ${workspace}
    ORDER BY b."month" DESC NULLS LAST, c."name" ASC
  `;
}
