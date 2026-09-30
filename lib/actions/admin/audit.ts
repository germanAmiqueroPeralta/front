"use server";

import { cookies } from "next/headers";
import { backend, combine, id, orEmpty } from "@/lib/api/server";
import type {
  AlertStatus,
  ApiResult,
  AuditFilters,
  AuditLog,
  BlockScope,
  Device,
  SecurityAlert,
  User,
  UserSession,
} from "@/lib/api/types";

/** Sesión y dispositivo de quien está usando el panel (vienen dentro de su propio token). */
async function currentIds(): Promise<{ sessionId: string | null; deviceId: string | null }> {
  const token = (await cookies()).get("access_token")?.value;
  try {
    const payload = JSON.parse(Buffer.from(token!.split(".")[1], "base64url").toString());
    return { sessionId: payload.sid ?? null, deviceId: payload.did ?? null };
  } catch {
    return { sessionId: null, deviceId: null };
  }
}

export async function loadAuditLogs(filters: AuditFilters): Promise<ApiResult<{ items: AuditLog[]; total: number }>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const logs = await backend<AuditLog[]>(`/audit-logs?${query}`);
  if (!logs.ok) return logs;
  return { ...logs, data: { items: logs.data, total: Number(logs.meta?.total ?? logs.data.length) } };
}

/** Usuarios para mostrar nombres y llenar el filtro "Usuario". */
export async function loadAuditUsers() {
  return backend<User[]>("/users");
}

export async function loadSessionsPage(onlyActive: boolean) {
  const [sessions, devices, users] = await Promise.all([
    backend<UserSession[]>(`/sessions${onlyActive ? "?active=true" : ""}`),
    backend<Device[]>("/devices"),
    backend<User[]>("/users"),
  ]);
  const result = combine({ sessions, devices, users });
  return result.ok ? { ...result, data: { ...result.data, current: await currentIds() } } : result;
}

export async function revokeSession(sessionId: string) {
  return backend<null>(`/sessions/${id(sessionId)}`, { method: "DELETE" });
}

/** Bloquea o desbloquea: solo esa cuenta en ese navegador, o el navegador entero para todas las cuentas. */
export async function setDeviceTrusted(deviceId: string, trusted: boolean, reason?: string, scope: BlockScope = "account") {
  return backend<Device>(`/devices/${id(deviceId)}`, {
    method: "PUT",
    body: { trusted, scope, blocked_reason: trusted ? null : reason },
  });
}

export async function setUserBlocked(userId: string, blocked: boolean, reason?: string) {
  return backend<User>(`/users/${id(userId)}`, {
    method: "PUT",
    body: { blocked, blocked_reason: blocked ? reason : null },
  });
}

/* ───────────── Alertas de riesgo ───────────── */

export async function loadAlerts(status: AlertStatus) {
  const [alerts, users, devices] = await Promise.all([
    backend<SecurityAlert[]>(`/security-alerts?status=${status}`),
    backend<User[]>("/users"),
    backend<Device[]>("/devices"),
  ]);
  return combine({ alerts, users, devices });
}

/** Cantidad de alertas abiertas para el aviso del menú (0 si el rol no puede verlas). */
export async function loadOpenAlertCount(): Promise<ApiResult<number>> {
  const alerts = orEmpty(await backend<SecurityAlert[]>("/security-alerts?status=open"));
  return alerts.ok ? { ...alerts, data: alerts.data.length } : alerts;
}

export async function scanAlerts() {
  return backend<{ created: number }>("/security-alerts/scan", { method: "POST" });
}

export async function closeAlert(alertId: string, status: AlertStatus, resolution: string) {
  return backend<SecurityAlert>(`/security-alerts/${id(alertId)}`, { method: "PUT", body: { status, resolution } });
}
