"use client";

import { bp } from "@/lib/paths";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { Plus, Trash2, Loader2, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import {
  addBlockAction,
  deleteBlockAction,
  disconnectGoogleAction,
  saveAgentAction,
  saveScheduleAction,
  saveSettingsAction,
  type ActionResult,
} from "@/app/admin/actions";
import type { AppSettings } from "@/lib/db";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

interface Props {
  isSuper: boolean;
  windows: { id: number; weekday: number; start_time: string; end_time: string }[];
  blocks: { id: number; from: string; to: string; reason: string }[];
  agents: { id: number; name: string; color: string; photo: string | null; active: boolean; email: string | null; phone: string | null }[];
  settings: AppSettings;
  google: { configured: boolean; connected: boolean; email: string | null; rootFolderId: string | null; sheetId: string | null; redirectUri: string; message: string | null };
  mail: { smtp: boolean; from: string; last: { ok: boolean; error: string | null; at: string } | null };
}

export function ConfigClient(p: Props) {
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      setFlash({ ok: r.ok, text: r.message ?? (r.ok ? "Guardado." : "Error") });
    });

  return (
    <div className="space-y-6">
      {flash && (
        <p className={clsx("rounded-2xl px-4 py-3 text-sm font-bold", flash.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600")}>{flash.text}</p>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Schedule windows={p.windows} run={run} pending={pending} />
        <Blocks blocks={p.blocks} run={run} pending={pending} />
      </div>
      <Agents agents={p.agents} run={run} pending={pending} />
      {p.isSuper && <SettingsCard settings={p.settings} run={run} pending={pending} />}
      {p.isSuper && <GoogleCard g={p.google} run={run} pending={pending} />}
      <MailCard mail={p.mail} />
    </div>
  );
}

type RunProps = { run: (fn: () => Promise<ActionResult>) => void; pending: boolean };

function Card({ title, children, id, sub }: { title: string; children: React.ReactNode; id?: string; sub?: string }) {
  return (
    <section id={id} className="rounded-2xl bg-white p-5 shadow-soft">
      <h2 className="font-display text-lg font-semibold text-brand-navy">{title}</h2>
      {sub && <p className="text-sm text-slate-500">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Schedule({ windows, run, pending }: { windows: Props["windows"] } & RunProps) {
  const [rows, setRows] = useState(windows.map((w) => ({ weekday: w.weekday, start_time: w.start_time, end_time: w.end_time })));
  const upd = (i: number, k: "start_time" | "end_time", v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <Card title="Horario de atención" sub="Agenda general de la oficina (hora del Este). Usa varios tramos por día para la hora de almuerzo.">
      <div className="space-y-3">
        {ORDER.map((wd) => {
          const list = rows.map((r, i) => ({ ...r, i })).filter((r) => r.weekday === wd);
          return (
            <div key={wd} className="flex flex-wrap items-start gap-3 border-b border-slate-50 pb-3">
              <p className="w-24 pt-2 text-sm font-bold text-slate-700">{DAYS[wd]}</p>
              <div className="flex-1 space-y-2">
                {list.length === 0 && <p className="pt-2 text-sm text-slate-400">Cerrado</p>}
                {list.map((r) => (
                  <div key={r.i} className="flex items-center gap-2">
                    <input type="time" className="input !w-32 !py-1.5" value={r.start_time} onChange={(e) => upd(r.i, "start_time", e.target.value)} />
                    <span className="text-slate-400">–</span>
                    <input type="time" className="input !w-32 !py-1.5" value={r.end_time} onChange={(e) => upd(r.i, "end_time", e.target.value)} />
                    <button onClick={() => setRows(rows.filter((_, j) => j !== r.i))} className="text-slate-400 hover:text-rose-500" aria-label="Quitar tramo">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setRows([...rows, { weekday: wd, start_time: "09:00", end_time: "17:00" }])} className="mt-1 text-xs font-bold text-teal-700 hover:underline">
                <Plus className="inline h-3.5 w-3.5" /> Tramo
              </button>
            </div>
          );
        })}
      </div>
      <button className="btn-blue mt-4 !py-2" disabled={pending} onClick={() => run(() => saveScheduleAction(rows))}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar horario
      </button>
    </Card>
  );
}

function Blocks({ blocks, run, pending }: { blocks: Props["blocks"] } & RunProps) {
  const [f, setF] = useState({ from: "", to: "", allDay: true, startTime: "12:00", endTime: "13:00", reason: "" });
  return (
    <Card title="Bloqueos y festivos" sub="Días u horas en que no se reciben citas (vacaciones, festivos, eventos).">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-500">
          Desde
          <input type="date" className="input mt-1 !py-1.5" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: f.to || e.target.value })} />
        </label>
        <label className="text-xs font-bold text-slate-500">
          Hasta
          <input type="date" className="input mt-1 !py-1.5" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 accent-brand-pink" checked={f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} /> Todo el día
        </label>
        {!f.allDay && (
          <>
            <label className="text-xs font-bold text-slate-500">
              Hora inicio
              <input type="time" className="input mt-1 !py-1.5" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
            </label>
            <label className="text-xs font-bold text-slate-500">
              Hora fin
              <input type="time" className="input mt-1 !py-1.5" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} />
            </label>
          </>
        )}
        <input className="input !py-1.5 sm:col-span-2" placeholder="Motivo (opcional)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
      </div>
      <button className="btn-blue mt-3 !py-2" disabled={pending || !f.from} onClick={() => run(() => addBlockAction(f))}>
        <Plus className="h-4 w-4" /> Agregar bloqueo
      </button>
      <ul className="mt-4 divide-y divide-slate-100">
        {blocks.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="flex-1">
              <b>{b.from}</b> → <b>{b.to}</b> {b.reason && <span className="text-slate-500">· {b.reason}</span>}
            </span>
            <button onClick={() => run(() => deleteBlockAction(b.id))} className="text-slate-400 hover:text-rose-500" aria-label="Eliminar bloqueo">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {blocks.length === 0 && <li className="py-2 text-sm text-slate-400">No hay bloqueos próximos.</li>}
      </ul>
    </Card>
  );
}

function Agents({ agents, run, pending }: { agents: Props["agents"] } & RunProps) {
  const [rows, setRows] = useState(agents.map((a) => ({ ...a, email: a.email ?? "", phone: a.phone ?? "" })));
  const [neu, setNeu] = useState({ name: "", email: "", phone: "", color: "#7B6CF6" });
  return (
    <Card title="Gestores" sub="Personas a las que se asignan las citas. El correo del gestor recibe aviso y queda invitado al evento de Google Calendar.">
      <div className="space-y-3">
        {rows.map((a, i) => (
          <div key={a.id} className="grid items-end gap-2 sm:grid-cols-[1.3fr,1.5fr,1fr,70px,90px,auto]">
            <input className="input !py-1.5" value={a.name} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />
            <input className="input !py-1.5" placeholder="correo@…" value={a.email} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, email: e.target.value } : r)))} />
            <input className="input !py-1.5" placeholder="Teléfono" value={a.phone} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, phone: e.target.value } : r)))} />
            <input type="color" className="h-10 w-full rounded-xl border border-slate-200" value={a.color} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, color: e.target.value } : r)))} />
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-brand-pink" checked={a.active} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, active: e.target.checked } : r)))} /> Activo
            </label>
            <button className="btn-ghost !py-2" disabled={pending} onClick={() => run(() => saveAgentAction(a))}>
              Guardar
            </button>
          </div>
        ))}
        <div className="grid items-end gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[1.3fr,1.5fr,1fr,70px,90px,auto]">
          <input className="input !py-1.5" placeholder="Nuevo gestor" value={neu.name} onChange={(e) => setNeu({ ...neu, name: e.target.value })} />
          <input className="input !py-1.5" placeholder="correo@…" value={neu.email} onChange={(e) => setNeu({ ...neu, email: e.target.value })} />
          <input className="input !py-1.5" placeholder="Teléfono" value={neu.phone} onChange={(e) => setNeu({ ...neu, phone: e.target.value })} />
          <input type="color" className="h-10 w-full rounded-xl border border-slate-200" value={neu.color} onChange={(e) => setNeu({ ...neu, color: e.target.value })} />
          <span />
          <button
            className="btn-blue !py-2"
            disabled={pending || !neu.name.trim()}
            onClick={() =>
              run(async () => {
                const r = await saveAgentAction({ ...neu, active: true });
                if (r.ok) window.location.reload();
                return r;
              })
            }
          >
            <Plus className="h-4 w-4" /> Agregar
          </button>
        </div>
      </div>
    </Card>
  );
}

