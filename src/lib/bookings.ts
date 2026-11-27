import fs from "node:fs/promises";
import path from "node:path";
import { getDb, getSettings } from "./db";
import { allFields, getService, optionLabel, type Locale, type ServiceDef } from "./catalog";
import { getAgent, getSlots } from "./availability";
import { bookingCode, decryptJson, encryptJson, mask, randomToken } from "./crypto";
import { validateContact, validateService, type Values } from "./validation";
import {
  cancelCalendarEvent,
  createBookingFolder,
  createCalendarEvent,
  googleReady,
  renameFolder,
  updateCalendarEvent,
  uploadToDrive,
  upsertSheetRow,
  appUrl,
} from "./google";
import { localDate, localTime, fmt, zonedToUtc } from "./time";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
export type Mode = "virtual" | "presencial";

export interface BookingRow {
  id: number;
  code: string;
  token: string;
  service_id: string;
  locale: Locale;
  mode: Mode;
  agent_id: number | null;
  prior_contact_agent_id: number | null;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  answers: string;
  secrets: string | null;
  meet_link: string | null;
  calendar_event_id: string | null;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  admin_notes: string | null;
  reminder_day_sent_at: string | null;
  reminder_hour_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingFile {
  id: number;
  booking_id: number;
  field_key: string;
  filename: string;
  mime: string | null;
  size: number | null;
  local_path: string | null;
  drive_file_id: string | null;
  drive_url: string | null;
  created_at: string;
}

export interface BookingEvent {
  id: number;
  booking_id: number;
  type: string;
  detail: string | null;
  actor: string | null;
  created_at: string;
}

export interface UploadedFile {
  fieldKey: string;
  filename: string;
  mime: string;
  data: Buffer;
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = /^(image\/(jpeg|png|heic|heif|webp|gif)|application\/pdf)$/;

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");

export class BookingError extends Error {
  constructor(
    message: string,
    public code: "invalid" | "slot_taken" | "not_found" | "forbidden",
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* Lectura                                                              */
/* ------------------------------------------------------------------ */

export function getBooking(id: number): BookingRow | undefined {
  return getDb().prepare(`SELECT * FROM bookings WHERE id = ?`).get(id) as BookingRow | undefined;
}

export function getBookingByToken(token: string): BookingRow | undefined {
  return getDb().prepare(`SELECT * FROM bookings WHERE token = ?`).get(token) as BookingRow | undefined;
}

export function getBookingFiles(id: number): BookingFile[] {
  return getDb().prepare(`SELECT * FROM booking_files WHERE booking_id = ? ORDER BY id`).all(id) as BookingFile[];
}

export function getBookingEvents(id: number): BookingEvent[] {
  return getDb().prepare(`SELECT * FROM booking_events WHERE booking_id = ? ORDER BY id DESC`).all(id) as BookingEvent[];
}

export function parseAnswers(b: BookingRow): Values {
  try {
    return JSON.parse(b.answers) as Values;
  } catch {
    return {};
  }
}

export function getSecrets(b: BookingRow): Record<string, string> {
  return decryptJson<Record<string, string>>(b.secrets) ?? {};
}

export interface ListFilters {
  from?: string;
  to?: string;
  status?: string;
  serviceId?: string;
  agentId?: number;
  q?: string;
  limit?: number;
  order?: "asc" | "desc";
}

export function listBookings(f: ListFilters = {}): BookingRow[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (f.from) {
    where.push(`start_at >= ?`);
    args.push(f.from);
  }
  if (f.to) {
    where.push(`start_at < ?`);
    args.push(f.to);
  }
  if (f.status) {
    const list = f.status.split(",");
    where.push(`status IN (${list.map(() => "?").join(",")})`);
    args.push(...list);
  }
  if (f.serviceId) {
    where.push(`service_id = ?`);
    args.push(f.serviceId);
  }
  if (f.agentId) {
    where.push(`agent_id = ?`);
    args.push(f.agentId);
  }
  if (f.q) {
    where.push(`(code LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ? OR (first_name || ' ' || last_name) LIKE ?)`);
    const like = `%${f.q.trim()}%`;
    args.push(like, like, like, like, like, like);
  }
  const sql = `SELECT * FROM bookings ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY start_at ${
    f.order === "desc" ? "DESC" : "ASC"
  } LIMIT ${Math.min(f.limit ?? 500, 2000)}`;
  return getDb().prepare(sql).all(...args) as BookingRow[];
}

export function logEvent(bookingId: number, type: string, detail?: string, actor = "sistema") {
  getDb()
    .prepare(`INSERT INTO booking_events (booking_id, type, detail, actor) VALUES (?, ?, ?, ?)`)
    .run(bookingId, type, detail ?? null, actor);
}

/* ------------------------------------------------------------------ */
/* Crear                                                                */
/* ------------------------------------------------------------------ */

export interface CreateInput {
  serviceId: string;
  locale: Locale;
  mode: Mode;
  /** El cliente confirma que ya habló con un gestor (servicios de Tax). No se verifica. */
  priorContact: boolean;
  date: string;
  time: string;
  values: Values;
  files: UploadedFile[];
  accepted: boolean;
}

export function validateCreate(input: CreateInput): { service: ServiceDef; answers: Values; secrets: Record<string, string> } {
  const service = getService(input.serviceId);
  if (!service) throw new BookingError("Servicio no válido", "invalid");
  if (input.mode !== "virtual" && input.mode !== "presencial") throw new BookingError("Modalidad no válida", "invalid");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) {
    throw new BookingError("Fecha u hora no válida", "invalid");
  }
  const locale = input.locale;
  const fileKeys = new Set(input.files.map((f) => f.fieldKey));
  const contactErrors = validateContact(input.values, locale);
  const { errors, answers, secrets } = validateService(service, input.values, locale, fileKeys);
  const all = { ...contactErrors, ...errors };
  if (service.requiresPriorContact && !input.priorContact) {
    all.prior_contact =
      locale === "es"
        ? "Confirma que ya tuviste contacto con uno de nuestros gestores."
        : "Please confirm you have already been in contact with one of our advisors.";
  }
  if (!input.accepted) all.accept_terms = locale === "es" ? "Debes aceptar para continuar." : "You must accept to continue.";
  for (const f of input.files) {
    if (f.data.length > MAX_FILE_BYTES) all[f.fieldKey] = locale === "es" ? "El archivo supera 10 MB." : "File is larger than 10 MB.";
    else if (!ALLOWED_MIME.test(f.mime)) all[f.fieldKey] = locale === "es" ? "Solo imágenes o PDF." : "Images or PDF only.";
  }
  const validFileKeys = new Set(allFields(service).filter((f) => f.type === "file").map((f) => f.key));
  input.files = input.files.filter((f) => validFileKeys.has(f.fieldKey));
  if (Object.keys(all).length) throw new BookingError("Hay campos por corregir", "invalid", all);
  return { service, answers, secrets };
}

export async function createBooking(input: CreateInput): Promise<BookingRow> {
  const { service, answers, secrets } = validateCreate(input);
  const db = getDb();
  const v = input.values;

  // La verificación del horario y la inserción van en la misma transacción para evitar dobles reservas.
  const insert = db.transaction(() => {
    const slots = getSlots({ serviceId: service.id, date: input.date });
    const slot = slots.find((s) => s.time === input.time);
    if (!slot) throw new BookingError("Ese horario ya no está disponible", "slot_taken");
    const status: BookingStatus = service.requiresApproval ? "pending" : "confirmed";
    const res = db
      .prepare(
        `INSERT INTO bookings (code, token, service_id, locale, mode, agent_id, prior_contact_agent_id, start_at, end_at, status,
          first_name, last_name, email, phone, answers, secrets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        bookingCode(),
        randomToken(),
        service.id,
        input.locale,
        input.mode,
        null,
        null,
        slot.start,
        slot.end,
        status,
        String(v.first_name).trim(),
        String(v.last_name).trim(),
        String(v.email).trim().toLowerCase(),
        String(v.phone ?? "").trim() || null,
        JSON.stringify(answers),
        Object.keys(secrets).length ? encryptJson(secrets) : null,
      );
    return Number(res.lastInsertRowid);
  });

  const id = insert();
  logEvent(id, "created", `${service.name.es} · ${input.mode}`, "cliente");

  // Archivos: primero al disco (respaldo), luego a Drive en syncGoogle.
  if (input.files.length) {
    const booking = getBooking(id)!;
    const dir = path.join(UPLOAD_DIR, booking.code);
    await fs.mkdir(dir, { recursive: true });
    const ins = db.prepare(
      `INSERT INTO booking_files (booking_id, field_key, filename, mime, size, local_path) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const [i, f] of input.files.entries()) {
      const safe = f.filename.replace(/[^\w.\-() áéíóúñÁÉÍÓÚÑ]/g, "_").slice(-120) || `archivo-${i + 1}`;
      const p = path.join(dir, `${f.fieldKey}-${i + 1}-${safe}`);
      await fs.writeFile(p, f.data, { mode: 0o600 });
      ins.run(id, f.fieldKey, safe, f.mime, f.data.length, p);
    }
  }

  await syncGoogle(id);
  return getBooking(id)!;
}

/* ------------------------------------------------------------------ */
/* Google: carpeta, archivos, evento con Meet y fila en Sheets          */
/* ------------------------------------------------------------------ */

export function folderName(b: BookingRow): string {
  const s = getService(b.service_id);
  return `${localDate(b.start_at)} · ${b.code} · ${b.first_name} ${b.last_name} · ${s?.short.es ?? b.service_id}`;
}

export function describeAnswers(b: BookingRow, locale: Locale = "es"): string {
  const s = getService(b.service_id);
  if (!s) return "";
  const answers = parseAnswers(b);
  return allFields(s)
    .filter((f) => answers[f.key] != null && f.type !== "file")
    .map((f) => {
      const v = answers[f.key];
      const val = Array.isArray(v) ? v.map((x) => optionLabel(f, x, locale)).join(", ") : optionLabel(f, String(v), locale);
      return `${f.label[locale]}: ${val}`;
    })
    .join("\n");
}

function calendarInput(b: BookingRow) {
  const s = getService(b.service_id)!;
  const agent = b.agent_id ? getAgent(b.agent_id) : undefined;
  const settings = getSettings();
  const manage = `${appUrl()}/admin/citas/${b.id}`;
  return {
    code: b.code,
    summary: `${b.status === "pending" ? "[Pendiente] " : ""}${s.short.es} · ${b.first_name} ${b.last_name}`,
    description: [
      `Cita ${b.code} (${b.mode === "virtual" ? "Virtual" : "Presencial"})`,
      `Cliente: ${b.first_name} ${b.last_name} · ${b.email} · ${b.phone ?? ""}`,
      agent ? `Gestor: ${agent.name}` : "",
      b.drive_folder_url ? `Documentos: ${b.drive_folder_url}` : "",
      `Gestionar: ${manage}`,
    ]
      .filter(Boolean)
      .join("\n"),
    start: b.start_at,
    end: b.end_at,
    virtual: b.mode === "virtual",
    location: settings.officeAddress,
    attendees: [agent?.email ?? ""],
    timezone: settings.timezone,
  };
}

export function sheetRow(b: BookingRow): string[] {
  const s = getService(b.service_id);
  const agent = b.agent_id ? getAgent(b.agent_id) : undefined;
  const secrets = getSecrets(b);
  const masked = Object.entries(secrets)
    .map(([k, v]) => `${k}: ${mask(v)}`)
    .join(" | ");
  return [
    b.code,
    fmt(b.created_at, "yyyy-MM-dd HH:mm"),
    STATUS_LABEL[b.status].es,
    s?.name.es ?? b.service_id,
    b.mode === "virtual" ? "Virtual" : "Presencial",
    agent?.name ?? "",
    localDate(b.start_at),
    localTime(b.start_at),
    b.first_name,
    b.last_name,
    b.email,
    b.phone ?? "",
    b.locale.toUpperCase(),
    b.meet_link ?? "",
    b.drive_folder_url ?? "",
    describeAnswers(b, "es"),
    masked,
    fmt(new Date(), "yyyy-MM-dd HH:mm"),
  ];
}

/** Idempotente: crea lo que falte y actualiza lo existente. Los errores quedan en el historial. */
export async function syncGoogle(id: number): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  if (!googleReady()) return { ok: false, errors: ["Google no está conectado"] };
  const db = getDb();
  let b = getBooking(id)!;

  // 1) Carpeta en Drive
  try {
    if (!b.drive_folder_id) {
      const folder = await createBookingFolder(folderName(b));
      if (folder) {
        db.prepare(`UPDATE bookings SET drive_folder_id = ?, drive_folder_url = ? WHERE id = ?`).run(folder.id, folder.url, id);
        logEvent(id, "drive_folder", folder.url);
      }
    } else {
      await renameFolder(b.drive_folder_id, folderName(b));
    }
  } catch (e) {
    errors.push(`Drive (carpeta): ${errMsg(e)}`);
  }
  b = getBooking(id)!;

  // 2) Archivos pendientes
  if (b.drive_folder_id) {
    for (const f of getBookingFiles(id).filter((x) => !x.drive_file_id && x.local_path)) {
      try {
        const data = await fs.readFile(f.local_path!);
        const up = await uploadToDrive(b.drive_folder_id, `${f.field_key} - ${f.filename}`, f.mime ?? "", data);
        if (up) {
          db.prepare(`UPDATE booking_files SET drive_file_id = ?, drive_url = ?, local_path = NULL WHERE id = ?`).run(up.id, up.url, f.id);
          // Ya está en Drive: se borra la copia local para no duplicar datos personales.
          await fs.rm(f.local_path!, { force: true });
        }
      } catch (e) {
        errors.push(`Drive (${f.filename}): ${errMsg(e)}`);
      }
    }
  }

  // 3) Evento de Calendar (+ Meet si es virtual)
  try {
    if (b.status === "cancelled") {
      if (b.calendar_event_id) {
        await cancelCalendarEvent(b.calendar_event_id);
        db.prepare(`UPDATE bookings SET calendar_event_id = NULL WHERE id = ?`).run(id);
      }
    } else if (!b.calendar_event_id) {
      const ev = await createCalendarEvent(calendarInput(b));
      if (ev) {
        db.prepare(`UPDATE bookings SET calendar_event_id = ?, meet_link = ? WHERE id = ?`).run(ev.eventId, ev.meetLink, id);
        logEvent(id, "calendar", ev.meetLink ? `Evento con Meet: ${ev.meetLink}` : "Evento creado");
      }
    } else {
      const ev = await updateCalendarEvent(b.calendar_event_id, calendarInput(b));
      if (ev && ev.meetLink !== b.meet_link) {
        db.prepare(`UPDATE bookings SET meet_link = ? WHERE id = ?`).run(ev.meetLink, id);
      }
    }
  } catch (e) {
    errors.push(`Calendar: ${errMsg(e)}`);
  }
  b = getBooking(id)!;

  // 4) Fila en Google Sheets
  try {
    await upsertSheetRow(b.code, sheetRow(b));
  } catch (e) {
    errors.push(`Sheets: ${errMsg(e)}`);
  }

  if (errors.length) logEvent(id, "google_error", errors.join("\n"));
  return { ok: errors.length === 0, errors };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/* ------------------------------------------------------------------ */
/* Cambios                                                              */
/* ------------------------------------------------------------------ */

export const STATUS_LABEL: Record<BookingStatus, { es: string; en: string; color: string }> = {
  pending: { es: "Pendiente de aprobación", en: "Pending approval", color: "#F59E0B" },
  confirmed: { es: "Confirmada", en: "Confirmed", color: "#14B8A6" },
  cancelled: { es: "Cancelada", en: "Cancelled", color: "#F43F5E" },
  completed: { es: "Completada", en: "Completed", color: "#6366F1" },
  no_show: { es: "No asistió", en: "No show", color: "#94A3B8" },
};

function touch(id: number) {
  getDb().prepare(`UPDATE bookings SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(id);
}

export function setStatus(id: number, status: BookingStatus, actor: string) {
  const b = getBooking(id);
  if (!b) throw new BookingError("Cita no encontrada", "not_found");
  getDb().prepare(`UPDATE bookings SET status = ? WHERE id = ?`).run(status, id);
  touch(id);
  logEvent(id, "status", `${STATUS_LABEL[b.status].es} → ${STATUS_LABEL[status].es}`, actor);
}

/**
 * Cambia fecha/hora y opcionalmente la modalidad.
 * `force` permite al admin agendar fuera del horario publicado o sobre otra cita.
 */
export function reschedule(id: number, opts: { date: string; time: string; mode?: Mode; force?: boolean; actor: string }) {
  const db = getDb();
  const b = getBooking(id);
  if (!b) throw new BookingError("Cita no encontrada", "not_found");
  const service = getService(b.service_id)!;
  db.transaction(() => {
    let start: string;
    let end: string;
    const slot = getSlots({ serviceId: b.service_id, date: opts.date, excludeBookingId: id, ignoreNotice: true }).find(
      (s) => s.time === opts.time,
    );
    if (slot) {
      start = slot.start;
      end = slot.end;
    } else if (opts.force) {
      const s = zonedToUtc(opts.date, opts.time, getSettings().timezone);
      start = s.toISOString();
      end = new Date(s.getTime() + service.durationMin * 60_000).toISOString();
    } else {
      throw new BookingError("Ese horario no está disponible", "slot_taken");
    }
    db.prepare(
      `UPDATE bookings SET start_at = ?, end_at = ?, mode = ?, reminder_day_sent_at = NULL, reminder_hour_sent_at = NULL WHERE id = ?`,
    ).run(start, end, opts.mode ?? b.mode, id);
  })();
  touch(id);
  const after = getBooking(id)!;
  logEvent(
    id,
    "rescheduled",
    `${localDate(b.start_at)} ${localTime(b.start_at)} → ${localDate(after.start_at)} ${localTime(after.start_at)}${
      after.mode !== b.mode ? ` · ${after.mode === "virtual" ? "Virtual" : "Presencial"}` : ""
    }`,
    opts.actor,
  );
  return { before: b, after };
}

/** Asigna (o quita) la gestora responsable. */
export function assignAgent(id: number, agentId: number | null, actor: string) {
  const b = getBooking(id);
  if (!b) throw new BookingError("Cita no encontrada", "not_found");
  getDb().prepare(`UPDATE bookings SET agent_id = ? WHERE id = ?`).run(agentId, id);
  touch(id);
  const name = agentId ? getAgent(agentId)?.name ?? `#${agentId}` : "Sin asignar";
  logEvent(id, "assigned", name, actor);
}

export function addNote(id: number, text: string, actor: string) {
  const clean = text.trim();
  if (!clean) return;
  logEvent(id, "note", clean.slice(0, 4000), actor);
}

export function updateDetails(
  id: number,
  patch: { first_name?: string; last_name?: string; email?: string; phone?: string; admin_notes?: string; answers?: Values },
  actor: string,
) {
  const b = getBooking(id);
  if (!b) throw new BookingError("Cita no encontrada", "not_found");
  const next = {
    first_name: patch.first_name?.trim() || b.first_name,
    last_name: patch.last_name?.trim() || b.last_name,
    email: patch.email?.trim().toLowerCase() || b.email,
    phone: patch.phone?.trim() ?? b.phone,
    admin_notes: patch.admin_notes ?? b.admin_notes,
    answers: patch.answers ? JSON.stringify({ ...parseAnswers(b), ...patch.answers }) : b.answers,
  };
  getDb()
    .prepare(`UPDATE bookings SET first_name = ?, last_name = ?, email = ?, phone = ?, admin_notes = ?, answers = ? WHERE id = ?`)
    .run(next.first_name, next.last_name, next.email, next.phone, next.admin_notes, next.answers, id);
  touch(id);
  logEvent(id, "edited", "Datos actualizados", actor);
}

export function canClientChange(b: BookingRow, now = new Date()): boolean {
  if (b.status !== "pending" && b.status !== "confirmed") return false;
  const limit = getSettings().cancelLimitHours * 3_600_000;
  return Date.parse(b.start_at) - now.getTime() >= limit;
}
