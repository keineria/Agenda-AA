import { notFound } from "next/navigation";
import { getService } from "@/lib/catalog";
import { isLocale } from "@/lib/i18n";
import { canClientChange, getBookingByToken, STATUS_LABEL } from "@/lib/bookings";
import { getSettings } from "@/lib/db";
import { addDays, localDate } from "@/lib/time";
import { eventDetails } from "@/lib/notify";
import { googleCalendarLink } from "@/lib/ics";
import { ManageBooking } from "@/components/booking/ManageBooking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi cita", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  const b = getBookingByToken(token);
  const settings = getSettings();
  const today = localDate(new Date(), settings.timezone);
  if (!b) {
    return <ManageBooking locale={locale} booking={null} todayMonth={today.slice(0, 7)} maxMonth={today.slice(0, 7)} cancelLimitHours={settings.cancelLimitHours} />;
  }
  const s = getService(b.service_id)!;
  const ev = eventDetails(b, locale);
  return (
    <ManageBooking
      locale={locale}
      todayMonth={today.slice(0, 7)}
      maxMonth={addDays(today, settings.maxDaysAhead).slice(0, 7)}
      cancelLimitHours={settings.cancelLimitHours}
      booking={{
        token: b.token,
        code: b.code,
        serviceId: b.service_id,
        serviceName: s.name[locale],
        durationMin: s.durationMin,
        start: b.start_at,
        mode: b.mode,
        status: b.status,
        statusLabel: STATUS_LABEL[b.status][locale],
        statusColor: STATUS_LABEL[b.status].color,
        meetLink: b.status === "confirmed" ? b.meet_link : null,
        canChange: canClientChange(b),
        googleCalendarUrl: googleCalendarLink(ev),
        firstName: b.first_name,
      }}
    />
  );
}
