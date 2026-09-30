import type { CarePackage, CareService, Child } from "@/lib/api/types";

/** Los paquetes de "RN en riesgo" solo aplican a niños prematuros o con bajo peso. */
export const packageApplies = (pkg: CarePackage, child: Pick<Child, "birth_condition">) =>
  !pkg.at_risk_newborn_only || child.birth_condition !== "none";

/** Prestaciones del catálogo que le corresponden al niño (de paquetes activos que le aplican). */
export function applicableServices(child: Pick<Child, "birth_condition">, packages: CarePackage[], services: CareService[]) {
  const ok = new Set(packages.filter((p) => packageApplies(p, child)).map((p) => p.id));
  return services.filter((s) => ok.has(s.package_id));
}

export type ServiceState = "completed" | "overdue" | "due" | "upcoming" | "not_applicable";

/** Estado de una prestación para un niño de `age` días: cumplida, vencida, le falta (está en plazo) o todavía no le toca. */
export function serviceState(age: number, service: CareService, control?: { status: string }): ServiceState {
  if (control?.status === "completed") return "completed";
  if (control?.status === "not_applicable") return "not_applicable";
  if (age < service.min_age_days) return "upcoming";
  return age > service.max_age_days ? "overdue" : "due";
}

/** Momento del paquete según la edad: vigente, ya pasó o todavía no empieza. */
export function packagePhase(age: number, pkg: CarePackage): "current" | "past" | "future" {
  if (age > pkg.max_age_days) return "past";
  return age < pkg.min_age_days ? "future" : "current";
}
