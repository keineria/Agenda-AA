/** Archivo .ics y enlace "Agregar a Google Calendar" para que el cliente guarde su cita. */

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Pliega líneas largas a 75 octetos como pide RFC 5545. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut), "utf8") > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export interface IcsInput {
  uid: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  url?: string;
  method?: "PUBLISH" | "REQUEST" | "CANCEL";
  sequence?: number;
  organizerEmail?: string;
}

export function buildIcs(e: IcsInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AA Solutions Services//Agenda//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${e.method ?? "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}@aasolutionsllc.com`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(e.end)}`,
    `SEQUENCE:${e.sequence ?? 0}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.description)}`,
    `LOCATION:${esc(e.location)}`,
    e.url ? `URL:${e.url}` : "",
    e.organizerEmail ? `ORGANIZER;CN=AA Solutions Services:mailto:${e.organizerEmail}` : "",
    e.method === "CANCEL" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarLink(e: { title: string; description: string; location: string; start: string; end: string }): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsDate(e.start)}/${icsDate(e.end)}`,
    details: e.description,
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
