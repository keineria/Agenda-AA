import { allFields, CONTACT_FIELDS, isVisible, type FieldDef, type Locale, type ServiceDef } from "./catalog";

export type Values = Record<string, string | string[]>;

const MSG = {
  required: { es: "Este campo es obligatorio.", en: "This field is required." },
  email: { es: "Escribe un correo válido.", en: "Enter a valid email." },
  date: { es: "Escribe una fecha válida.", en: "Enter a valid date." },
  number: { es: "Escribe un número válido.", en: "Enter a valid number." },
  option: { es: "Elige una opción válida.", en: "Choose a valid option." },
  mustBeTrue: { es: "Debes aceptar para continuar.", en: "You must accept to continue." },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim() === "";
}

/**
 * Valida un campo. `hasFile` indica si el cliente adjuntó archivo (los archivos viajan aparte).
 * Devuelve el mensaje de error o null.
 */
export function validateField(f: FieldDef, value: unknown, locale: Locale, hasFile = false): string | null {
  if (f.type === "file") {
    return f.required && !hasFile ? MSG.required[locale] : null;
  }
  if (f.type === "checkbox") {
    if ((f.required || f.mustBeTrue) && value !== "true" && value !== true) return MSG.mustBeTrue[locale];
    return null;
  }
  if (isEmpty(value)) return f.required ? MSG.required[locale] : null;

  const str = Array.isArray(value) ? "" : String(value).trim();
  switch (f.type) {
    case "email":
      if (!EMAIL_RE.test(str)) return MSG.email[locale];
      break;
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str) || Number.isNaN(Date.parse(str))) return MSG.date[locale];
      break;
    }
    case "number":
      if (Number.isNaN(Number(str.replace(/[$,]/g, ""))) || Number(str.replace(/[$,]/g, "")) < 0) return MSG.number[locale];
      break;
    case "select":
    case "radio":
    case "yesno":
      if (f.options && f.options.length && !f.options.some((o) => o.value === str)) return MSG.option[locale];
      if (f.mustBeTrue && str !== "yes") return MSG.mustBeTrue[locale];
      break;
    case "checkbox_group": {
      const arr = Array.isArray(value) ? value : [String(value)];
      if (f.options && arr.some((x) => !f.options!.some((o) => o.value === x))) return MSG.option[locale];
      break;
    }
  }
  if (f.pattern && str) {
    const clean = f.type === "tel" ? str : str.replace(/\s/g, "");
    if (!new RegExp(f.pattern).test(clean)) return f.patternMessage?.[locale] ?? MSG.option[locale];
  }
  return null;
}

export interface ValidationResult {
  errors: Record<string, string>;
  /** Respuestas no sensibles y visibles (se guardan en claro). */
  answers: Values;
  /** Respuestas sensibles (se guardan cifradas). */
  secrets: Record<string, string>;
}

export function validateContact(values: Values, locale: Locale): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of CONTACT_FIELDS) {
    const e = validateField(f, values[f.key], locale);
    if (e) errors[f.key] = e;
  }
  return errors;
}

export function validateService(
  service: ServiceDef,
  values: Values,
  locale: Locale,
  fileKeys: Set<string> = new Set(),
): ValidationResult {
  const errors: Record<string, string> = {};
  const answers: Values = {};
  const secrets: Record<string, string> = {};
  for (const f of allFields(service)) {
    if (!isVisible(f, values)) continue;
    const v = values[f.key];
    const e = validateField(f, v, locale, fileKeys.has(f.key));
    if (e) {
      errors[f.key] = e;
      continue;
    }
    if (f.type === "file" || isEmpty(v)) continue;
    if (f.sensitive) secrets[f.key] = String(v).trim();
    else answers[f.key] = Array.isArray(v) ? v.map(String) : String(v).trim();
  }
  return { errors, answers, secrets };
}
