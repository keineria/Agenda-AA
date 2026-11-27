import { OAuth2Client } from "google-auth-library";
import { calendar as calendarApi } from "@googleapis/calendar";
import { drive as driveApi } from "@googleapis/drive";
import { sheets as sheetsApi } from "@googleapis/sheets";
import { Readable } from "node:stream";
import { getKV, setKV } from "./db";
import { decrypt, encrypt } from "./crypto";

/**
 * Integración con la cuenta de Google del negocio (OAuth, sin costo):
 * - Calendar: un evento por cita; si es virtual, con enlace de Google Meet.
 * - Drive: una carpeta por cita dentro de "AA Solutions · Agendamientos".
 * - Sheets: una fila por cita en la hoja "AA Solutions · Agendamientos".
 *
 * Alcances mínimos: calendar.events y drive.file (la app solo ve lo que ella crea).
 * La conexión se hace una vez desde Admin › Configuración › Google.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

const KV_TOKEN = "google_refresh_token";
const KV_EMAIL = "google_account_email";
const KV_ROOT_FOLDER = "google_root_folder_id";
const KV_SHEET = "google_sheet_id";

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function oauthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${appUrl()}/api/admin/google/callback`,
  });
}

export function googleAuthUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function handleGoogleCallback(code: string): Promise<string> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error("Google no devolvió refresh_token. Quita el acceso de la app en tu cuenta Google y vuelve a conectar.");
  setKV(KV_TOKEN, encrypt(tokens.refresh_token));
  client.setCredentials(tokens);
  let email = "";
  if (tokens.id_token) {
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    email = ticket.getPayload()?.email ?? "";
  }
  setKV(KV_EMAIL, email);
  return email;
}

export function disconnectGoogle() {
  setKV(KV_TOKEN, null);
  setKV(KV_EMAIL, null);
}

function refreshToken(): string | null {
  const stored = getKV(KV_TOKEN);
  if (stored) {
    try {
      return decrypt(stored);
    } catch {
      return null;
    }
  }
  return process.env.GOOGLE_REFRESH_TOKEN || null;
}

export function googleStatus() {
  return {
    configured: googleConfigured(),
    connected: googleConfigured() && Boolean(refreshToken()),
    email: getKV(KV_EMAIL) || null,
    rootFolderId: getKV(KV_ROOT_FOLDER) || null,
    sheetId: getKV(KV_SHEET) || null,
  };
}

function authed(): OAuth2Client | null {
  if (!googleConfigured()) return null;
  const rt = refreshToken();
  if (!rt) return null;
  const client = oauthClient();
  client.setCredentials({ refresh_token: rt });
  return client;
}

export function googleReady(): boolean {
  return authed() !== null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function cal() {
  const auth = authed();
  return auth ? calendarApi({ version: "v3", auth: auth as any }) : null;
}
function drv() {
  const auth = authed();
  return auth ? driveApi({ version: "v3", auth: auth as any }) : null;
}
function sht() {
  const auth = authed();
  return auth ? sheetsApi({ version: "v4", auth: auth as any }) : null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const CALENDAR_ID = () => process.env.GOOGLE_CALENDAR_ID || "primary";

/* ------------------------------ Calendar ------------------------------ */

export interface CalendarInput {
  code: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  virtual: boolean;
  location?: string;
  attendees: string[];
  timezone: string;
}

export async function createCalendarEvent(input: CalendarInput) {
  const api = cal();
  if (!api) return null;
  const res = await api.events.insert({
    calendarId: CALENDAR_ID(),
    conferenceDataVersion: 1,
    sendUpdates: "none",
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.virtual ? undefined : input.location,
      start: { dateTime: input.start, timeZone: input.timezone },
      end: { dateTime: input.end, timeZone: input.timezone },
      attendees: input.attendees.filter(Boolean).map((email) => ({ email })),
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
      extendedProperties: { private: { bookingCode: input.code } },
      conferenceData: input.virtual
        ? { createRequest: { requestId: `${input.code}-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } } }
        : undefined,
    },
  });
  const ev = res.data;
  const meet = ev.hangoutLink || ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri || null;
  return { eventId: ev.id!, meetLink: meet, htmlLink: ev.htmlLink ?? null };
}

export async function updateCalendarEvent(eventId: string, input: CalendarInput) {
  const api = cal();
  if (!api) return null;
  // Al pasar de virtual a presencial se quita la reunión de Meet (conferenceData: null).
  const requestBody: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    location: input.virtual ? "" : input.location,
    start: { dateTime: input.start, timeZone: input.timezone },
    end: { dateTime: input.end, timeZone: input.timezone },
    attendees: input.attendees.filter(Boolean).map((email) => ({ email })),
  };
  const current = await api.events.get({ calendarId: CALENDAR_ID(), eventId });
  const hasMeet = Boolean(current.data.conferenceData);
  if (input.virtual && !hasMeet) {
    requestBody.conferenceData = { createRequest: { requestId: `${input.code}-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } } };
  } else if (!input.virtual && hasMeet) {
    requestBody.conferenceData = null;
  }
  const res = await api.events.patch({
    calendarId: CALENDAR_ID(),
    eventId,
    conferenceDataVersion: 1,
    sendUpdates: "none",
    requestBody: requestBody as never,
  });
  const ev = res.data;
  const meet = input.virtual
    ? ev.hangoutLink || ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri || null
    : null;
  return { eventId: ev.id!, meetLink: meet, htmlLink: ev.htmlLink ?? null };
}

