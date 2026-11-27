import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { appendToTab, googleReady } from "@/lib/google";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { fmt } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Suscripción al boletín del sitio: guarda el correo y agrega fila en "Suscriptores". */
export async function POST(req: Request) {
  if (!rateLimit(`sub:${clientIp(req)}`, 5, 10 * 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (String(body.website ?? "").trim()) return NextResponse.json({ ok: true });
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 160);
  const locale = body.lang === "en" ? "en" : "es";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: "invalid", fields: { email: "invalid" } }, { status: 400 });
  const res = getDb().prepare(`INSERT OR IGNORE INTO subscribers (email, locale) VALUES (?, ?)`).run(email, locale);
  if (res.changes === 1 && googleReady()) {
    appendToTab("Suscriptores", ["Fecha", "Correo", "Idioma"], [fmt(new Date(), "yyyy-MM-dd HH:mm"), email, locale]).catch((e) =>
      console.error("[subscribe] Sheets", e instanceof Error ? e.message : e),
    );
  }
  return NextResponse.json({ ok: true, already: res.changes === 0 });
}
