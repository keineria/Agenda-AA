"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/ratelimit";
import { getDb, saveSettings } from "@/lib/db";
import { createUser, deleteUser, login, logout, requireRole, updateUser, type Role } from "@/lib/auth";
import {
  addNote,
  assignAgent,
  BookingError,
  getBooking,
  getSecrets,
  logEvent,
  reschedule,
  setStatus,
  syncGoogle,
  updateDetails,
  type BookingStatus,
  type Mode,
} from "@/lib/bookings";
import { notifyClient, type ClientNotice } from "@/lib/notify";
import { disconnectGoogle } from "@/lib/google";
import { zonedToUtc } from "@/lib/time";

export type ActionResult = { ok: boolean; message?: string; data?: unknown };

function fail(e: unknown): ActionResult {
  if (e instanceof BookingError) return { ok: false, message: e.message };
  return { ok: false, message: e instanceof Error ? e.message : "Error inesperado" };
}

/* ------------------------------- Sesión ------------------------------- */

export async function loginAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000) || !rateLimit(`login:${email}`, 10, 15 * 60_000)) {
    return { ok: false, message: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo." };
  }
  const ok = await login(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!ok) return { ok: false, message: "Correo o contraseña incorrectos." };
  const next = String(form.get("next") ?? "/admin");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

/* -------------------------------- Citas ------------------------------- */

export async function changeStatusAction(id: number, status: BookingStatus, notify: boolean): Promise<ActionResult> {
  const s = await requireRole("admin");
  try {
    setStatus(id, status, s.name);
    await syncGoogle(id);
    if (notify) {
      if (status === "cancelled") await notifyClient(id, "cancelled", s.name);
      if (status === "confirmed") await notifyClient(id, "confirmed", s.name);
    }
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function rescheduleAction(
  id: number,
  input: { date: string; time: string; mode: Mode; force: boolean; notify: boolean },
): Promise<ActionResult> {
  const s = await requireRole("admin");
  try {
    reschedule(id, { date: input.date, time: input.time, mode: input.mode, force: input.force, actor: s.name });
    const res = await syncGoogle(id);
    if (input.notify) await notifyClient(id, "rescheduled", s.name);
    revalidatePath("/admin", "layout");
    return { ok: true, message: res.ok ? undefined : `Guardado. Google: ${res.errors.join("; ")}` };
  } catch (e) {
    return fail(e);
  }
}

export async function assignAction(id: number, agentId: number | null): Promise<ActionResult> {
  const s = await requireRole("admin");
  try {
    assignAgent(id, agentId, s.name);
    await syncGoogle(id);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateDetailsAction(
  id: number,
  patch: { first_name: string; last_name: string; email: string; phone: string; answers?: Record<string, string | string[]> },
): Promise<ActionResult> {
  const s = await requireRole("admin");
  try {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(patch.email.trim())) return { ok: false, message: "Correo no válido." };
    updateDetails(id, patch, s.name);
    await syncGoogle(id);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Los gestores también pueden dejar notas. */
export async function addNoteAction(id: number, text: string): Promise<ActionResult> {
  const s = await requireRole("gestor");
  try {
    addNote(id, text, s.name);
    revalidatePath(`/admin/citas/${id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resendAction(id: number, kind: ClientNotice): Promise<ActionResult> {
  const s = await requireRole("admin");
  const ok = await notifyClient(id, kind, s.name);
  revalidatePath(`/admin/citas/${id}`);
  return ok ? { ok: true, message: "Aviso enviado." } : { ok: false, message: "No se pudo enviar el correo. Revisa la configuración SMTP." };
}

export async function syncAction(id: number): Promise<ActionResult> {
  await requireRole("admin");
  const res = await syncGoogle(id);
  revalidatePath(`/admin/citas/${id}`);
  return res.ok ? { ok: true, message: "Sincronizado con Google." } : { ok: false, message: res.errors.join("; ") };
}

/** Muestra los datos sensibles (solo admin y superadmin) y deja registro en el historial. */
export async function revealSecretsAction(id: number): Promise<ActionResult> {
  const s = await requireRole("admin");
  const b = getBooking(id);
  if (!b) return { ok: false, message: "No encontrada" };
  logEvent(id, "secrets_viewed", "Datos sensibles consultados", s.name);
  return { ok: true, data: getSecrets(b) };
}

/* ----------------------------- Configuración --------------------------- */

export async function saveScheduleAction(windows: { weekday: number; start_time: string; end_time: string }[]): Promise<ActionResult> {
  await requireRole("admin");
  const re = /^\d{2}:\d{2}$/;
  for (const w of windows) {
    if (!re.test(w.start_time) || !re.test(w.end_time) || w.start_time >= w.end_time || w.weekday < 0 || w.weekday > 6) {
      return { ok: false, message: "Revisa los horarios: el inicio debe ser antes del fin." };
    }
  }
  const db = getDb();
  db.transaction(() => {
    db.prepare(`DELETE FROM availability WHERE agent_id IS NULL`).run();
    const ins = db.prepare(`INSERT INTO availability (agent_id, weekday, start_time, end_time) VALUES (NULL, ?, ?, ?)`);
    for (const w of windows) ins.run(w.weekday, w.start_time, w.end_time);
  })();
  revalidatePath("/admin/configuracion");
  return { ok: true, message: "Horario guardado." };
}

export async function addBlockAction(input: { from: string; to: string; allDay: boolean; startTime?: string; endTime?: string; reason: string }): Promise<ActionResult> {
  await requireRole("admin");
  if (!input.from || !input.to || input.to < input.from) return { ok: false, message: "Revisa las fechas." };
  const start = zonedToUtc(input.from, input.allDay ? "00:00" : input.startTime || "00:00");
  const endDate = input.allDay ? addOneDay(input.to) : input.to;
  const end = zonedToUtc(endDate, input.allDay ? "00:00" : input.endTime || "23:59");
  if (end <= start) return { ok: false, message: "El fin debe ser después del inicio." };
  getDb().prepare(`INSERT INTO blocks (agent_id, start_at, end_at, reason) VALUES (NULL, ?, ?, ?)`).run(start.toISOString(), end.toISOString(), input.reason || null);
  revalidatePath("/admin/configuracion");
  return { ok: true, message: "Bloqueo agregado." };
}

function addOneDay(d: string) {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10);
}

export async function deleteBlockAction(id: number): Promise<ActionResult> {
  await requireRole("admin");
  getDb().prepare(`DELETE FROM blocks WHERE id = ?`).run(id);
  revalidatePath("/admin/configuracion");
  return { ok: true };
}

export async function saveSettingsAction(input: {
  bufferMin: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  capacity: number;
  slotStepMin: number;
  cancelLimitHours: number;
  adminEmails: string;
}): Promise<ActionResult> {
  await requireRole("superadmin");
  const n = (x: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(x) || 0)));
  saveSettings({
    bufferMin: n(input.bufferMin, 0, 120),
    minNoticeHours: n(input.minNoticeHours, 0, 24 * 30),
    maxDaysAhead: n(input.maxDaysAhead, 1, 365),
    capacity: n(input.capacity, 1, 10),
    slotStepMin: [15, 20, 30, 45, 60].includes(Number(input.slotStepMin)) ? Number(input.slotStepMin) : 30,
    cancelLimitHours: n(input.cancelLimitHours, 0, 24 * 14),
    adminEmails: input.adminEmails
      .split(/[,\s]+/)
      .map((x) => x.trim())
      .filter((x) => /@/.test(x)),
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Ajustes guardados." };
}

export async function saveAgentAction(input: { id?: number; name: string; email: string; phone: string; color: string; active: boolean }): Promise<ActionResult> {
  await requireRole("admin");
  if (!input.name.trim()) return { ok: false, message: "El nombre es obligatorio." };
  const db = getDb();
  if (input.id) {
    db.prepare(`UPDATE agents SET name = ?, email = ?, phone = ?, color = ?, active = ? WHERE id = ?`).run(
      input.name.trim(),
      input.email.trim() || null,
      input.phone.trim() || null,
      input.color,
      input.active ? 1 : 0,
      input.id,
    );
  } else {
    db.prepare(`INSERT INTO agents (name, email, phone, color, active, sort) VALUES (?, ?, ?, ?, 1, 99)`).run(
      input.name.trim(),
      input.email.trim() || null,
      input.phone.trim() || null,
      input.color,
    );
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Gestor guardado." };
}

export async function disconnectGoogleAction(): Promise<ActionResult> {
  await requireRole("superadmin");
  disconnectGoogle();
  revalidatePath("/admin/configuracion");
  return { ok: true };
}

/* ------------------------------- Usuarios ------------------------------ */

export async function createUserAction(input: { email: string; name: string; password: string; role: Role }): Promise<ActionResult> {
  await requireRole("superadmin");
  try {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email.trim())) return { ok: false, message: "Correo no válido." };
    createUser(input);
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuario creado." };
  } catch (e) {
    const msg = e instanceof Error && /UNIQUE/.test(e.message) ? "Ya existe un usuario con ese correo." : undefined;
    return msg ? { ok: false, message: msg } : fail(e);
  }
}

export async function updateUserAction(id: number, input: { role?: Role; password?: string; name?: string }): Promise<ActionResult> {
  const s = await requireRole("superadmin");
  if (id === s.uid && input.role && input.role !== "superadmin") return { ok: false, message: "No puedes quitarte tu propio rol de superadmin." };
  try {
    updateUser(id, input);
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuario actualizado." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteUserAction(id: number): Promise<ActionResult> {
  const s = await requireRole("superadmin");
  if (id === s.uid) return { ok: false, message: "No puedes eliminar tu propio usuario." };
  deleteUser(id);
  revalidatePath("/admin/usuarios");
  return { ok: true };
}
