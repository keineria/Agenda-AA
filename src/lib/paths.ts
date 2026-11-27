/**
 * Prefijo de la app cuando corre bajo una subruta (p. ej. /agenda en new.aasolutionsllc.com).
 * Next.js agrega el basePath solo en <Link>, router y redirect(); en fetch, <a>, <img> y <form> hay que ponerlo a mano.
 */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function bp(path: string): string {
  return path.startsWith("/") ? `${BASE}${path}` : path;
}
