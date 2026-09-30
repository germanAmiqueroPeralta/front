"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { buttonClass, inputClass, linkButtonClass, reclamoTone } from "@/lib/dashboard/cred";
import { formatDate } from "@/lib/sisnat/dates";
import type { EstadoReclamo } from "@/lib/sisnat/types";
import { EmptyRow, FilterBar, PageTitle, PersonCell, StatusBadge, Table, Td, Tr } from "@/components/dashboard/shared";
import { ClaimModal } from "@/components/dashboard/modals/claim-modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

export function ClaimsView({ nav }: { nav: Nav }) {
  const { db, reclamos, session } = useSisnat();
  const admin = session.role === "admin";
  const [nuevo, setNuevo] = useState(false);
  const [estado, setEstado] = useState<EstadoReclamo | "">("");
  const lista = reclamos
    .filter((r) => admin || r.propio)
    .filter((r) => !estado || r.estado === estado);

  return (
    <>
      <PageTitle kicker={admin ? "Gestión" : "Soporte"}
        title="Solicitudes de revisión"
        subtitle={
          admin
            ? "Casos enviados por padres para validar atenciones."
            : "Reporta una atención que no aparece correctamente registrada."
        }
        action={
          !admin && (
            <button className={buttonClass} onClick={() => setNuevo(true)}>
              <Plus className="size-4" />
              Nueva solicitud
            </button>
          )
        }
      />
      <FilterBar>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          Estado
          <select className={inputClass} value={estado} onChange={(e) => setEstado(e.target.value as EstadoReclamo | "")}>
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_REVISION">En revisión</option>
            <option value="RESUELTO">Resuelto</option>
            <option value="RECHAZADO">Rechazado</option>
          </select>
        </label>
        <p className="ml-auto self-center text-sm text-muted-foreground">{lista.length} solicitudes</p>
      </FilterBar>
      <Table head={["Niño", "Estado", "Identificador", "Establecimiento", "Fecha", "Evidencias", ""]} minWidth={860}>
        {lista.length ? (
          lista.map((r) => {
            const nino = db.ninos.find((n) => n.id === r.ninoId);
            return (
              <Tr key={r.id}>
                <Td>
                  <PersonCell name={nino?.nombre ?? "—"} detail={r.dniNino || "Sin DNI"} />
                </Td>
                <Td>
                  <StatusBadge tone={reclamoTone[r.estado]}>{r.estado.replace("_", " ")}</StatusBadge>
                </Td>
                <Td>{r.identificadorNino}</Td>
                <Td>{r.establecimiento}</Td>
                <Td>{r.fechaAtencion ? formatDate(r.fechaAtencion) : "No indicada"}</Td>
                <Td>{r.evidencias.length}</Td>
                <Td>
                  <button className={linkButtonClass} onClick={() => nav.go({ name: "claimDetail", claimId: r.id })}>
                    Ver detalle
                  </button>
                </Td>
              </Tr>
            );
          })
        ) : (
          <EmptyRow colSpan={7}>No hay solicitudes registradas.</EmptyRow>
        )}
      </Table>
      {nuevo && <ClaimModal onClose={() => setNuevo(false)} />}
    </>
  );
}
