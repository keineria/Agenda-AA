import Link from "next/link";
import { CalendarDays, AlertTriangle, UserPlus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listBookings } from "@/lib/bookings";
import { SERVICES } from "@/lib/catalog";
import { getSettings } from "@/lib/db";
import { googleStatus } from "@/lib/google";
import { addDays, localDate, weekdayOf, zonedToUtc, fmt } from "@/lib/time";
import { toCard } from "@/lib/view";
import { PageHeader } from "@/components/admin/PageHeader";
import { Avatar, BookingMiniCard, DateChip, Donut, ServiceTag, fmt12 } from "@/components/admin/ui";

export default async function Dashboard() {
  const session = (await getSession())!;
  const tz = getSettings().timezone;
  const now = new Date();
  const today = localDate(now, tz);
  const weekStart = addDays(today, -((weekdayOf(today) + 6) % 7)); // lunes
  const iso = (d: string) => zonedToUtc(d, "00:00", tz).toISOString();

  const week = listBookings({ from: iso(weekStart), to: iso(addDays(weekStart, 7)) });
  const active = (s: string) => s === "confirmed" || s === "pending";
  const weekActive = week.filter((b) => active(b.status));
  const todayCount = weekActive.filter((b) => localDate(b.start_at, tz) === today).length;
  const lastWeek = listBookings({ from: iso(addDays(weekStart, -7)), to: iso(weekStart) });
  const lastDone = lastWeek.filter((b) => b.status === "completed").length;
  const lastClosed = lastWeek.filter((b) => ["completed", "no_show", "confirmed"].includes(b.status)).length;
  const attendance = lastClosed ? Math.round((lastDone / lastClosed) * 100) : 0;

  const upcoming = listBookings({ from: now.toISOString(), status: "confirmed,pending", limit: 8 }).map(toCard);
  const unassigned = listBookings({ from: now.toISOString(), status: "confirmed,pending", limit: 200 })
    .filter((b) => !b.agent_id)
    .slice(0, 8)
    .map(toCard);

  const month = listBookings({ from: iso(addDays(today, -30)), to: iso(addDays(today, 30)) }).filter((b) => b.status !== "cancelled");
  const byService = SERVICES.map((s) => ({ label: s.short.es, color: s.color, value: month.filter((b) => b.service_id === s.id).length }));
  const totalMonth = byService.reduce((a, b) => a + b.value, 0) || 1;
  const google = googleStatus();

  const hour = Number(fmt(now, "H", tz));
  const greet = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const first = session.name.split(" ")[0];

  return (
    <>
      <PageHeader title="Dashboard" />

      {!google.connected && session.role === "superadmin" && (
        <Link href="/admin/configuracion#google" className="mb-5 flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 ring-1 ring-amber-200">
          <AlertTriangle className="h-5 w-5" /> Google no está conectado: las citas no crean Meet ni carpetas en Drive. Conéctalo en Horarios y ajustes.
        </Link>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.6fr,1fr,1fr,1.3fr]">
        <div className="flex items-center gap-5 rounded-2xl bg-gradient-to-br from-sky-100 to-teal-50 p-5 ring-1 ring-sky-200">
          <div>
            <Avatar name={session.name} size={56} color="#0B2545" />
            <p className="mt-3 text-xs text-slate-500">{greet}</p>
            <p className="font-display text-lg font-semibold text-brand-navy">{first}</p>
          </div>
          <div className="border-l border-sky-200 pl-5">
            <p className="font-display text-4xl font-semibold text-brand-navy">{fmt(now, "d", tz)}</p>
            <p className="text-xs font-bold uppercase text-slate-500">{new Intl.DateTimeFormat("es-US", { month: "short", timeZone: tz }).format(now)}</p>
            <p className="mt-2 text-sm font-bold text-slate-600">{new Intl.DateTimeFormat("es-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(now)} ET</p>
          </div>
          <div className="ml-auto hidden flex-1 rounded-xl bg-white/80 p-3 text-sm sm:block">
            <p className="font-bold text-brand-navy">Hoy</p>
            <p className="font-display text-3xl font-semibold text-teal-600">{todayCount}</p>
            <p className="text-xs text-slate-500">{todayCount === 1 ? "cita activa" : "citas activas"}</p>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl bg-[#3E2F8F] p-5 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-4xl font-semibold">{weekActive.length}</p>
            <p className="text-sm text-white/80">Citas esta semana</p>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl bg-teal-600 p-5 text-white">
          <p className="text-sm font-bold">Asistencia la semana pasada</p>
          <div className="relative mx-auto mt-2 h-20 w-36 overflow-hidden">
            <svg viewBox="0 0 100 50" className="h-full w-full">
              <path d="M5 50 A45 45 0 0 1 95 50" stroke="rgba(255,255,255,.25)" strokeWidth="10" fill="none" />
              <path d="M5 50 A45 45 0 0 1 95 50" stroke="#FFC02E" strokeWidth="10" fill="none" strokeDasharray={`${(attendance / 100) * 141.4} 200`} />
            </svg>
            <p className="absolute inset-x-0 bottom-0 text-center font-display text-xl font-semibold">{attendance}%</p>
          </div>
          <p className="text-center text-xs text-white/80">citas completadas</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-brand-navy">Citas por servicio (±30 días)</p>
          <div className="mt-3 flex items-center gap-4">
            <Donut data={byService} />
            <ul className="grid flex-1 grid-cols-1 gap-1 text-xs">
              {byService.map((s) => (
                <li key={s.label} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 text-slate-600">{s.label}</span>
                  <span className="font-bold text-brand-navy">{Math.round((s.value / totalMonth) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="my-8 border-t border-slate-200" />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-brand-navy">Próximas citas</h2>
          <Link href="/admin/calendario" className="text-sm font-bold text-teal-700 hover:underline">
            Ver calendario
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-soft">No hay citas próximas.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {upcoming.map((b, i) => (
              <BookingMiniCard key={b.id} b={b} highlight={i === 0} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-brand-navy">Sin gestor asignado</h2>
          <Link href="/admin/citas?asignacion=sin" className="text-sm font-bold text-teal-700 hover:underline">
            Ver todas
          </Link>
        </div>
        {unassigned.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-soft">Todas las citas próximas tienen gestor. 🎉</p>
        ) : (
          <div className="grid gap-x-4 gap-y-8 pt-3 sm:grid-cols-2 xl:grid-cols-4">
            {unassigned.map((b) => (
              <Link key={b.id} href={`/admin/citas/${b.id}`} className="relative block rounded-2xl border border-slate-100 bg-white p-4 pt-6 shadow-soft hover:shadow-card">
                <span className="absolute -top-3 left-3 inline-flex items-center gap-1.5 rounded-t-lg rounded-br-lg bg-rose-500 px-2.5 py-1 text-[11px] font-extrabold text-white">
                  <UserPlus className="h-3.5 w-3.5" /> Asignar gestor
                </span>
                <DateChip date={b.date} />
                <p className="mt-3 font-display text-[15px] font-semibold text-brand-navy">{b.name}</p>
                <div className="mt-2">
                  <ServiceTag name={b.serviceShort} color={b.color} />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {b.mode === "virtual" ? "Virtual" : "Presencial"} · <b className="text-slate-700">{fmt12(b.time)}</b>
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
