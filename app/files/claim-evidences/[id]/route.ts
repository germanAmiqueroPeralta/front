import { cookies, headers } from "next/headers";
import { BACKEND_URL } from "@/lib/backend";

/**
 * Descarga una evidencia de reclamo: el navegador no tiene el token del backend,
 * así que este Route Handler lo reenvía y devuelve el archivo tal cual.
 */
export async function GET(_request: Request, ctx: RouteContext<"/files/claim-evidences/[id]">) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return new Response("Tu sesión terminó, vuelve a ingresar", { status: 401 });

  // El padre descarga por el portal (solo evidencias de sus propios reclamos).
  const base = cookieStore.get("session_role")?.value === "guardian" ? "portal/claim-evidences" : "claim-evidences";
  const res = await fetch(`${BACKEND_URL}/api/${base}/${encodeURIComponent(id)}/file`, {
    headers: { Cookie: `access_token=${token}`, "User-Agent": (await headers()).get("user-agent") ?? "" },
    cache: "no-store",
  }).catch(() => null);

  if (!res) return new Response("No se pudo conectar con el servidor", { status: 503 });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    return new Response(payload?.msg ?? `Error ${res.status} del servidor`, { status: res.status });
  }

  const out = new Headers();
  for (const name of ["content-type", "content-length", "content-disposition"]) {
    const value = res.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(res.body, { status: 200, headers: out });
}
