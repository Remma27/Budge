import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Rate limiting persistente en Postgres: funciona con N instancias serverless
// (un Map en memoria se vacía en cada cold start y no comparte estado).
export async function allowAttempt(
  key: string,
  limit = 8,
  windowMs = 15 * 60_000,
): Promise<boolean> {
  const now = new Date();
  try {
    const rec = await prisma.rateLimit.findUnique({ where: { key } });
    if (!rec || rec.resetAt <= now) {
      const resetAt = new Date(Date.now() + windowMs);
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      return true;
    }
    if (rec.count >= limit) return false;
    await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return true;
  } catch {
    // Fail-open: si la BD cae, el login falla de todos modos en la consulta del usuario.
    return true;
  }
}

// IP del cliente para componer claves `acción:ip:email`. En server actions no
// hay `req`, así que se lee de los headers del request actual.
export async function clientIp(req?: unknown): Promise<string> {
  try {
    const h =
      req && typeof req === "object" && "headers" in req
        ? (req as { headers: unknown }).headers
        : await headers();
    const get = (name: string): string => {
      const getter = (h as { get?: (n: string) => string | null }).get;
      if (typeof getter === "function") return getter.call(h, name) ?? "";
      const v = (h as Record<string, unknown> | undefined)?.[name.toLowerCase()];
      return Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
    };
    const forwarded = get("x-forwarded-for").split(",")[0]?.trim() ?? "";
    return forwarded || get("x-real-ip").trim() || "unknown";
  } catch {
    return "unknown";
  }
}
