import { describe, it, expect, beforeAll, vi } from "vitest";
import fs from "node:fs";
import { getDb, saveSettings } from "@/lib/db";
import { getSlots, getAvailableDays } from "@/lib/availability";
import { createBooking, getBooking, getSecrets, BookingError, reschedule, setStatus } from "@/lib/bookings";
import { decrypt, encrypt, mask } from "@/lib/crypto";
import { validateService } from "@/lib/validation";
import { getService, taxYearOptions } from "@/lib/catalog";
import { buildIcs } from "@/lib/ics";
import { runReminders } from "@/lib/notify";

// Viernes 27 nov 2026, 5:00 p. m. hora de NJ.
const NOW = new Date("2026-11-27T22:00:00Z");

const contact = { first_name: "Ana", last_name: "Ruiz", email: "ana@example.com", phone: "+1 201 555 0100" };
const consulta = { ...contact, topic: "taxes", is_existing_client: "no", message: "Hola" };

beforeAll(() => {
  for (const f of [process.env.DATABASE_PATH!, `${process.env.DATABASE_PATH}-wal`, `${process.env.DATABASE_PATH}-shm`]) fs.rmSync(f, { force: true });
  getDb();
});

describe("disponibilidad", () => {
  it("respeta la anticipación mínima de 48 h y no abre fines de semana", () => {
    // Sábado 28 y domingo 29: cerrado. Lunes 30: 48 h después del viernes 5 p. m. → desde el domingo 5 p. m., así que el lunes abre completo.
    expect(getSlots({ serviceId: "consulta", date: "2026-11-28", now: NOW })).toHaveLength(0);
    expect(getSlots({ serviceId: "consulta", date: "2026-11-29", now: NOW })).toHaveLength(0);
    const monday = getSlots({ serviceId: "consulta", date: "2026-11-30", now: NOW }).map((s) => s.time);
    expect(monday[0]).toBe("09:00");
    // Almuerzo 12:00-13:00
    expect(monday).toContain("11:30");
    expect(monday).not.toContain("12:00");
    expect(monday).not.toContain("12:30");
    expect(monday).toContain("13:00");
    expect(monday.at(-1)).toBe("19:30");
  });

  it("una cita de 60 min no cruza el almuerzo ni el cierre", () => {
    const slots = getSlots({ serviceId: "tax_business", date: "2026-11-30", now: NOW }).map((s) => s.time);
    expect(slots).toContain("11:00");
    expect(slots).not.toContain("11:30");
    expect(slots.at(-1)).toBe("19:00");
  });

  it("convierte a UTC con la zona de NJ (9:00 ET = 14:00 UTC en invierno)", () => {
    const s = getSlots({ serviceId: "consulta", date: "2026-11-30", now: NOW })[0];
    expect(s.start).toBe("2026-11-30T14:00:00.000Z");
  });

  it("lista los días con cupo del mes", () => {
    const days = getAvailableDays({ serviceId: "consulta", month: "2026-12", now: NOW });
    expect(days).toContain("2026-12-01");
    expect(days).not.toContain("2026-12-05"); // sábado
  });
});

