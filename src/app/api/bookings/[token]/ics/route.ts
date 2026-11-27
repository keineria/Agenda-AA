import { getBookingByToken } from "@/lib/bookings";
import { buildIcs } from "@/lib/ics";
import { eventDetails } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const b = getBookingByToken(token);
  if (!b) return new Response("Not found", { status: 404 });
  const ev = eventDetails(b, b.locale);
  const ics = buildIcs({
    uid: b.code,
    title: ev.title,
    description: ev.description,
    location: ev.location,
    start: b.start_at,
    end: b.end_at,
    url: ev.manageUrl,
    method: b.status === "cancelled" ? "CANCEL" : "PUBLISH",
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="cita-${b.code}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
