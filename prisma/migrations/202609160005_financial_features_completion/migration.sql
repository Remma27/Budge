ALTER TABLE "RecurringRule" ADD COLUMN IF NOT EXISTS "kind" "RecurringKind" NOT NULL DEFAULT 'SERVICE';
ALTER TABLE "RecurringRule" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "RecurringRule" ADD COLUMN IF NOT EXISTS "chargeDay" INTEGER;
ALTER TABLE "RecurringRule" ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT;
CREATE INDEX IF NOT EXISTS "SavingsGoal_userId_workspaceId_idx" ON "SavingsGoal"("userId","workspaceId");
CREATE INDEX IF NOT EXISTS "SavingsContribution_goalId_date_idx" ON "SavingsContribution"("goalId","date");
CREATE INDEX IF NOT EXISTS "PaymentMethod_userId_workspaceId_idx" ON "PaymentMethod"("userId","workspaceId");
CREATE INDEX IF NOT EXISTS "Transaction_paymentMethodId_idx" ON "Transaction"("paymentMethodId");
-- Las constraints de abajo ya vienen de 202609160004_financial_features; este
-- guardia las hace idempotentes porque ADD CONSTRAINT no acepta IF NOT EXISTS
-- (necesario para poder replayar las migraciones en la base shadow).
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavingsGoal_userId_fkey') THEN ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavingsGoal_workspaceId_fkey') THEN ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavingsContribution_goalId_fkey') THEN ALTER TABLE "SavingsContribution" ADD CONSTRAINT "SavingsContribution_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "SavingsGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentMethod_userId_fkey') THEN ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentMethod_workspaceId_fkey') THEN ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_paymentMethodId_fkey') THEN ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecurringRule_paymentMethodId_fkey') THEN ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
