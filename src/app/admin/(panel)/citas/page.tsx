import { bp } from "@/lib/paths";
import Link from "next/link";
import { Download } from "lucide-react";
import { listBookings, STATUS_LABEL } from "@/lib/bookings";
import { filtersFrom, type SP } from "@/lib/filters";
import { SERVICES } from "@/lib/catalog";
import { agentsLite, toCard } from "@/lib/view";
import { PageHeader } from "@/components/admin/PageHeader";
import { Avatar, DateChip, ModeIcon, ServiceTag, StatusChip, fmt12 } from "@/components/admin/ui";

export default async function ListPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f = filtersFrom(sp);
  let rows = listBookings(f);
  if (f.unassigned) rows = rows.filter((b) => !b.agent_id);
  const cards = rows.map(toCard);
  const agents = agentsLite();
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader title="Citas" search={false}>
        <a href={bp(`/api/admin/export?${qs}`)} className="btn-ghost !py-2">
          <Download className="h-4 w-4" /> Exportar CSV
        </a>
      </PageHeader>

      <form className="mb-5 grid gap-3 rounded-2xl bg-white p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <input name="q" defaultValue={sp.q} placeholder="Nombre, correo, teléfono o código" className="input !py-2 xl:col-span-2" />
        <select name="periodo" defaultValue={sp.periodo ?? "proximas"} className="input !py-2">
          <option value="proximas">Próximas</option>
          <option value="pasadas">Pasadas</option>
          <option value="todas">Todas</option>
        </select>
        <select name="estado" defaultValue={sp.estado ?? ""} className="input !py-2">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v.es}
            </option>
          ))}
        </select>
        <select name="servicio" defaultValue={sp.servicio ?? ""} className="input !py-2">
          <option value="">Todos los servicios</option>
          {SERVICES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name.es}
            </option>
          ))}
        </select>
        <select name="gestor" defaultValue={sp.gestor ?? ""} className="input !py-2">
          <option value="">Todos los gestores</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select name="asignacion" defaultValue={sp.asignacion ?? ""} className="input !py-2">
          <option value="">Con o sin gestor</option>
          <option value="sin">Sin gestor asignado</option>
        </select>
        <div className="flex gap-2">
          <button className="btn-blue flex-1 !py-2">Filtrar</button>
          <Link href="/admin/citas" className="btn-ghost !px-3 !py-2">
            Limpiar
          </Link>
        </div>
        <label className="text-xs font-bold text-slate-500 xl:col-span-2">
          Desde <input type="date" name="desde" defaultValue={sp.desde} className="input mt-1 !py-2" />
        </label>
        <label className="text-xs font-bold text-slate-500 xl:col-span-2">
          Hasta <input type="date" name="hasta" defaultValue={sp.hasta} className="input mt-1 !py-2" />
        </label>
      </form>

      <p className="mb-3 text-sm text-slate-500">{cards.length} {cards.length === 1 ? "cita" : "citas"}</p>

      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-soft md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Servicio</th>
              <th className="px-4 py-3">Modalidad</th>
              <th className="px-4 py-3">Gestor</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cards.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/citas/${b.id}`} className="flex items-center gap-2">
                    <DateChip date={b.date} />
                    <span className="font-bold text-slate-700">{fmt12(b.time)}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/citas/${b.id}`} className="font-bold text-brand-navy hover:underline">
                    {b.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {b.email} · {b.code}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <ServiceTag name={b.serviceShort} color={b.color} />
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <ModeIcon mode={b.mode} /> {b.mode === "virtual" ? "Virtual" : "Presencial"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {b.agentName ? (
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={b.agentName} photo={b.agentPhoto} color={b.agentColor} size={24} /> {b.agentName.split(" ")[0]}
                    </span>
                  ) : (
                    <span className="chip bg-amber-50 text-amber-600">Sin asignar</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusChip label={b.statusLabel} color={b.statusColor} />
                </td>
              </tr>
            ))}
            {cards.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No hay citas con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {cards.map((b) => (
          <Link key={b.id} href={`/admin/citas/${b.id}`} className="block rounded-2xl bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <DateChip date={b.date} />
              <StatusChip label={b.statusLabel} color={b.statusColor} />
            </div>
            <p className="mt-2 font-bold text-brand-navy">{b.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <ServiceTag name={b.serviceShort} color={b.color} />
              <ModeIcon mode={b.mode} /> {fmt12(b.time)} · {b.agentName ?? "Sin asignar"}
            </div>
          </Link>
        ))}
        {cards.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">No hay citas con estos filtros.</p>}
      </div>
    </>
  );
}
