import type { ListFilters } from "./bookings";
import { getSettings } from "./db";
import { addDays, localDate, zonedToUtc } from "./time";

export type SP = { q?: string; estado?: string; servicio?: string; gestor?: string; desde?: string; hasta?: string; periodo?: string; asignacion?: string };

export function filtersFrom(sp: SP): ListFilters & { unassigned: boolean } {
  const tz = getSettings().timezone;
  const today = localDate(new Date(), tz);
  const periodo = sp.periodo ?? "proximas";
  const f: ListFilters & { unassigned: boolean } = { q: sp.q || undefined, unassigned: sp.asignacion === "sin" };
  if (sp.estado) f.status = sp.estado;
  if (sp.servicio) f.serviceId = sp.servicio;
  if (sp.gestor) f.agentId = Number(sp.gestor);
  if (sp.desde) f.from = zonedToUtc(sp.desde, "00:00", tz).toISOString();
  else if (periodo === "proximas") f.from = new Date().toISOString();
  if (sp.hasta) f.to = zonedToUtc(addDays(sp.hasta, 1), "00:00", tz).toISOString();
  else if (periodo === "pasadas") f.to = new Date().toISOString();
  if (periodo === "pasadas" && !sp.desde) f.from = zonedToUtc(addDays(today, -365), "00:00", tz).toISOString();
  f.order = periodo === "pasadas" ? "desc" : "asc";
  return f;
}

