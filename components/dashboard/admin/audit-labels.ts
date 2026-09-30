import type { AuditAction, AuditLog } from "@/lib/api/types";
import type { Tone } from "@/lib/dashboard/cred";

export const tableLabels: Record<string, string> = {
  users: "Usuarios",
  security_alerts: "Alertas de riesgo",
  roles: "Roles",
  permissions: "Permisos",
  role_permission: "Permisos de rol",
  regions: "Micro redes",
  health_facilities: "Establecimientos",
  user_region: "Micro redes de usuario",
  guardians: "Padres",
  children: "Niños",
  child_guardian: "Vínculos padre ↔ hijo",
  care_packages: "Paquetes",
  care_services: "Prestaciones",
  child_controls: "Controles",
  claims: "Reclamos",
  claim_evidences: "Evidencias",
  devices: "Dispositivos",
  sessions: "Sesiones",
};

export const actionLabels: Record<AuditAction, { label: string; tone: Tone }> = {
  INSERT: { label: "Creó", tone: "good" },
  UPDATE: { label: "Editó", tone: "default" },
  DELETE: { label: "Eliminó", tone: "danger" },
};

export const revokedReasonLabels: Record<string, string> = {
  logout: "Cerró sesión",
  revoked_by_admin: "Cerrada por un administrador",
  device_blocked: "Dispositivo bloqueado",
};

/** "Chrome en Windows" en lugar del user agent completo. */
export function describeAgent(ua: string | null | undefined) {
  if (!ua) return "Desconocido";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iPhone"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (browser && os) return `${browser} en ${os}`;
  return browser ?? os ?? (ua.length > 40 ? `${ua.slice(0, 40)}…` : ua);
}

const LIMA = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const formatDateTime = (iso: string | null | undefined) => (iso ? LIMA.format(new Date(iso)) : "—");

/** Texto corto que identifica el registro afectado (nombre, código, usuario…). */
export function summarize(log: AuditLog) {
  const row = log.details?.new ?? log.details?.old ?? {};
  const pick = (...keys: string[]) => keys.map((k) => row[k]).find((v) => typeof v === "string" && v) as string | undefined;
  const person = row.first_names ? `${row.first_names} ${row.last_names ?? ""}`.trim() : undefined;
  return (
    pick("full_name", "username") ??
    person ??
    pick("name", "code", "padron_code", "original_name", "relationship", "user_agent") ??
    (log.record_id ? `#${log.record_id.slice(0, 8)}` : "—")
  );
}

/** Campos que cambiaron entre antes y después (en altas/bajas, todos los campos). */
export function changedFields(log: AuditLog) {
  const before = log.details?.old ?? {};
  const after = log.details?.new ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys
    .map((key) => ({
      key,
      before: before[key],
      after: after[key],
      changed: log.action !== "UPDATE" || JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    }))
    .sort((a, b) => Number(b.changed) - Number(a.changed));
}

export function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
