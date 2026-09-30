"use client";

import { FileText, Save } from "lucide-react";
import { useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { buttonClass, inputClass, linkButtonClass, reclamoTone } from "@/lib/dashboard/cred";
import { formatDate } from "@/lib/sisnat/dates";
import type { EstadoReclamo } from "@/lib/sisnat/types";
import { Card } from "@/components/dashboard/card";
import { PageTitle, StatusBadge } from "@/components/dashboard/shared";
import { submitWith } from "@/components/dashboard/forms";

export function ClaimDetailView({ claimId }: { claimId: number }) {
  const { db, reclamos, session, actualizarReclamo } = useSisnat();
  const r = reclamos.find((x) => x.id === claimId && (session.role === "admin" || x.propio));
  const [pending, setPending] = useState(false);
  if (!r) return <p className="text-muted-foreground">Reclamo no encontrado.</p>;
  const nino = db.ninos.find((n) => n.id === r.ninoId);

  async function submit(form: FormData) {
    setPending(true);
    await actualizarReclamo(claimId, form.get("estado") as EstadoReclamo, String(form.get("respuesta") ?? ""));
    setPending(false);
  }

  const info = [
    ["Solicitante", `${r.usuarioNombre} · DNI ${r.dniSolicitante}`],
    ["Niño", `${nino?.nombre ?? "—"} · DNI ${r.dniNino || "—"}`],
    ["Establecimiento", r.establecimiento],
    ["Fecha de atención", r.fechaAtencion ? formatDate(r.fechaAtencion) : "No indicada"],
    ["Enviado el", formatDate(r.creadoEn)],
  ];

  return (
    <>
      <PageTitle kicker="Solicitud"
        title={`Revisión #${r.id}`}
        subtitle={`${nino?.nombre ?? ""} · ${r.identificadorNino}`}
        action={<StatusBadge tone={reclamoTone[r.estado]}>{r.estado.replace("_", " ")}</StatusBadge>}
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Detalle del caso">
          <dl className="grid gap-3 sm:grid-cols-2">
            {info.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mb-2 mt-5 text-sm font-semibold">Mensaje</p>
          <blockquote className="rounded-lg border-l-4 border-primary bg-primary/5 p-4 text-sm">{r.mensaje}</blockquote>
          <p className="mb-2 mt-5 text-sm font-semibold">Evidencias</p>
          <div className="flex flex-wrap gap-2">
            {r.evidencias.length ? (
              r.evidencias.map((e) =>
                e.url ? (
                  <a key={e.id} href={e.url} target="_blank" rel="noreferrer" className={`${linkButtonClass} inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2`}>
                    <FileText className="size-4" />
                    {e.nombre}
                  </a>
                ) : (
                  <span key={e.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                    <FileText className="size-4" />
                    {e.nombre}
                  </span>
                ),
              )
            ) : (
              <span className="text-sm text-muted-foreground">No adjuntó evidencias.</span>
            )}
          </div>
        </Card>
        {session.role === "admin" ? (
          <Card title="Gestionar solicitud">
            <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4" key={`${r.estado}-${r.respuesta}`}>
              <label className="grid gap-1.5 text-sm font-medium">
                Estado
                <select name="estado" defaultValue={r.estado} className={inputClass}>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="EN_REVISION">En revisión</option>
                  <option value="RESUELTO">Resuelto</option>
                  <option value="RECHAZADO">Rechazado</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Respuesta para el padre
                <textarea
                  name="respuesta"
                  rows={5}
                  defaultValue={r.respuesta}
                  className="rounded-lg border border-input bg-background p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <button className={buttonClass} type="submit" disabled={pending}>
                <Save className="size-4" />
                {pending ? "Guardando..." : "Actualizar solicitud"}
              </button>
            </form>
          </Card>
        ) : (
          <Card title="Respuesta del establecimiento">
            <p className="text-sm text-muted-foreground">{r.respuesta || "Aún no hay respuesta. Te avisaremos cuando se revise tu caso."}</p>
          </Card>
        )}
      </div>
    </>
  );
}
