"use client";

import { ArrowLeft, ArrowRight, Download, FileText, Paperclip, Plus, Save, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useBackendAction, useBackendQuery } from "@/hooks/use-backend";
import { useSisnat } from "@/hooks/use-sisnat";
import {
  createClaim,
  deleteClaim,
  deleteEvidence,
  loadClaim,
  loadClaims,
  reviewClaim,
  uploadEvidence,
} from "@/lib/actions/admin/claims";
import {
  MAX_EVIDENCES,
  MAX_EVIDENCE_BYTES,
  childName,
  claimStatusLabels,
  type CareService,
  type Child,
  type Claim,
  type ClaimStatus,
  type HealthFacility,
} from "@/lib/api/types";
import { buttonClass, inputClass, secondaryButtonClass, type Tone } from "@/lib/dashboard/cred";
import { formatDate, todayISO } from "@/lib/sisnat/dates";
import { EmptyRow, FilterBar, PageTitle, PersonCell, StatusBadge, Table, Td, Tr } from "@/components/dashboard/shared";
import { RowActions } from "@/components/dashboard/row-actions";
import { TextField, labelClass, submitWith, textareaClass } from "@/components/dashboard/forms";
import { LoadState, Pagination, SearchField, SelectField, matches, optional, required, usePage } from "@/components/dashboard/admin/common";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

const statusTone: Record<ClaimStatus, Tone> = {
  pending: "warn",
  in_review: "default",
  resolved: "good",
  rejected: "danger",
};

const closed = (status: ClaimStatus) => status === "resolved" || status === "rejected";

const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Nombre del niño si sigue en el padrón; si no, el identificador guardado en el reclamo. */
const childLabel = (claim: Claim, child?: Child) => (child ? childName(child) : claim.child_identifier);

/* ───────────── Lista de reclamos ───────────── */

