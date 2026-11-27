import { bp } from "@/lib/paths";
import clsx from "clsx";
import { Video, Building2 } from "lucide-react";
import type { BookingCardData } from "@/lib/view";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function Avatar({ name, photo, color, size = 32 }: { name: string; photo?: string | null; color?: string | null; size?: number }) {
  if (photo)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={bp(photo)} alt={name} title={name} width={size} height={size} className="rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />;
  return (
    <span
      title={name}
      className="grid place-items-center rounded-full font-bold text-white ring-2 ring-white"
      style={{ width: size, height: size, background: color || "#7B6CF6", fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <span className="chip" style={{ background: `${color}1F`, color }}>
      {label}
    </span>
  );
}

export function ServiceTag({ name, color }: { name: string; color: string }) {
  return (
    <span className="chip" style={{ background: `${color}22`, color }}>
      {name}
    </span>
  );
}

export function ModeIcon({ mode, className }: { mode: string; className?: string }) {
  const Icon = mode === "virtual" ? Video : Building2;
  return <Icon className={clsx("h-4 w-4", className)} />;
}

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
export function DateChip({ date, active }: { date: string; active?: boolean }) {
  const [, m, d] = date.split("-");
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold",
        active ? "border-teal-700 bg-teal-700 text-white" : "border-teal-600/40 text-teal-700",
      )}
    >
      {Number(d)} <span className="opacity-40">|</span> {MONTHS[Number(m) - 1]}
    </span>
  );
}

export function fmt12(time: string) {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "p. m." : "a. m.";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function BookingMiniCard({ b, highlight }: { b: BookingCardData; highlight?: boolean }) {
  return (
    <a
      href={bp(`/admin/citas/${b.id}`)}
      className={clsx(
        "block rounded-2xl border bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card",
        highlight ? "border-teal-500 ring-2 ring-teal-500/20" : "border-slate-100",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <DateChip date={b.date} active={highlight} />
        {b.agentName ? <Avatar name={b.agentName} photo={b.agentPhoto} color={b.agentColor} size={28} /> : <span className="chip bg-amber-50 text-amber-600">Sin asignar</span>}
      </div>
      <p className="mt-3 line-clamp-2 font-display text-[15px] font-semibold leading-snug text-brand-navy">{b.name}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ServiceTag name={b.serviceShort} color={b.color} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <ModeIcon mode={b.mode} />
        </span>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">{b.mode === "virtual" ? "Virtual" : "Presencial"}</p>
          <p className="font-bold text-slate-700">{fmt12(b.time)}</p>
        </div>
        <span className="ml-auto">
          <StatusChip label={b.statusLabel} color={b.statusColor} />
        </span>
      </div>
    </a>
  );
}

/** Dona simple en SVG para "Citas por servicio". */
export function Donut({ data, size = 92 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = 15.915;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" role="img" aria-label="Citas por servicio">
      <circle cx="21" cy="21" r={r} fill="none" stroke="#EEF2F7" strokeWidth="7" />
      {data
        .filter((d) => d.value > 0)
        .map((d) => {
          const pct = (d.value / total) * 100;
          const el = (
            <circle
              key={d.label}
              cx="21"
              cy="21"
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth="7"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={25 - acc}
            />
          );
          acc += pct;
          return el;
        })}
    </svg>
  );
}
