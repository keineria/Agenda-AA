import { bp } from "@/lib/paths";
import { notFound } from "next/navigation";
import { getSession, hasRole } from "@/lib/auth";
import { getBooking, getBookingEvents, getBookingFiles, getSecrets, parseAnswers } from "@/lib/bookings";
import { getService, isVisible, optionLabel } from "@/lib/catalog";
import { countryName } from "@/lib/countries";
import { mask } from "@/lib/crypto";
import { googleStatus } from "@/lib/google";
import { fmt } from "@/lib/time";
import { agentsLite, toCard } from "@/lib/view";
import { BookingDetail, type AnswerGroup } from "@/components/admin/BookingDetail";

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = getBooking(Number(id));
  if (!b) notFound();
  const session = (await getSession())!;
  const service = getService(b.service_id);
  const answers = parseAnswers(b);
  const secrets = getSecrets(b);
  const files = getBookingFiles(b.id);
  const values: Record<string, unknown> = { ...answers, ...secrets };

  const groups: AnswerGroup[] = (service?.groups ?? []).map((g) => ({
    title: g.title.es,
    items: g.sections.flatMap((sec) =>
      sec.fields
        .filter((f) => isVisible(f, values))
        .map((f) => {
          if (f.type === "file") {
            const list = files.filter((x) => x.field_key === f.key);
            return { key: f.key, label: f.label.es, value: list.length ? `${list.length} archivo(s)` : "—", sensitive: false, type: f.type };
          }
          if (f.sensitive) {
            const v = secrets[f.key];
            return { key: f.key, label: f.label.es, value: v ? mask(v) : "—", sensitive: !!v, type: f.type };
          }
          const v = answers[f.key];
          let shown = "—";
          if (Array.isArray(v)) shown = v.map((x) => optionLabel(f, x, "es")).join(", ");
          else if (v != null && v !== "") shown = f.type === "country" ? countryName(String(v), "es") : f.type === "yesno" ? optionLabel(f, String(v), "es") : optionLabel(f, String(v), "es");
          return { key: f.key, label: f.label.es, value: shown, sensitive: false, type: f.type, raw: Array.isArray(v) ? undefined : (v as string | undefined) };
        }),
    ),
  }));

  return (
    <BookingDetail
      canEdit={hasRole(session, "admin")}
      booking={toCard(b)}
      extra={{
        locale: b.locale,
        token: b.token,
        driveUrl: b.drive_folder_url,
        calendarEventId: b.calendar_event_id,
        createdAt: fmt(b.created_at, "yyyy-MM-dd HH:mm"),
        firstName: b.first_name,
        lastName: b.last_name,
        remindersSent: { day: b.reminder_day_sent_at, hour: b.reminder_hour_sent_at },
        durationMin: service?.durationMin ?? 30,
      }}
      groups={groups}
      files={files.map((f) => ({ id: f.id, name: f.filename, field: f.field_key, url: f.drive_url ?? bp(`/api/admin/files/${f.id}`), inDrive: !!f.drive_file_id }))}
      events={getBookingEvents(b.id).map((e) => ({ id: e.id, type: e.type, detail: e.detail, actor: e.actor, at: fmt(e.created_at, "yyyy-MM-dd HH:mm") }))}
      agents={agentsLite()}
      googleConnected={googleStatus().connected}
    />
  );
}