export function AdminClaimsView({ nav }: { nav: Nav }) {
  const { data, loading, error, reload } = useBackendQuery("claims", loadClaims);
  // El coordinador revisa y responde; crear y eliminar reclamos queda para el admin.
  const admin = useSisnat().session.role === "admin";
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "">("");
  const [creating, setCreating] = useState(false);
  const [remove, setRemove] = useState<Claim | null>(null);

  const childById = useMemo(() => new Map(data?.children.map((c) => [c.id, c]) ?? []), [data]);
  const userById = useMemo(() => new Map(data?.users.map((u) => [u.id, u]) ?? []), [data]);
  const serviceById = useMemo(() => new Map(data?.services.map((s) => [s.id, s]) ?? []), [data]);

  const rows = (data?.claims ?? []).filter(
    (c) =>
      (!statusFilter || c.status === statusFilter) &&
      matches(q, childLabel(c, childById.get(c.child_id)), c.child_dni, c.requester_dni, userById.get(c.requester_user_id)?.full_name, c.message),
  );
  const { items, pager } = usePage(rows, `${q}|${statusFilter}`);
  const pendingCount = data?.claims.filter((c) => c.status === "pending").length ?? 0;

  return (
    <>
      <PageTitle
        kicker="Atención al usuario"
        title="Reclamos"
        subtitle={
          pendingCount
            ? `${pendingCount} reclamo${pendingCount === 1 ? "" : "s"} pendiente${pendingCount === 1 ? "" : "s"} de revisión.`
            : "Reclamos de los padres sobre la atención de sus hijos."
        }
        action={
          admin && (
            <button className={buttonClass} onClick={() => setCreating(true)} disabled={!data}>
              <Plus className="size-4" />
              Nuevo reclamo
            </button>
          )
        }
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        <FilterBar>
          <SearchField value={q} onChange={setQ} placeholder="Niño, DNI, solicitante o texto del reclamo" />
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Estado
            <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ClaimStatus | "")}>
              <option value="">Todos</option>
              {(Object.keys(claimStatusLabels) as ClaimStatus[]).map((s) => (
                <option key={s} value={s}>
                  {claimStatusLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <p className="ml-auto self-center text-sm text-muted-foreground">{rows.length} reclamos</p>
        </FilterBar>
        <Table head={["Niño", "Solicitante", "Prestación", "Registrado", "Estado", ""]} minWidth={940}>
          {rows.length ? (
            items.map((c) => {
              const requester = userById.get(c.requester_user_id);
              return (
                <Tr key={c.id}>
                  <Td>
                    <button className="text-left hover:underline" onClick={() => nav.go({ name: "adminClaim", claimId: c.id })}>
                      <PersonCell name={childLabel(c, childById.get(c.child_id))} detail={c.message.slice(0, 60) + (c.message.length > 60 ? "…" : "")} />
                    </button>
                  </Td>
                  <Td>
                    <span className="grid max-md:text-right">
                      <span>{requester?.full_name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">DNI {c.requester_dni}</span>
                    </span>
                  </Td>
                  <Td>{c.service_id ? (serviceById.get(c.service_id)?.name ?? "—") : "—"}</Td>
                  <Td>{formatDate(c.created_at)}</Td>
                  <Td>
                    <StatusBadge tone={statusTone[c.status]}>{claimStatusLabels[c.status]}</StatusBadge>
                  </Td>
                  <Td>
                    <RowActions label="reclamo" onDelete={admin ? () => setRemove(c) : undefined}>
                      <button className={`${secondaryButtonClass} h-9`} onClick={() => nav.go({ name: "adminClaim", claimId: c.id })}>
                        Revisar
                        <ArrowRight className="size-4" />
                      </button>
                    </RowActions>
                  </Td>
                </Tr>
              );
            })
          ) : (
            <EmptyRow colSpan={6}>{q || statusFilter ? "No hay reclamos para esta búsqueda." : "Aún no hay reclamos."}</EmptyRow>
          )}
        </Table>
        <Pagination pager={pager} label="reclamos" />
      </LoadState>

      {creating && data && (
        <ClaimFormModal
          kids={data.children}
          services={data.services}
          facilities={data.facilities}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            reload();
            nav.go({ name: "adminClaim", claimId: saved.id });
          }}
        />
      )}
      {remove && <DeleteClaimModal claim={remove} onClose={() => setRemove(null)} onDeleted={reload} />}
    </>
  );
}

function DeleteClaimModal({ claim, onClose, onDeleted }: { claim: Claim; onClose: () => void; onDeleted: () => void }) {
  const run = useBackendAction();
  return (
    <ConfirmModal
      title="Eliminar reclamo"
      message={
        <>
          ¿Eliminar el reclamo sobre <b>{claim.child_identifier}</b>? También se borran sus evidencias. No se puede deshacer.
        </>
      }
      onConfirm={async () => {
        const ok = await run(deleteClaim(claim.id));
        if (ok) onDeleted();
        return ok !== null;
      }}
      onClose={onClose}
    />
  );
}

function ClaimFormModal({
  kids,
  services,
  facilities,
  onClose,
  onSaved,
}: {
  kids: Child[];
  services: CareService[];
  facilities: HealthFacility[];
  onClose: () => void;
  onSaved: (saved: Claim) => void;
}) {
  const run = useBackendAction();
  const [pending, setPending] = useState(false);
  const [childId, setChildId] = useState("");
  const child = kids.find((c) => c.id === childId);

  async function submit(form: FormData) {
    setPending(true);
    const saved = await run(
      createClaim({
        child_id: required(form, "child_id"),
        requester_dni: required(form, "requester_dni"),
        service_id: optional(form, "service_id"),
        health_facility_id: optional(form, "health_facility_id"),
        attention_date: optional(form, "attention_date"),
        message: required(form, "message"),
      }),
      "Reclamo registrado. Puedes adjuntar evidencias.",
    );
    setPending(false);
    if (saved) {
      onSaved(saved);
      onClose();
    }
  }

  return (
    <Modal title="Nuevo reclamo" subtitle="Registrado a nombre de tu cuenta" onClose={onClose} wide>
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <SelectField
              label="Niño"
              name="child_id"
              required
              placeholder="Seleccionar niño"
              onChange={setChildId}
              options={[...kids]
                .sort((a, b) => a.last_names.localeCompare(b.last_names))
                .map((c) => ({ value: c.id, label: `${c.last_names}, ${c.first_names} · ${c.padron_code}` }))}
            />
          </div>
          <TextField label="DNI del solicitante" name="requester_dni" required inputMode="numeric" maxLength={8} pattern="\d{8}" placeholder="8 dígitos" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label="Prestación"
            name="service_id"
            placeholder="No aplica"
            options={services.map((s) => ({ value: s.id, label: s.name }))}
          />
          <SelectField
            key={childId}
            label="Establecimiento"
            name="health_facility_id"
            placeholder="No aplica"
            defaultValue={child?.health_facility_id}
            options={facilities.map((f) => ({ value: f.id, label: f.name }))}
          />
          <TextField label="Fecha de atención" name="attention_date" type="date" max={todayISO()} />
        </div>
        <label className={labelClass}>
          <span>
            Reclamo<span className="text-destructive"> *</span>
          </span>
          <textarea name="message" rows={4} required placeholder="Qué pasó" className={textareaClass} />
        </label>
        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : "Registrar reclamo"}
        </button>
      </form>
    </Modal>
  );
}

