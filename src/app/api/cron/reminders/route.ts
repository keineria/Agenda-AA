import { NextResponse } from "next/server";
import { runReminders } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** Llamar cada 5 minutos: curl -s "https://.../api/cron/reminders?key=$CRON_SECRET" */
async function handle(req: Request) {
  const key = new URL(req.url).searchParams.get("key") || req.headers.get("x-cron-key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await runReminders();
  return NextResponse.json({ ok: true, ...res });
}

export const GET = handle;
export const POST = handle;
