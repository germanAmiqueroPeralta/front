/** Tipos de la API real (SICNA-backend). Reflejan el `to_dict()` de cada módulo. */

import type { SessionRole } from "@/lib/backend";

export type ApiResult<T> =
  | { ok: true; data: T; msg: string; meta?: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export type Role = {
  id: string;
  name: SessionRole;
  is_active: boolean;
  permission_ids: string[];
};

export type Permission = {
  id: string;
  code: string;
  description: string | null;
};

export type User = {
  id: string;
  username: string;
  role_id: string;
  full_name: string;
  dni: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  blocked: boolean;
  blocked_reason: string | null;
  region_ids: string[];
  created_at: string | null;
};

export type Region = {
  id: string;
  name: string;
  health_network: string | null;
  active: boolean;
};

export type HealthFacility = {
  id: string;
  name: string;
  region_id: string;
  active: boolean;
};

export type Guardian = {
  id: string;
  full_name: string;
  dni: string;
  phone: string | null;
  email: string | null;
  user_id: string | null;
  active: boolean;
};

export type BirthCondition = "none" | "premature" | "low_weight" | "premature_low_weight";

export type Child = {
  id: string;
  padron_code: string;
  medical_record_code: string | null;
  dni: string | null;
  first_names: string;
  last_names: string;
  birth_date: string;
  gender: "M" | "F" | null;
  birth_condition: BirthCondition;
  mother_name: string | null;
  mother_dni: string | null;
  address: string | null;
  contact_phone: string | null;
  insurance: string | null;
  health_facility_id: string;
  active: boolean;
};

export type ChildGuardian = {
  child_id: string;
  guardian_id: string;
  relationship: string;
};

export type UserInput = {
  username?: string;
  password?: string;
  role_id?: string;
  full_name?: string;
  dni?: string | null;
  phone?: string | null;
  email?: string | null;
  blocked?: boolean;
  blocked_reason?: string | null;
  region_ids?: string[];
};

export type GuardianInput = {
  full_name: string;
  dni: string;
  phone: string | null;
  email: string | null;
  user_id?: string | null;
  /** Crea la cuenta del portal familiar (rol apoderado) junto con el padre. */
  account_username?: string;
  account_password?: string;
};

export type ChildInput = Omit<Child, "id" | "active">;

export const birthConditionLabels: Record<BirthCondition, string> = {
  none: "Normal",
  premature: "Prematuro",
  low_weight: "Bajo peso",
  premature_low_weight: "Prematuro y bajo peso",
};

export const RELATIONSHIPS = ["Madre", "Padre", "Abuelo(a)", "Tío(a)", "Hermano(a)", "Apoderado"];

export const childName = (c: Pick<Child, "first_names" | "last_names">) => `${c.first_names} ${c.last_names}`;

export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

export type AuditLog = {
  id: string;
  user_id: string | null;
  device_id: string | null;
  action: AuditAction;
  affected_table: string | null;
  record_id: string | null;
  record_key: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  result: string;
  details: { old?: Record<string, unknown>; new?: Record<string, unknown> } | null;
  created_at: string;
};

export type AuditFilters = {
  user_id?: string;
  affected_table?: string;
  action?: AuditAction;
  date_from?: string;
  date_to?: string;
  limit: number;
  offset: number;
};

export type UserSession = {
  id: string;
  user_id: string;
  device_id: string;
  ip_address: string | null;
  created_at: string | null;
  expires_at: string;
  revoked: boolean;
  revoked_reason: string | null;
};

export type BlockScope = "account" | "browser";

export type Device = {
  id: string;
  user_id: string;
  /** Identificador corto del navegador: el mismo en todas las cuentas que lo usan. */
  browser: string;
  user_agent: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  trusted: boolean;
  block_scope: BlockScope | null;
  blocked_reason: string | null;
  blocked_at: string | null;
  blocked_by: string | null;
};

export type AlertStatus = "open" | "resolved" | "dismissed";

type AlertBase = {
  id: string;
  user_id: string | null;
  browser: string | null;
  status: AlertStatus;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Un navegador usado por varias cuentas. */
export type SharedDeviceAlert = AlertBase & {
  kind: "shared_device";
  detail: {
    total: number;
    items: { device_id: string; user_id: string; username: string; full_name: string; user_agent: string | null; last_seen_at: string }[];
  };
};

/** Una cuenta que entra desde varios dispositivos. */
export type ManyDevicesAlert = AlertBase & {
  kind: "many_devices";
  detail: {
    total: number;
    username: string;
    full_name: string;
    items: { device_id: string; browser: string; user_agent: string | null; last_seen_at: string }[];
  };
};

export type SecurityAlert = SharedDeviceAlert | ManyDevicesAlert;

/* ───────────── Catálogo SISNAT y controles ───────────── */

export type CarePackage = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  min_age_days: number;
  max_age_days: number;
  at_risk_newborn_only: boolean;
  sort_order: number;
  active: boolean;
};

export type CarePackageInput = Omit<CarePackage, "id" | "active"> & { active?: boolean };

export type CareService = {
  id: string;
  package_id: string;
  code: string;
  name: string;
  group_name: string;
  group_order: number;
  sort_order: number;
  min_age_days: number;
  max_age_days: number;
  min_interval_days: number;
  active: boolean;
};

export type CareServiceInput = Omit<CareService, "id" | "active"> & { active?: boolean };

export type ControlStatus = "pending" | "completed" | "overdue" | "not_applicable";

export type ChildControl = {
  id: string;
  child_id: string;
  service_id: string;
  status: ControlStatus;
  scheduled_date: string | null;
  completed_date: string | null;
  health_facility_id: string | null;
  batch_number: string | null;
  book_page: string | null;
  book_record: string | null;
  notes: string | null;
  registered_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ChildControlInput = {
  status?: ControlStatus;
  scheduled_date: string | null;
  completed_date: string | null;
  health_facility_id: string | null;
  batch_number: string | null;
  book_page: string | null;
  book_record: string | null;
  notes: string | null;
};

export const controlStatusLabels: Record<ControlStatus, string> = {
  pending: "Pendiente",
  completed: "Cumplido",
  overdue: "Vencido",
  not_applicable: "No aplica",
};

/* ───────────── Reclamos ───────────── */

export type ClaimStatus = "pending" | "in_review" | "resolved" | "rejected";

export type Claim = {
  id: string;
  child_id: string;
  requester_user_id: string;
  requester_dni: string;
  child_dni: string | null;
  child_identifier: string;
  health_facility_id: string | null;
  service_id: string | null;
  attention_date: string | null;
  message: string;
  status: ClaimStatus;
  response: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ClaimInput = {
  child_id: string;
  requester_dni: string;
  health_facility_id: string | null;
  service_id: string | null;
  attention_date: string | null;
  message: string;
};

export type ClaimEvidence = {
  id: string;
  claim_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string | null;
};

export const claimStatusLabels: Record<ClaimStatus, string> = {
  pending: "Pendiente",
  in_review: "En revisión",
  resolved: "Resuelto",
  rejected: "Rechazado",
};

/* ───────────── Portal familiar (padre con sesión) ───────────── */

export type PortalChild = Child & { relationship: string };

export type PortalOverview = {
  guardian: Guardian;
  children: PortalChild[];
  controls: ChildControl[];
  packages: CarePackage[];
  services: CareService[];
  facilities: HealthFacility[];
};

export type PortalClaims = { claims: Claim[]; evidences: ClaimEvidence[] };

export const MAX_EVIDENCES = 5;
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
