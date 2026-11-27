"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { Plus, Trash2, KeyRound } from "lucide-react";
import { createUserAction, deleteUserAction, updateUserAction, type ActionResult } from "@/app/admin/actions";
import type { Role } from "@/lib/session";

const ROLE_HELP: Record<Role, string> = {
  superadmin: "Todo: usuarios, Google, reglas y citas.",
  admin: "Gestiona citas, horarios, bloqueos y gestores.",
  gestor: "Solo ve citas y deja notas.",
};

export function UsersClient({ users, me, roles }: { users: { id: number; email: string; name: string; role: Role; created: string }[]; me: number; roles: Record<Role, string> }) {
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [neu, setNeu] = useState({ name: "", email: "", password: "", role: "gestor" as Role });
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      setFlash({ ok: r.ok, text: r.message ?? (r.ok ? "Listo." : "Error") });
    });
  return (
    <div className="space-y-6">
      {flash && <p className={clsx("rounded-2xl px-4 py-3 text-sm font-bold", flash.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600")}>{flash.text}</p>}
      <section className="overflow-hidden rounded-2xl bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-bold text-brand-navy">{u.name}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <select className="input !w-40 !py-1.5" defaultValue={u.role} disabled={pending || u.id === me} onChange={(e) => run(() => updateUserAction(u.id, { role: e.target.value as Role }))}>
                    {(Object.keys(roles) as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {roles[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="mr-3 text-slate-400 hover:text-brand-navy"
                    title="Cambiar contraseña"
                    onClick={() => {
                      const p = prompt(`Nueva contraseña para ${u.name} (mínimo 8 caracteres):`);
                      if (p) run(() => updateUserAction(u.id, { password: p }));
                    }}
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                  {u.id !== me && (
                    <button className="text-slate-400 hover:text-rose-500" title="Eliminar" onClick={() => confirm(`¿Eliminar a ${u.name}?`) && run(() => deleteUserAction(u.id))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-brand-navy">Nuevo usuario</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className="input" placeholder="Nombre" value={neu.name} onChange={(e) => setNeu({ ...neu, name: e.target.value })} />
          <input className="input" placeholder="Correo" type="email" value={neu.email} onChange={(e) => setNeu({ ...neu, email: e.target.value })} />
          <input className="input" placeholder="Contraseña (mín. 8)" type="password" value={neu.password} onChange={(e) => setNeu({ ...neu, password: e.target.value })} />
          <select className="input" value={neu.role} onChange={(e) => setNeu({ ...neu, role: e.target.value as Role })}>
            {(Object.keys(roles) as Role[]).map((r) => (
              <option key={r} value={r}>
                {roles[r]}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-xs text-slate-500">{ROLE_HELP[neu.role]}</p>
        <button
          className="btn-blue mt-3 !py-2"
          disabled={pending || !neu.name || !neu.email || neu.password.length < 8}
          onClick={() =>
            run(async () => {
              const r = await createUserAction(neu);
              if (r.ok) {
                setNeu({ name: "", email: "", password: "", role: "gestor" });
                setTimeout(() => window.location.reload(), 600);
              }
              return r;
            })
          }
        >
          <Plus className="h-4 w-4" /> Crear usuario
        </button>
      </section>
    </div>
  );
}
