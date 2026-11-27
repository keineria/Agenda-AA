import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, hasRole } from "@/lib/auth";
import { appUrl, handleGoogleCallback } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (msg: string) => NextResponse.redirect(`${appUrl()}/admin/configuracion?google=${encodeURIComponent(msg)}`);
  const s = await getSession();
  if (!hasRole(s, "superadmin")) return back("Inicia sesión como superadmin.");
  const jar = await cookies();
  const expected = jar.get("g_state")?.value;
  jar.delete("g_state");
  if (!expected || url.searchParams.get("state") !== expected) return back("La solicitud expiró, intenta de nuevo.");
  const err = url.searchParams.get("error");
  if (err) return back(`Google respondió: ${err}`);
  const code = url.searchParams.get("code");
  if (!code) return back("Falta el código de autorización.");
  try {
    const email = await handleGoogleCallback(code);
    return back(`ok:${email}`);
  } catch (e) {
    return back(e instanceof Error ? e.message : "Error al conectar con Google");
  }
}
