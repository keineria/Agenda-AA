import { NextResponse } from "next/server";
import { BookingError, canClientChange, getBookingByToken, reschedule, setStatus, syncGoogle } from "@/lib/bookings";
import { getSlots } from "@/lib/availability";
import { notifyAdmins, notifyClient } from "@/lib/notify";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Acciones del cliente desde el enlace de su correo: cancelar o cambiar fecha/hora. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!rateLimit(`manage:${clientIp(req)}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const { token } = await ctx.params;
  const b = getBookingByToken(token);
  if (!b) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!canClientChange(b)) return NextResponse.json({ error: "too_late" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; date?: string; time?: string };

  try {
    if (body.action === "cancel") {
      setStatus(b.id, "cancelled", "cliente");
      await syncGoogle(b.id);
      await Promise.allSettled([notifyClient(b.id, "cancelled", "cliente"), notifyAdmins(b.id, "admin_cancelled")]);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "reschedule" && body.date && body.time) {
      // El cliente debe respetar la anticipación mínima: se valida con el horario público.
      const ok = getSlots({ serviceId: b.service_id, date: body.date, excludeBookingId: b.id }).some((s) => s.time === body.time);
      if (!ok) return NextResponse.json({ error: "slot_taken" }, { status: 409 });
      const { before } = reschedule(b.id, { date: body.date, time: body.time, actor: "cliente" });
      await syncGoogle(b.id);
      await Promise.allSettled([
        notifyClient(b.id, "rescheduled", "cliente"),
        notifyAdmins(b.id, "admin_rescheduled", `Antes: ${new Date(before.start_at).toLocaleString("es-US", { timeZone: "America/New_York" })}`),
      ]);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.code }, { status: e.code === "slot_taken" ? 409 : 400 });
    console.error(e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
