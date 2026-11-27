import { NextResponse } from "next/server";
import { getDb, getSettings } from "@/lib/db";
import { appendToTab, googleReady } from "@/lib/google";
import { escapeHtml, renderEmail, renderText, sendMail } from "@/lib/mail";
import { appUrl } from "@/lib/google";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { fmt } from "@/lib/time";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Formulario de contacto del sitio web: guarda, avisa por correo a la oficina y agrega fila en "Contactos". */
export async function POST(req: Request) {
  if (!rateLimit(`contact:${clientIp(req)}`, 5, 10 * 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (String(body.website ?? "").trim()) return NextResponse.json({ ok: true }); // honeypot: se ignora en silencio
  const name = String(body.name ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 160);
  const phone = String(body.phone ?? "").trim().slice(0, 40);
  const service = String(body.service ?? "").trim().slice(0, 80);
  const message = String(body.message ?? "").trim().slice(0, 4000);
  const locale = body.lang === "en" ? "en" : "es";
  const fields: Record<string, string> = {};
  if (!name) fields.name = "required";
  if (!EMAIL_RE.test(email)) fields.email = "invalid";
  if (!message) fields.message = "required";
  if (Object.keys(fields).length) return NextResponse.json({ error: "invalid", fields }, { status: 400 });

  getDb().prepare(`INSERT INTO contacts (name, email, phone, service, message, locale) VALUES (?, ?, ?, ?, ?, ?)`).run(name, email, phone || null, service || null, message, locale);

  const to = process.env.CONTACT_NOTIFY_EMAIL || getSettings().adminEmails;
  const block = {
    heading: "Nuevo mensaje desde el sitio web",
    intro: `${escapeHtml(name)} escribió desde el formulario de contacto.`,
    rows: [
      ["Nombre", escapeHtml(name)],
      ["Correo", escapeHtml(email)],
      ["Teléfono", escapeHtml(phone || "—")],
      ["Servicio", escapeHtml(service || "—")],
      ["Idioma", locale.toUpperCase()],
      ["Mensaje", escapeHtml(message).replace(/\n/g, "<br>")],
    ] as [string, string][],
    footer: "Aviso automático del sitio de AA Solutions Services. Responde a este correo para contestarle al cliente.",
  };
  await sendMail({ to, subject: `Contacto web: ${name}${service ? ` · ${service}` : ""}`, html: renderEmail(block, `${appUrl()}/logo-white.png`), text: renderText(block), kind: "contact", replyTo: email });

  if (googleReady()) {
    appendToTab("Contactos", ["Fecha", "Nombre", "Correo", "Teléfono", "Servicio", "Idioma", "Mensaje"], [fmt(new Date(), "yyyy-MM-dd HH:mm"), name, email, phone, service, locale, message]).catch((e) =>
      console.error("[contact] Sheets", e instanceof Error ? e.message : e),
    );
  }
  return NextResponse.json({ ok: true });
}
