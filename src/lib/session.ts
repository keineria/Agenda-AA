import { jwtVerify, SignJWT } from "jose";

/** Sesión firmada (JWT HS256). Se usa también en el middleware (runtime edge), sin acceso a la BD. */

export type Role = "superadmin" | "admin" | "gestor";
export interface Session {
  uid: number;
  email: string;
  name: string;
  role: Role;
}

export const SESSION_COOKIE = "aa_admin";

function secret() {
  const s = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-session-secret-agenda-aa");
  if (!s) throw new Error("Falta SESSION_SECRET en el entorno.");
  return new TextEncoder().encode(s);
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}
