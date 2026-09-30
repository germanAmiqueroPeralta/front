"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { buttonClass, inputClass, linkButtonClass } from "@/lib/dashboard/cred";
import { directorio, padresDe } from "@/lib/sisnat/logic";
import type { Filtros, Nino } from "@/lib/sisnat/types";
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
  toneFor,
} from "@/components/dashboard/shared";
import { RowActions } from "@/components/dashboard/row-actions";
import { ChildFormModal } from "@/components/dashboard/modals/people-modals";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

export function DirectoryView({ nav }: { nav: Nav }) {
  const { db, alcance, session, eliminarNino } = useSisnat();
  const [form, setForm] = useState<{ nino?: Nino } | null>(null);
  const [borrar, setBorrar] = useState<Nino | null>(null);
  const admin = session.role === "admin";
  const inicial: Filtros = { microRed: alcance.microRed ?? "", establecimiento: "" };
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState(inicial);
  const rows = useMemo(() => directorio(db, alcance, { busqueda, filtros }), [db, alcance, busqueda, filtros]);

  return (
    <>
      <PageTitle
        kicker="Directorio"
        title="Niños"
        subtitle="Consulta, registra y actualiza a los niños y sus padres."
        action={
          <button className={buttonClass} onClick={() => setForm({})}>
            <Plus className="size-4" />
            Registrar niño
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
        <LocationFilters alcance={alcance} value={filtros} onChange={setFiltros} />
        <ResetButton
          onClick={() => {
            setBusqueda("");
            setFiltros(inicial);
          }}
        />
      </FilterBar>
      <Table head={["Niño", "DNI", "Padres", "Establecimiento", "Paquetes", "Cumplimiento", ""]} minWidth={960}>
        {rows.length ? (
          rows.map((r) => (
            <Tr key={r.nino.id}>
              <Td>
                <PersonCell name={r.nino.nombre} detail={r.nino.codPadron} />
              </Td>
              <Td>{r.nino.dni ?? "Sin DNI"}</Td>
              <Td>
                <span className="grid gap-0.5 text-xs">
                  {padresDe(db, r.nino.id).map((p) => (
                    <span key={p.id} className="truncate">
                      {p.nombre.split(" ").slice(0, 2).join(" ")} <span className="text-muted-foreground">· {p.parentesco}</span>
                    </span>
                  ))}
                  {!padresDe(db, r.nino.id).length && <span className="text-muted-foreground">Sin padres</span>}
                </span>
              </Td>
              <Td>
                {r.nino.establecimiento}
                <span className="block text-xs text-muted-foreground">{r.nino.microRed}</span>
              </Td>
              <Td>
                <div className="flex flex-col items-start gap-1">
                  <span>{r.paquetes.length}</span>
                  {r.retrasadas > 0 && <StatusBadge tone="danger">{r.retrasadas} retrasadas</StatusBadge>}
                </div>
              </Td>
              <Td className="md:w-44">
                <div className="w-40 md:w-full">
                <div className="mb-1 text-xs">
                  {r.cumplidas}/{r.total} ({r.porcentaje}%)
                </div>
                <Progress value={r.porcentaje} tone={toneFor(r.porcentaje)} />
                </div>
              </Td>
              <Td>
                <RowActions
                  label={r.nino.nombre}
                  onEdit={() => setForm({ nino: r.nino })}
                  onDelete={admin ? () => setBorrar(r.nino) : undefined}
                >
                  <button className={`${linkButtonClass} mr-1`} onClick={() => nav.go({ name: "directoryChild", childId: r.nino.id })}>
                    Ver datos
                  </button>
                </RowActions>
              </Td>
            </Tr>
          ))
        ) : (
          <EmptyRow colSpan={7}>No hay niños para estos filtros.</EmptyRow>
        )}
      </Table>

      {form && (
        <ChildFormModal
          nino={form.nino}
          onClose={() => setForm(null)}
          onSaved={(id) => !form.nino && nav.go({ name: "directoryChild", childId: id })}
        />
      )}
      {borrar && (
        <ConfirmModal
          title="Dar de baja al niño"
          confirmText="Dar de baja"
          message={
            <>
              <b>{borrar.nombre}</b> dejará de aparecer en paquetes, estadísticas y en el portal de sus padres. Su
              historial de atenciones se conserva.
            </>
          }
          onConfirm={() => eliminarNino(borrar.id)}
          onClose={() => setBorrar(null)}
        />
      )}
    </>
  );
}
