"use client";

import { Download, FileText, MessageSquareWarning, Paperclip, Plus, Send, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useBackendAction, useBackendQuery } from "@/hooks/use-backend";
import { useSisnat } from "@/hooks/use-sisnat";
import { createPortalClaim, loadPortal, loadPortalClaims, uploadPortalEvidence } from "@/lib/actions/portal";
import { applicableServices } from "@/lib/api/cred";
import {
  MAX_EVIDENCES,
  MAX_EVIDENCE_BYTES,
  childName,
  claimStatusLabels,
  type CarePackage,
  type CareService,
  type Claim,
  type ClaimEvidence,
  type ClaimStatus,
  type HealthFacility,
  type PortalChild,
  type PortalOverview,
} from "@/lib/api/types";
import { buttonClass, secondaryButtonClass, type Tone } from "@/lib/dashboard/cred";
import { addDays, ageDays, formatAge, formatDate, todayISO } from "@/lib/sisnat/dates";
import { EmptyRow, PageTitle, PersonCell, StatusBadge, Table, Td, Tr } from "@/components/dashboard/shared";
import { labelClass, submitWith, textareaClass, TextField } from "@/components/dashboard/forms";
import { LoadState, Pagination, SelectField, optional, required, usePage } from "@/components/dashboard/admin/common";
import {
  FollowupModal,
  GuardianChildren,
  followup,
  states,
  type ServiceRow,
} from "@/components/dashboard/admin/tracking-view";
import { Modal } from "@/components/ui/modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

const claimTone: Record<ClaimStatus, Tone> = { pending: "warn", in_review: "default", resolved: "good", rejected: "danger" };
const closed = (status: ClaimStatus) => status === "resolved" || status === "rejected";
const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/* ───────────── Mis hijos ───────────── */

export function PortalChildrenView({ nav }: { nav: Nav }) {
  const { data, loading, error, reload } = useBackendQuery("portal", loadPortal);
  const [childId, setChildId] = useState<string | null>(null);
  const [claim, setClaim] = useState<{ childId: string; serviceId?: string } | null>(null);

  const summaries = useMemo(() => new Map(data?.children.map((c) => [c.id, followup(c, data)]) ?? []), [data]);
  const child = data?.children.find((c) => c.id === childId);

  return (
    <>
      <PageTitle
        kicker="Portal familiar"
        title="Mis hijos"
        subtitle={data ? `Hola, ${data.guardian.full_name}. Elige a tu hijo para ver sus controles.` : undefined}
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        {data && (
          <GuardianChildren
            showGuardian={false}
            guardian={data.guardian}
            kids={data.children.map((c) => ({ child: c, relationship: c.relationship }))}
            summaries={summaries}
            onOpen={setChildId}
          />
        )}
      </LoadState>

      {child && data && (
        <FollowupModal
          followup={summaries.get(child.id)!}
          parents={[{ guardian: data.guardian, relationship: child.relationship }]}
          onClose={() => setChildId(null)}
          renderPick={(row, close) => (
            <ControlDetailModal
              row={row}
              child={child}
              pkg={data.packages.find((p) => p.id === row.service.package_id)}
              facilities={data.facilities}
              onClose={close}
              onClaim={() => {
                close();
                setClaim({ childId: child.id, serviceId: row.service.id });
              }}
            />
          )}
          footer={
            <button className={secondaryButtonClass} onClick={() => setClaim({ childId: child.id })}>
              <MessageSquareWarning className="size-4" />
              Presentar un reclamo
            </button>
          }
        />
      )}

      {claim && data && (
        <PortalClaimModal
          portal={data}
          defaultChildId={claim.childId}
          defaultServiceId={claim.serviceId}
          onClose={() => setClaim(null)}
          onSaved={() => {
            setChildId(null);
            nav.go({ name: "claims" });
          }}
        />
      )}
    </>
  );
}

