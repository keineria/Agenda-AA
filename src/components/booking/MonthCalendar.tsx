"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import type { Locale } from "@/lib/catalog";

interface Props {
  month: string; // YYYY-MM
  onMonth: (m: string) => void;
  available: Set<string>;
  selected: string | null;
  onSelect: (d: string) => void;
  locale: Locale;
  loading?: boolean;
  minMonth?: string;
  maxMonth?: string;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function MonthCalendar({ month, onMonth, available, selected, onSelect, locale, loading, minMonth, maxMonth }: Props) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = first.getUTCDay(); // 0 = domingo
  const tag = locale === "es" ? "es-US" : "en-US";
  const raw = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const title = raw.charAt(0).toUpperCase() + raw.slice(1);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(tag, { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2023, 0, 1 + i))),
  );
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  const canPrev = !minMonth || month > minMonth;
  const canNext = !maxMonth || month < maxMonth;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => canPrev && onMonth(shiftMonth(month, -1))}
          disabled={!canPrev}
          className="grid h-9 w-9 place-items-center rounded-full text-brand-ink hover:bg-slate-100 disabled:opacity-30"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-display text-base font-semibold">{title}</p>
        <button
          type="button"
          onClick={() => canNext && onMonth(shiftMonth(month, 1))}
          disabled={!canNext}
          className="grid h-9 w-9 place-items-center rounded-full text-brand-ink hover:bg-slate-100 disabled:opacity-30"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-brand-muted">
        {weekdays.map((w, i) => (
          <div key={i} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className={clsx("grid grid-cols-7 gap-1", loading && "animate-pulse opacity-60")}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const isAvail = available.has(d);
          const isSel = selected === d;
          return (
            <button
              type="button"
              key={d}
              disabled={!isAvail}
              onClick={() => onSelect(d)}
              className={clsx(
                "relative aspect-square rounded-full text-sm font-bold transition",
                isSel && "bg-brand-pink text-white shadow-pink",
                !isSel && isAvail && "text-brand-ink hover:bg-violet-50",
                !isAvail && "cursor-default text-slate-300",
              )}
            >
              {Number(d.slice(-2))}
              {isAvail && !isSel ? <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand-pink" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
