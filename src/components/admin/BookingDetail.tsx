"use client";

import { BASE, bp } from "@/lib/paths";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowLeft,
  CalendarClock,
  Video,
  FolderOpen,
  Send,
  RefreshCw,
  Eye,
  Pencil,
  Check,
  X,
  FileText,
  StickyNote,
  History,
  Loader2,
  Mail,
  Phone,
  CloudOff,
} from "lucide-react";
import type { BookingCardData } from "@/lib/view";
import {
  addNoteAction,
  assignAction,
  changeStatusAction,
  rescheduleAction,
  resendAction,
  revealSecretsAction,
  syncAction,
  updateDetailsAction,
  type ActionResult,
} from "@/app/admin/actions";
import { Avatar, ServiceTag, StatusChip, fmt12 } from "./ui";

export interface AnswerGroup {
  title: string;
  items: { key: string; label: string; value: string; sensitive: boolean; type: string; raw?: string }[];
}

interface Props {
  canEdit: boolean;
  booking: BookingCardData;
  extra: {
    locale: string;
    token: string;
    driveUrl: string | null;
    calendarEventId: string | null;
    createdAt: string;
    firstName: string;
    lastName: string;
    remindersSent: { day: string | null; hour: string | null };
    durationMin: number;
  };
  groups: AnswerGroup[];
  files: { id: number; name: string; field: string; url: string; inDrive: boolean }[];
  events: { id: number; type: string; detail: string | null; actor: string | null; at: string }[];
  agents: { id: number; name: string; color: string; photo: string | null; active: boolean }[];
  googleConnected: boolean;
}

const EVENT_LABEL: Record<string, string> = {
  created: "Cita creada",
  status: "Estado",
  rescheduled: "Reprogramada",
  edited: "Datos editados",
  assigned: "Gestor asignado",
  note: "Nota",
  mail: "Correo enviado",
  mail_error: "Error de correo",
  calendar: "Google Calendar",
  drive_folder: "Carpeta en Drive",
  google_error: "Error con Google",
  secrets_viewed: "Datos sensibles vistos",
};

const NOTICES = [
  ["confirmed", "Confirmación"],
  ["reminder_day", "Recordatorio 1 día antes"],
  ["reminder_hour", "Recordatorio 1 hora antes"],
  ["rescheduled", "Cambio de fecha"],
  ["cancelled", "Cancelación"],
] as const;

