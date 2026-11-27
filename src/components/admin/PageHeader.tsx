import { bp } from "@/lib/paths";
import { Search } from "lucide-react";

export function PageHeader({ title, children, search = true }: { title: string; children?: React.ReactNode; search?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <h1 className="font-display text-2xl font-semibold text-brand-navy sm:text-[28px]">{title}</h1>
      {search && (
        <form action={bp("/admin/citas")} className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input name="q" placeholder="Buscar por nombre, correo o código" className="w-full rounded-full border-0 bg-slate-200/60 py-2.5 pl-10 pr-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-sky-300" />
        </form>
      )}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}
