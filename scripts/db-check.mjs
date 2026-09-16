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
