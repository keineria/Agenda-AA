import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * Base de datos SQLite en un solo archivo (data/agenda.db por defecto).
 * Suficiente para el volumen de una oficina y fácil de respaldar: basta copiar el archivo.
 */

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "agenda.db");

declare global {
  // eslint-disable-next-line no-var
  var __agendaDb: Database.Database | undefined;
}

const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    photo TEXT,
    color TEXT NOT NULL DEFAULT '#7B6CF6',
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0
  );

  -- Horario semanal de la oficina (agenda general). weekday: 0=domingo ... 6=sábado.
  -- Varias filas por día permiten pausas (p. ej. almuerzo). agent_id queda para uso futuro.
  CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
  );

  -- Bloqueos: vacaciones, festivos, almuerzo puntual. agent_id NULL = toda la oficina.
  CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    reason TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    service_id TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'es',
    mode TEXT NOT NULL,
    agent_id INTEGER REFERENCES agents(id),
    prior_contact_agent_id INTEGER REFERENCES agents(id),
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    answers TEXT NOT NULL DEFAULT '{}',
    secrets TEXT,
    meet_link TEXT,
    calendar_event_id TEXT,
    drive_folder_id TEXT,
    drive_folder_url TEXT,
    admin_notes TEXT,
    reminder_day_sent_at TEXT,
    reminder_hour_sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_bookings_start ON bookings(start_at);
  CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

  CREATE TABLE IF NOT EXISTS booking_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime TEXT,
    size INTEGER,
    local_path TEXT,
    drive_file_id TEXT,
    drive_url TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  -- Historial de cada cita (creación, cambios, avisos enviados, errores de integración).
  CREATE TABLE IF NOT EXISTS booking_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    detail TEXT,
    actor TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    agent_id INTEGER REFERENCES agents(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mail_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER,
    kind TEXT NOT NULL,
    to_addr TEXT NOT NULL,
    subject TEXT NOT NULL,
    ok INTEGER NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  `,
  `
  -- Formulario de contacto y suscripción del sitio web (no son citas).
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    service TEXT,
    message TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'es',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    locale TEXT NOT NULL DEFAULT 'es',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  `,
];

function migrate(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY)`);
  const done = new Set((db.prepare(`SELECT id FROM _migrations`).all() as { id: number }[]).map((r) => r.id));
  MIGRATIONS.forEach((sql, i) => {
    if (done.has(i)) return;
    db.transaction(() => {
      db.exec(sql);
      db.prepare(`INSERT INTO _migrations (id) VALUES (?)`).run(i);
    })();
  });
  seedDefaults(db);
}

/**
 * Datos iniciales: las dos gestoras y el horario acordado
 * (lunes a viernes 9:00-20:00 con almuerzo 12:00-13:00; sin sábados ni domingos por ahora).
 */
function seedDefaults(db: Database.Database) {
  const count = (db.prepare(`SELECT COUNT(*) AS n FROM agents`).get() as { n: number }).n;
  if (count > 0) return;
  const insertAgent = db.prepare(`INSERT INTO agents (name, email, phone, photo, color, sort) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertAvail = db.prepare(`INSERT INTO availability (agent_id, weekday, start_time, end_time) VALUES (NULL, ?, ?, ?)`);
  const agents: [string, string, string, string][] = [
    ["Alexandra Peguero", "(201) 654-1106", "/alexandra.jpg", "#3EC6F2"],
    ["Angela Jiménez", "(908) 636-3943", "/angela.jpg", "#EC5FA8"],
  ];
  db.transaction(() => {
    agents.forEach(([name, phone, photo, color], i) => insertAgent.run(name, null, phone, photo, color, i));
    for (let wd = 1; wd <= 5; wd++) {
      insertAvail.run(wd, "09:00", "12:00");
      insertAvail.run(wd, "13:00", "20:00");
    }
  })();
}

export function getDb(): Database.Database {
  if (!globalThis.__agendaDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    migrate(db);
    globalThis.__agendaDb = db;
  }
  return globalThis.__agendaDb;
}

/* ---------------------------- settings ---------------------------- */

export interface AppSettings {
  timezone: string;
  slotStepMin: number;
  bufferMin: number;
  minNoticeHours: number;
  /** Citas que pueden coincidir a la misma hora (agenda general). */
  capacity: number;
  maxDaysAhead: number;
  adminEmails: string[];
  officeAddress: string;
  cancelLimitHours: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  timezone: "America/New_York",
  slotStepMin: 30,
  bufferMin: 15,
  minNoticeHours: 48,
  capacity: 1,
  maxDaysAhead: 60,
  adminEmails: (process.env.ADMIN_NOTIFY_EMAILS || "infoaasolutionservices@gmail.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  officeAddress: "246 W Linden Ave, Linden, NJ 07036",
  cancelLimitHours: 24,
};

export function getSettings(): AppSettings {
  const row = getDb().prepare(`SELECT value FROM settings WHERE key = 'app'`).get() as { value: string } | undefined;
  if (!row) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(patch: Partial<AppSettings>) {
  const next = { ...getSettings(), ...patch };
  getDb()
    .prepare(`INSERT INTO settings (key, value) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(JSON.stringify(next));
  return next;
}

export function getKV(key: string): string | undefined {
  const row = getDb().prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string } | undefined;
  return row?.value;
}

export function setKV(key: string, value: string | null) {
  if (value === null) {
    getDb().prepare(`DELETE FROM settings WHERE key = ?`).run(key);
    return;
  }
  getDb()
    .prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(key, value);
}