/** Detalle de una prestación, solo lectura: el padre ve qué se hizo, cuándo y dónde. */
function ControlDetailModal({
  row,
  child,
  pkg,
  facilities,
  onClose,
  onClaim,
}: {
  row: ServiceRow;
  child: PortalChild;
  pkg?: CarePackage;
  facilities: HealthFacility[];
  onClose: () => void;
  onClaim: () => void;
}) {
  const { service, control, state } = row;
  const { label, icon: Icon, box, iconClass } = states[state];
  const facility = control?.health_facility_id ? facilities.find((f) => f.id === control.health_facility_id) : undefined;

  return (
    <Modal title={service.name} subtitle={[pkg?.name, service.group_name].filter(Boolean).join(" · ")} onClose={onClose}>
      <div className="grid gap-4 text-sm">
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${box}`}>
          <Icon className={`size-5 shrink-0 ${iconClass}`} />
          <span className="font-semibold">{label}</span>
        </div>
        {pkg?.description && <p className="text-muted-foreground">{pkg.description}</p>}
        <dl className="grid gap-3 sm:grid-cols-2">
          <Item label="Le corresponde">
            {formatDate(addDays(child.birth_date, service.min_age_days))} – {formatDate(addDays(child.birth_date, service.max_age_days))}
            <span className="block text-xs text-muted-foreground">
              De {formatAge(service.min_age_days)} a {formatAge(service.max_age_days)}
            </span>
          </Item>
          <Item label="Fecha de atención">{formatDate(control?.completed_date)}</Item>
          <Item label="Próxima cita">{formatDate(control?.scheduled_date)}</Item>
          <Item label="Establecimiento">{facility?.name ?? "—"}</Item>
          {control?.batch_number && <Item label="Lote">{control.batch_number}</Item>}
          {(control?.book_page || control?.book_record) && (
            <Item label="Libro de registro">
              Folio {control.book_page ?? "—"} · N° {control.book_record ?? "—"}
            </Item>
          )}
        </dl>
        {control?.notes && (
          <Item label="Observaciones">
            <p className="whitespace-pre-wrap">{control.notes}</p>
          </Item>
        )}
        {!control && state !== "upcoming" && (
          <p className="rounded-lg bg-muted/50 p-3 text-muted-foreground">
            Aún no hay atención registrada. Si tu hijo sí la recibió, puedes presentar un reclamo.
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <button className={secondaryButtonClass} onClick={onClose}>
            Cerrar
          </button>
          <button className={secondaryButtonClass} onClick={onClaim}>
            <MessageSquareWarning className="size-4" />
            Reclamar sobre esta prestación
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/* ───────────── Nuevo reclamo (solo sobre sus hijos) ───────────── */

function PortalClaimModal({
  portal,
  defaultChildId,
  defaultServiceId,
  onClose,
  onSaved,
}: {
  portal: PortalOverview;
  defaultChildId?: string;
  defaultServiceId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const run = useBackendAction();
  const { notify } = useSisnat();
  const [pending, setPending] = useState(false);
  const [childId, setChildId] = useState(defaultChildId ?? "");
  const child = portal.children.find((c) => c.id === childId);

  const services = useMemo(() => {
    if (!child) return [] as CareService[];
    const age = ageDays(child.birth_date);
    return applicableServices(child, portal.packages, portal.services).filter((s) => age >= s.min_age_days);
  }, [child, portal]);

  async function submit(form: FormData) {
    const file = form.get("file");
    const attach = file instanceof File && file.size > 0 ? file : null;
    if (attach && attach.size > MAX_EVIDENCE_BYTES) {
      notify("El archivo supera los 10 MB", "danger");
      return;
    }
    setPending(true);
    const created = await run(
      createPortalClaim({
        child_id: required(form, "child_id"),
        service_id: optional(form, "service_id"),
        attention_date: optional(form, "attention_date"),
        message: required(form, "message"),
      }),
      "Reclamo enviado. El establecimiento lo revisará.",
    );
    if (created && attach) {
      const upload = new FormData();
      upload.set("claim_id", created.id);
      upload.set("file", attach);
      await run(uploadPortalEvidence(upload), "Reclamo enviado con su evidencia");
    }
    setPending(false);
    if (created) {
      onSaved();
      onClose();
    }
  }

  return (
    <Modal title="Presentar un reclamo" subtitle="Cuéntanos qué pasó con la atención de tu hijo" onClose={onClose}>
      <form onSubmit={submitWith(submit)} className="grid gap-4">
        <SelectField
          label="Hijo"
          name="child_id"
          required
          placeholder="Seleccionar"
          defaultValue={defaultChildId}
          onChange={setChildId}
          options={portal.children.map((c) => ({ value: c.id, label: childName(c) }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            key={childId}
            label="Prestación"
            name="service_id"
            placeholder="No es sobre una prestación"
            defaultValue={defaultServiceId}
            options={services.map((s) => ({ value: s.id, label: s.name }))}
          />
          <TextField label="Fecha de la atención" name="attention_date" type="date" max={todayISO()} min={child?.birth_date} />
        </div>
        <label className={labelClass}>
          <span>
            ¿Qué pasó?<span className="text-destructive"> *</span>
          </span>
          <textarea name="message" rows={4} required placeholder="Ej. Mi hijo recibió la vacuna pero aparece como pendiente." className={textareaClass} />
        </label>
        <label className={labelClass}>
          Evidencia (opcional)
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,application/pdf"
            className="text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-sm file:font-semibold"
          />
          <span className="text-xs font-normal text-muted-foreground">Foto del carnet o constancia: JPG, PNG o PDF de hasta 10 MB.</span>
        </label>
        <button className={buttonClass} type="submit" disabled={pending}>
          <Send className="size-4" />
          {pending ? "Enviando..." : "Enviar reclamo"}
        </button>
      </form>
    </Modal>
  );
}

/* ───────────── Mis reclamos ───────────── */

export function PortalClaimsView() {
  const { data, loading, error, reload } = useBackendQuery("portal-claims", loadPortalClaims);
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const childById = useMemo(() => new Map(data?.overview.children.map((c) => [c.id, c]) ?? []), [data]);
  const serviceById = useMemo(() => new Map(data?.overview.services.map((s) => [s.id, s]) ?? []), [data]);
  const claims = data?.mine.claims ?? [];
  const { items, pager } = usePage(claims);
  const detail = claims.find((c) => c.id === detailId);

  const childLabel = (c: Claim) => {
    const child = childById.get(c.child_id);
    return child ? childName(child) : c.child_identifier;
  };

  return (
    <>
      <PageTitle
        kicker="Portal familiar"
        title="Mis reclamos"
        subtitle="Reclamos que presentaste sobre la atención de tus hijos y la respuesta del establecimiento."
        action={
          <button className={buttonClass} onClick={() => setCreating(true)} disabled={!data?.overview.children.length}>
            <Plus className="size-4" />
            Nuevo reclamo
          </button>
        }
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        <Table head={["Hijo", "Prestación", "Enviado", "Estado", ""]} minWidth={760}>
          {claims.length ? (
            items.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <button className="text-left hover:underline" onClick={() => setDetailId(c.id)}>
                    <PersonCell name={childLabel(c)} detail={c.message.slice(0, 60) + (c.message.length > 60 ? "…" : "")} />
                  </button>
                </Td>
                <Td>{c.service_id ? (serviceById.get(c.service_id)?.name ?? "—") : "—"}</Td>
                <Td>{formatDate(c.created_at)}</Td>
                <Td>
                  <StatusBadge tone={claimTone[c.status]}>{claimStatusLabels[c.status]}</StatusBadge>
                </Td>
                <Td>
                  <button className={`${secondaryButtonClass} h-9`} onClick={() => setDetailId(c.id)}>
                    Ver
                  </button>
                </Td>
              </Tr>
            ))
          ) : (
            <EmptyRow colSpan={5}>Aún no presentaste reclamos.</EmptyRow>
          )}
        </Table>
        <Pagination pager={pager} label="reclamos" />
      </LoadState>

      {creating && data && <PortalClaimModal portal={data.overview} onClose={() => setCreating(false)} onSaved={reload} />}
      {detail && data && (
        <PortalClaimDetailModal
          claim={detail}
          childLabel={childLabel(detail)}
          service={detail.service_id ? serviceById.get(detail.service_id) : undefined}
          evidences={data.mine.evidences.filter((e) => e.claim_id === detail.id)}
          onClose={() => setDetailId(null)}
          onChanged={reload}
        />
      )}
    </>
  );
}

function PortalClaimDetailModal({
  claim,
  childLabel,
  service,
  evidences,
  onClose,
  onChanged,
}: {
  claim: Claim;
  childLabel: string;
  service?: CareService;
  evidences: ClaimEvidence[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const run = useBackendAction();
  const { notify } = useSisnat();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canUpload = !closed(claim.status) && evidences.length < MAX_EVIDENCES;

  async function upload(file: File) {
    if (fileRef.current) fileRef.current.value = "";
    if (file.size > MAX_EVIDENCE_BYTES) {
      notify("El archivo supera los 10 MB", "danger");
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.set("claim_id", claim.id);
    form.set("file", file);
    const saved = await run(uploadPortalEvidence(form), "Evidencia adjuntada");
    setUploading(false);
    if (saved) onChanged();
  }

  return (
    <Modal title={`Reclamo sobre ${childLabel}`} subtitle={`Enviado el ${formatDate(claim.created_at)}`} onClose={onClose}>
      <div className="grid gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={claimTone[claim.status]}>{claimStatusLabels[claim.status]}</StatusBadge>
          {service && <span className="text-muted-foreground">{service.name}</span>}
          {claim.attention_date && <span className="text-muted-foreground">Atención del {formatDate(claim.attention_date)}</span>}
        </div>
        <Item label="Tu reclamo">
          <p className="whitespace-pre-wrap">{claim.message}</p>
        </Item>
        <div className={`rounded-lg border p-3 ${claim.response ? "border-primary/30 bg-primary/5" : "border-dashed border-border"}`}>
          <p className="text-xs text-muted-foreground">Respuesta del establecimiento</p>
          <p className="mt-1 whitespace-pre-wrap">{claim.response ?? "Aún sin respuesta. Te avisaremos aquí cuando la revisen."}</p>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">
              Evidencias ({evidences.length}/{MAX_EVIDENCES})
            </p>
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
            {canUpload && (
              <button className={secondaryButtonClass} disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" />
                {uploading ? "Subiendo..." : "Adjuntar"}
              </button>
            )}
          </div>
          {evidences.length ? (
            <ul className="grid gap-2">
              {evidences.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                  {e.mime_type === "application/pdf" ? (
                    <FileText className="size-5 shrink-0 text-primary" />
                  ) : (
                    <Paperclip className="size-5 shrink-0 text-primary" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.original_name}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(e.size_bytes)}</span>
                  </span>
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
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Sin evidencias adjuntas.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
