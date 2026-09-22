import { generateDueRecurring } from "@/lib/recurring";
import { prisma } from "@/lib/prisma";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "No autorizado" }, { status: 401 });
  try {
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
    return Response.json({ ok: true, generated: await generateDueRecurring() });
  }
  catch (error) { console.error("recurring cron failed", { message: error instanceof Error ? error.message : "unknown" }); return Response.json({ error: "Error interno" }, { status: 500 }); }
}
