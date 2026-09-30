"use server";

import { backend, combine, id, orEmpty } from "@/lib/api/server";
import type {
  CareService,
  Child,
  Claim,
  ClaimEvidence,
  ClaimInput,
  ClaimStatus,
  HealthFacility,
  User,
} from "@/lib/api/types";

/** Reclamos más lo necesario para mostrarlos con nombres (niño, solicitante, prestación). */
export async function loadClaims() {
  const [claims, children, users, services, facilities] = await Promise.all([
    backend<Claim[]>("/claims"),
    backend<Child[]>("/children"),
    backend<User[]>("/users").then(orEmpty),
    backend<CareService[]>("/care-services"),
    backend<HealthFacility[]>("/health-facilities"),
  ]);
  return combine({ claims, children, users, services, facilities });
}

export async function loadClaim(claimId: string) {
  const [claim, evidences, children, users, services, facilities] = await Promise.all([
    backend<Claim>(`/claims/${id(claimId)}`),
    backend<ClaimEvidence[]>(`/claim-evidences?claim_id=${id(claimId)}`),
    backend<Child[]>("/children"),
    backend<User[]>("/users").then(orEmpty),
    backend<CareService[]>("/care-services"),
    backend<HealthFacility[]>("/health-facilities"),
  ]);
  return combine({ claim, evidences, children, users, services, facilities });
}

export async function createClaim(input: ClaimInput) {
  return backend<Claim>("/claims", { method: "POST", body: input });
}

export async function reviewClaim(claimId: string, input: { status: ClaimStatus; response: string | null }) {
  return backend<Claim>(`/claims/${id(claimId)}`, { method: "PUT", body: input });
}

export async function deleteClaim(claimId: string) {
  return backend<null>(`/claims/${id(claimId)}`, { method: "DELETE" });
}

/** `form` trae `claim_id` y `file` (el backend valida tipo, tamaño y máximo por reclamo). */
export async function uploadEvidence(form: FormData) {
  return backend<ClaimEvidence>("/claim-evidences", { method: "POST", form });
}

export async function deleteEvidence(evidenceId: string) {
  return backend<null>(`/claim-evidences/${id(evidenceId)}`, { method: "DELETE" });
}
