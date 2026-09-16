import { prisma } from "@/lib/prisma";

function advance(date: Date, frequency: string) {
  const next = new Date(date);
  if (frequency === "WEEKLY") next.setDate(next.getDate() + 7);
  else if (frequency === "MONTHLY") next.setMonth(next.getMonth() + 1);
  else next.setFullYear(next.getFullYear() + 1);
  return next;
}

export async function generateDueRecurring(userId?: string, workspaceId?: string | null) {
  const now = new Date();
  const rules = await prisma.recurringRule.findMany({ where: { ...(userId ? { userId } : {}), ...(workspaceId === undefined ? {} : { workspaceId }), isActive: true, nextRun: { lte: now } } });
  let generated = 0;
  for (const rule of rules) {
    let next = rule.nextRun;
    while (next <= now) {
      const run = await prisma.recurringRun.createMany({ data: [{ ruleId: rule.id, scheduledDate: next }], skipDuplicates: true });
      if (run.count > 0) {
        await prisma.transaction.create({ data: { userId: rule.userId, workspaceId: rule.workspaceId, type: rule.type, amount: rule.amount, currency: rule.currency, date: next, note: rule.note, categoryId: rule.categoryId } });
        generated++;
      }
      next = advance(next, rule.frequency);
    }
    await prisma.recurringRule.update({ where: { id: rule.id }, data: { nextRun: next } });
  }
  return generated;
}
