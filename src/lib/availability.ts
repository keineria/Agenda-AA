import { getDb, getSettings } from "./db";
import { getService } from "./catalog";
import { addDays, hhmm, localDate, minutes, weekdayOf, zonedToUtc } from "./time";

/**
 * Agenda general de la oficina: el cliente no elige gestor. Un horario está libre si
 * cae dentro del horario de la oficina, no choca con un bloqueo y hay menos citas
 * simultáneas que `capacity`. Las gestoras se asignan internamente desde el panel.
 */

export interface Agent {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  photo: string | null;
  color: string;
  active: number;
  sort: number;
}

export interface Slot {
  time: string; // HH:mm en la zona del negocio
  start: string; // ISO UTC
  end: string; // ISO UTC
}

export interface Window {
  id: number;
  weekday: number;
  start_time: string;
  end_time: string;
}

/** Estados que ocupan el horario. */
export const BLOCKING_STATUSES = ["pending", "confirmed"];

export function listAgents(includeInactive = false): Agent[] {
  const sql = includeInactive
    ? `SELECT * FROM agents ORDER BY sort, id`
    : `SELECT * FROM agents WHERE active = 1 ORDER BY sort, id`;
  return getDb().prepare(sql).all() as Agent[];
}

export function getAgent(id: number): Agent | undefined {
  return getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(id) as Agent | undefined;
}

export function listWindows(): Window[] {
  return getDb()
    .prepare(`SELECT id, weekday, start_time, end_time FROM availability WHERE agent_id IS NULL ORDER BY weekday, start_time`)
    .all() as Window[];
}

interface Interval {
  start: number;
  end: number;
}

function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

export function getSlots(opts: {
  serviceId: string;
  date: string;
  /** Al reprogramar, ignora la propia cita. */
  excludeBookingId?: number;
  now?: Date;
  /** El admin puede agendar sin respetar la anticipación mínima ni el máximo de días. */
  ignoreNotice?: boolean;
}): Slot[] {
  const service = getService(opts.serviceId);
  if (!service) return [];
  const settings = getSettings();
  const db = getDb();
  const now = opts.now ?? new Date();
  const tz = settings.timezone;

  const today = localDate(now, tz);
  if (opts.date < today) return [];
  if (!opts.ignoreNotice && opts.date > addDays(today, settings.maxDaysAhead)) return [];

  const wd = weekdayOf(opts.date);
  const windows = db
    .prepare(`SELECT start_time, end_time FROM availability WHERE agent_id IS NULL AND weekday = ? ORDER BY start_time`)
    .all(wd) as { start_time: string; end_time: string }[];
  if (windows.length === 0) return [];

  const dayStart = zonedToUtc(opts.date, "00:00", tz).getTime();
  const dayEnd = zonedToUtc(addDays(opts.date, 1), "00:00", tz).getTime();
  const bufferMs = settings.bufferMin * 60_000;
  const durMs = service.durationMin * 60_000;
  const earliest = opts.ignoreNotice ? now.getTime() : now.getTime() + settings.minNoticeHours * 3_600_000;
  const capacity = Math.max(1, settings.capacity);

  const booked: Interval[] = (
    db
      .prepare(
        `SELECT id, start_at, end_at FROM bookings
         WHERE status IN (${BLOCKING_STATUSES.map(() => "?").join(",")}) AND start_at < ? AND end_at > ?`,
      )
      .all(...BLOCKING_STATUSES, new Date(dayEnd + bufferMs).toISOString(), new Date(dayStart - bufferMs).toISOString()) as {
      id: number;
      start_at: string;
      end_at: string;
    }[]
  )
    .filter((b) => b.id !== opts.excludeBookingId)
    .map((b) => ({ start: Date.parse(b.start_at) - bufferMs, end: Date.parse(b.end_at) + bufferMs }));

  const blocked: Interval[] = (
    db
      .prepare(`SELECT start_at, end_at FROM blocks WHERE agent_id IS NULL AND start_at < ? AND end_at > ?`)
      .all(new Date(dayEnd).toISOString(), new Date(dayStart).toISOString()) as { start_at: string; end_at: string }[]
  ).map((b) => ({ start: Date.parse(b.start_at), end: Date.parse(b.end_at) }));

  const out: Slot[] = [];
  const seen = new Set<string>();
  for (const w of windows) {
    const from = minutes(w.start_time);
    const to = minutes(w.end_time);
    for (let m = from; m + service.durationMin <= to; m += settings.slotStepMin) {
      const time = hhmm(m);
      if (seen.has(time)) continue;
      const start = zonedToUtc(opts.date, time, tz).getTime();
      const iv = { start, end: start + durMs };
      if (start < earliest) continue;
      if (blocked.some((b) => overlaps(iv, b))) continue;
      if (booked.filter((b) => overlaps(iv, b)).length >= capacity) continue;
      seen.add(time);
      out.push({ time, start: new Date(iv.start).toISOString(), end: new Date(iv.end).toISOString() });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/** Días del mes (YYYY-MM) que tienen al menos un horario libre. */
export function getAvailableDays(opts: { serviceId: string; month: string; now?: Date }): string[] {
  const [y, m] = opts.month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${opts.month}-${String(d).padStart(2, "0")}`;
    if (getSlots({ serviceId: opts.serviceId, date, now: opts.now }).length > 0) out.push(date);
  }
  return out;
}
