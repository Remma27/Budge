// Asegura la base "shadow" que Prisma necesita para `migrate diff --from-migrations`
// (y para `migrate dev`). Es una base distinta a la principal: NUNCA debe ser igual
// a DATABASE_URL, porque Prisma la resetea al replayar migraciones.
//
// Uso: node scripts/ensure-shadow-db.mjs   (encadena al inicio de `pnpm db:diff`)
// Usa el CLI de Prisma (mismo transporte que migrate diff) porque el endpoint
// HTTP de Neon bloquea consultas a pg_database y CREATE DATABASE.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const prismaCli = `${root}node_modules/prisma/build/index.js`;

const env = readFileSync(`${root}.env`, "utf8");
const line = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
const raw = line?.slice(line.indexOf("=") + 1).replace(/^['"]|['"]$/g, "").trim();
if (!raw) {
  console.error("DATABASE_URL no encontrado en .env");
  process.exit(1);
}

const mainUrl = new URL(raw);
const mainDb = decodeURIComponent(mainUrl.pathname.replace(/^\//, "")) || "postgres";
const shadowDb = process.env["SHADOW_DATABASE_NAME"] || `${mainDb}_shadow`;
if (shadowDb === mainDb) {
  console.error("La base shadow no puede ser igual a la principal");
  process.exit(1);
}
const safeName = shadowDb.replace(/[^A-Za-z0-9_]/g, "_");
const shadowUrl = new URL(raw);
shadowUrl.pathname = `/${safeName}`;

const run = (sql, url) => execFileSync(process.execPath, [prismaCli, "db", "execute", "--stdin"], {
  input: `${sql};\n`,
  cwd: root,
  env: { ...process.env, DATABASE_URL: url },
  stdio: ["pipe", "ignore", "pipe"],
  encoding: "utf8",
});

const exists = () => {
  try {
    run("SELECT 1", shadowUrl.toString());
    return true;
  } catch {
    return false;
  }
};

if (exists()) {
  console.log(`shadow ya existe: ${safeName}`);
  process.exit(0);
}

try {
  run(`CREATE DATABASE "${safeName}"`, raw);
  console.log(`shadow creada: ${safeName}`);
} catch (error) {
  // Carrera o "already exists": lo confirmamos volviendo a conectar.
  if (exists()) {
    console.log(`shadow ya existe: ${safeName}`);
    process.exit(0);
  }
  console.error(`No se pudo crear la base shadow "${safeName}":`);
  console.error(String(error?.stderr ?? error?.message ?? error));
  process.exit(1);
}
