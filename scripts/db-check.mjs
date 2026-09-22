// Solo lectura: verifica tablas y conteos. Uso: node scripts/db-check.mjs
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const url = env
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="))
  ?.split("=")
  .slice(1)
  .join("=")
  .replace(/^['"]|['"]$/g, "")
  .trim();
if (!url) {
  console.error("DATABASE_URL no encontrado en .env");
  process.exit(1);
}

const sql = neon(url);
console.log("Form schema:", await sql.query("SELECT table_name, column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('RecurringRule', 'SavingsGoal') ORDER BY table_name, ordinal_position", []));
console.log("Recurring frequencies:", await sql.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = enumtypid WHERE typname = 'RecurringFrequency'", []));
// Exercise the deployed budget query even when the table is empty.
await sql.query(`
  SELECT b."id", b."userId", b."workspaceId", b."categoryId", b."amount",
         b."mode" AS "budgetMode", b."percentage", b."currency", b."month",
         json_build_object('id', c."id", 'name', c."name", 'color', c."color") AS "category"
  FROM "Budget" b JOIN "Category" c ON c."id" = b."categoryId"
  WHERE b."userId" = $1 AND b."workspaceId" IS NULL
  ORDER BY b."month" DESC NULLS LAST, c."name" ASC
`, ["schema-check"]);
console.log("Budget query: OK");
console.log("Budget columns:", await sql.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Budget' ORDER BY ordinal_position", []));
console.log("Feature enums:", await sql.query("SELECT typname FROM pg_type WHERE typname IN ('SavingsFrequency', 'BudgetMode')", []));
console.log("Savings frequency:", await sql.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SavingsGoal' AND column_name = 'frequency'", []));
const tables = await sql.query(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1",
  [],
);
console.log(
  "tablas:",
  tables.map((r) => r.tablename).join(", "),
);
for (const t of ["User", "Category", "Transaction", "Budget", "RecurringRule"]) {
  const n = await sql.query(`SELECT count(*)::int AS n FROM "${t}"`, []);
  console.log(`${t}: ${n[0].n}`);
}
