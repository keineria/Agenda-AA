import { NextResponse } from "next/server";
import { getAvailableDays, getSlots } from "@/lib/availability";
import { getService } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("service") ?? "";
  if (!getService(serviceId)) return NextResponse.json({ error: "service" }, { status: 400 });
  const month = url.searchParams.get("month");
  const date = url.searchParams.get("date");
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ days: getAvailableDays({ serviceId, month }) });
  }
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ slots: getSlots({ serviceId, date }).map((s) => ({ time: s.time, start: s.start })) });
  }
  return NextResponse.json({ error: "params" }, { status: 400 });
}
