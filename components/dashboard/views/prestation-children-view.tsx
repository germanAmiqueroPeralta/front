"use client";

import { useMemo, useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { inputClass, linkButtonClass } from "@/lib/dashboard/cred";
import { formatDate } from "@/lib/sisnat/dates";
import { moduloDe, ninosDePrestacion, prestacionDe } from "@/lib/sisnat/logic";
import type { Filtros } from "@/lib/sisnat/types";
import {
  EmptyRow,
  FilterBar,
  LocationFilters,
  PageTitle,
  PersonCell,
  ResetButton,
  StatusBadge,
  Table,
  Td,
  Tr,
} from "@/components/dashboard/shared";
import type { Nav } from "@/components/dashboard/views/packages-view";

type Mostrar = "" | "atendido" | "pendiente";

export function PrestationChildrenView({ nav, code, prestacionId }: { nav: Nav; code: string; prestacionId: number }) {
  const { db, alcance } = useSisnat();
  const modulo = moduloDe(db, code)!;
  const prestacion = prestacionDe(db, prestacionId)!;
  const inicial: Filtros = { microRed: alcance.microRed ?? "", establecimiento: "" };
  const [filtros, setFiltros] = useState(inicial);
  const [mostrar, setMostrar] = useState<Mostrar>("");
  const rows = useMemo(
    () => ninosDePrestacion(db, alcance, code, prestacionId, filtros, mostrar),
    [db, alcance, code, prestacionId, filtros, mostrar],
  );

  return (
    <>
      <PageTitle kicker={`${code} · ${prestacion.grupo}`}
        title={prestacion.nombre}
        subtitle={`Niños correspondientes a esta atención del paquete ${modulo.nombre}.`}
      />
      <FilterBar>
        <LocationFilters alcance={alcance} value={filtros} onChange={setFiltros} />
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          Mostrar
          <select className={inputClass} value={mostrar} onChange={(e) => setMostrar(e.target.value as Mostrar)}>
            <option value="">Todos</option>
            <option value="atendido">Atendidos</option>
            <option value="pendiente">No atendidos</option>
          </select>
        </label>
        <ResetButton
          onClick={() => {
            setFiltros(inicial);
            setMostrar("");
          }}
        />
        <p className="ml-auto self-center text-sm text-muted-foreground">
          {rows.filter((r) => r.registro).length} atendidos de {rows.length}
        </p>
      </FilterBar>
      <Table head={["Niño", "Documento", "Micro red", "Estado", "Fecha de atención", "Centro de salud", ""]} minWidth={900}>
        {rows.length ? (
          rows.map(({ nino, registro }) => (
            <Tr key={nino.id}>
              <Td>
                <PersonCell name={nino.nombre} detail={nino.codPadron} />
              </Td>
              <Td>{nino.dni ?? "Sin DNI"}</Td>
              <Td>{nino.microRed}</Td>
              <Td>
                <StatusBadge tone={registro ? "good" : "warn"}>{registro ? "ATENDIDO" : "NO ATENDIDO"}</StatusBadge>
              </Td>
              <Td>{registro ? formatDate(registro.fechaAtencion) : "Pendiente"}</Td>
              <Td>{registro?.establecimiento ?? "No registrado"}</Td>
              <Td>
                <button className={linkButtonClass} onClick={() => nav.go({ name: "child", childId: nino.id, code })}>
                  Ver ficha
                </button>
              </Td>
            </Tr>
          ))
        ) : (
          <EmptyRow colSpan={7}>No hay niños para este filtro.</EmptyRow>
        )}
      </Table>
    </>
  );
}
