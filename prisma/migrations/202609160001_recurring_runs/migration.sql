CREATE TABLE "RecurringRun" ("id" TEXT NOT NULL, "ruleId" TEXT NOT NULL, "scheduledDate" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RecurringRun_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "RecurringRun_ruleId_scheduledDate_key" ON "RecurringRun"("ruleId", "scheduledDate");
CREATE INDEX "RecurringRun_ruleId_scheduledDate_idx" ON "RecurringRun"("ruleId", "scheduledDate");
ALTER TABLE "RecurringRun" ADD CONSTRAINT "RecurringRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RecurringRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
