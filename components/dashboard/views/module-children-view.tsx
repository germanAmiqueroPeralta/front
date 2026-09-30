"use client";

import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { inputClass, linkButtonClass, secondaryButtonClass } from "@/lib/dashboard/cred";
import { formatAge } from "@/lib/sisnat/dates";
import { ninosDelModulo, toCsv, moduloDe } from "@/lib/sisnat/logic";
import type { EstadoPrestacion, Filtros } from "@/lib/sisnat/types";
import {
  EmptyRow,
  FilterBar,
  LocationFilters,
  PageTitle,
  PersonCell,
  Progress,
  ResetButton,
  StatusBadge,
  Table,
  Td,
  Tr,
  downloadCsv,
  toneFor,
} from "@/components/dashboard/shared";
import type { Nav } from "@/components/dashboard/views/packages-view";

export function ModuleChildrenView({ nav, code }: { nav: Nav; code: string }) {
  const { db, alcance } = useSisnat();
  const modulo = moduloDe(db, code)!;
  const inicial: Filtros = { microRed: alcance.microRed ?? "", establecimiento: "" };
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoPrestacion | "">("");
  const [filtros, setFiltros] = useState(inicial);

  const rows = useMemo(
    () => ninosDelModulo(db, alcance, code, { busqueda, estado, filtros }),
    [db, alcance, code, busqueda, estado, filtros],
  );

  function exportar() {
    downloadCsv(
      `${code.toLowerCase()}_sicna.csv`,
      toCsv(
        ["Código padrón", "DNI", "Nombre", "Nacimiento", "Micro red", "EESS", "Prestaciones", "Cumplidas"],
        rows.map((r) => [r.nino.codPadron, r.nino.dni, r.nino.nombre, r.nino.fechaNacimiento, r.nino.microRed, r.nino.establecimiento, r.prestaciones, r.cumplidas]),
      ),
    );
  }

  return (
    <>
      <PageTitle kicker={code}
        title={modulo.nombre}
        subtitle={modulo.descripcion}
        action={
          <button className={secondaryButtonClass} onClick={exportar} disabled={!rows.length}>
            <Download className="size-4" />
            Exportar CSV
          </button>
        }
      />
      <FilterBar>
        <label className="grid flex-1 gap-1.5 text-xs font-medium text-muted-foreground">
          Buscar
          <span className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              className={`${inputClass} w-full min-w-56 pl-9`}
              placeholder="Nombre, DNI o padrón"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </span>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          Estado
          <select className={inputClass} value={estado} onChange={(e) => setEstado(e.target.value as EstadoPrestacion | "")}>
            <option value="">Todos los estados</option>
            <option value="CUMPLIDO">Con cumplidas</option>
            <option value="PENDIENTE">Con pendientes</option>
            <option value="VENCIDO">Con vencidas</option>
          </select>
        </label>
        <LocationFilters alcance={alcance} value={filtros} onChange={setFiltros} />
        <ResetButton
          onClick={() => {
            setBusqueda("");
            setEstado("");
            setFiltros(inicial);
          }}
        />
      </FilterBar>
      <Table head={["Niño", "Documento", "Edad", "Micro red", "Establecimiento", "Avance", ""]} minWidth={860}>
        {rows.length ? (
          rows.map((r) => {
            const pct = Math.round((r.cumplidas * 100) / r.prestaciones);
            return (
              <Tr key={r.nino.id}>
                <Td>
                  <PersonCell name={r.nino.nombre} detail={r.nino.codPadron} />
                </Td>
                <Td>{r.nino.dni ?? "Sin DNI"}</Td>
                <Td>{formatAge(r.edad)}</Td>
                <Td>{r.nino.microRed}</Td>
                <Td>{r.nino.establecimiento}</Td>
                <Td className="md:w-44">
                  <div className="w-40 md:w-full">
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                    <span>
                      {r.cumplidas}/{r.prestaciones}
                    </span>
                    {r.vencidas > 0 && <StatusBadge tone="danger">{r.vencidas} vencidas</StatusBadge>}
                  </div>
                  <Progress value={pct} tone={toneFor(pct)} />
                  </div>
                </Td>
                <Td>
                  <button className={linkButtonClass} onClick={() => nav.go({ name: "child", childId: r.nino.id, code })}>
                    Ver ficha
                  </button>
                </Td>
              </Tr>
            );
          })
        ) : (
          <EmptyRow colSpan={7}>No hay niños dentro del rango de edad de este paquete.</EmptyRow>
        )}
      </Table>
    </>
  );
}
