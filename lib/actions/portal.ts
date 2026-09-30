"use server";

import { backend, combine } from "@/lib/api/server";
import type { Claim, ClaimEvidence, PortalClaims, PortalOverview } from "@/lib/api/types";

/**
 * Portal familiar: el backend filtra todo por el padre de la sesión (sus hijos, sus
 * controles y sus reclamos), así que aquí no se envía ningún id de padre.
 */
export async function loadPortal() {
  return backend<PortalOverview>("/portal");
}

export async function loadPortalClaims() {
  const [overview, mine] = await Promise.all([backend<PortalOverview>("/portal"), backend<PortalClaims>("/portal/claims")]);
  return combine({ overview, mine });
}

export async function createPortalClaim(input: {
  child_id: string;
  service_id: string | null;
  attention_date: string | null;
  message: string;
}) {
  return backend<Claim>("/portal/claims", { method: "POST", body: input });
}

/** `form` trae `claim_id` y `file`; solo se aceptan reclamos propios. */
export async function uploadPortalEvidence(form: FormData) {
  return backend<ClaimEvidence>("/portal/claim-evidences", { method: "POST", form });
}
