import fs from "node:fs/promises";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { BookingFile } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** Descarga de un archivo que aún no se subió a Drive (copia local). Requiere sesión. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const f = getDb().prepare(`SELECT * FROM booking_files WHERE id = ?`).get(Number(id)) as BookingFile | undefined;
  if (!f) return new Response("Not found", { status: 404 });
  if (f.drive_url) return Response.redirect(f.drive_url, 302);
  if (!f.local_path) return new Response("Not found", { status: 404 });
  const data = await fs.readFile(f.local_path);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": f.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(f.filename)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
