import { getDb, getSettings } from "./db";
import { getService, type Locale } from "./catalog";
import { getAgent } from "./availability";
import { appUrl } from "./google";
import { buildIcs, googleCalendarLink } from "./ics";
import { escapeHtml, renderEmail, renderText, sendMail, type EmailBlock } from "./mail";
import { clock, longDate, tzLabel } from "./time";
import { getBooking, logEvent, STATUS_LABEL, type BookingRow } from "./bookings";

export type ClientNotice = "received" | "confirmed" | "rescheduled" | "cancelled" | "reminder_day" | "reminder_hour";
export type AdminNotice = "admin_new" | "admin_rescheduled" | "admin_cancelled";

export const NOTICE_LABEL: Record<ClientNotice, string> = {
  received: "Solicitud recibida",
  confirmed: "Confirmación",
  rescheduled: "Cambio de fecha",
  cancelled: "Cancelación",
  reminder_day: "Recordatorio 1 día antes",
  reminder_hour: "Recordatorio 1 hora antes",
};

const C = {
  es: {
    hello: (n: string) => `Hola ${n},`,
    service: "Servicio",
    date: "Fecha",
    time: "Hora",
    mode: "Modalidad",
    virtual: "Virtual (Google Meet)",
    presencial: "Presencial en oficina",
    where: "Lugar",
    agent: "Gestor",
    code: "Código",
    meet: "Enlace de la reunión",
    meetLater: "Te enviaremos el enlace de Google Meet cuando el gestor confirme la cita.",
    join: "Unirme a Google Meet",
    addGoogle: "Agregar a Google Calendar",
    manage: "Ver o cambiar mi cita",
    footer:
      "AA Solutions Services LLC · 246 W Linden Ave, Linden, NJ 07036<br>(201) 608-0673 · (908) 636-3943 · English (201) 654-1106<br>infoaasolutionservices@gmail.com",
    received: {
      subject: (s: string) => `Recibimos tu solicitud de cita · ${s}`,
      heading: "Recibimos tu solicitud",
      intro: (n: string) =>
        `${n} Tu cita quedó <b>pendiente de aprobación</b>. Uno de nuestros gestores la revisará y te enviaremos la confirmación por este medio.`,
    },
    confirmed: {
      subject: (s: string) => `Tu cita está confirmada · ${s}`,
      heading: "¡Tu cita está confirmada!",
      intro: (n: string) => `${n} Estos son los detalles de tu cita. Te enviaremos un recordatorio un día antes y una hora antes.`,
    },
    rescheduled: {
      subject: (s: string) => `Tu cita cambió de fecha · ${s}`,
      heading: "Actualizamos tu cita",
      intro: (n: string) => `${n} Tu cita tiene una nueva fecha u hora. Estos son los detalles actualizados.`,
    },
    cancelled: {
      subject: (s: string) => `Tu cita fue cancelada · ${s}`,
      heading: "Tu cita fue cancelada",
      intro: (n: string) => `${n} Tu cita fue cancelada. Si quieres, puedes agendar una nueva cuando gustes.`,
    },
    reminder_day: {
      subject: (s: string) => `Recordatorio: tu cita es mañana · ${s}`,
      heading: "Tu cita es mañana",
      intro: (n: string) => `${n} Te recordamos que mañana tienes una cita con AA Solutions Services.`,
    },
    reminder_hour: {
      subject: (s: string) => `Tu cita empieza en 1 hora · ${s}`,
      heading: "Tu cita empieza en 1 hora",
      intro: (n: string) => `${n} Tu cita empieza en una hora. ¡Te esperamos!`,
    },
    bookAgain: "Agendar otra cita",
    docsNote:
      "Si tienes documentos pendientes (W-2, 1099, ID), puedes traerlos a la cita o enviarlos a infoaasolutionservices@gmail.com.",
  },
  en: {
    hello: (n: string) => `Hi ${n},`,
    service: "Service",
    date: "Date",
    time: "Time",
    mode: "Type",
    virtual: "Virtual (Google Meet)",
    presencial: "In person at our office",
    where: "Location",
    agent: "Advisor",
    code: "Code",
    meet: "Meeting link",
    meetLater: "We will send you the Google Meet link once the advisor confirms your appointment.",
    join: "Join Google Meet",
    addGoogle: "Add to Google Calendar",
    manage: "View or change my appointment",
    footer:
      "AA Solutions Services LLC · 246 W Linden Ave, Linden, NJ 07036<br>(201) 654-1106 (English) · (201) 608-0673 · (908) 636-3943<br>infoaasolutionservices@gmail.com",
    received: {
      subject: (s: string) => `We received your appointment request · ${s}`,
      heading: "We received your request",
      intro: (n: string) =>
        `${n} Your appointment is <b>pending approval</b>. One of our advisors will review it and we will send you the confirmation by email.`,
    },
    confirmed: {
      subject: (s: string) => `Your appointment is confirmed · ${s}`,
      heading: "Your appointment is confirmed!",
      intro: (n: string) => `${n} Here are your appointment details. We will remind you one day before and one hour before.`,
    },
    rescheduled: {
      subject: (s: string) => `Your appointment was rescheduled · ${s}`,
      heading: "We updated your appointment",
      intro: (n: string) => `${n} Your appointment has a new date or time. Here are the updated details.`,
    },
    cancelled: {
      subject: (s: string) => `Your appointment was cancelled · ${s}`,
      heading: "Your appointment was cancelled",
      intro: (n: string) => `${n} Your appointment was cancelled. You can book a new one anytime.`,
    },
    reminder_day: {
      subject: (s: string) => `Reminder: your appointment is tomorrow · ${s}`,
      heading: "Your appointment is tomorrow",
      intro: (n: string) => `${n} This is a reminder that you have an appointment with AA Solutions Services tomorrow.`,
    },
    reminder_hour: {
      subject: (s: string) => `Your appointment starts in 1 hour · ${s}`,
      heading: "Your appointment starts in 1 hour",
      intro: (n: string) => `${n} Your appointment starts in one hour. See you soon!`,
    },
    bookAgain: "Book another appointment",
    docsNote: "If you have pending documents (W-2, 1099, ID), bring them to the appointment or email them to infoaasolutionservices@gmail.com.",
  },
};

