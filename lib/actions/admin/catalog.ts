"use server";

import { backend, combine, id } from "@/lib/api/server";
import type {
  CarePackage,
  CarePackageInput,
  CareService,
  CareServiceInput,
  Child,
  ChildControl,
  ChildControlInput,
  ChildGuardian,
  Guardian,
  HealthFacility,
} from "@/lib/api/types";

/** Paquetes y prestaciones (catálogo SISNAT). */
export async function loadCatalog() {
  const [packages, services] = await Promise.all([
    backend<CarePackage[]>("/care-packages"),
    backend<CareService[]>("/care-services"),
  ]);
  return combine({ packages, services });
}

export async function saveCarePackage(input: CarePackageInput, packageId?: string) {
  return packageId
    ? backend<CarePackage>(`/care-packages/${id(packageId)}`, { method: "PUT", body: input })
    : backend<CarePackage>("/care-packages", { method: "POST", body: input });
}

export async function deleteCarePackage(packageId: string) {
  return backend<null>(`/care-packages/${id(packageId)}`, { method: "DELETE" });
}

export async function saveCareService(input: CareServiceInput, serviceId?: string) {
  return serviceId
    ? backend<CareService>(`/care-services/${id(serviceId)}`, { method: "PUT", body: input })
    : backend<CareService>("/care-services", { method: "POST", body: input });
}

export async function deleteCareService(serviceId: string) {
  return backend<null>(`/care-services/${id(serviceId)}`, { method: "DELETE" });
}

/* ───────────── Controles de un niño ───────────── */

export async function loadChildControls(childId: string) {
  const [child, controls, packages, services, facilities] = await Promise.all([
    backend<Child>(`/children/${id(childId)}`),
    backend<ChildControl[]>(`/child-controls?child_id=${id(childId)}`),
    backend<CarePackage[]>("/care-packages"),
    backend<CareService[]>("/care-services"),
    backend<HealthFacility[]>("/health-facilities"),
  ]);
  return combine({ child, controls, packages, services, facilities });
}

export async function createChildControl(childId: string, serviceId: string, input: ChildControlInput) {
  return backend<ChildControl>("/child-controls", {
    method: "POST",
    body: { child_id: childId, service_id: serviceId, ...input },
  });
}

export async function updateChildControl(controlId: string, input: ChildControlInput) {
  return backend<ChildControl>(`/child-controls/${id(controlId)}`, { method: "PUT", body: input });
}

export async function deleteChildControl(controlId: string) {
  return backend<null>(`/child-controls/${id(controlId)}`, { method: "DELETE" });
}

/** Búsqueda y seguimiento: padres, niños, vínculos, catálogo y todos los controles. */
export async function loadTracking() {
  const [guardians, children, links, packages, services, controls, facilities] = await Promise.all([
    backend<Guardian[]>("/guardians"),
    backend<Child[]>("/children"),
    backend<ChildGuardian[]>("/child-guardians"),
    backend<CarePackage[]>("/care-packages"),
    backend<CareService[]>("/care-services"),
    backend<ChildControl[]>("/child-controls"),
    backend<HealthFacility[]>("/health-facilities"),
  ]);
  return combine({ guardians, children, links, packages, services, controls, facilities });
}
