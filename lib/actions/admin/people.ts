"use server";

import { backend, combine, id, orEmpty } from "@/lib/api/server";
import type {
  ApiResult,
  Child,
  ChildGuardian,
  ChildInput,
  Guardian,
  GuardianInput,
  HealthFacility,
  Region,
  Role,
  User,
} from "@/lib/api/types";

/** Todo lo que necesitan las pantallas de padres y niños, en una sola ida al servidor. */
export async function loadPeople() {
  const [guardians, children, links, facilities, regions, users, roles] = await Promise.all([
    backend<Guardian[]>("/guardians"),
    backend<Child[]>("/children"),
    backend<ChildGuardian[]>("/child-guardians"),
    backend<HealthFacility[]>("/health-facilities"),
    backend<Region[]>("/regions"),
    backend<User[]>("/users").then(orEmpty),
    backend<Role[]>("/roles").then(orEmpty),
  ]);
  return combine({ guardians, children, links, facilities, regions, users, roles });
}

/* ───────────── Padres ───────────── */

export async function saveGuardian(input: GuardianInput, guardianId?: string) {
  return guardianId
    ? backend<Guardian>(`/guardians/${id(guardianId)}`, { method: "PUT", body: input })
    : backend<Guardian>("/guardians", { method: "POST", body: input });
}

export async function deleteGuardian(guardianId: string) {
  return backend<null>(`/guardians/${id(guardianId)}`, { method: "DELETE" });
}

/* ───────────── Niños ───────────── */

/**
 * Registra al niño y lo vincula al padre. Son dos llamadas al backend: si la segunda
 * falla, el niño queda registrado y se avisa para vincularlo con "Vincular hijo existente".
 */
export async function createChildForGuardian(
  guardianId: string,
  input: ChildInput,
  relationship: string,
): Promise<ApiResult<Child>> {
  const created = await backend<Child>("/children", { method: "POST", body: input });
  if (!created.ok) return created;

  const link = await backend<ChildGuardian>("/child-guardians", {
    method: "POST",
    body: { child_id: created.data.id, guardian_id: guardianId, relationship },
  });
  if (!link.ok) {
    return {
      ok: false,
      status: link.status,
      error: `El niño se registró, pero no se pudo vincular (${link.error}). Usa "Vincular hijo existente".`,
    };
  }
  return { ...created, msg: "Hijo registrado y vinculado correctamente" };
}

export async function updateChild(childId: string, input: Partial<ChildInput>) {
  return backend<Child>(`/children/${id(childId)}`, { method: "PUT", body: input });
}

export async function deleteChild(childId: string) {
  return backend<null>(`/children/${id(childId)}`, { method: "DELETE" });
}

/* ───────────── Vínculos padre ↔ hijo ───────────── */

export async function linkChild(guardianId: string, childId: string, relationship: string) {
  return backend<ChildGuardian>("/child-guardians", {
    method: "POST",
    body: { child_id: childId, guardian_id: guardianId, relationship },
  });
}

export async function updateLink(guardianId: string, childId: string, relationship: string) {
  return backend<ChildGuardian>(`/child-guardians/${id(childId)}/${id(guardianId)}`, {
    method: "PUT",
    body: { relationship },
  });
}

export async function unlinkChild(guardianId: string, childId: string) {
  return backend<null>(`/child-guardians/${id(childId)}/${id(guardianId)}`, { method: "DELETE" });
}
