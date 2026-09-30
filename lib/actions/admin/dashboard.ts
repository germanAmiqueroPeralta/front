"use server";

import { backend, combine } from "@/lib/api/server";
import type {
  AuditLog,
  CarePackage,
  CareService,
  Child,
  ChildControl,
  Claim,
  Guardian,
  HealthFacility,
  Region,
  SecurityAlert,
  User,
  UserSession,
} from "@/lib/api/types";

/** Todo lo que resume el panel del administrador, en una sola ida al servidor. */
export async function loadDashboard() {
  const [children, controls, packages, services, facilities, regions, claims, guardians, users, sessions, changes, alerts] =
    await Promise.all([
      backend<Child[]>("/children"),
      backend<ChildControl[]>("/child-controls"),
      backend<CarePackage[]>("/care-packages"),
      backend<CareService[]>("/care-services"),
      backend<HealthFacility[]>("/health-facilities"),
      backend<Region[]>("/regions"),
      backend<Claim[]>("/claims"),
      backend<Guardian[]>("/guardians"),
      backend<User[]>("/users"),
      backend<UserSession[]>("/sessions?active=true"),
      backend<AuditLog[]>("/audit-logs?limit=6"),
      backend<SecurityAlert[]>("/security-alerts?status=open"),
    ]);
  return combine({ children, controls, packages, services, facilities, regions, claims, guardians, users, sessions, changes, alerts });
}
