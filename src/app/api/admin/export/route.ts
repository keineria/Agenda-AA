import { getSession } from "@/lib/auth";
import { listBookings, sheetRow } from "@/lib/bookings";
import { SHEET_HEADERS } from "@/lib/google";
import { filtersFrom } from "@/lib/filters";

export const dynamic = "force-dynamic";

function csvCell(v: string) {
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return new Response("Unauthorized", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const f = filtersFrom(sp);
  let rows = listBookings({ ...f, limit: 2000 });
  if (f.unassigned) rows = rows.filter((b) => !b.agent_id);
  const lines = [SHEET_HEADERS, ...rows.map((b) => sheetRow(b))].map((r) => r.map((c) => csvCell(String(c ?? ""))).join(","));
  return new Response("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="citas-aa-solutions.csv"`,
    },
  });
}
