import { prisma } from "@/lib/prisma";
import { advanceRecurring } from "@/lib/recurring-schedule";

export async function generateDueRecurring(userId?: string, workspaceId?: string | null) {
  const now = new Date();
  const rules = await prisma.recurringRule.findMany({ where: { ...(userId ? { userId } : {}), ...(workspaceId === undefined ? {} : { workspaceId }), isActive: true, nextRun: { lte: now } } });
  let generated = 0;
  for (const rule of rules) {
    let next = rule.nextRun;
    while (next <= now) {
      const run = await prisma.recurringRun.createMany({ data: [{ ruleId: rule.id, scheduledDate: next }], skipDuplicates: true });
      if (run.count > 0) {
        await prisma.transaction.create({ data: { userId: rule.userId, workspaceId: rule.workspaceId, type: rule.type, amount: rule.amount, currency: rule.currency, date: next, note: rule.note, categoryId: rule.categoryId, paymentMethodId: rule.paymentMethodId } });
        generated++;
      }
      next = advanceRecurring(next, rule.frequency, rule.chargeDay);
    }
    await prisma.recurringRule.update({ where: { id: rule.id }, data: { nextRun: next } });
  }
  return generated;
}
