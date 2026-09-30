"use client";

import { ClipboardList, MapPin, Plus, RotateCcw, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import type { useViewHistory } from "@/hooks/use-view-history";
import { buttonClass, secondaryButtonClass, sessionRoleLabels } from "@/lib/dashboard/cred";
import { resumenPaquetes } from "@/lib/sisnat/logic";
import { PageTitle, Progress, toneFor } from "@/components/dashboard/shared";
import { Stat } from "@/components/dashboard/stat";
import { PackageFormModal } from "@/components/dashboard/modals/catalog-modals";

export type Nav = ReturnType<typeof useViewHistory>;

export function PackagesView({ nav }: { nav: Nav }) {
  const { db, alcance, session, reactivarPaquete } = useSisnat();
  const resumen = useMemo(() => resumenPaquetes(db, alcance), [db, alcance]);
  const [nuevo, setNuevo] = useState(false);
  const admin = session.role === "admin";
  const desactivados = db.modulos.filter((m) => !m.activo);

  return (
    <>
      <PageTitle kicker="Centro de control"
        title="Resumen general"
        subtitle="Selecciona un paquete para consultar sus niños o sus atenciones."
        action={
          admin && (
            <button className={buttonClass} onClick={() => setNuevo(true)}>
              <Plus className="size-4" />
              Nuevo paquete
            </button>
          )
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat label="Niños activos" value={String(resumen.totalNinos)} detail="En tu ámbito de atención" icon={Users} />
        <Stat label="Paquetes operativos" value={String(resumen.modulos.length)} detail="Catálogo de atención integral" icon={ClipboardList} />
        <Stat
          className="col-span-2 sm:col-span-1"
          label="Alcance"
          value={alcance.microRed ?? "Toda la red"}
          detail={sessionRoleLabels[session.role]}
          icon={MapPin}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {resumen.modulos.map((m) => (
          <button
            key={m.codigo}
            onClick={() => nav.go({ name: "packageChoice", code: m.codigo })}
            className="flex flex-col justify-between gap-5 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary/50 hover:bg-primary/5"
          >
            <div>
              <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold tracking-wide text-primary">
                {m.codigo}
              </span>
              <h3 className="mt-2 font-semibold">{m.nombre}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{m.descripcion}</p>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>
                  {m.cumplidas} de {m.total} atenciones
                </span>
                <strong className="text-foreground">{m.porcentaje}%</strong>
              </div>
              <Progress value={m.porcentaje} tone={m.total ? toneFor(m.porcentaje) : "default"} />
            </div>
          </button>
        ))}
      </div>

      {admin && desactivados.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Paquetes desactivados</h2>
          <ul className="divide-y divide-border rounded-xl border border-dashed border-border bg-card">
            {desactivados.map((m) => (
              <li key={m.codigo} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold tracking-wide text-muted-foreground">{m.codigo}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{m.nombre}</span>
                <button className={secondaryButtonClass} onClick={() => nav.go({ name: "packageChoice", code: m.codigo })}>
                  Ver
                </button>
                <button className={secondaryButtonClass} onClick={() => reactivarPaquete(m.codigo)}>
                  <RotateCcw className="size-4" />
                  Reactivar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {nuevo && (
        <PackageFormModal onClose={() => setNuevo(false)} onSaved={(code) => nav.go({ name: "packageConfig", code })} />
      )}
    </>
  );
}
