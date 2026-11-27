"use client";

import { useMemo, useRef } from "react";
import { Paperclip, X, Lock } from "lucide-react";
import clsx from "clsx";
import { US_STATES, type FieldDef, type Locale } from "@/lib/catalog";
import { countryOptions } from "@/lib/countries";
import { dict } from "@/lib/i18n";

export type FormValue = string | string[];

interface FieldProps {
  field: FieldDef;
  locale: Locale;
  value: FormValue | undefined;
  files?: File[];
  error?: string;
  onChange: (v: FormValue) => void;
  onFiles?: (files: File[]) => void;
}

export function Field({ field, locale, value, files, error, onChange, onFiles }: FieldProps) {
  const t = dict(locale);
  const id = `f-${field.key}`;
  const label = (
    <label htmlFor={id} className="label flex items-center gap-1.5">
      <span>{field.label[locale]}</span>
      {field.required ? <span className="text-brand-pink">*</span> : null}
      {field.sensitive ? <Lock className="h-3.5 w-3.5 text-brand-muted" aria-label="cifrado" /> : null}
    </label>
  );
  const help = field.help ? <p className="help">{field.help[locale]}</p> : null;
  const err = error ? (
    <p className="mt-1 text-xs font-bold text-rose-500" role="alert">
      {error}
    </p>
  ) : null;
  const str = typeof value === "string" ? value : "";
  const cls = clsx("input", error && "border-rose-300 bg-rose-50/40");

  let control: React.ReactNode;
  switch (field.type) {
    case "textarea":
      control = <textarea id={id} rows={3} className={cls} value={str} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "select":
      control = (
        <select id={id} className={cls} value={str} onChange={(e) => onChange(e.target.value)}>
          <option value="">{field.placeholder?.[locale] ?? t.selectPlaceholder}</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label[locale]}
            </option>
          ))}
        </select>
      );
      break;
    case "us_state":
      control = (
        <select id={id} className={cls} value={str} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t.selectPlaceholder}</option>
          {US_STATES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      );
      break;
    case "country":
      control = <CountrySelect id={id} cls={cls} value={str} locale={locale} onChange={onChange} />;
      break;
    case "yesno":
    case "radio":
      control = (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={id}>
          {field.options?.map((o) => {
            const on = str === o.value;
            return (
              <button
                type="button"
                key={o.value}
                role="radio"
                aria-checked={on}
                onClick={() => onChange(o.value)}
                className={clsx(
                  "min-w-[84px] rounded-full border px-4 py-2 text-sm font-bold transition",
                  on ? "border-brand-violet bg-brand-violet text-white shadow-soft" : "border-slate-200 bg-white text-brand-ink hover:border-brand-violet",
                )}
              >
                {o.label[locale]}
              </button>
            );
          })}
        </div>
      );
      break;
    case "checkbox_group": {
      const arr = Array.isArray(value) ? value : [];
      control = (
        <div className="flex flex-wrap gap-2">
          {field.options?.map((o) => {
            const on = arr.includes(o.value);
            return (
              <button
                type="button"
                key={o.value}
                aria-pressed={on}
                onClick={() => onChange(on ? arr.filter((x) => x !== o.value) : [...arr, o.value])}
                className={clsx(
                  "rounded-full border px-4 py-2 text-sm font-bold transition",
                  on ? "border-brand-pink bg-brand-pink text-white shadow-pink" : "border-slate-200 bg-white text-brand-ink hover:border-brand-pink",
                )}
              >
                {o.label[locale]}
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case "checkbox":
      return (
        <div className={clsx(field.wide && "sm:col-span-2")}>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm">
            <input
              id={id}
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-brand-pink"
              checked={str === "true"}
              onChange={(e) => onChange(e.target.checked ? "true" : "")}
            />
            <span className="font-semibold">{field.label[locale]}</span>
          </label>
          {err}
        </div>
      );
    case "file":
      control = <FileInput id={id} locale={locale} files={files ?? []} onFiles={onFiles!} error={!!error} />;
      break;
    default: {
      const type = field.type === "number" ? "text" : field.type;
      control = (
        <input
          id={id}
          type={type}
          inputMode={field.type === "number" || field.sensitive ? "numeric" : field.type === "tel" ? "tel" : undefined}
          autoComplete={autoComplete(field.key)}
          className={cls}
          placeholder={field.placeholder?.[locale]}
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
  }

  return (
    <div className={clsx(field.wide && "sm:col-span-2")}>
      {label}
      {control}
      {help}
      {err}
    </div>
  );
}

function autoComplete(key: string): string | undefined {
  return (
    {
      first_name: "given-name",
      last_name: "family-name",
      email: "email",
      phone: "tel",
      address_street: "street-address",
      city: "address-level2",
      zip_code: "postal-code",
      date_of_birth: "bday",
      ssn_itin: "off",
      spouse_ssn: "off",
      bank_routing_number: "off",
      bank_account_number: "off",
    } as Record<string, string>
  )[key];
}

function CountrySelect({ id, cls, value, locale, onChange }: { id: string; cls: string; value: string; locale: Locale; onChange: (v: string) => void }) {
  const opts = useMemo(() => countryOptions(locale), [locale]);
  return (
    <select id={id} className={cls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{dict(locale).selectPlaceholder}</option>
      {opts.map((o, i) =>
        o.value ? (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ) : (
          <option key={`sep-${i}`} disabled>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}

function FileInput({ id, locale, files, onFiles, error }: { id: string; locale: Locale; files: File[]; onFiles: (f: File[]) => void; error: boolean }) {
  const t = dict(locale);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={clsx("rounded-xl border border-dashed p-3", error ? "border-rose-300 bg-rose-50/40" : "border-slate-300 bg-slate-50/60")}>
      <input
        ref={ref}
        id={id}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          onFiles([...files, ...picked].slice(0, 5));
          e.target.value = "";
        }}
      />
      <button type="button" onClick={() => ref.current?.click()} className="btn-ghost !py-2">
        <Paperclip className="h-4 w-4" /> {t.chooseFile}
      </button>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-sm shadow-sm">
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-brand-muted">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              <button type="button" aria-label={t.removeFile} onClick={() => onFiles(files.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-500">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
