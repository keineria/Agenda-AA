"use client";

import { BASE, bp } from "@/lib/paths";

import { useEffect, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { CalendarDays, Clock, Video, Building2, Download, Loader2, X, RefreshCw } from "lucide-react";
import type { Locale } from "@/lib/catalog";
import { dict } from "@/lib/i18n";
import { MonthCalendar } from "./MonthCalendar";

interface BookingView {
  token: string;
  code: string;
  serviceId: string;
  serviceName: string;
  durationMin: number;
  start: string;
  mode: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  meetLink: string | null;
  canChange: boolean;
  googleCalendarUrl: string;
  firstName: string;
}

const TZ = "America/New_York";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ManageBooking({
  locale,
  booking,
  todayMonth,
  maxMonth,
  cancelLimitHours,
}: {
  locale: Locale;
  booking: BookingView | null;
  todayMonth: string;
  maxMonth: string;
  cancelLimitHours: number;
}) {
  const t = dict(locale);
  const tag = locale === "es" ? "es-US" : "en-US";
  const [view, setView] = useState<"main" | "cancel" | "reschedule">("main");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [month, setMonth] = useState(todayMonth);
  const [days, setDays] = useState<Set<string>>(new Set());
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ time: string; start: string }[]>([]);
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    if (view !== "reschedule" || !booking) return;
    fetch(`${BASE}/api/availability?service=${booking.serviceId}&month=${month}`)
      .then((r) => r.json())
      .then((d) => setDays(new Set(d.days ?? [])));
  }, [view, month, booking]);

  useEffect(() => {
    if (!date || !booking) return;
    fetch(`${BASE}/api/availability?service=${booking.serviceId}&date=${date}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []));
  }, [date, booking]);

  const fmtTime = (iso: string) => new Intl.DateTimeFormat(tag, { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(iso));

  async function act(body: Record<string, string>) {
    if (!booking) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`${BASE}/api/bookings/${booking.token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg(body.action === "cancel" ? t.cancelled : t.changed);
      setTimeout(() => window.location.reload(), 1800);
    } else if (data.error === "slot_taken") setErr(t.slotTaken);
    else if (data.error === "too_late") setErr(t.tooLate(cancelLimitHours));
    else setErr(t.genericError);
  }

  return (
    <div className="bg-public min-h-screen px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="card px-6 pb-6 pt-6">
          <Image src={bp("/logo.jpg")} alt="AA Solutions Services" width={48} height={48} className="h-12 w-12 rounded-xl" />
          <h1 className="mt-4 font-display text-2xl font-semibold">{t.myAppointment}</h1>
          {!booking ? (
            <p className="mt-2 text-brand-muted">{t.notFound}</p>
          ) : (
            <>
              <div className="mt-3 space-y-1.5 text-[15px] font-semibold text-brand-pink">
                <p className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {cap(new Intl.DateTimeFormat(tag, { dateStyle: "full", timeZone: TZ }).format(new Date(booking.start)))}
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> {fmtTime(booking.start)} (ET) · {booking.durationMin} min
                </p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="chip" style={{ background: `${booking.statusColor}1A`, color: booking.statusColor }}>
                  {booking.statusLabel}
                </span>
                <span className="chip bg-slate-100 text-brand-ink">{booking.serviceName}</span>
                <span className="chip bg-slate-100 text-brand-ink">
                  {booking.mode === "virtual" ? <Video className="mr-1 h-3 w-3" /> : <Building2 className="mr-1 h-3 w-3" />}
                  {booking.mode === "virtual" ? t.virtual : t.presencial}
                </span>
                <span className="chip bg-slate-100 text-brand-muted">{booking.code}</span>
              </div>
            </>
          )}
        </div>

        {booking && booking.status !== "cancelled" && (
          <div className="card space-y-3 p-5">
            {msg && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{msg}</p>}
            {err && (
              <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-600" role="alert">
                {err}
              </p>
            )}
            {view === "main" && (
              <>
                {booking.meetLink && (
                  <a href={booking.meetLink} target="_blank" rel="noreferrer" className="btn-blue w-full">
                    <Video className="h-4 w-4" /> {t.joinMeet}
                  </a>
                )}
                <div className="flex flex-wrap gap-2">
                  <a className="btn-ghost" href={booking.googleCalendarUrl} target="_blank" rel="noreferrer">
                    <CalendarDays className="h-4 w-4" /> {t.addGoogle}
                  </a>
                  <a className="btn-ghost" href={bp(`/api/bookings/${booking.token}/ics`)}>
                    <Download className="h-4 w-4" /> .ics
                  </a>
                </div>
                {booking.canChange ? (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button className="btn-primary" onClick={() => setView("reschedule")}>
                      <RefreshCw className="h-4 w-4" /> {t.reschedule}
                    </button>
                    <button className="btn-ghost text-rose-600" onClick={() => setView("cancel")}>
                      <X className="h-4 w-4" /> {t.cancel}
                    </button>
                  </div>
                ) : (
                  <p className="border-t border-slate-100 pt-3 text-sm text-brand-muted">{t.tooLate(cancelLimitHours)}</p>
                )}
              </>
            )}
            {view === "cancel" && (
              <>
                <p className="font-bold">{t.cancelConfirm}</p>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-danger" disabled={busy} onClick={() => act({ action: "cancel" })}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t.yesCancel}
                  </button>
                  <button className="btn-ghost" onClick={() => setView("main")}>
                    {t.keep}
                  </button>
                </div>
              </>
            )}
            {view === "reschedule" && (
              <>
                <MonthCalendar
                  month={month}
                  onMonth={setMonth}
                  available={days}
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setTime(null);
                  }}
                  locale={locale}
                  minMonth={todayMonth}
                  maxMonth={maxMonth}
                />
                {date && (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.length === 0 && <p className="col-span-3 text-sm text-brand-muted">{t.noSlots}</p>}
                    {slots.map((s) => (
                      <button
                        key={s.time}
                        onClick={() => setTime(s.time)}
                        className={clsx("rounded-xl border px-2 py-2 text-sm font-bold", time === s.time ? "border-brand-pink bg-brand-pink text-white" : "border-slate-200")}
                      >
                        {fmtTime(s.start)}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" disabled={!date || !time || busy} onClick={() => act({ action: "reschedule", date: date!, time: time! })}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t.saveChange}
                  </button>
                  <button className="btn-ghost" onClick={() => setView("main")}>
                    {t.back}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {booking?.status === "cancelled" && (
          <a href={bp(`/${locale}/agendar`)} className="btn-primary w-full">
            {t.bookAnother}
          </a>
        )}
        <p className="text-center text-xs text-white/85">{t.contact}</p>
      </div>
    </div>
  );
}
