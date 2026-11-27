import { NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth";
import { getSlots } from "@/lib/availability";
import { getBooking } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** Horarios libres para reprogramar desde el panel (ignora la anticipación mínima y la propia cita). */
export async function GET(req: Request) {
  const s = await getSession();
  if (!hasRole(s, "admin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const b = getBooking(Number(url.searchParams.get("booking")));
  const date = url.searchParams.get("date") ?? "";
  if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "params" }, { status: 400 });
  const slots = getSlots({ serviceId: b.service_id, date, excludeBookingId: b.id, ignoreNotice: true });
  return NextResponse.json({ slots: slots.map((x) => x.time) });
}
