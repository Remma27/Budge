import { generateDueRecurring } from "@/lib/recurring";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "No autorizado" }, { status: 401 });
  return Response.json({ ok: true, generated: await generateDueRecurring() });
}