export async function cancelCalendarEvent(eventId: string) {
  const api = cal();
  if (!api) return;
  await api.events.delete({ calendarId: CALENDAR_ID(), eventId, sendUpdates: "none" });
}

/* -------------------------------- Drive ------------------------------- */

async function ensureRootFolder(): Promise<string | null> {
  const api = drv();
  if (!api) return null;
  const existing = getKV(KV_ROOT_FOLDER);
  if (existing) {
    try {
      const f = await api.files.get({ fileId: existing, fields: "id, trashed" });
      if (f.data.id && !f.data.trashed) return existing;
    } catch {
      /* se recrea abajo */
    }
  }
  const res = await api.files.create({
    requestBody: { name: "AA Solutions · Agendamientos", mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  });
  setKV(KV_ROOT_FOLDER, res.data.id!);
  return res.data.id!;
}

export async function createBookingFolder(name: string) {
  const api = drv();
  if (!api) return null;
  const root = await ensureRootFolder();
  const res = await api.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: root ? [root] : undefined },
    fields: "id, webViewLink",
  });
  return { id: res.data.id!, url: res.data.webViewLink ?? `https://drive.google.com/drive/folders/${res.data.id}` };
}

export async function renameFolder(folderId: string, name: string) {
  const api = drv();
  if (!api) return;
  await api.files.update({ fileId: folderId, requestBody: { name } });
}

export async function uploadToDrive(folderId: string, filename: string, mime: string, data: Buffer) {
  const api = drv();
  if (!api) return null;
  const res = await api.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: mime || "application/octet-stream", body: Readable.from(data) },
    fields: "id, webViewLink",
  });
  return { id: res.data.id!, url: res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view` };
}

/* -------------------------------- Sheets ------------------------------ */

export const SHEET_HEADERS = [
  "Código",
  "Creada",
  "Estado",
  "Servicio",
  "Modalidad",
  "Gestor",
  "Fecha",
  "Hora (ET)",
  "Nombre",
  "Apellidos",
  "Email",
  "Teléfono",
  "Idioma",
  "Google Meet",
  "Carpeta Drive",
  "Respuestas",
  "Datos sensibles (enmascarados)",
  "Actualizada",
];

async function ensureSpreadsheet(): Promise<string | null> {
  const api = sht();
  if (!api) return null;
  const existing = getKV(KV_SHEET);
  if (existing) return existing;
  const res = await api.spreadsheets.create({
    requestBody: {
      properties: { title: "AA Solutions · Agendamientos" },
      sheets: [{ properties: { title: "Citas", gridProperties: { frozenRowCount: 1 } } }],
    },
  });
  const id = res.data.spreadsheetId!;
  await api.spreadsheets.values.update({
    spreadsheetId: id,
    range: "Citas!A1",
    valueInputOption: "RAW",
    requestBody: { values: [SHEET_HEADERS] },
  });
  setKV(KV_SHEET, id);
  // Mueve la hoja a la carpeta raíz para tener todo junto.
  try {
    const root = await ensureRootFolder();
    const d = drv();
    if (root && d) await d.files.update({ fileId: id, addParents: root, fields: "id" });
  } catch {
    /* no es crítico */
  }
  return id;
}

/** Inserta o actualiza la fila de la cita (busca el código en la columna A). */
export async function upsertSheetRow(code: string, row: string[]) {
  const api = sht();
  if (!api) return null;
  const id = await ensureSpreadsheet();
  if (!id) return null;
  const col = await api.spreadsheets.values.get({ spreadsheetId: id, range: "Citas!A:A" });
  const values = col.data.values ?? [];
  const idx = values.findIndex((r) => r[0] === code);
  if (idx >= 0) {
    await api.spreadsheets.values.update({
      spreadsheetId: id,
      range: `Citas!A${idx + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await api.spreadsheets.values.append({
      spreadsheetId: id,
      range: "Citas!A1",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }
  return `https://docs.google.com/spreadsheets/d/${id}`;
}

/** Agrega una fila a otra pestaña de la hoja (la crea con encabezados si no existe). */
export async function appendToTab(tab: string, headers: string[], row: string[]) {
  const api = sht();
  if (!api) return null;
  const id = await ensureSpreadsheet();
  if (!id) return null;
  const meta = await api.spreadsheets.get({ spreadsheetId: id, fields: "sheets.properties.title" });
  const exists = meta.data.sheets?.some((x) => x.properties?.title === tab);
  if (!exists) {
    await api.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: [{ addSheet: { properties: { title: tab, gridProperties: { frozenRowCount: 1 } } } }] },
    });
    await api.spreadsheets.values.update({ spreadsheetId: id, range: `${tab}!A1`, valueInputOption: "RAW", requestBody: { values: [headers] } });
  }
  await api.spreadsheets.values.append({
    spreadsheetId: id,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
  return id;
}
