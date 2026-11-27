"use client";

import { BASE, bp } from "@/lib/paths";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import {
  CalendarDays,
  Clock,
  Video,
  Building2,
  MessageCircle,
  Receipt,
  Car,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Check,
  Globe,
  ShieldCheck,
  Download,
  ExternalLink,
  Loader2,
  Info,
} from "lucide-react";
import {
  CONTACT_FIELDS,
  GENERAL_CONSENT,
  PERJURY_TEXT,
  PRIOR_CONTACT_TEXT,
  TAX_TERMS,
  isVisible,
  type CategoryDef,
  type CategoryId,
  type Locale,
  type ServiceDef,
} from "@/lib/catalog";
import { dict } from "@/lib/i18n";
import { validateField } from "@/lib/validation";
import { Field, type FormValue } from "./Fields";
import { MonthCalendar, shiftMonth } from "./MonthCalendar";

interface Props {
  locale: Locale;
  categories: CategoryDef[];
  services: ServiceDef[];
  todayMonth: string;
  maxMonth: string;
  initialService?: string;
  initialTopic?: string;
  /** Modo incrustado en el sitio (iframe): sin pie de página y avisa su alto al padre. */
  embed?: boolean;
  transparent?: boolean;
  theme?: string;
}

interface Result {
  code: string;
  token: string;
  status: string;
  start: string;
  end: string;
  mode: string;
  meetLink: string | null;
  googleCalendarUrl: string;
  manageUrl: string;
}