function SettingsCard({ settings, run, pending }: { settings: AppSettings } & RunProps) {
  const [s, setS] = useState({
    bufferMin: settings.bufferMin,
    minNoticeHours: settings.minNoticeHours,
    maxDaysAhead: settings.maxDaysAhead,
    capacity: settings.capacity,
    slotStepMin: settings.slotStepMin,
    cancelLimitHours: settings.cancelLimitHours,
    adminEmails: settings.adminEmails.join(", "),
  });
  const num = (k: keyof typeof s, label: string, help: string) => (
    <label className="text-xs font-bold text-slate-500">
      {label}
      <input type="number" className="input mt-1 !py-1.5" value={s[k] as number} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} />
      <span className="mt-1 block font-normal text-slate-400">{help}</span>
    </label>
  );
  return (
    <Card title="Reglas de agendamiento" sub="Solo superadmin.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {num("minNoticeHours", "Anticipación mínima (horas)", "48 = dos días.")}
        {num("maxDaysAhead", "Reservar hasta (días)", "Cuántos días hacia adelante.")}
        {num("bufferMin", "Pausa entre citas (min)", "Tiempo libre después de cada cita.")}
        {num("capacity", "Citas a la misma hora", "1 = una cita a la vez; 2 si atienden ambas.")}
        {num("slotStepMin", "Intervalo de horarios (min)", "15, 20, 30, 45 o 60.")}
        {num("cancelLimitHours", "El cliente puede cambiar hasta (h antes)", "Luego debe llamar.")}
        <label className="text-xs font-bold text-slate-500 sm:col-span-2 lg:col-span-3">
          Correos que reciben aviso de cada cita nueva
          <input className="input mt-1 !py-1.5" value={s.adminEmails} onChange={(e) => setS({ ...s, adminEmails: e.target.value })} />
        </label>
      </div>
      <button className="btn-blue mt-4 !py-2" disabled={pending} onClick={() => run(() => saveSettingsAction(s))}>
        Guardar reglas
      </button>
    </Card>
  );
}

