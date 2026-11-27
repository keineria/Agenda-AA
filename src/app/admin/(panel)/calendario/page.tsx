import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listBookings } from "@/lib/bookings";
import { getSettings } from "@/lib/db";
import { addDays, localDate, minutes, weekdayOf, zonedToUtc } from "@/lib/time";
import { toCard, type BookingCardData } from "@/lib/view";
import { PageHeader } from "@/components/admin/PageHeader";
import { ModeIcon, fmt12 } from "@/components/admin/ui";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const START_H = 8;
const END_H = 21;
const PX_PER_MIN = 1.7;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ vista?: string; fecha?: string; estado?: string }> }) {
  const sp = await searchParams;
  const tz = getSettings().timezone;
  const today = localDate(new Date(), tz);
  const view = sp.vista === "semana" ? "semana" : "mes";
  const anchor = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : today;
  const showCancelled = sp.estado === "todas";

  let from: string;
  let to: string;
  if (view === "mes") {
    const first = `${anchor.slice(0, 7)}-01`;
    from = addDays(first, -weekdayOf(first));
    const [y, m] = anchor.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    to = addDays(last, 7 - weekdayOf(last));
  } else {
    from = addDays(anchor, -((weekdayOf(anchor) + 6) % 7));
    to = addDays(from, 7);
  }
  const bookings = listBookings({ from: zonedToUtc(from, "00:00", tz).toISOString(), to: zonedToUtc(to, "00:00", tz).toISOString() })
    .filter((b) => showCancelled || b.status !== "cancelled")
    .map(toCard);
  const byDay = new Map<string, BookingCardData[]>();
  for (const b of bookings) byDay.set(b.date, [...(byDay.get(b.date) ?? []), b]);

  const prev = view === "mes" ? shiftMonth(anchor, -1) : addDays(anchor, -7);
  const next = view === "mes" ? shiftMonth(anchor, 1) : addDays(anchor, 7);
  const title =
    view === "mes"
      ? cap(new Intl.DateTimeFormat("es-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${anchor}T12:00:00Z`)))
      : `${short(from)} – ${short(addDays(from, 6))}`;
  const q = (o: Record<string, string>) => {
    const p = new URLSearchParams({ vista: view, fecha: anchor, ...(showCancelled ? { estado: "todas" } : {}), ...o });
    return `/admin/calendario?${p}`;
  };

  return (
    <>
      <PageHeader title="Calendario" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-soft">
          <Link href={q({ fecha: prev })} className="grid h-8 w-8 place-items-center rounded-full hover:bg-slate-100" aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link href={q({ fecha: today })} className="rounded-full px-3 py-1 text-sm font-bold hover:bg-slate-100">
            Hoy
          </Link>
          <Link href={q({ fecha: next })} className="grid h-8 w-8 place-items-center rounded-full hover:bg-slate-100" aria-label="Siguiente">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <h2 className="font-display text-xl font-semibold text-brand-navy">{title}</h2>
        <div className="ml-auto flex items-center gap-2">
          <Link href={q({ estado: showCancelled ? "" : "todas" })} className="text-xs font-bold text-slate-500 hover:text-brand-navy">
            {showCancelled ? "Ocultar canceladas" : "Mostrar canceladas"}
          </Link>
          <div className="flex rounded-full bg-white p-1 shadow-soft">
            {(["mes", "semana"] as const).map((v) => (
              <Link key={v} href={q({ vista: v })} className={clsx("rounded-full px-4 py-1.5 text-sm font-bold capitalize", view === v ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
                {v}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {view === "mes" ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-bold uppercase text-slate-500">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) }, (_, i) => addDays(from, i)).map((d) => {
              const list = byDay.get(d) ?? [];
              const out = d.slice(0, 7) !== anchor.slice(0, 7);
              return (
                <div key={d} className={clsx("min-h-[112px] border-b border-r border-slate-100 p-1.5", out && "bg-slate-50/70")}>
                  <Link
                    href={`/admin/calendario?vista=semana&fecha=${d}`}
                    className={clsx(
                      "mb-1 inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold",
                      d === today ? "bg-brand-pink text-white" : out ? "text-slate-300" : "text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {Number(d.slice(-2))}
                  </Link>
                  <div className="space-y-1">
                    {list.slice(0, 3).map((b) => (
                      <Link
                        key={b.id}
                        href={`/admin/citas/${b.id}`}
                        className={clsx("flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-bold", b.status === "cancelled" && "line-through opacity-50")}
                        style={{ background: `${b.color}1F`, color: b.color }}
                        title={`${fmt12(b.time)} · ${b.name} · ${b.serviceName}`}
                      >
                        <span className="shrink-0">{b.time}</span>
                        <span className="truncate text-slate-700">{b.name}</span>
                      </Link>
                    ))}
                    {list.length > 3 && (
                      <Link href={`/admin/calendario?vista=semana&fecha=${d}`} className="block px-1.5 text-[11px] font-bold text-slate-500">
                        +{list.length - 3} más
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-soft">
          <div className="grid min-w-[760px]" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
            <div className="border-b border-slate-100" />
            {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => (
              <div key={d} className={clsx("border-b border-l border-slate-100 py-2 text-center", d === today && "bg-pink-50")}>
                <p className="text-xs font-bold uppercase text-slate-500">{DAY_NAMES[weekdayOf(d)]}</p>
                <p className={clsx("font-display text-lg font-semibold", d === today ? "text-brand-pink" : "text-brand-navy")}>{Number(d.slice(-2))}</p>
              </div>
            ))}
            <div className="relative" style={{ height: (END_H - START_H) * 60 * PX_PER_MIN }}>
              {Array.from({ length: END_H - START_H }, (_, i) => (
                <span key={i} className="absolute right-2 -translate-y-2 text-[10px] font-bold text-slate-400" style={{ top: i * 60 * PX_PER_MIN }}>
                  {fmt12(`${String(START_H + i).padStart(2, "0")}:00`).replace(":00", "")}
                </span>
              ))}
            </div>
            {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => (
              <div key={d} className="relative border-l border-slate-100" style={{ height: (END_H - START_H) * 60 * PX_PER_MIN }}>
                {Array.from({ length: END_H - START_H }, (_, h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: h * 60 * PX_PER_MIN }} />
                ))}
                {layoutDay(byDay.get(d) ?? []).map(({ b, col, cols }) => {
                  const top = (minutes(b.time) - START_H * 60) * PX_PER_MIN;
                  const dur = (Date.parse(b.end) - Date.parse(b.start)) / 60_000;
                  return (
                    <Link
                      key={b.id}
                      href={`/admin/citas/${b.id}`}
                      className={clsx("absolute overflow-hidden rounded-lg border-l-4 bg-white px-1.5 py-1 text-[11px] shadow-soft hover:z-10 hover:shadow-card", b.status === "cancelled" && "opacity-50")}
                      style={{
                        top: Math.max(0, top),
                        height: Math.max(22, dur * PX_PER_MIN - 2),
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        borderColor: b.color,
                        background: `${b.color}14`,
                      }}
                      title={`${b.name} · ${b.serviceName}`}
                    >
                      <p className="flex items-center gap-1 truncate font-bold leading-tight text-slate-700">
                        <ModeIcon mode={b.mode} className="h-3 w-3 shrink-0" /> {fmt12(b.time)}
                      </p>
                      <p className="truncate font-bold leading-tight" style={{ color: b.color }}>
                        {b.name}
                      </p>
                      <p className="truncate text-slate-500">{b.agentName ?? "Sin asignar"}</p>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** Reparte en columnas las citas que se cruzan (capacidad > 1). */
function layoutDay(list: BookingCardData[]) {
  const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
  const out: { b: BookingCardData; col: number; cols: number }[] = [];
  let group: { b: BookingCardData; col: number }[] = [];
  let groupEnd = 0;
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    for (const g of group) out.push({ ...g, cols });
    group = [];
  };
  for (const b of sorted) {
    const s = Date.parse(b.start);
    if (group.length && s >= groupEnd) flush();
    const used = new Set(group.filter((g) => Date.parse(g.b.end) > s).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ b, col });
    groupEnd = Math.max(groupEnd, Date.parse(b.end));
  }
  flush();
  return out;
}

function shiftMonth(date: string, delta: number) {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10);
}

function short(d: string) {
  return new Intl.DateTimeFormat("es-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
