-- Keep the physical budget column aligned with @map("mode") after the previous rename migration.
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Budget' AND column_name = 'budgetMode') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Budget' AND column_name = 'mode') THEN ALTER TABLE "Budget" RENAME COLUMN "budgetMode" TO "mode"; END IF; END $$;
ALTER TABLE "SavingsGoal" ALTER COLUMN "target" DROP NOT NULL;
ALTER TYPE "RecurringFrequency" ADD VALUE IF NOT EXISTS 'BIWEEKLY';
