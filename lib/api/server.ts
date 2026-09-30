import { cookies, headers } from "next/headers";
import { BACKEND_URL } from "@/lib/backend";
import type { ApiResult } from "@/lib/api/types";

/**
 * Llamada al backend desde una Server Action: reenvía la cookie de sesión y el navegador
 * del usuario (el backend los usa para la sesión y la auditoría). Solo importar desde
 * archivos "use server": el token nunca llega al navegador.
 * `body` va como JSON; `form` como multipart (subida de archivos).
 */
export async function backend<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; form?: FormData } = {},
): Promise<ApiResult<T>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return { ok: false, status: 401, error: "Tu sesión terminó, vuelve a ingresar" };

  const userAgent = (await headers()).get("user-agent") ?? "";
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    method: init.method ?? "GET",
    headers: {
      Cookie: `access_token=${token}`,
      "User-Agent": userAgent,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    cache: "no-store",
  }).catch(() => null);

  if (!res) return { ok: false, status: 503, error: "No se pudo conectar con el servidor" };

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) {
      cookieStore.delete("access_token");
      cookieStore.delete("session_role");
    }
    return { ok: false, status: res.status, error: payload?.msg ?? `Error ${res.status} del servidor` };
  }
  return { ok: true, data: payload?.data as T, msg: payload?.msg ?? "", meta: payload?.meta };
}

/** Une varias lecturas hechas en paralelo: si alguna falla, devuelve ese error. */
export function combine<T extends Record<string, ApiResult<unknown>>>(
  results: T,
): ApiResult<{ [K in keyof T]: T[K] extends ApiResult<infer U> ? U : never }> {
  const data: Record<string, unknown> = {};
  for (const [key, result] of Object.entries(results)) {
    if (!result.ok) return result;
    data[key] = result.data;
  }
  return { ok: true, data: data as { [K in keyof T]: T[K] extends ApiResult<infer U> ? U : never }, msg: "" };
}

export const id = (value: string) => encodeURIComponent(value);

/**
 * Para listas de apoyo que no todos los roles pueden leer (p. ej. el coordinador no ve
 * usuarios): un 403 se trata como lista vacía en vez de romper toda la pantalla.
 */
export function orEmpty<T>(result: ApiResult<T[]>): ApiResult<T[]> {
  return !result.ok && result.status === 403 ? { ok: true, data: [], msg: "" } : result;
}
