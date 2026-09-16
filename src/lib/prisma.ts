import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// ponytail: Neon serverless via HTTPS (443). El puerto 5432 no sale de esta red
// (timeout incluso con IPv4 forzada), así que nada usa TCP directo: ni migrate,
// ni el cliente. Las migraciones se generan offline (migrate diff --script) y se
// aplican con scripts/apply-sql.mjs, que usa este mismo transporte.
const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});

// ponytail: singleton global para no agotar conexiones con el hot-reload de Next.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
