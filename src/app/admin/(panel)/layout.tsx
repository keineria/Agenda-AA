import { requireRole } from "@/lib/auth";
import { Sidebar } from "@/components/admin/Sidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panel", robots: { index: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRole("gestor");
  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      <Sidebar role={s.role} name={s.name} />
      <div className="lg:pl-60">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 lg:px-10 lg:pt-8">{children}</div>
      </div>
    </div>
  );
}