const ICONS = { chat: MessageCircle, receipt: Receipt, car: Car };
const TZ = "America/New_York";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Wizard({ locale, categories, services, todayMonth, maxMonth, initialService, initialTopic, embed, transparent, theme }: Props) {
  const t = dict(locale);
  const tag = locale === "es" ? "es-US" : "en-US";

  const initial = services.find((s) => s.id === initialService);
  const initialCategory = categories.find((c) => c.id === initialService)?.id ?? initial?.category ?? null;
  const [category, setCategory] = useState<CategoryId | null>(initialCategory);
  const [serviceId, setServiceId] = useState<string | null>(initial?.id ?? null);
  const [priorContact, setPriorContact] = useState(false);
  const [mode, setMode] = useState<"virtual" | "presencial">("virtual");
  const [month, setMonth] = useState(todayMonth);
  const [days, setDays] = useState<Set<string>>(new Set());
  const [daysLoading, setDaysLoading] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ time: string; start: string }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, FormValue>>((): Record<string, FormValue> => {
    const consulta = services.find((s) => s.id === "consulta");
    const topicField = consulta?.groups[0]?.sections[0]?.fields.find((f) => f.key === "topic");
    return initialTopic && topicField?.options?.some((o) => o.value === initialTopic) ? { topic: initialTopic } : ({} as Record<string, FormValue>);
  });
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const service = services.find((s) => s.id === serviceId) ?? null;
  const steps = useMemo(() => {
    const base: { id: string; title: string }[] = [
      { id: "service", title: t.stepService },
      { id: "when", title: t.stepWhen },
      { id: "contact", title: t.yourData },
    ];
    for (const g of service?.groups ?? []) base.push({ id: `g:${g.id}`, title: g.title[locale] });
    base.push({ id: "review", title: t.stepConfirm });
    return base;
  }, [service, locale, t]);
  const current = steps[Math.min(step, steps.length - 1)];

  // Días disponibles del mes
  useEffect(() => {
    if (!serviceId) return;
    let alive = true;
    setDaysLoading(true);
    fetch(`${BASE}/api/availability?service=${serviceId}&month=${month}`)
      .then((r) => r.json())
      .then((d) => alive && setDays(new Set(d.days ?? [])))
      .catch(() => alive && setDays(new Set()))
      .finally(() => alive && setDaysLoading(false));
    return () => {
      alive = false;
    };
  }, [serviceId, month]);

  // Horarios del día
  useEffect(() => {
    if (!serviceId || !date) return;
    let alive = true;
    setSlotsLoading(true);
    fetch(`${BASE}/api/availability?service=${serviceId}&date=${date}`)
      .then((r) => r.json())
      .then((d) => alive && setSlots(d.slots ?? []))
      .catch(() => alive && setSlots([]))
      .finally(() => alive && setSlotsLoading(false));
    return () => {
      alive = false;
    };
  }, [serviceId, date]);

  // Al entrar a un mes sin día elegido, salta al primer mes con disponibilidad.
  useEffect(() => {
    if (!serviceId || daysLoading || date || days.size > 0) return;
    if (month < maxMonth && month === todayMonth) setMonth(shiftMonth(month, 1));
  }, [serviceId, daysLoading, days, date, month, maxMonth, todayMonth]);

  useEffect(() => {
    if (embed) {
      document.getElementById("aa-booking-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.parent?.postMessage({ type: "aa-booking:step", step: step + 1 }, "*");
    } else window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, embed]);

  // En modo incrustado, informa el alto al sitio padre para que el iframe crezca sin barras.
  useEffect(() => {
    if (!embed) return;
    document.documentElement.classList.add("embed");
    const root = document.getElementById("aa-booking-root");
    if (!root) return;
    const send = () => window.parent?.postMessage({ type: "aa-booking:height", height: Math.ceil(root.getBoundingClientRect().height) }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(root);
    send();
    return () => ro.disconnect();
  }, [embed]);

  useEffect(() => {
    if (embed && result) window.parent?.postMessage({ type: "aa-booking:done", code: result.code }, "*");
  }, [embed, result]);

  const set = (key: string, v: FormValue) => {
    setValues((p) => ({ ...p, [key]: v }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: "" }));
  };

  function chooseService(id: string) {
    setServiceId(id);
    setDate(null);
    setTime(null);
    setMonth(todayMonth);
  }

  function validateStep(): boolean {
    const errs: Record<string, string> = {};
    if (current.id === "service") {
      if (!service) return false;
      if (service.requiresPriorContact && !priorContact) errs.prior_contact = "required";
    } else if (current.id === "when") {
      if (!date || !time) return false;
    } else if (current.id === "contact") {
      for (const f of CONTACT_FIELDS) {
        const e = validateField(f, values[f.key], locale);
        if (e) errs[f.key] = e;
      }
    } else if (current.id.startsWith("g:") && service) {
      const g = service.groups.find((x) => `g:${x.id}` === current.id)!;
      for (const sec of g.sections)
        for (const f of sec.fields) {
          if (!isVisible(f, values)) continue;
          const e = validateField(f, values[f.key], locale, (files[f.key]?.length ?? 0) > 0);
          if (e) errs[f.key] = e;
          if (f.type === "file")
            for (const file of files[f.key] ?? []) {
              if (file.size > 10 * 1024 * 1024) errs[f.key] = locale === "es" ? "Cada archivo debe pesar menos de 10 MB." : "Each file must be under 10 MB.";
            }
        }
    }
    setErrors(errs);
    const ok = Object.values(errs).every((x) => !x);
    if (!ok) {
      setFormError(t.fixErrors);
      setTimeout(() => document.querySelector("[role=alert]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    } else setFormError(null);
    return ok;
  }

  function next() {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }
  function back() {
    setFormError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    if (!service || !date || !time) return;
    if (!accepted) {
      setErrors({ accept_terms: "required" });
      setFormError(t.fixErrors);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({ serviceId: service.id, locale, mode, priorContact, date, time, values, accepted }),
    );
    fd.set("website", honeypot);
    for (const [key, list] of Object.entries(files)) for (const f of list) fd.append(`file:${key}`, f, f.name);
    try {
      const res = await fetch(`${BASE}/api/bookings`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult(data as Result);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (data.error === "slot_taken") {
        setFormError(t.slotTaken);
        setTime(null);
        setStep(1);
      } else if (data.fields) {
        setErrors(data.fields);
        // Lleva al primer paso con error.
        const firstKey = Object.keys(data.fields)[0];
        const idx = steps.findIndex((s) => {
          if (s.id === "contact") return CONTACT_FIELDS.some((f) => f.key === firstKey);
          if (s.id.startsWith("g:")) return service.groups.find((g) => `g:${g.id}` === s.id)?.sections.some((sec) => sec.fields.some((f) => f.key === firstKey));
          if (s.id === "service") return firstKey === "prior_contact";
          return false;
        });
        if (idx >= 0) setStep(idx);
        setFormError(t.fixErrors);
      } else {
        setFormError(t.genericError);
      }
    } catch {
      setFormError(t.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  const fmtDate = (d: string) =>
    cap(new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)));
  const fmtTime = (iso: string) => new Intl.DateTimeFormat(tag, { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
  const selectedSlot = slots.find((s) => s.time === time);

  /* ------------------------------ Render ------------------------------ */

  const header = (
    <div className="relative">
      <div className="card relative z-10 px-6 pb-10 pt-6">
        <div className="flex items-center justify-between">
          <Image src={bp("/logo.jpg")} alt="AA Solutions Services" width={56} height={56} className="h-12 w-12 rounded-xl object-cover" priority />
          {!embed && <Link
            href={`/${t.langHref}/agendar`}
            className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-brand-violet hover:bg-violet-100"
          >
            <Globe className="h-3.5 w-3.5" /> {t.language}
          </Link>}
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold text-brand-ink">{result ? t.successTitle : t.bookTitle}</h1>
        <div className="mt-3 space-y-1.5 text-[15px] font-semibold text-brand-pink">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {date ? fmtDate(date) : service ? service.name[locale] : t.chooseService}
          </p>
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {selectedSlot ? `${fmtTime(selectedSlot.start)} · ${mode === "virtual" ? t.virtual : t.presencial}` : service ? t.minutes(service.durationMin) : t.bookSubtitle.split(".")[0]}
          </p>
        </div>
      </div>
      <div className="absolute -bottom-6 left-1/2 z-20 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full bg-brand-pink text-lg font-extrabold text-white shadow-pink">
        {result ? <Check className="h-6 w-6" /> : step + 1}
      </div>
    </div>
  );

  const stepList = (
    <nav className="bg-panel relative -mt-4 hidden overflow-hidden rounded-b-2xl px-8 pb-10 pt-14 text-white/70 md:block">
      <ol className="space-y-5">
        {steps.map((s, i) => (
          <li key={s.id} className={clsx("flex items-center gap-4 text-[15px]", i === step && !result && "font-bold text-white")}>
            <span className={clsx("h-1.5 w-1.5 rounded-full", i === step && !result ? "bg-brand-pink" : i < step || result ? "bg-brand-teal" : "bg-white/40")} />
            {s.title}
          </li>
        ))}
      </ol>
      <svg className="pointer-events-none absolute bottom-0 left-0 w-full opacity-40" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden>
        <path d="M0 30 Q 100 0 200 25 T 400 20 V60 H0Z" fill="#ffffff" fillOpacity="0.25" />
        <path d="M0 45 Q 120 20 230 42 T 400 35 V60 H0Z" fill="#ffffff" fillOpacity="0.2" />
      </svg>
    </nav>
  );

  return (
    <div
      id="aa-booking-root"
      data-theme={theme === "aa" ? "aa" : undefined}
      className={clsx(transparent ? "" : "bg-public", embed ? "px-3 pb-6 pt-4" : "min-h-screen px-4 pb-16 pt-6 sm:pt-10")}
    >
      <span id="aa-booking-top" />
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[320px,1fr] md:items-start">
        <aside className="md:sticky md:top-8">
          {header}
          {stepList}
          {!result && (
            <div className="mt-10 flex items-center justify-center gap-1.5 md:hidden" aria-label={t.stepOf(step + 1, steps.length)}>
              {steps.map((s, i) => (
                <span key={s.id} className={clsx("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-white" : i < step ? "w-1.5 bg-white/90" : "w-1.5 bg-white/40")} />
              ))}
            </div>
          )}
        </aside>

        <main className="min-w-0">
          {result ? (
            <Success result={result} locale={locale} service={service!} fmtTime={fmtTime} />
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between text-white">
                <p className="text-sm font-bold uppercase tracking-wider text-white/80">{t.stepOf(step + 1, steps.length)}</p>
                {step > 0 && (
                  <button type="button" onClick={back} className="inline-flex items-center gap-1 text-sm font-bold text-white/90 hover:text-white">
                    <ArrowLeft className="h-4 w-4" /> {t.back}
                  </button>
                )}
              </div>

              {current.id === "service" && (
                <ServiceStep
                  locale={locale}
                  categories={categories}
                  services={services}
                  category={category}
                  setCategory={(c) => {
                    setCategory(c);
                    const list = services.filter((s) => s.category === c);
                    if (list.length === 1) chooseService(list[0].id);
                    else if (!list.some((s) => s.id === serviceId)) setServiceId(null);
                  }}
                  serviceId={serviceId}
                  chooseService={chooseService}
                  priorContact={priorContact}
                  setPriorContact={setPriorContact}
                  priorError={!!errors.prior_contact}
                />
              )}

              {current.id === "when" && service && (
                <div className="space-y-4">
                  <section className="card p-5 sm:p-6">
                    <h2 className="font-display text-lg font-semibold">{t.modeTitle}</h2>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {(["virtual", "presencial"] as const).map((m) => {
                        const Icon = m === "virtual" ? Video : Building2;
                        const on = mode === m;
                        return (
                          <button
                            type="button"
                            key={m}
                            onClick={() => setMode(m)}
                            className={clsx(
                              "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition",
                              on ? "border-brand-pink bg-pink-50/60" : "border-slate-100 hover:border-violet-200",
                            )}
                          >
                            <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", on ? "bg-brand-pink text-white" : "bg-violet-50 text-brand-violet")}>
                              <Icon className="h-5 w-5" />
                            </span>
                            <span>
                              <span className="block font-bold">{m === "virtual" ? t.virtual : t.presencial}</span>
                              <span className="block text-sm text-brand-muted">{m === "virtual" ? t.virtualDesc : t.presencialDesc}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  <section className="card grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr,200px]">
                    <div>
                      <h2 className="mb-3 font-display text-lg font-semibold">{t.pickDay}</h2>
                      <MonthCalendar
                        month={month}
                        onMonth={(m) => {
                          setMonth(m);
                        }}
                        available={days}
                        selected={date}
                        onSelect={(d) => {
                          setDate(d);
                          setTime(null);
                        }}
                        locale={locale}
                        loading={daysLoading}
                        minMonth={todayMonth}
                        maxMonth={maxMonth}
                      />
                      {!daysLoading && days.size === 0 && <p className="mt-3 text-sm text-brand-muted">{t.noDays}</p>}
                    </div>
                    <div>
                      <h2 className="mb-3 font-display text-lg font-semibold">{t.pickTime}</h2>
                      {!date ? (
                        <p className="text-sm text-brand-muted">{t.pickDay}…</p>
                      ) : slotsLoading ? (
                        <p className="flex items-center gap-2 text-sm text-brand-muted">
                          <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
                        </p>
                      ) : slots.length === 0 ? (
                        <p className="text-sm text-brand-muted">{t.noSlots}</p>
                      ) : (
                        <div className="grid max-h-[340px] grid-cols-3 gap-2 overflow-y-auto pr-1 lg:grid-cols-1">
                          {slots.map((s) => (
                            <button
                              type="button"
                              key={s.time}
                              onClick={() => setTime(s.time)}
                              className={clsx(
                                "rounded-xl border px-2 py-2.5 text-sm font-bold transition",
                                time === s.time ? "border-brand-pink bg-brand-pink text-white shadow-pink" : "border-slate-200 hover:border-brand-pink",
                              )}
                            >
                              {fmtTime(s.start)}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="mt-3 text-xs text-brand-muted">{t.timesIn}</p>
                    </div>
                  </section>
                </div>
              )}

              {current.id === "contact" && (
                <section className="card p-5 sm:p-6">
                  <h2 className="font-display text-lg font-semibold">{t.yourData}</h2>
                  <p className="mb-4 text-sm text-brand-muted">{t.yourDataSub}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {CONTACT_FIELDS.map((f) => (
                      <Field key={f.key} field={f} locale={locale} value={values[f.key]} error={errors[f.key]} onChange={(v) => set(f.key, v)} />
                    ))}
                  </div>
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    className="absolute -left-[9999px] h-0 w-0 opacity-0"
                    aria-hidden
                  />
                </section>
              )}

              {current.id.startsWith("g:") && service && (
                <GroupStep
                  service={service}
                  groupId={current.id.slice(2)}
                  locale={locale}
                  values={values}
                  files={files}
                  errors={errors}
                  set={set}
                  setFiles={(k, f) => setFiles((p) => ({ ...p, [k]: f }))}
                />
              )}

              {current.id === "review" && service && date && selectedSlot && (
                <section className="card p-5 sm:p-6">
                  <h2 className="font-display text-lg font-semibold">{t.review}</h2>
                  <dl className="mt-4 divide-y divide-slate-100 rounded-2xl bg-slate-50 px-4">
                    {[
                      [t.service, service.name[locale]],
                      [t.date, fmtDate(date)],
                      [t.time, `${fmtTime(selectedSlot.start)} (ET)`],
                      [t.mode, mode === "virtual" ? `${t.virtual} · Google Meet` : `${t.presencial} · 246 W Linden Ave, Linden, NJ`],
                      [t.name, `${values.first_name ?? ""} ${values.last_name ?? ""}`],
                      ["Email", String(values.email ?? "")],
                    ].map(([k, v]) => (
                      <div key={k} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                        <dt className="text-brand-muted">{k}</dt>
                        <dd className="font-bold cap-first">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-5">
                    {service.legal === "tax_terms" && (
                      <div className="rounded-2xl border border-slate-200">
                        <button type="button" onClick={() => setShowTerms((x) => !x)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold">
                          {TAX_TERMS.title[locale]}
                          <ChevronDown className={clsx("h-4 w-4 transition", showTerms && "rotate-180")} />
                        </button>
                        {showTerms && (
                          <ol className="max-h-72 space-y-3 overflow-y-auto border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                            {TAX_TERMS.clauses.map((c, i) => (
                              <li key={i}>
                                <p className="font-bold text-brand-ink">
                                  {i + 1}. {c.title[locale]}
                                </p>
                                <p>{c.body[locale]}</p>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                    <label className={clsx("mt-3 flex cursor-pointer items-start gap-3 rounded-2xl p-4 text-sm", errors.accept_terms && !accepted ? "bg-rose-50 ring-1 ring-rose-200" : "bg-violet-50/70")}>
                      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-brand-pink" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                      <span className="font-semibold">
                        {service.legal === "tax_terms" ? TAX_TERMS.accept[locale] : service.legal === "perjury" ? PERJURY_TEXT[locale] : GENERAL_CONSENT[locale]}
                        <span className="text-brand-pink"> *</span>
                      </span>
                    </label>
                    {service.category === "tax" && (
                      <p className="mt-3 flex items-center gap-2 text-xs text-brand-muted">
                        <ShieldCheck className="h-4 w-4 text-brand-teal" /> {t.sensitiveNote}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {formError && (
                <p className="mt-4 rounded-2xl bg-white/95 px-4 py-3 text-sm font-bold text-rose-600 shadow-soft" role="alert">
                  {formError}
                </p>
              )}

              <div className="mt-6 flex justify-end">
                {current.id === "review" ? (
                  <button type="button" className="btn-primary w-full !py-3.5 text-base sm:w-auto" onClick={submit} disabled={submitting}>
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                    {submitting ? t.sending : t.confirm}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary w-full !py-3.5 text-base sm:w-auto"
                    onClick={next}
                    disabled={(current.id === "service" && !service) || (current.id === "when" && (!date || !time))}
                  >
                    {t.next} <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </div>
      {!embed && (
      <footer className="mx-auto mt-12 max-w-5xl text-center text-xs leading-relaxed text-white/85">
        AA Solutions Services LLC · 246 W Linden Ave, Linden, NJ 07036 · (201) 608-0673 · (908) 636-3943 · English (201) 654-1106
      </footer>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- */

function ServiceStep(props: {
  locale: Locale;
  categories: CategoryDef[];
  services: ServiceDef[];
  category: CategoryId | null;
  setCategory: (c: CategoryId) => void;
  serviceId: string | null;
  chooseService: (id: string) => void;
  priorContact: boolean;
  setPriorContact: (b: boolean) => void;
  priorError: boolean;
}) {
  const { locale, categories, services, category, setCategory, serviceId, chooseService, priorContact, setPriorContact, priorError } = props;
  const t = dict(locale);
  const sub = services.filter((s) => s.category === category);
  const selected = services.find((s) => s.id === serviceId);
  return (
    <div className="space-y-4">
      <section className="bg-panel overflow-hidden rounded-2xl text-white shadow-card">
        <h2 className="px-5 pb-2 pt-5 font-display text-lg font-semibold sm:px-6">{t.chooseService}</h2>
        <ul className="divide-y divide-white/10">
          {categories.map((c) => {
            const Icon = ICONS[c.icon];
            const on = category === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={clsx("relative flex w-full items-center gap-4 px-5 py-4 text-left transition sm:px-6", on ? "bg-white/10" : "hover:bg-white/5")}
                >
                  <span className={clsx("absolute inset-y-3 left-0 w-1 rounded-r", on ? "bg-brand-pink" : "bg-transparent")} />
                  <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", on ? "bg-brand-pink" : "bg-white/10")}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{c.name[locale]}</span>
                    <span className="block text-sm text-white/70">{c.description[locale]}</span>
                  </span>
                  <ChevronRight className={clsx("h-5 w-5 shrink-0 transition", on ? "rotate-90 text-brand-pink" : "text-white/50")} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {category && sub.length > 1 && (
        <section className="card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">{category === "tax" ? t.chooseTaxType : t.chooseRegType}</h2>
          <div className="mt-3 grid gap-3">
            {sub.map((s) => {
              const on = s.id === serviceId;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => chooseService(s.id)}
                  className={clsx("flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition", on ? "border-brand-pink bg-pink-50/60" : "border-slate-100 hover:border-violet-200")}
                >
                  <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1">
                    <span className="block font-bold">{s.name[locale]}</span>
                    {s.sheetId ? null : null}
                  </span>
                  <span className="chip bg-slate-100 text-brand-muted">{t.minutes(s.durationMin)}</span>
                  {on && <Check className="h-5 w-5 text-brand-pink" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {selected?.requiresPriorContact && (
        <section className={clsx("card p-5 sm:p-6", priorError && !priorContact && "ring-2 ring-rose-300")}>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Info className="h-5 w-5 text-brand-pink" /> {t.priorContactTitle}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{PRIOR_CONTACT_TEXT[locale]}</p>
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl bg-violet-50/70 p-4 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-brand-pink" checked={priorContact} onChange={(e) => setPriorContact(e.target.checked)} />
            <span className="font-semibold">{t.priorContactCheck}</span>
          </label>
          {priorError && !priorContact && (
            <p className="mt-2 text-xs font-bold text-rose-500" role="alert">
              {locale === "es" ? "Confirma para continuar." : "Please confirm to continue."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function GroupStep(props: {
  service: ServiceDef;
  groupId: string;
  locale: Locale;
  values: Record<string, FormValue>;
  files: Record<string, File[]>;
  errors: Record<string, string>;
  set: (k: string, v: FormValue) => void;
  setFiles: (k: string, f: File[]) => void;
}) {
  const { service, groupId, locale, values, files, errors, set, setFiles } = props;
  const g = service.groups.find((x) => x.id === groupId)!;
  const first = service.groups[0].id === groupId;
  return (
    <div className="space-y-4">
      {first && service.intro && <p className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-brand-ink shadow-soft">{service.intro[locale]}</p>}
      {g.sections.map((sec) => {
        const visible = sec.fields.filter((f) => isVisible(f, values));
        if (visible.length === 0) return null;
        return (
          <section key={sec.id} className="card p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold">{sec.title[locale]}</h2>
            {sec.intro && <p className="text-sm text-brand-muted">{sec.intro[locale]}</p>}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {visible.map((f) => (
                <Field
                  key={f.key}
                  field={f}
                  locale={locale}
                  value={values[f.key]}
                  files={files[f.key]}
                  error={errors[f.key]}
                  onChange={(v) => set(f.key, v)}
                  onFiles={(list) => setFiles(f.key, list)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Success({ result, locale, service, fmtTime }: { result: Result; locale: Locale; service: ServiceDef; fmtTime: (iso: string) => string }) {
  const t = dict(locale);
  const tag = locale === "es" ? "es-US" : "en-US";
  const day = cap(new Intl.DateTimeFormat(tag, { dateStyle: "full", timeZone: TZ }).format(new Date(result.start)));
  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
          <CalendarCheckArt />
          <h2 className="mt-4 font-display text-2xl font-semibold">{t.successTitle}</h2>
          <p className="mt-1 text-brand-muted">{t.successSub}</p>
        </div>
        <div className="bg-panel px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold cap-first">{day}</p>
              <p className="mt-1 text-lg font-extrabold">{service.name[locale]}</p>
              <p className="text-sm text-white/80">{result.mode === "virtual" ? `${t.virtual} · Google Meet` : `${t.presencial} · Linden, NJ`}</p>
              <p className="mt-2 text-sm font-bold text-brand-teal">✓ {locale === "es" ? "Confirmada" : "Confirmed"}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold">{fmtTime(result.start)}</p>
              <p className="text-xs text-white/70">ET</p>
              <p className="mt-2 whitespace-nowrap rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{result.code}</p>
            </div>
          </div>
        </div>
      </section>

      {result.meetLink && (
        <a href={result.meetLink} target="_blank" rel="noreferrer" className="card flex items-center gap-3 p-4 hover:ring-2 hover:ring-brand-pink">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-teal text-white">
            <Video className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{t.joinMeet}</span>
            <span className="block truncate text-sm text-brand-muted">{result.meetLink}</span>
          </span>
          <ExternalLink className="h-4 w-4 text-brand-muted" />
        </a>
      )}

      <section className="card p-5">
        <h3 className="font-bold">{t.saveCalendar}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn-primary" href={result.googleCalendarUrl} target="_blank" rel="noreferrer">
            <CalendarDays className="h-4 w-4" /> {t.addGoogle}
          </a>
          <a className="btn-ghost" href={bp(`/api/bookings/${result.token}/ics`)}>
            <Download className="h-4 w-4" /> {t.downloadIcs}
          </a>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-sm font-bold">
          <a href={result.manageUrl} className="text-brand-violet hover:underline">
            {t.manage}
          </a>
          <a href={bp(`/${locale}/agendar${typeof window !== "undefined" ? window.location.search : ""}`)} className="text-brand-muted hover:underline">
            {t.bookAnother}
          </a>
        </div>
      </section>
    </div>
  );
}

/** Ilustración simple en la línea de la referencia (calendario con globos). */
function CalendarCheckArt() {
  return (
    <svg width="150" height="110" viewBox="0 0 150 110" fill="none" aria-hidden>
      <path d="M8 96 Q 40 84 75 92 T 142 90" stroke="#E4E1F5" strokeWidth="2" />
      <circle cx="30" cy="30" r="12" fill="#8B7CF6" opacity=".55" />
      <circle cx="44" cy="22" r="14" fill="#7DD3FC" opacity=".8" />
      <path d="M30 42 L50 70 M44 36 L52 70" stroke="#C7C2E8" strokeWidth="1.5" />
      <rect x="52" y="40" width="64" height="52" rx="10" fill="#FCE7F3" stroke="#EC5FA8" strokeWidth="2" />
      <rect x="52" y="40" width="64" height="14" rx="7" fill="#F9A8D4" />
      <path d="M72 72 l8 8 l16 -16" stroke="#EC5FA8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M118 30 l6 -4 M126 36 l6 -4" stroke="#C7C2E8" strokeWidth="1.5" />
    </svg>
  );
}
