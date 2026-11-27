import { fromZonedTime, formatInTimeZone, toZonedTime } from "date-fns-tz";
import type { Locale } from "./catalog";

export const BUSINESS_TZ = process.env.BUSINESS_TIMEZONE || "America/New_York";

/** "2026-12-03" + "09:30" en la zona del negocio → Date (UTC). */
export function zonedToUtc(date: string, time: string, tz = BUSINESS_TZ): Date {
  return fromZonedTime(`${date}T${time}:00`, tz);
}

export function utcToZoned(d: Date | string, tz = BUSINESS_TZ): Date {
  return toZonedTime(typeof d === "string" ? new Date(d) : d, tz);
}

export function fmt(d: Date | string, pattern: string, tz = BUSINESS_TZ): string {
  return formatInTimeZone(typeof d === "string" ? new Date(d) : d, tz, pattern);
}

/** Fecha local (YYYY-MM-DD) en la zona del negocio. */
export function localDate(d: Date | string, tz = BUSINESS_TZ): string {
  return fmt(d, "yyyy-MM-dd", tz);
}

export function localTime(d: Date | string, tz = BUSINESS_TZ): string {
  return fmt(d, "HH:mm", tz);
}

/** Día de la semana (0=domingo) de una fecha YYYY-MM-DD. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function hhmm(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const LOCALE_TAG: Record<Locale, string> = { es: "es-US", en: "en-US" };

/** "jueves, 3 de diciembre de 2026" / "Thursday, December 3, 2026" */
export function longDate(d: Date | string, locale: Locale, tz = BUSINESS_TZ): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { dateStyle: "full", timeZone: tz }).format(new Date(d));
}

export function shortDate(d: Date | string, locale: Locale, tz = BUSINESS_TZ): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { day: "numeric", month: "short", year: "numeric", timeZone: tz }).format(new Date(d));
}

/** "9:30 a. m." / "9:30 AM" */
export function clock(d: Date | string, locale: Locale, tz = BUSINESS_TZ): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(d));
}

export function clockFromHHMM(time: string, locale: Locale): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(d);
}

export function tzLabel(locale: Locale): string {
  return locale === "es" ? "hora del Este (NJ/NY)" : "Eastern Time (NJ/NY)";
}