export function eventDetails(b: BookingRow, locale: Locale) {
  const s = getService(b.service_id)!;
  const settings = getSettings();
  const title = `AA Solutions · ${s.name[locale]}`;
  const location = b.mode === "virtual" ? b.meet_link ?? "Google Meet" : settings.officeAddress;
  const manageUrl = `${appUrl()}/${locale}/cita/${b.token}`;
  const description = [
    `${C[locale].code}: ${b.code}`,
    b.mode === "virtual" && b.meet_link ? `${C[locale].meet}: ${b.meet_link}` : "",
    `${C[locale].manage}: ${manageUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { title, location, description, manageUrl, start: b.start_at, end: b.end_at };
}

function clientBlock(b: BookingRow, kind: ClientNotice): { subject: string; block: EmailBlock; withIcs: boolean } {
  const locale = b.locale;
  const c = C[locale];
  const s = getService(b.service_id)!;
  const agent = b.agent_id ? getAgent(b.agent_id) : undefined;
  const ev = eventDetails(b, locale);
  const settings = getSettings();
  const copy = c[kind];

  const rows: [string, string][] = [
    [c.service, escapeHtml(s.name[locale])],
    [c.date, escapeHtml(longDate(b.start_at, locale))],
    [c.time, `${escapeHtml(clock(b.start_at, locale))} <span style="font-weight:400;color:#7C7A9A">(${tzLabel(locale)})</span>`],
    [c.mode, b.mode === "virtual" ? c.virtual : c.presencial],
  ];
  if (b.mode === "presencial") rows.push([c.where, escapeHtml(settings.officeAddress)]);
  if (agent) rows.push([c.agent, escapeHtml(agent.name)]);
  rows.push([c.code, escapeHtml(b.code)]);

  const buttons: EmailBlock["buttons"] = [];
  const active = kind !== "cancelled";
  const showMeet = active && b.mode === "virtual" && b.meet_link && b.status === "confirmed";
  if (showMeet) buttons.push({ label: c.join, url: b.meet_link!, primary: true });
  if (active && b.status === "confirmed") buttons.push({ label: c.addGoogle, url: googleCalendarLink(ev) });
  if (active) buttons.push({ label: c.manage, url: ev.manageUrl, primary: !showMeet && b.status !== "confirmed" });
  if (!active) buttons.push({ label: c.bookAgain, url: `${appUrl()}/${locale}/agendar`, primary: true });

  let note: string | undefined;
  if (b.mode === "virtual" && b.status === "pending") note = c.meetLater;
  else if (s.category === "tax" && active) note = c.docsNote;

  return {
    subject: copy.subject(s.short[locale]),
    block: {
      heading: copy.heading,
      intro: copy.intro(escapeHtml(c.hello(b.first_name))),
      rows,
      buttons,
      note,
      footer: c.footer,
      badge: { text: STATUS_LABEL[kind === "cancelled" ? "cancelled" : b.status][locale], color: STATUS_LABEL[kind === "cancelled" ? "cancelled" : b.status].color },
    },
    withIcs: active && b.status === "confirmed" && (kind === "confirmed" || kind === "rescheduled"),
  };
}

function logoUrl() {
  return `${appUrl()}/logo-white.png`;
}

export async function notifyClient(bookingId: number, kind: ClientNotice, actor = "sistema"): Promise<boolean> {
  const b = getBooking(bookingId);
  if (!b) return false;
  const { subject, block, withIcs } = clientBlock(b, kind);
  const ev = eventDetails(b, b.locale);
  const ok = await sendMail({
    to: b.email,
    subject,
    html: renderEmail(block, logoUrl()),
    text: renderText(block),
    kind,
    bookingId: b.id,
    attachments: withIcs
      ? [
          {
            filename: "cita-aa-solutions.ics",
            contentType: "text/calendar; charset=utf-8",
            content: buildIcs({ uid: b.code, title: ev.title, description: ev.description, location: ev.location, start: b.start_at, end: b.end_at, url: ev.manageUrl }),
          },
        ]
      : undefined,
  });
  logEvent(b.id, ok ? "mail" : "mail_error", `${NOTICE_LABEL[kind]} → ${b.email}`, actor);
  return ok;
}

export async function notifyAdmins(bookingId: number, kind: AdminNotice, extra = ""): Promise<boolean> {
  const b = getBooking(bookingId);
  if (!b) return false;
  const s = getService(b.service_id)!;
  const agent = b.agent_id ? getAgent(b.agent_id) : undefined;
  const settings = getSettings();
  const to = [...settings.adminEmails, agent?.email ?? ""].filter(Boolean);
  const heading = {
    admin_new: b.status === "pending" ? "Nueva cita por aprobar" : "Nueva cita agendada",
    admin_rescheduled: "El cliente cambió su cita",
    admin_cancelled: "El cliente canceló su cita",
  }[kind];
  const block: EmailBlock = {
    heading,
    intro: `${escapeHtml(b.first_name)} ${escapeHtml(b.last_name)} · ${escapeHtml(s.name.es)}${extra ? `<br>${escapeHtml(extra)}` : ""}`,
    rows: [
      ["Fecha", escapeHtml(longDate(b.start_at, "es"))],
      ["Hora", `${escapeHtml(clock(b.start_at, "es"))} (ET)`],
      ["Modalidad", b.mode === "virtual" ? "Virtual (Google Meet)" : "Presencial"],
      ["Gestor", escapeHtml(agent?.name ?? "Sin asignar")],
      ["Contacto", `${escapeHtml(b.email)}<br>${escapeHtml(b.phone ?? "")}`],
      ["Código", escapeHtml(b.code)],
      ["Estado", STATUS_LABEL[b.status].es],
    ],
    buttons: [
      { label: b.status === "pending" ? "Revisar y aprobar" : "Abrir en el panel", url: `${appUrl()}/admin/citas/${b.id}`, primary: true },
      ...(b.drive_folder_url ? [{ label: "Carpeta en Drive", url: b.drive_folder_url }] : []),
    ],
    footer: "Aviso automático del sistema de agendamiento de AA Solutions Services.",
    badge: { text: STATUS_LABEL[b.status].es, color: STATUS_LABEL[b.status].color },
  };
  const ok = await sendMail({
    to,
    subject: `${heading}: ${b.first_name} ${b.last_name} · ${s.short.es} · ${longDate(b.start_at, "es")} ${clock(b.start_at, "es")}`,
    html: renderEmail(block, logoUrl()),
    text: renderText(block),
    kind,
    bookingId: b.id,
    replyTo: b.email,
  });
  logEvent(b.id, ok ? "mail" : "mail_error", `Aviso admin (${heading}) → ${to.join(", ")}`);
  return ok;
}

/* ------------------------------------------------------------------ */
/* Recordatorios (1 día y 1 hora antes)                                 */
/* ------------------------------------------------------------------ */

/**
 * Envía los recordatorios que toquen. Se llama cada 5 minutos (cron interno o /api/cron/reminders).
 * La marca *_sent_at se pone antes de enviar con UPDATE condicional, así nunca sale duplicado
 * aunque corran dos procesos a la vez.
 */
export async function runReminders(now = new Date()): Promise<{ day: number; hour: number }> {
  const db = getDb();
  const nowMs = now.getTime();
  const iso = (ms: number) => new Date(ms).toISOString();
  let day = 0;
  let hour = 0;

  // 1 hora antes: citas que empiezan en los próximos 65 minutos.
  const hourRows = db
    .prepare(
      `SELECT id FROM bookings WHERE status = 'confirmed' AND reminder_hour_sent_at IS NULL AND start_at > ? AND start_at <= ?`,
    )
    .all(iso(nowMs), iso(nowMs + 65 * 60_000)) as { id: number }[];
  for (const { id } of hourRows) {
    const claimed = db
      .prepare(`UPDATE bookings SET reminder_hour_sent_at = ?, reminder_day_sent_at = COALESCE(reminder_day_sent_at, ?) WHERE id = ? AND reminder_hour_sent_at IS NULL`)
      .run(iso(nowMs), iso(nowMs), id);
    if (claimed.changes === 1 && (await notifyClient(id, "reminder_hour"))) hour++;
  }

  // 1 día antes: citas que empiezan entre 2 h y 24 h + 5 min desde ahora
  // (si la cita se agendó con menos de 24 h, igual recibe un aviso el mismo día).
  const dayRows = db
    .prepare(
      `SELECT id, created_at FROM bookings WHERE status = 'confirmed' AND reminder_day_sent_at IS NULL AND start_at > ? AND start_at <= ?`,
    )
    .all(iso(nowMs + 2 * 3_600_000), iso(nowMs + 24 * 3_600_000 + 5 * 60_000)) as { id: number; created_at: string }[];
  for (const { id, created_at } of dayRows) {
    // Si la cita se creó hace menos de 1 hora, ya recibió su confirmación: no hace falta otro correo.
    if (nowMs - Date.parse(created_at) < 3_600_000) {
      db.prepare(`UPDATE bookings SET reminder_day_sent_at = ? WHERE id = ? AND reminder_day_sent_at IS NULL`).run(iso(nowMs), id);
      continue;
    }
    const claimed = db
      .prepare(`UPDATE bookings SET reminder_day_sent_at = ? WHERE id = ? AND reminder_day_sent_at IS NULL`)
      .run(iso(nowMs), id);
    if (claimed.changes === 1 && (await notifyClient(id, "reminder_day"))) day++;
  }

  return { day, hour };
}
