import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * Detrás del proxy de OpenLiteSpeed, Next solo ve 127.0.0.1 y armaría las redirecciones hacia
 * localhost. Por eso se construyen con APP_URL (que ya incluye el basePath).
 * Con basePath, req.nextUrl.pathname llega sin el prefijo.
 */
function redirectTo(req: NextRequest, path: string) {
  const app = process.env.APP_URL?.replace(/\/$/, "");
  const target = app ? `${app}${path}` : new URL(`${BASE}${path}`, req.url).toString();
  return NextResponse.redirect(target, 307);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/" || pathname === "") {
    const lang = (req.headers.get("accept-language") || "").toLowerCase().startsWith("en") ? "en" : "es";
    return redirectTo(req, `/${lang}/agendar${req.nextUrl.search}`);
  }

  const isAdminPage = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (isAdminPage || isAdminApi) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySession(token) : null;
    if (!session) {
      if (isAdminApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      return redirectTo(req, `/admin/login?next=${encodeURIComponent(pathname)}`);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Runtime de Node: lee APP_URL y SESSION_SECRET del entorno al arrancar, no al compilar.
  runtime: "nodejs",
  matcher: ["/", "/admin/:path*", "/api/admin/:path*"],
};
