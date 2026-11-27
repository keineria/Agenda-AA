import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { signSession, verifySession, SESSION_COOKIE, type Role, type Session } from "./session";

export type { Role, Session };

/**
 * Roles:
 * - superadmin: todo, incluido usuarios, conexión con Google y ajustes generales.
 * - admin: gestiona citas (editar, mover, cancelar, reenviar avisos, asignar), horarios y bloqueos.
 * - gestor: solo ve las citas y deja notas. No mueve ni edita.
 */
export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  gestor: "Gestor",
};

const RANK: Record<Role, number> = { gestor: 1, admin: 2, superadmin: 3 };

export function hasRole(session: Session | null, min: Role): boolean {
  return !!session && RANK[session.role] >= RANK[min];
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  agent_id: number | null;
  created_at: string;
}

export function listUsers(): AdminUser[] {
  return getDb().prepare(`SELECT * FROM admin_users ORDER BY id`).all() as AdminUser[];
}

export function findUserByEmail(email: string): AdminUser | undefined {
  return getDb().prepare(`SELECT * FROM admin_users WHERE email = ?`).get(email.trim().toLowerCase()) as AdminUser | undefined;
}

export function createUser(u: { email: string; name: string; password: string; role: Role; agentId?: number | null }) {
  if (u.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  const hash = bcrypt.hashSync(u.password, 11);
  getDb()
    .prepare(`INSERT INTO admin_users (email, name, password_hash, role, agent_id) VALUES (?, ?, ?, ?, ?)`)
    .run(u.email.trim().toLowerCase(), u.name.trim(), hash, u.role, u.agentId ?? null);
}

export function updateUser(id: number, patch: { name?: string; role?: Role; password?: string; agentId?: number | null }) {
  const db = getDb();
  if (patch.name) db.prepare(`UPDATE admin_users SET name = ? WHERE id = ?`).run(patch.name.trim(), id);
  if (patch.role) db.prepare(`UPDATE admin_users SET role = ? WHERE id = ?`).run(patch.role, id);
  if (patch.agentId !== undefined) db.prepare(`UPDATE admin_users SET agent_id = ? WHERE id = ?`).run(patch.agentId, id);
  if (patch.password) {
    if (patch.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
    db.prepare(`UPDATE admin_users SET password_hash = ? WHERE id = ?`).run(bcrypt.hashSync(patch.password, 11), id);
  }
}

export function deleteUser(id: number) {
  getDb().prepare(`DELETE FROM admin_users WHERE id = ?`).run(id);
}

/** Si no hay usuarios, crea el superadmin con ADMIN_EMAIL y ADMIN_PASSWORD del entorno. */
export function ensureBootstrapAdmin() {
  const n = (getDb().prepare(`SELECT COUNT(*) AS n FROM admin_users`).get() as { n: number }).n;
  if (n > 0) return;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  createUser({ email, name: process.env.ADMIN_NAME || "Superadmin", password, role: "superadmin" });
}

export async function login(email: string, password: string): Promise<boolean> {
  ensureBootstrapAdmin();
  const user = findUserByEmail(email);
  // Compara aunque no exista el usuario para no revelar qué correos están registrados.
  const ok = bcrypt.compareSync(password, user?.password_hash ?? "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !ok) return false;
  const token = await signSession({ uid: user.id, email: user.email, name: user.name, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return true;
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await verifySession(token);
  if (!s) return null;
  // El rol se relee de la BD por si cambió después de iniciar sesión.
  const row = getDb().prepare(`SELECT id, role, name, email FROM admin_users WHERE id = ?`).get(s.uid) as
    | { id: number; role: Role; name: string; email: string }
    | undefined;
  if (!row) return null;
  return { uid: row.id, role: row.role, name: row.name, email: row.email };
}

/** Para páginas y acciones del servidor: redirige al login o lanza si no alcanza el rol. */
export async function requireRole(min: Role, opts: { redirectTo?: string } = {}): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (!hasRole(s, min)) {
    if (opts.redirectTo) redirect(opts.redirectTo);
    throw new Error("No tienes permiso para esta acción.");
  }
  return s;
}
