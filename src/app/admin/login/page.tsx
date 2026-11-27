import { bp } from "@/lib/paths";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Ingresar", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="bg-public grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="card px-7 pb-8 pt-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bp("/logo.jpg")} alt="AA Solutions Services" className="h-14 w-14 rounded-xl" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Panel de citas</h1>
          <p className="text-sm text-brand-muted">AA Solutions Services</p>
          <LoginForm next={next ?? "/admin"} />
        </div>
      </div>
    </div>
  );
}