describe("citas", () => {
  it("crea una cita, bloquea el horario (con pausa) y evita la doble reserva", async () => {
    vi.setSystemTime(NOW);
    const b = await createBooking({ serviceId: "consulta", locale: "es", mode: "virtual", priorContact: false, date: "2026-12-01", time: "10:00", values: consulta, files: [], accepted: true });
    expect(b.status).toBe("confirmed");
    expect(b.agent_id).toBeNull();
    const slots = getSlots({ serviceId: "consulta", date: "2026-12-01", now: NOW }).map((s) => s.time);
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("10:30"); // pausa de 15 min tras la cita
    expect(slots).not.toContain("09:30");
    await expect(
      createBooking({ serviceId: "consulta", locale: "es", mode: "virtual", priorContact: false, date: "2026-12-01", time: "10:00", values: consulta, files: [], accepted: true }),
    ).rejects.toMatchObject({ code: "slot_taken" });
    vi.useRealTimers();
  });

  it("con capacidad 2 permite dos citas a la misma hora", async () => {
    vi.setSystemTime(NOW);
    saveSettings({ capacity: 2 });
    await createBooking({ serviceId: "consulta", locale: "es", mode: "virtual", priorContact: false, date: "2026-12-02", time: "10:00", values: consulta, files: [], accepted: true });
    await createBooking({ serviceId: "consulta", locale: "en", mode: "presencial", priorContact: false, date: "2026-12-02", time: "10:00", values: consulta, files: [], accepted: true });
    await expect(
      createBooking({ serviceId: "consulta", locale: "es", mode: "virtual", priorContact: false, date: "2026-12-02", time: "10:00", values: consulta, files: [], accepted: true }),
    ).rejects.toBeInstanceOf(BookingError);
    saveSettings({ capacity: 1 });
    vi.useRealTimers();
  });

  it("Tax exige confirmar contacto previo y cifra los datos sensibles", async () => {
    vi.setSystemTime(NOW);
    const values = {
      ...contact,
      tax_years: [String(NOW.getFullYear() - 1)],
      ssn_itin: "123-45-6789",
      date_of_birth: "1990-01-01",
      occupation: "Chef",
      address_street: "1 Main St",
      city: "Linden",
      state: "NJ",
      zip_code: "07036",
      is_dependent: "no",
      is_disabled: "no",
      marital_status: "single",
      refund_method: "direct_deposit",
      bank_routing_number: "021000021",
      bank_account_number: "000123456789",
      bank_account_type: "checking",
      has_health_insurance: "no",
      is_homeowner: "no",
      has_single_member_llc: "no",
      sent_tax_docs: "yes",
    };
    const file = { fieldKey: "taxpayer_id_file", filename: "id.pdf", mime: "application/pdf", data: Buffer.from("%PDF-1.4") };
    await expect(
      createBooking({ serviceId: "tax_personal", locale: "es", mode: "presencial", priorContact: false, date: "2026-12-03", time: "09:00", values, files: [file], accepted: true }),
    ).rejects.toMatchObject({ fields: { prior_contact: expect.any(String) } });
    const b = await createBooking({ serviceId: "tax_personal", locale: "es", mode: "presencial", priorContact: true, date: "2026-12-03", time: "09:00", values, files: [file], accepted: true });
    const row = getBooking(b.id)!;
    expect(row.answers).not.toContain("123-45-6789");
    expect(row.answers).not.toContain("000123456789");
    expect(row.secrets).toMatch(/^v1:/);
    expect(getSecrets(row)).toMatchObject({ ssn_itin: "123-45-6789", bank_account_number: "000123456789" });
    vi.useRealTimers();
  });

  it("reprogramar libera el horario anterior y reinicia recordatorios", async () => {
    vi.setSystemTime(NOW);
    const b = await createBooking({ serviceId: "consulta", locale: "es", mode: "virtual", priorContact: false, date: "2026-12-04", time: "15:00", values: consulta, files: [], accepted: true });
    getDb().prepare(`UPDATE bookings SET reminder_day_sent_at = 'x' WHERE id = ?`).run(b.id);
    reschedule(b.id, { date: "2026-12-04", time: "16:00", actor: "test" });
    const after = getBooking(b.id)!;
    expect(after.reminder_day_sent_at).toBeNull();
    const slots = getSlots({ serviceId: "consulta", date: "2026-12-04", now: NOW }).map((s) => s.time);
    expect(slots).toContain("15:00");
    expect(slots).not.toContain("16:00");
    vi.useRealTimers();
  });
});

describe("recordatorios", () => {
  it("envía 1 día antes y 1 hora antes, una sola vez", async () => {
    vi.setSystemTime(NOW);
    const b = await createBooking({ serviceId: "consulta", locale: "es", mode: "virtual", priorContact: false, date: "2026-12-07", time: "11:00", values: consulta, files: [], accepted: true });
    vi.useRealTimers();
    const start = Date.parse(getBooking(b.id)!.start_at);
    const dayBefore = new Date(start - 23.5 * 3_600_000);
    const r1 = await runReminders(dayBefore);
    expect(r1.day).toBeGreaterThanOrEqual(1);
    expect(getBooking(b.id)!.reminder_day_sent_at).not.toBeNull();
    const again = await runReminders(new Date(dayBefore.getTime() + 5 * 60_000));
    expect(again.day).toBe(0);
    const hourBefore = new Date(start - 55 * 60_000);
    const r2 = await runReminders(hourBefore);
    expect(r2.hour).toBeGreaterThanOrEqual(1);
    expect((await runReminders(hourBefore)).hour).toBe(0);
  });

  it("no envía recordatorios de citas canceladas", async () => {
    vi.setSystemTime(NOW);
    const b = await createBooking({ serviceId: "consulta", locale: "es", mode: "virtual", priorContact: false, date: "2026-12-08", time: "11:00", values: consulta, files: [], accepted: true });
    vi.useRealTimers();
    setStatus(b.id, "cancelled", "test");
    const start = Date.parse(getBooking(b.id)!.start_at);
    await runReminders(new Date(start - 30 * 60_000));
    expect(getBooking(b.id)!.reminder_hour_sent_at).toBeNull();
  });
});

describe("utilidades", () => {
  it("cifra y descifra", () => {
    const c = encrypt("987-65-4321");
    expect(c).not.toContain("987");
    expect(decrypt(c)).toBe("987-65-4321");
    expect(mask("987-65-4321")).toBe("•••• 4321");
  });

  it("valida campos condicionales del cónyuge", () => {
    const s = getService("tax_personal")!;
    const base = { marital_status: "married_joint" };
    const { errors } = validateService(s, base, "es");
    expect(errors.spouse_name).toBeDefined();
    const single = validateService(s, { marital_status: "single" }, "es");
    expect(single.errors.spouse_name).toBeUndefined();
  });

  it("calcula los últimos 5 años fiscales", () => {
    expect(taxYearOptions(new Date("2026-11-27")).map((o) => o.value)).toEqual(["2025", "2024", "2023", "2022", "2021"]);
  });

  it("genera un .ics válido", () => {
    const ics = buildIcs({ uid: "AA-TEST", title: "Cita", description: "Línea 1\nLínea 2", location: "Linden, NJ", start: "2026-12-01T14:00:00.000Z", end: "2026-12-01T14:30:00.000Z" });
    expect(ics).toContain("DTSTART:20261201T140000Z");
    expect(ics).toContain("DESCRIPTION:Línea 1\\nLínea 2");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
});