function GoogleCard({ g, run, pending }: { g: Props["google"] } & RunProps) {
  const ok = g.message?.startsWith("ok:");
  return (
    <Card id="google" title="Google (Calendar, Meet, Drive y Sheets)" sub="Cuenta del negocio que crea los eventos con Meet, las carpetas por cita y la hoja de cálculo.">
      {g.message && (
        <p className={clsx("mb-3 rounded-xl px-3 py-2 text-sm font-bold", ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600")}>
          {ok ? `Conectado con ${g.message.slice(3)}` : g.message}
        </p>
      )}
      {!g.configured ? (
        <p className="flex items-start gap-2 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el archivo .env del servidor. Sigue la guía GOOGLE_SETUP.md.
        </p>
      ) : g.connected ? (
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 font-bold text-emerald-700">
            <CheckCircle2 className="h-5 w-5" /> Conectado {g.email ? `con ${g.email}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {g.rootFolderId && (
              <a className="btn-ghost !py-2" target="_blank" rel="noreferrer" href={`https://drive.google.com/drive/folders/${g.rootFolderId}`}>
                <ExternalLink className="h-4 w-4" /> Carpeta de citas
              </a>
            )}
            {g.sheetId && (
              <a className="btn-ghost !py-2" target="_blank" rel="noreferrer" href={`https://docs.google.com/spreadsheets/d/${g.sheetId}`}>
                <ExternalLink className="h-4 w-4" /> Hoja de citas
              </a>
            )}
            <a className="btn-ghost !py-2" href={bp("/api/admin/google/connect")}>
              Reconectar
            </a>
            <button className="btn-ghost !py-2 text-rose-600" disabled={pending} onClick={() => confirm("¿Desconectar Google?") && run(() => disconnectGoogleAction())}>
              Desconectar
            </button>
          </div>
          {!g.rootFolderId && <p className="text-xs text-slate-500">La carpeta y la hoja se crean solas con la primera cita.</p>}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            URI de redirección para Google Cloud: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{g.redirectUri}</code>
          </p>
          <a className="btn-primary !py-2" href={bp("/api/admin/google/connect")}>
            Conectar cuenta de Google
          </a>
        </div>
      )}
    </Card>
  );
}

function MailCard({ mail }: { mail: Props["mail"] }) {
  return (
    <Card title="Correo de avisos" sub="Se configura en el archivo .env del servidor (SMTP).">
      <div className="space-y-1 text-sm">
        <p>
          Remitente: <b>{mail.from}</b>
        </p>
        <p className={mail.smtp ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>
          {mail.smtp ? "SMTP configurado" : "SMTP sin configurar: los correos solo se registran en el servidor."}
        </p>
        {mail.last && (
          <p className="text-slate-500">
            Último envío: {mail.last.at} · {mail.last.ok ? "OK" : `Error: ${mail.last.error}`}
          </p>
        )}
      </div>
    </Card>
  );
}
