"use client";

import { useMemo, useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { linkButtonClass } from "@/lib/dashboard/cred";
import { prestacionesDelModulo, moduloDe } from "@/lib/sisnat/logic";
import type { Filtros } from "@/lib/sisnat/types";
import {
  EmptyRow,
  FilterBar,
  GroupRow,
  LocationFilters,
  PageTitle,
  PersonCell,
  Progress,
  ResetButton,
  StatusBadge,
  Table,
  Td,
  Tr,
  groupBy,
  toneFor,
} from "@/components/dashboard/shared";
import type { Nav } from "@/components/dashboard/views/packages-view";

export function ModulePrestationsView({ nav, code }: { nav: Nav; code: string }) {
  const { db, alcance } = useSisnat();
  const modulo = moduloDe(db, code)!;
  const inicial: Filtros = { microRed: alcance.microRed ?? "", establecimiento: "" };
  const [filtros, setFiltros] = useState(inicial);
  const rows = useMemo(() => prestacionesDelModulo(db, alcance, code, filtros), [db, alcance, code, filtros]);
  const grupos = groupBy(rows, (r) => r.prestacion.grupo);

  return (
    <>
      <PageTitle kicker={code}
        title={modulo.nombre}
        subtitle="Atenciones agrupadas según los encabezados y puntos de cada Excel."
      />
      <FilterBar>
        <LocationFilters alcance={alcance} value={filtros} onChange={setFiltros} />
        <ResetButton onClick={() => setFiltros(inicial)} />
      </FilterBar>
      <Table head={["Atención / punto", "Niños correspondientes", "Atendidos", "Pendientes", "Cobertura", ""]} minWidth={820}>
        {grupos.length ? (
          grupos.map(([grupo, items]) => [
            <GroupRow key={grupo} colSpan={6}>
              {grupo}
            </GroupRow>,
            ...items.map(({ prestacion: p, total, atendidos }) => {
              const pct = total ? Math.round((atendidos * 100) / total) : 0;
              return (
                <Tr key={p.id}>
                  <Td>
                    <PersonCell name={p.nombre} detail={p.codigo} />
                  </Td>
                  <Td>{total}</Td>
                  <Td>
                    <StatusBadge tone="good">{atendidos}</StatusBadge>
                  </Td>
                  <Td>
                    <StatusBadge tone={total - atendidos ? "warn" : "muted"}>{total - atendidos}</StatusBadge>
                  </Td>
                  <Td className="md:w-40">
                    <div className="w-40 md:w-full">
                    <Progress value={pct} tone={total ? toneFor(pct) : "default"} />
                    </div>
                  </Td>
                  <Td>
                    <button
                      className={linkButtonClass}
                      onClick={() => nav.go({ name: "prestationChildren", code, prestacionId: p.id })}
                    >
                      Ver niños
                    </button>
                  </Td>
                </Tr>
              );
            }),
          ])
        ) : (
          <EmptyRow colSpan={6}>No hay atenciones para este paquete.</EmptyRow>
        )}
      </Table>
    </>
  );
}
