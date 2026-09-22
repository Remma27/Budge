-- Revocación de sesiones y rate limiting persistente (serverless-safe).
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

CREATE TABLE "RateLimit" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 1,
  "resetAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");
