import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BACKEND_URL, type BackendUser, type SessionRole } from "@/lib/backend";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

async function loadSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;

  const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: `access_token=${token}` },
    cache: "no-store",
  });
  if (!meRes.ok) return null;
  const meBody = await meRes.json();
  const user = meBody.data as BackendUser;

  const role = user.role ?? (cookieStore.get("session_role")?.value as SessionRole | undefined);
  if (!role) return null;

  return {
    id: user.id,
    name: user.full_name,
    role,
    establishment: "Red de Salud Huamanga",
  };
}

export default async function DashboardPage() {
  const session = await loadSession();
  if (!session) redirect("/session-expired");

  return <DashboardClient session={session} />;
}
