import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/**
 * La sesión dejó de valer en el backend (cerrada, vencida o dispositivo bloqueado) pero la
 * cookie sigue en el navegador. Un Server Component no puede borrarla, así que el dashboard
 * redirige aquí: sin esto, proxy.ts mandaría de /login a /dashboard en bucle.
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("session_role");
  return NextResponse.redirect(new URL("/login", request.url));
}