/* ───────────── Detalle del reclamo (revisión + evidencias) ───────────── */

export function AdminClaimDetailView({ nav, claimId }: { nav: Nav; claimId: string }) {
  const { data, loading, error, reload } = useBackendQuery(`claim:${claimId}`, () => loadClaim(claimId));
  const run = useBackendAction();
  const { notify, session } = useSisnat();
  const admin = session.role === "admin";
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removeClaim, setRemoveClaim] = useState(false);
  const [removeEvidence, setRemoveEvidence] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const back = (
    <button className={secondaryButtonClass} onClick={() => nav.go({ name: "claims" })}>
      <ArrowLeft className="size-4" />
      Volver a reclamos
    </button>
  );

  if (!data)
    return (
      <LoadState loading={loading} error={error} onRetry={reload}>
        {null}
      </LoadState>
    );

  const { claim, evidences } = data;
  const child = data.children.find((c) => c.id === claim.child_id);
  const requester = data.users.find((u) => u.id === claim.requester_user_id);
  const reviewer = claim.reviewed_by ? data.users.find((u) => u.id === claim.reviewed_by) : undefined;
  const service = claim.service_id ? data.services.find((s) => s.id === claim.service_id) : undefined;
  const facility = claim.health_facility_id ? data.facilities.find((f) => f.id === claim.health_facility_id) : undefined;
  const canUpload = !closed(claim.status) && evidences.length < MAX_EVIDENCES;

  async function review(form: FormData) {
    setPending(true);
    const saved = await run(
      reviewClaim(claim.id, { status: required(form, "status") as ClaimStatus, response: optional(form, "response") }),
      "Reclamo actualizado",
    );
    setPending(false);
    if (saved) reload();
  }

  async function upload(file: File) {
    if (file.size > MAX_EVIDENCE_BYTES) {
      notify("El archivo supera los 10 MB", "danger");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.set("claim_id", claim.id);
    form.set("file", file);
    const saved = await run(uploadEvidence(form), "Evidencia adjuntada");
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (saved) reload();
  }

  return (
    <>
      <PageTitle
        kicker="Reclamo"
        title={childLabel(claim, child)}
        subtitle={`Registrado el ${formatDate(claim.created_at)}`}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            {back}
            {admin && (
              <button className={`${secondaryButtonClass} text-destructive`} onClick={() => setRemoveClaim(true)}>
                <Trash2 className="size-4" />
                Eliminar
              </button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-6">
          <section className="grid gap-4 rounded-xl border border-border bg-card p-5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Detalle</h2>
              <StatusBadge tone={statusTone[claim.status]}>{claimStatusLabels[claim.status]}</StatusBadge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Niño">
                {childLabel(claim, child)}
                {claim.child_dni && <span className="text-muted-foreground"> · DNI {claim.child_dni}</span>}
              </Field>
              <Field label="Solicitante">
                {requester?.full_name ?? "—"} <span className="text-muted-foreground">· DNI {claim.requester_dni}</span>
              </Field>
              <Field label="Prestación">{service?.name ?? "—"}</Field>
              <Field label="Establecimiento">{facility?.name ?? "—"}</Field>
              <Field label="Fecha de atención">{formatDate(claim.attention_date)}</Field>
            </div>
            <Field label="Reclamo">
              <p className="whitespace-pre-wrap">{claim.message}</p>
            </Field>
          </section>

          <section className="grid gap-4 rounded-xl border border-border bg-card p-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">
                Evidencias ({evidences.length}/{MAX_EVIDENCES})
              </h2>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(file);
                }}
              />
              {admin && (
                <button className={secondaryButtonClass} disabled={!canUpload || uploading} onClick={() => fileRef.current?.click()}>
                  <Upload className="size-4" />
                  {uploading ? "Subiendo..." : "Adjuntar"}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {closed(claim.status)
                ? "El reclamo está cerrado: ya no se pueden adjuntar archivos."
                : "JPG, PNG o PDF de hasta 10 MB. Máximo 5 por reclamo."}
            </p>
            {evidences.length ? (
              <ul className="grid gap-2">
                {evidences.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    {e.mime_type === "application/pdf" ? (
                      <FileText className="size-5 shrink-0 text-primary" />
                    ) : (
                      <Paperclip className="size-5 shrink-0 text-primary" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{e.original_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatBytes(e.size_bytes)} · {formatDate(e.created_at)}
                      </span>
                    </span>
                    <RowActions label={e.original_name} onDelete={admin ? () => setRemoveEvidence(e.id) : undefined}>
                      <a
                        href={`/files/claim-evidences/${encodeURIComponent(e.id)}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex size-9 items-center justify-center rounded-lg border border-border transition hover:bg-accent"
                        aria-label={`Descargar ${e.original_name}`}
                        title="Descargar"
                      >
                        <Download className="size-4" />
                      </a>
                    </RowActions>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">Sin evidencias adjuntas.</p>
            )}
          </section>
        </div>

        <section className="grid content-start gap-4 rounded-xl border border-border bg-card p-5 text-sm">
          <h2 className="text-base font-semibold">Revisión</h2>
          <form key={claim.updated_at} onSubmit={submitWith(review)} className="grid gap-4">
            <SelectField
              label="Estado"
              name="status"
              required
              defaultValue={claim.status}
              options={(Object.keys(claimStatusLabels) as ClaimStatus[]).map((s) => ({ value: s, label: claimStatusLabels[s] }))}
              hint="Para resolver o rechazar hace falta una respuesta."
            />
            <label className={labelClass}>
              Respuesta al padre
              <textarea name="response" rows={5} defaultValue={claim.response ?? ""} className={textareaClass} />
            </label>
            <button className={buttonClass} type="submit" disabled={pending}>
              <Save className="size-4" />
              {pending ? "Guardando..." : "Guardar revisión"}
            </button>
          </form>
          {claim.reviewed_at && (
            <p className="text-xs text-muted-foreground">
              Última revisión: {reviewer?.full_name ?? "—"}, {formatDate(claim.reviewed_at)}
            </p>
          )}
        </section>
      </div>

      {removeClaim && (
        <DeleteClaimModal claim={claim} onClose={() => setRemoveClaim(false)} onDeleted={() => nav.go({ name: "claims" })} />
      )}
      {removeEvidence && (
        <ConfirmModal
          title="Eliminar evidencia"
          message="¿Eliminar este archivo del reclamo? No se puede deshacer."
          onConfirm={async () => {
            const ok = await run(deleteEvidence(removeEvidence));
            if (ok) reload();
            return ok !== null;
          }}
          onClose={() => setRemoveEvidence(null)}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
