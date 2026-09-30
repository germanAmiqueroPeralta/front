"use server";

import { cookies, headers } from "next/headers";
import {
  BACKEND_URL,
  parseSetCookie,
  type BackendUser,
  type SessionRole,
} from "@/lib/backend";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60,
};

/** El backend identifica el navegador con esta cookie; dura lo mismo que allá (~400 días). */
const DEVICE_COOKIE_OPTIONS = { ...COOKIE_OPTIONS, maxAge: 400 * 24 * 60 * 60 };

type LoginResult = { ok: true; user: BackendUser; role: SessionRole } | { ok: false; error: string };

/**
 * Devuelve el error en lugar de lanzarlo: en producción Next oculta el mensaje de los
 * errores lanzados en Server Actions y el usuario vería un error genérico de React.
 */
export async function loginAction(username: string, password: string): Promise<LoginResult> {
  const cookieStore = await cookies();
  const userAgent = (await headers()).get("user-agent") ?? "";
  const deviceToken = cookieStore.get("device_token")?.value;

  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
      ...(deviceToken ? { Cookie: `device_token=${deviceToken}` } : {}),
    },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  }).catch(() => null);
  if (!loginRes) return { ok: false, error: "No se pudo conectar con el servidor" };
  const loginBody = await loginRes.json().catch(() => null);
  if (!loginRes.ok) {
    return { ok: false, error: loginBody?.msg ?? "Credenciales inválidas" };
  }

  const setCookies = loginRes.headers.getSetCookie();
  const token = parseSetCookie(setCookies, "access_token");
  if (!token) {
    return { ok: false, error: "No se recibió la sesión del servidor" };
  }
  const newDeviceToken = parseSetCookie(setCookies, "device_token");

  // El backend devuelve el nombre del rol junto al usuario: no todos los roles pueden leer /roles.
  const user = loginBody.data as BackendUser;
  const role = user.role;
  if (!role) return { ok: false, error: "Tu cuenta no tiene un rol válido" };

  cookieStore.set("access_token", token, COOKIE_OPTIONS);
  cookieStore.set("session_role", role, COOKIE_OPTIONS);
  if (newDeviceToken) cookieStore.set("device_token", newDeviceToken, DEVICE_COOKIE_OPTIONS);

  return { ok: true, user, role };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  const userAgent = (await headers()).get("user-agent") ?? "";

  await fetch(`${BACKEND_URL}/api/auth/logout`, {
    method: "POST",
    headers: token ? { Cookie: `access_token=${token}`, "User-Agent": userAgent } : { "User-Agent": userAgent },
    cache: "no-store",
  }).catch(() => null);

  cookieStore.delete("access_token");
  cookieStore.delete("session_role");
}
