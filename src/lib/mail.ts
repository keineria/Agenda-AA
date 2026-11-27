import nodemailer, { type Transporter } from "nodemailer";
import { getDb } from "./db";

/**
 * Envío de correos por SMTP (sin costo mensual): sirve el correo del propio VPS/CyberPanel,
 * Gmail con contraseña de aplicación o el SMTP de Hostinger.
 * Sin SMTP_HOST (desarrollo) los correos se registran en consola y en mail_log.
 */

let transporter: Transporter | null = null;

function getTransport(): Transporter {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

export function mailFrom(): string {
  return process.env.MAIL_FROM || "AA Solutions Services <info@aasolutionsllc.com>";
}

export interface MailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  kind: string;
  bookingId?: number;
  attachments?: { filename: string; content: string; contentType: string }[];
}

export async function sendMail(m: MailInput): Promise<boolean> {
  const to = (Array.isArray(m.to) ? m.to : [m.to]).filter(Boolean);
  if (to.length === 0) return false;
  const log = getDb().prepare(
    `INSERT INTO mail_log (booking_id, kind, to_addr, subject, ok, error) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  try {
    await getTransport().sendMail({
      from: mailFrom(),
      to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      replyTo: m.replyTo || process.env.MAIL_REPLY_TO || "infoaasolutionservices@gmail.com",
      attachments: m.attachments,
    });
    if (!process.env.SMTP_HOST) console.log(`[mail:dev] ${m.kind} → ${to.join(", ")} · ${m.subject}`);
    log.run(m.bookingId ?? null, m.kind, to.join(", "), m.subject, 1, null);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[mail] error enviando ${m.kind} a ${to.join(", ")}: ${msg}`);
    log.run(m.bookingId ?? null, m.kind, to.join(", "), m.subject, 0, msg);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Plantilla HTML (compatible con clientes de correo: tablas + inline)  */
/* ------------------------------------------------------------------ */

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface EmailBlock {
  heading: string;
  intro: string;
  rows: [string, string][];
  buttons?: { label: string; url: string; primary?: boolean }[];
  note?: string;
  footer: string;
  badge?: { text: string; color: string };
}

export function renderEmail(b: EmailBlock, logoUrl: string): string {
  const rows = b.rows
    .map(
      ([k, v]) => `<tr>
        <td style="padding:8px 0;color:#7C7A9A;font-size:13px;width:38%;vertical-align:top">${escapeHtml(k)}</td>
        <td style="padding:8px 0;color:#2B2A4C;font-size:14px;font-weight:700">${v}</td>
      </tr>`,
    )
    .join("");
  const buttons = (b.buttons ?? [])
    .map(
      (btn) =>
        `<a href="${escapeHtml(btn.url)}" style="display:inline-block;margin:6px 6px 0 0;padding:12px 20px;border-radius:999px;font-weight:700;font-size:14px;text-decoration:none;${
          btn.primary ? "background:#EC5FA8;color:#ffffff" : "background:#F1F0FB;color:#2B2A4C"
        }">${escapeHtml(btn.label)}</a>`,
    )
    .join("");
  const badge = b.badge
    ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${b.badge.color}1A;color:${b.badge.color};font-size:12px;font-weight:700">${escapeHtml(b.badge.text)}</span>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#EEEAFB;font-family:Nunito,Segoe UI,Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(150deg,#a5b4fc,#8b7cf6 40%,#b388eb 75%,#f3a6c8);background-color:#8b7cf6;padding:32px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td align="center" style="padding-bottom:18px"><img src="${logoUrl}" alt="AA Solutions Services" width="150" style="display:block;border:0"></td></tr>
    <tr><td style="background:#ffffff;border-radius:20px;padding:28px 28px 24px;box-shadow:0 18px 40px -18px rgba(43,42,76,.35)">
      ${badge}
      <h1 style="margin:12px 0 8px;font-size:22px;line-height:1.25;color:#2B2A4C">${escapeHtml(b.heading)}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#4A4868">${b.intro}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EEEDF6;border-bottom:1px solid #EEEDF6;margin:4px 0 16px">${rows}</table>
      ${buttons ? `<div style="margin:4px 0 12px">${buttons}</div>` : ""}
      ${b.note ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:#7C7A9A">${b.note}</p>` : ""}
    </td></tr>
    <tr><td align="center" style="padding:18px 12px;color:#ffffff;font-size:12px;line-height:1.6">${b.footer}</td></tr>
  </table>
</td></tr></table></body></html>`;
}

export function renderText(b: EmailBlock): string {
  const strip = (s: string) => s.replace(/<[^>]+>/g, "");
  return [
    b.heading,
    "",
    strip(b.intro),
    "",
    ...b.rows.map(([k, v]) => `${k}: ${strip(v)}`),
    "",
    ...(b.buttons ?? []).map((x) => `${x.label}: ${x.url}`),
    b.note ? `\n${strip(b.note)}` : "",
    "",
    strip(b.footer),
  ].join("\n");
}
