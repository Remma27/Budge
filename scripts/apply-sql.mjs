// Aplica una migración SQL contra Neon por HTTPS (puerto 443).
// Escape hatch para redes donde el puerto 5432 no sale (ver src/lib/prisma.ts).
// Uso: node scripts/apply-sql.mjs 0_init
// Nota: NO registra nada en _prisma_migrations. Cuando `prisma migrate` tenga
// red (puerto 5432), marca la línea base con:
//   prisma migrate resolve --applied "<nombre>"
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const name = process.argv[2];
if (!name) {
  console.error("Uso: node scripts/apply-sql.mjs <nombre-migracion>");
  process.exit(1);
}

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

const sqlText = readFileSync(
  new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url),
  "utf8",
);
// El SQL de Prisma no tiene punto y coma dentro de sentencias (solo DDL simple),
// así que partir por ";\n" es seguro aquí.
const statements = sqlText
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, "").trim() !== "")
  .map((s) => (s.endsWith(";") ? s : `${s};`));

const sql = neon(url);
for (const [i, stmt] of statements.entries()) {
  const firstLine = stmt.split("\n").find((l) => !l.startsWith("--")) ?? stmt;
  await sql.query(stmt, []);
  console.log(`[${i + 1}/${statements.length}] ok: ${firstLine.slice(0, 80)}`);
}

const tables = await sql.query(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1",
  [],
);
const rows = Array.isArray(tables) ? tables : tables.rows;
console.log(
  "Tablas en public:",
  rows.map((r) => r.tablename).join(", "),
);
