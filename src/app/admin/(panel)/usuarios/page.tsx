import { listUsers, requireRole, ROLE_LABEL } from "@/lib/auth";
import { fmt } from "@/lib/time";
import { PageHeader } from "@/components/admin/PageHeader";
import { UsersClient } from "@/components/admin/UsersClient";

export default async function UsersPage() {
  const s = await requireRole("superadmin", { redirectTo: "/admin" });
  const users = listUsers().map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, created: fmt(u.created_at, "yyyy-MM-dd") }));
  return (
    <>
      <PageHeader title="Usuarios" search={false} />
      <UsersClient users={users} me={s.uid} roles={ROLE_LABEL} />
    </>
  );
}
