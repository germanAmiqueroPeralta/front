"use server";

import { backend, combine, id } from "@/lib/api/server";
import type { HealthFacility, Region } from "@/lib/api/types";

export async function loadTerritory() {
  const [regions, facilities] = await Promise.all([
    backend<Region[]>("/regions"),
    backend<HealthFacility[]>("/health-facilities"),
  ]);
  return combine({ regions, facilities });
}

export async function saveRegion(input: { name: string; health_network?: string }, regionId?: string) {
  return regionId
    ? backend<Region>(`/regions/${id(regionId)}`, { method: "PUT", body: input })
    : backend<Region>("/regions", { method: "POST", body: input });
}

export async function deleteRegion(regionId: string) {
  return backend<null>(`/regions/${id(regionId)}`, { method: "DELETE" });
}

export async function saveFacility(input: { name: string; region_id: string }, facilityId?: string) {
  return facilityId
    ? backend<HealthFacility>(`/health-facilities/${id(facilityId)}`, { method: "PUT", body: input })
    : backend<HealthFacility>("/health-facilities", { method: "POST", body: input });
}

export async function deleteFacility(facilityId: string) {
  return backend<null>(`/health-facilities/${id(facilityId)}`, { method: "DELETE" });
}
