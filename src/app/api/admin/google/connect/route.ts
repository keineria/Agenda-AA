import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, hasRole } from "@/lib/auth";
import { googleAuthUrl, googleConfigured } from "@/lib/google";
import { randomToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!hasRole(s, "superadmin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!googleConfigured()) return NextResponse.json({ error: "Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET" }, { status: 400 });
  const state = randomToken(16);
  (await cookies()).set("g_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return NextResponse.redirect(googleAuthUrl(state));
}
