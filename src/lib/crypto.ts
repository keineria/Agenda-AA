import crypto from "node:crypto";

/**
 * Cifrado AES-256-GCM para datos sensibles (SSN/ITIN, cuentas bancarias, IP PIN,
 * tokens de Google). La clave sale de ENCRYPTION_KEY (32 bytes en base64).
 * Si se pierde la clave, los datos cifrados no se pueden recuperar: respáldala.
 */

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
    // Acepta cualquier frase y la deriva a 32 bytes.
    return crypto.createHash("sha256").update(raw).digest();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta ENCRYPTION_KEY en el entorno de producción.");
  }
  return crypto.createHash("sha256").update("dev-only-key-agenda-aa").digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(":");
  if (v !== "v1") throw new Error("Formato de cifrado desconocido");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export function encryptJson(obj: unknown): string {
  return encrypt(JSON.stringify(obj));
}

export function decryptJson<T = Record<string, string>>(payload: string | null | undefined): T | null {
  if (!payload) return null;
  try {
    return JSON.parse(decrypt(payload)) as T;
  } catch {
    return null;
  }
}

/** Solo los últimos 4 caracteres: "•••-••-1234". */
export function mask(value: string): string {
  const clean = value.replace(/\s/g, "");
  if (clean.length <= 4) return "••••";
  return `•••• ${clean.slice(-4)}`;
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Código corto y legible para el cliente: AA-7K3F2Q */
export function bookingCode(): string {
  const bytes = crypto.randomBytes(6);
  let s = "";
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `AA-${s}`;
}
