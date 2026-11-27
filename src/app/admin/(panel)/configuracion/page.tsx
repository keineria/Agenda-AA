import { getDb, getSettings } from "@/lib/db";
import { requireRole, hasRole } from "@/lib/auth";
import { listWindows } from "@/lib/availability";
import { googleStatus, googleConfigured, appUrl } from "@/lib/google";
import { mailFrom } from "@/lib/mail";
import { fmt } from "@/lib/time";
import { agentsLite } from "@/lib/view";
import { PageHeader } from "@/components/admin/PageHeader";
import { ConfigClient } from "@/components/admin/ConfigClient";

export default async function ConfigPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const s = await requireRole("admin", { redirectTo: "/admin" });
  const sp = await searchParams;
  const blocks = (
    getDb().prepare(`SELECT id, start_at, end_at, reason FROM blocks WHERE agent_id IS NULL AND end_at > ? ORDER BY start_at`).all(new Date().toISOString()) as {
      id: number;
      start_at: string;
      end_at: string;
      reason: string | null;
    }[]
  ).map((b) => ({ id: b.id, from: fmt(b.start_at, "yyyy-MM-dd HH:mm"), to: fmt(b.end_at, "yyyy-MM-dd HH:mm"), reason: b.reason ?? "" }));
  const lastMail = getDb().prepare(`SELECT ok, error, created_at FROM mail_log ORDER BY id DESC LIMIT 1`).get() as { ok: number; error: string | null; created_at: string } | undefined;
  const g = googleStatus();
  return (
    <>
      <PageHeader title="Horarios y ajustes" search={false} />
      <ConfigClient
        isSuper={hasRole(s, "superadmin")}
        windows={listWindows()}
        blocks={blocks}
        agents={agentsLite().map((a) => ({ ...a, ...(getDb().prepare(`SELECT email, phone FROM agents WHERE id = ?`).get(a.id) as { email: string | null; phone: string | null }) }))}
        settings={getSettings()}
        google={{
          ...g,
          configured: googleConfigured(),
          redirectUri: `${appUrl()}/api/admin/google/callback`,
          message: sp.google ?? null,
        }}
        mail={{
          smtp: Boolean(process.env.SMTP_HOST),
          from: mailFrom(),
          last: lastMail ? { ok: !!lastMail.ok, error: lastMail.error, at: fmt(lastMail.created_at, "yyyy-MM-dd HH:mm") } : null,
        }}
      />
    </>
  );
}