export function BookingDetail({ canEdit, booking: b, extra, groups, files, events, agents, googleConnected }: Props) {
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [panel, setPanel] = useState<null | "reschedule" | "edit">(null);
  const [secrets, setSecrets] = useState<Record<string, string> | null>(null);
  const [notice, setNotice] = useState<string>("confirmed");
  const [note, setNote] = useState("");

  const run = (fn: () => Promise<ActionResult>, okText?: string) =>
    start(async () => {
      const r = await fn();
      setFlash({ ok: r.ok, text: r.message ?? (r.ok ? okText ?? "Listo." : "No se pudo completar.") });
      if (r.ok) setPanel(null);
    });

  const day = cap(new Intl.DateTimeFormat("es-US", { dateStyle: "full", timeZone: "America/New_York" }).format(new Date(b.start)));
  const active = b.status === "confirmed" || b.status === "pending";
  const notes = events.filter((e) => e.type === "note");
  const history = events.filter((e) => e.type !== "note");

  return (
    <div>
      <Link href="/admin/citas" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-brand-navy">
        <ArrowLeft className="h-4 w-4" /> Citas
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold text-brand-navy sm:text-[28px]">{b.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip label={b.statusLabel} color={b.statusColor} />
            <ServiceTag name={b.serviceName} color={b.color} />
            <span className="chip bg-slate-100 text-slate-600">{b.code}</span>
            <span className="chip bg-slate-100 text-slate-600">{extra.locale.toUpperCase()}</span>
          </div>
        </div>
        {canEdit && active && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary !py-2" onClick={() => setPanel(panel === "reschedule" ? null : "reschedule")}>
              <CalendarClock className="h-4 w-4" /> Reprogramar
            </button>
            <button className="btn-ghost !py-2" onClick={() => setPanel(panel === "edit" ? null : "edit")}>
              <Pencil className="h-4 w-4" /> Editar datos
            </button>
          </div>
        )}
      </div>

      {flash && (
        <div className={clsx("mb-4 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold", flash.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600")}>
          {flash.text}
          <button onClick={() => setFlash(null)} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {panel === "reschedule" && <ReschedulePanel b={b} onRun={run} pending={pending} onClose={() => setPanel(null)} />}
      {panel === "edit" && <EditPanel b={b} extra={extra} groups={groups} onRun={run} pending={pending} onClose={() => setPanel(null)} />}

      <div className="grid gap-6 xl:grid-cols-[1fr,360px]">
        <div className="space-y-6">
          {/* Cita */}
          <section className="rounded-2xl bg-white p-5 shadow-soft">
            <div className="grid gap-5 sm:grid-cols-2">
              <Info label="Fecha" value={day} />
              <Info label="Hora" value={`${fmt12(b.time)} (ET) · ${extra.durationMin} min`} />
              <Info label="Modalidad" value={b.mode === "virtual" ? "Virtual · Google Meet" : "Presencial · Oficina Linden, NJ"} />
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Gestor asignado</p>
                {canEdit ? (
                  <select
                    className="input mt-1 !py-2"
                    value={b.agentId ?? ""}
                    disabled={pending}
                    onChange={(e) => run(() => assignAction(b.id, e.target.value ? Number(e.target.value) : null), "Gestor asignado.")}
                  >
                    <option value="">Sin asignar</option>
                    {agents
                      .filter((a) => a.active || a.id === b.agentId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <p className="mt-1 flex items-center gap-2 font-bold text-slate-700">
                    {b.agentName ? <Avatar name={b.agentName} photo={b.agentPhoto} color={b.agentColor} size={24} /> : null}
                    {b.agentName ?? "Sin asignar"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Contacto</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Mail className="h-4 w-4 text-slate-400" /> <a href={`mailto:${b.email}`} className="hover:underline">{b.email}</a>
                </p>
                {b.phone && (
                  <p className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Phone className="h-4 w-4 text-slate-400" /> <a href={`tel:${b.phone}`} className="hover:underline">{b.phone}</a>
                    <a href={`https://wa.me/${b.phone.replace(/\D/g, "").replace(/^(\d{10})$/, "1$1")}`} target="_blank" rel="noreferrer" className="chip bg-emerald-50 text-emerald-600">
                      WhatsApp
                    </a>
                  </p>
                )}
              </div>
              <Info label="Creada" value={`${extra.createdAt} (ET)`} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {b.meetLink && b.mode === "virtual" && (
                <a href={b.meetLink} target="_blank" rel="noreferrer" className="btn-blue !py-2">
                  <Video className="h-4 w-4" /> Abrir Meet
                </a>
              )}
              {extra.driveUrl && (
                <a href={extra.driveUrl} target="_blank" rel="noreferrer" className="btn-ghost !py-2">
                  <FolderOpen className="h-4 w-4" /> Carpeta en Drive
                </a>
              )}
              <a href={bp(`/${extra.locale}/cita/${extra.token}`)} target="_blank" rel="noreferrer" className="btn-ghost !py-2">
                Vista del cliente
              </a>
              {!googleConnected && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600">
                  <CloudOff className="h-4 w-4" /> Google sin conectar
                </span>
              )}
            </div>
          </section>

          {/* Acciones */}
          {canEdit && (
            <section className="rounded-2xl bg-white p-5 shadow-soft">
              <h2 className="font-display text-lg font-semibold text-brand-navy">Gestionar</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {b.status !== "confirmed" && b.status !== "cancelled" && (
                  <button className="btn-ghost !py-2" disabled={pending} onClick={() => run(() => changeStatusAction(b.id, "confirmed", true), "Cita confirmada y cliente notificado.")}>
                    <Check className="h-4 w-4 text-teal-600" /> Confirmar
                  </button>
                )}
                {b.status === "cancelled" && (
                  <button className="btn-ghost !py-2" disabled={pending} onClick={() => run(() => changeStatusAction(b.id, "confirmed", true), "Cita reactivada.")}>
                    <RefreshCw className="h-4 w-4" /> Reactivar
                  </button>
                )}
                {active && (
                  <>
                    <button className="btn-ghost !py-2" disabled={pending} onClick={() => run(() => changeStatusAction(b.id, "completed", false), "Marcada como completada.")}>
                      <Check className="h-4 w-4 text-indigo-500" /> Completada
                    </button>
                    <button className="btn-ghost !py-2" disabled={pending} onClick={() => run(() => changeStatusAction(b.id, "no_show", false), "Marcada como no asistió.")}>
                      No asistió
                    </button>
                    <button
                      className="btn-ghost !py-2 text-rose-600"
                      disabled={pending}
                      onClick={() => {
                        if (confirm("¿Cancelar la cita? Se avisará al cliente por correo.")) run(() => changeStatusAction(b.id, "cancelled", true), "Cita cancelada y cliente notificado.");
                      }}
                    >
                      <X className="h-4 w-4" /> Cancelar
                    </button>
                  </>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
                <label className="text-xs font-bold text-slate-500">
                  Reenviar aviso al cliente
                  <select className="input mt-1 !py-2" value={notice} onChange={(e) => setNotice(e.target.value)}>
                    {NOTICES.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn-blue !py-2.5" disabled={pending} onClick={() => run(() => resendAction(b.id, notice as (typeof NOTICES)[number][0]))}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
                </button>
                <button className="btn-ghost !py-2.5" disabled={pending || !googleConnected} onClick={() => run(() => syncAction(b.id))} title="Vuelve a crear o actualizar el evento, la carpeta y la fila en Sheets">
                  <RefreshCw className="h-4 w-4" /> Sincronizar con Google
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Recordatorios automáticos: 1 día antes {extra.remindersSent.day ? "✓ enviado" : "pendiente"} · 1 hora antes {extra.remindersSent.hour ? "✓ enviado" : "pendiente"}
              </p>
            </section>
          )}

          {/* Respuestas */}
          {groups.map((g) => (
            <section key={g.title} className="rounded-2xl bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-brand-navy">{g.title}</h2>
                {canEdit && g.items.some((i) => i.sensitive) && !secrets && (
                  <button
                    className="btn-ghost !py-1.5 text-xs"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await revealSecretsAction(b.id);
                        if (r.ok) setSecrets(r.data as Record<string, string>);
                      })
                    }
                  >
                    <Eye className="h-4 w-4" /> Ver datos sensibles
                  </button>
                )}
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {g.items.map((i) => (
                  <div key={i.key} className="border-b border-slate-50 pb-2">
                    <dt className="text-xs text-slate-500">{i.label}</dt>
                    <dd className={clsx("text-sm font-bold text-slate-800", i.sensitive && "font-mono")}>{i.sensitive && secrets?.[i.key] ? secrets[i.key] : i.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          {/* Archivos */}
          <section className="rounded-2xl bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-semibold text-brand-navy">Archivos subidos</h2>
            {files.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">El cliente no subió archivos.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 py-2 text-sm">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 truncate font-bold text-brand-navy hover:underline">
                      {f.name}
                    </a>
                    <span className="text-xs text-slate-400">{f.inDrive ? "Drive" : "Servidor (pendiente de Drive)"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Notas e historial */}
        <aside className="space-y-6">
          <section className="rounded-2xl bg-white p-5 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-brand-navy">
              <StickyNote className="h-5 w-5 text-brand-gold" /> Notas internas
            </h2>
            <textarea className="input mt-3" rows={3} placeholder="Escribe una nota para el equipo…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button
              className="btn-blue mt-2 !py-2"
              disabled={pending || !note.trim()}
              onClick={() =>
                start(async () => {
                  const r = await addNoteAction(b.id, note);
                  if (r.ok) setNote("");
                  else setFlash({ ok: false, text: r.message ?? "Error" });
                })
              }
            >
              Agregar nota
            </button>
            <ul className="mt-4 space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-amber-50/70 p-3 text-sm">
                  <p className="whitespace-pre-wrap text-slate-700">{n.detail}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {n.actor} · {n.at}
                  </p>
                </li>
              ))}
              {notes.length === 0 && <li className="text-sm text-slate-400">Sin notas todavía.</li>}
            </ul>
          </section>
          <section className="rounded-2xl bg-white p-5 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-brand-navy">
              <History className="h-5 w-5 text-slate-400" /> Historial
            </h2>
            <ol className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
              {history.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span className={clsx("absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full", /error/.test(e.type) ? "bg-rose-500" : "bg-teal-500")} />
                  <p className="font-bold text-slate-700">{EVENT_LABEL[e.type] ?? e.type}</p>
                  {e.detail && <p className="whitespace-pre-wrap break-words text-xs text-slate-500">{e.detail}</p>}
                  <p className="text-[11px] text-slate-400">
                    {e.actor} · {e.at}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 font-bold text-slate-700">{value}</p>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ReschedulePanel({ b, onRun, pending, onClose }: { b: BookingCardData; onRun: (fn: () => Promise<ActionResult>, ok?: string) => void; pending: boolean; onClose: () => void }) {
  const [date, setDate] = useState(b.date);
  const [time, setTime] = useState(b.time);
  const [mode, setMode] = useState(b.mode);
  const [force, setForce] = useState(false);
  const [notify, setNotify] = useState(true);
  const [slots, setSlots] = useState<string[] | null>(null);

  useEffect(() => {
    setSlots(null);
    fetch(`${BASE}/api/admin/slots?booking=${b.id}&date=${date}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []));
  }, [b.id, date]);

  return (
    <section className="mb-6 rounded-2xl bg-white p-5 shadow-card ring-2 ring-brand-pink/30">
      <h2 className="font-display text-lg font-semibold text-brand-navy">Reprogramar cita</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <label className="text-xs font-bold text-slate-500">
          Fecha
          <input type="date" className="input mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-xs font-bold text-slate-500">
          Modalidad
          <select className="input mt-1" value={mode} onChange={(e) => setMode(e.target.value as "virtual" | "presencial")}>
            <option value="virtual">Virtual (Meet)</option>
            <option value="presencial">Presencial</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-500">
          Hora {force ? "(libre)" : ""}
          {force ? (
            <input type="time" className="input mt-1" value={time} onChange={(e) => setTime(e.target.value)} step={300} />
          ) : (
            <select className="input mt-1" value={time} onChange={(e) => setTime(e.target.value)}>
              {!slots ? <option>Cargando…</option> : slots.length === 0 ? <option value="">Sin horarios libres</option> : null}
              {slots?.map((s) => (
                <option key={s} value={s}>
                  {fmt12(s)}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="h-4 w-4 accent-brand-pink" /> Agendar fuera del horario (forzar)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-brand-pink" /> Avisar al cliente por correo
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          className="btn-primary !py-2"
          disabled={pending || !time || (!force && !slots?.includes(time))}
          onClick={() => onRun(() => rescheduleAction(b.id, { date, time, mode, force, notify }), "Cita reprogramada.")}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
        </button>
        <button className="btn-ghost !py-2" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </section>
  );
}

const EDITABLE_TYPES = new Set(["text", "textarea", "date", "number", "email", "tel"]);

function EditPanel({
  b,
  extra,
  groups,
  onRun,
  pending,
  onClose,
}: {
  b: BookingCardData;
  extra: Props["extra"];
  groups: AnswerGroup[];
  onRun: (fn: () => Promise<ActionResult>, ok?: string) => void;
  pending: boolean;
  onClose: () => void;
}) {
  const [c, setC] = useState({ first_name: extra.firstName, last_name: extra.lastName, email: b.email, phone: b.phone });
  const editable = groups.flatMap((g) => g.items).filter((i) => !i.sensitive && EDITABLE_TYPES.has(i.type));
  const [answers, setAnswers] = useState<Record<string, string>>(Object.fromEntries(editable.map((i) => [i.key, i.raw ?? ""])));
  return (
    <section className="mb-6 rounded-2xl bg-white p-5 shadow-card ring-2 ring-sky-300/40">
      <h2 className="font-display text-lg font-semibold text-brand-navy">Editar datos</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["first_name", "Nombre"],
            ["last_name", "Apellidos"],
            ["email", "Correo"],
            ["phone", "Teléfono"],
          ] as const
        ).map(([k, l]) => (
          <label key={k} className="text-xs font-bold text-slate-500">
            {l}
            <input className="input mt-1" value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      {editable.length > 0 && (
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {editable.map((i) => (
            <label key={i.key} className="text-xs font-bold text-slate-500">
              {i.label}
              <input
                type={i.type === "date" ? "date" : "text"}
                className="input mt-1"
                value={answers[i.key] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [i.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button className="btn-primary !py-2" disabled={pending} onClick={() => onRun(() => updateDetailsAction(b.id, { ...c, answers }), "Datos actualizados.")}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
        </button>
        <button className="btn-ghost !py-2" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
