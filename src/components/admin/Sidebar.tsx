"use client";

import { bp } from "@/lib/paths";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LayoutGrid, CalendarDays, ListChecks, Settings, Users, LogOut, Menu, X, Plus, ExternalLink } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/admin/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/admin/citas", label: "Citas", icon: ListChecks },
  { href: "/admin/configuracion", label: "Horarios y ajustes", icon: Settings, min: "admin" },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users, min: "superadmin" },
];

const RANK = { gestor: 1, admin: 2, superadmin: 3 } as const;

export function Sidebar({ role, name }: { role: "superadmin" | "admin" | "gestor"; name: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !n.min || RANK[role] >= RANK[n.min as keyof typeof RANK]);

  const body = (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-6 pt-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bp("/logo-white.png")} alt="AA Solutions Services" className="h-11 w-auto" />
      </div>
      <div className="grid grid-cols-2 gap-2 px-4">
        <a href={bp("/es/agendar")} target="_blank" className="flex flex-col items-start gap-1 rounded-xl border border-white/25 px-3 py-2.5 text-xs font-bold text-white hover:bg-white/10">
          <Plus className="h-4 w-4" /> Nueva cita
        </a>
        <a href="https://www.aasolutionsllc.com" target="_blank" className="flex flex-col items-start gap-1 rounded-xl border border-white/25 px-3 py-2.5 text-xs font-bold text-white hover:bg-white/10">
          <ExternalLink className="h-4 w-4" /> Ver sitio
        </a>
      </div>
      <nav className="mt-6 flex-1 space-y-1 pr-4">
        {items.map((n) => {
          const active = n.exact ? path === n.href : path.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={clsx(
                "flex items-center gap-3 rounded-r-full py-3 pl-6 pr-4 text-sm font-bold transition",
                active ? "bg-gradient-to-r from-sky-300 to-sky-400 text-brand-navy shadow-soft" : "text-white/85 hover:bg-white/10",
              )}
            >
              <Icon className="h-5 w-5" /> {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-6 py-4 text-white">
        <p className="truncate text-sm font-bold">{name}</p>
        <p className="text-xs capitalize text-white/60">{role}</p>
        <form action={logoutAction}>
          <button className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-white/80 hover:text-white">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 grid h-10 w-10 place-items-center rounded-xl bg-brand-navy text-white shadow-soft lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-brand-navy lg:block">{body}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-brand-navy">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 text-white" aria-label="Cerrar menú">
              <X className="h-5 w-5" />
            </button>
            {body}
          </aside>
        </div>
      )}
    </>
  );
}
