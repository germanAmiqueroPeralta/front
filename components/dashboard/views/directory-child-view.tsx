"use client";

import { History, Pencil, Phone, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { secondaryButtonClass } from "@/lib/dashboard/cred";
import { ageDays, formatAge, formatDate } from "@/lib/sisnat/dates";
import { padresDe, paquetesDelNino } from "@/lib/sisnat/logic";
import { PageTitle, Progress, StatusBadge, toneFor } from "@/components/dashboard/shared";
import { PackageCard } from "@/components/dashboard/package-card";
import { ChildFormModal } from "@/components/dashboard/modals/people-modals";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

export function DirectoryChildView({ nav, childId }: { nav: Nav; childId: number }) {
  const { db, session, eliminarNino } = useSisnat();
  const [editar, setEditar] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const nino = db.ninos.find((n) => n.id === childId);
  const paquetes = useMemo(() => (nino ? paquetesDelNino(db, nino) : []), [db, nino]);
  if (!nino) return <p className="text-muted-foreground">Niño no encontrado.</p>;

  const padres = padresDe(db, nino.id);
  const total = paquetes.reduce((s, p) => s + p.prestaciones, 0);
  const hechas = paquetes.reduce((s, p) => s + p.cumplidas, 0);
  const pct = total ? Math.round((hechas * 100) / total) : 0;

  return (
    <>
      <PageTitle
        kicker="Directorio"
        title={nino.nombre}
        subtitle={`${nino.dni ?? "Sin DNI"} · ${nino.codPadron}`}
        action={
          <div className="flex flex-wrap gap-2 max-md:w-full [&>button]:max-md:flex-1">
            <button className={secondaryButtonClass} onClick={() => nav.go({ name: "child", childId })}>
              <History className="size-4" />
              Historial
            </button>
            {nino.activo && (
              <button className={secondaryButtonClass} onClick={() => setEditar(true)}>
                <Pencil className="size-4" />
                Editar
              </button>
            )}
            {nino.activo && session.role === "admin" && (
              <button className={`${secondaryButtonClass} text-destructive hover:bg-destructive/10`} onClick={() => setBorrar(true)}>
                <Trash2 className="size-4" />
                Dar de baja
              </button>
            )}
          </div>
        }
      />
      {!nino.activo && (
        <div className="mb-5">
          <StatusBadge tone="danger">Niño dado de baja</StatusBadge>
        </div>
      )}
      <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold">Datos generales</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nacimiento: {formatDate(nino.fechaNacimiento)} ({formatAge(ageDays(nino.fechaNacimiento))}) · {nino.sexo === "F" ? "Niña" : "Niño"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {nino.establecimiento} · Micro red {nino.microRed}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Condición al nacer: {nino.condicionRn ?? "Normal"}</p>
          </div>
          <div className="md:min-w-44 md:text-right">
            <p className="text-3xl font-bold text-primary">{pct}%</p>
            <p className="mb-2 text-xs text-muted-foreground">cumplimiento general</p>
            <Progress value={pct} tone={toneFor(pct)} />
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold">Padres o apoderados</p>
            <button className="text-sm font-semibold text-primary hover:underline" onClick={() => nav.go({ name: "parents" })}>
              Ver todos
            </button>
          </div>
          {padres.length ? (
            <ul className="grid gap-2">
              {padres.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-lg bg-muted/60 p-3 text-sm">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.nombre}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {p.parentesco} · DNI {p.dni}
                      {p.celular && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3" />
                          {p.celular}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin padres vinculados. Usa “Editar” para asignarlos.</p>
          )}
        </section>
      </div>
      <h2 className="mb-3 font-semibold">Paquetes</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {paquetes.map((p) => (
          <PackageCard key={p.codigo} paquete={p} onClick={() => nav.go({ name: "child", childId, code: p.codigo })} />
        ))}
      </div>

      {editar && <ChildFormModal nino={nino} onClose={() => setEditar(false)} />}
      {borrar && (
        <ConfirmModal
          title="Dar de baja al niño"
          confirmText="Dar de baja"
          message={
            <>
              <b>{nino.nombre}</b> dejará de aparecer en paquetes, estadísticas y en el portal de sus padres. Su historial
              de atenciones se conserva.
            </>
          }
          onConfirm={async () => {
            const ok = await eliminarNino(nino.id);
            if (ok) nav.go({ name: "directory" });
            return ok;
          }}
          onClose={() => setBorrar(false)}
        />
      )}
    </>
  );
}
