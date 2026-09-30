export const BACKEND_URL =
  process.env.API_BACKEND_URL ?? process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export type SessionRole = "guardian" | "health_staff" | "admin";

export type BackendUser = {
  id: string;
  username: string;
  role_id: string;
  role: SessionRole | null;
  full_name: string;
  dni: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  blocked: boolean;
};

export type Session = {
  id: string;
  name: string;
  role: SessionRole;
  establishment: string;
};

/** Busca una cookie entre los `Set-Cookie` de la respuesta del backend (usar `headers.getSetCookie()`). */
export function parseSetCookie(setCookies: string[], name: string): string | null {
  for (const header of setCookies) {
    const match = header.match(new RegExp(`^${name}=([^;]*)`));
    if (match) return match[1];
  }
  return null;
}
