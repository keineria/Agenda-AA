import { getService } from "./catalog";
import { getAgent, listAgents } from "./availability";
import { STATUS_LABEL, type BookingRow } from "./bookings";
import { localDate, localTime } from "./time";

/** Datos de una cita listos para mostrar en el panel (serializables para componentes cliente). */
export interface BookingCardData {
  id: number;
  code: string;
  name: string;
  email: string;
  phone: string;
  serviceId: string;
  serviceName: string;
  serviceShort: string;
  category: string;
  color: string;
  mode: "virtual" | "presencial";
  status: string;
  statusLabel: string;
  statusColor: string;
  start: string;
  end: string;
  date: string;
  time: string;
  agentId: number | null;
  agentName: string | null;
  agentColor: string | null;
  agentPhoto: string | null;
  meetLink: string | null;
}

export function toCard(b: BookingRow): BookingCardData {
  const s = getService(b.service_id);
  const a = b.agent_id ? getAgent(b.agent_id) : undefined;
  return {
    id: b.id,
    code: b.code,
    name: `${b.first_name} ${b.last_name}`,
    email: b.email,
    phone: b.phone ?? "",
    serviceId: b.service_id,
    serviceName: s?.name.es ?? b.service_id,
    serviceShort: s?.short.es ?? b.service_id,
    category: s?.category ?? "",
    color: s?.color ?? "#7B6CF6",
    mode: b.mode,
    status: b.status,
    statusLabel: STATUS_LABEL[b.status].es,
    statusColor: STATUS_LABEL[b.status].color,
    start: b.start_at,
    end: b.end_at,
    date: localDate(b.start_at),
    time: localTime(b.start_at),
    agentId: b.agent_id,
    agentName: a?.name ?? null,
    agentColor: a?.color ?? null,
    agentPhoto: a?.photo ?? null,
    meetLink: b.meet_link,
  };
}

export function agentsLite() {
  return listAgents(true).map((a) => ({ id: a.id, name: a.name, color: a.color, photo: a.photo, active: !!a.active }));
}
