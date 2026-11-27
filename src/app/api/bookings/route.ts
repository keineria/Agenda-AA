import { NextResponse } from "next/server";
import { BookingError, createBooking, type UploadedFile } from "@/lib/bookings";
import { isLocale } from "@/lib/i18n";
import { notifyAdmins, notifyClient, eventDetails } from "@/lib/notify";
import { googleCalendarLink } from "@/lib/ics";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!rateLimit(`book:${clientIp(req)}`, 8, 10 * 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  // Campo trampa para bots: un humano nunca lo llena.
  if (String(form.get("website") ?? "").trim() !== "") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(String(form.get("payload") ?? "{}"));
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const files: UploadedFile[] = [];
  for (const [name, value] of form.entries()) {
    if (!name.startsWith("file:") || typeof value === "string") continue;
    if (value.size === 0) continue;
    files.push({
      fieldKey: name.slice(5),
      filename: value.name || "archivo",
      mime: value.type || "application/octet-stream",
      data: Buffer.from(await value.arrayBuffer()),
    });
  }
  if (files.length > 15) return NextResponse.json({ error: "too_many_files" }, { status: 400 });

  const locale = isLocale(String(payload.locale)) ? (payload.locale as "es" | "en") : "es";
  try {
    const booking = await createBooking({
      serviceId: String(payload.serviceId ?? ""),
      locale,
      mode: payload.mode === "presencial" ? "presencial" : "virtual",
      priorContact: payload.priorContact === true,
      date: String(payload.date ?? ""),
      time: String(payload.time ?? ""),
      values: (payload.values as Record<string, string | string[]>) ?? {},
      files,
      accepted: payload.accepted === true,
    });
    await Promise.allSettled([
      notifyClient(booking.id, booking.status === "pending" ? "received" : "confirmed", "cliente"),
      notifyAdmins(booking.id, "admin_new"),
    ]);
    const ev = eventDetails(booking, locale);
    return NextResponse.json({
      code: booking.code,
      token: booking.token,
      status: booking.status,
      start: booking.start_at,
      end: booking.end_at,
      mode: booking.mode,
      meetLink: booking.status === "confirmed" ? booking.meet_link : null,
      googleCalendarUrl: googleCalendarLink(ev),
      manageUrl: ev.manageUrl,
    });
  } catch (e) {
    if (e instanceof BookingError) {
      const status = e.code === "slot_taken" ? 409 : 400;
      return NextResponse.json({ error: e.code, message: e.message, fields: e.fields }, { status });
    }
    console.error("[bookings] error", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
