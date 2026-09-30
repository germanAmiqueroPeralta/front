import type { SessionRole } from "@/lib/backend";

/** Nombre legible del módulo de un permiso (`child.post` → "Niños"). */
export const moduleLabels: Record<string, string> = {
  user: "Usuarios",
  role: "Roles",
  permission: "Permisos",
  region: "Micro redes",
  health_facility: "Establecimientos",
  user_region: "Micro redes de usuarios",
  guardian: "Padres",
  child: "Niños",
  child_guardian: "Vínculos padre ↔ hijo",
  care_package: "Paquetes",
  care_service: "Prestaciones",
  child_control: "Controles",
  claim: "Reclamos",
  claim_evidence: "Evidencias de reclamos",
  device: "Dispositivos",
  session: "Sesiones",
  audit_log: "Auditoría",
  security_alert: "Alertas de riesgo",
  portal: "Portal familiar",
};

export const moduleOf = (code: string) => code.split(".")[0];
export const moduleLabel = (code: string) => moduleLabels[moduleOf(code)] ?? moduleOf(code);

export const roleDescriptions: Record<SessionRole, string> = {
  admin: "Administra todo el sistema: usuarios, catálogo, padrón y reclamos.",
  health_staff: "Coordinador: registra padres (con su cuenta del portal), niños, vínculos y controles, y responde reclamos.",
  guardian: "Padre o apoderado: consulta a sus hijos desde el portal familiar.",
};
