"use client";

import { KeyRound, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { buttonClass, inputClass } from "@/lib/dashboard/cred";
import { hijosDe, ninosEnAlcance } from "@/lib/sisnat/logic";
import type { Padre } from "@/lib/sisnat/types";
import { EmptyRow, FilterBar, PageTitle, PersonCell, StatusBadge, Table, Td, Tr } from "@/components/dashboard/shared";
import { RowActions } from "@/components/dashboard/row-actions";
import { ParentFormModal } from "@/components/dashboard/modals/people-modals";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

export function ParentsView({ nav }: { nav: Nav }) {
  const { db, alcance, session, eliminarPadre } = useSisnat();
  const [busqueda, setBusqueda] = useState("");
  const [sinHijos, setSinHijos] = useState(false);
  const [form, setForm] = useState<{ padre?: Padre } | null>(null);
  const [borrar, setBorrar] = useState<Padre | null>(null);
  const admin = session.role === "admin";

  const rows = useMemo(() => {
    // Personal de salud: padres con hijos en su micro red, o aún sin hijos vinculados.
    const enAlcance = new Set(ninosEnAlcance(db, { microRed: alcance.microRed, ninoIds: null }).map((n) => n.id));
    const q = busqueda.trim().toLowerCase();
    return db.padres
      .map((p) => ({ padre: p, hijos: hijosDe(db, p) }))
      .filter(({ hijos }) => !alcance.microRed || !hijos.length || hijos.some((h) => enAlcance.has(h.id)))
      .filter(({ hijos }) => !sinHijos || !hijos.length)
      .filter(
        ({ padre, hijos }) =>
          !q || `${padre.nombre} ${padre.dni} ${padre.celular} ${hijos.map((h) => h.nombre).join(" ")}`.toLowerCase().includes(q),
      )
      .sort((a, b) => a.padre.nombre.localeCompare(b.padre.nombre));
  }, [db, alcance.microRed, busqueda, sinHijos]);

  return (
    <>
      <PageTitle
        kicker="Directorio"
        title="Padres y apoderados"
        subtitle="Personas responsables de cada niño y su acceso al portal familiar."
        action={
          <button className={buttonClass} onClick={() => setForm({})}>
            <Plus className="size-4" />
            Registrar padre
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
              placeholder="Nombre, DNI, celular o nombre del hijo"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </span>
        </label>
        <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={sinHijos} onChange={(e) => setSinHijos(e.target.checked)} className="size-4 accent-(--primary)" />
          Solo sin hijos vinculados
        </label>
        <p className="ml-auto self-center text-sm text-muted-foreground">{rows.length} registrados</p>
      </FilterBar>
      <Table head={["Padre o apoderado", "DNI", "Contacto", "Hijos", "Portal", ""]} minWidth={900}>
        {rows.length ? (
          rows.map(({ padre, hijos }) => (
            <Tr key={padre.id}>
              <Td>
                <PersonCell name={padre.nombre} detail={padre.parentesco} />
              </Td>
              <Td>{padre.dni}</Td>
              <Td>
                <span className="grid max-md:text-right">
                  <span>{padre.celular || "—"}</span>
                  {padre.email && <span className="text-xs text-muted-foreground">{padre.email}</span>}
                </span>
              </Td>
              <Td>
                {hijos.length ? (
                  <span className="flex flex-wrap gap-1.5 max-md:justify-end">
                    {hijos.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => nav.go({ name: "directoryChild", childId: h.id })}
                        className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
                      >
                        {h.nombre.split(" ").slice(0, 2).join(" ")}
                      </button>
                    ))}
                  </span>
                ) : (
                  <StatusBadge tone="warn">Sin hijos</StatusBadge>
                )}
              </Td>
              <Td>
                {padre.usuario ? (
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <KeyRound className="size-3.5 text-success" />
                    <span className="font-mono">{padre.usuario}</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Sin cuenta</span>
                )}
              </Td>
              <Td>
                <RowActions
                  label={padre.nombre}
                  onEdit={() => setForm({ padre })}
                  onDelete={admin ? () => setBorrar(padre) : undefined}
                />
              </Td>
            </Tr>
          ))
        ) : (
          <EmptyRow colSpan={6}>No hay padres para esta búsqueda.</EmptyRow>
        )}
      </Table>

      {form && <ParentFormModal padre={form.padre} onClose={() => setForm(null)} />}
      {borrar && (
        <ConfirmModal
          title="Eliminar padre o apoderado"
          message={
            <>
              Se eliminará a <b>{borrar.nombre}</b> y se desvinculará de sus {borrar.hijos.length} hijos (los niños no se
              borran).
              {borrar.usuario && (
                <>
                  {" "}
                  Su cuenta <b className="font-mono">{borrar.usuario}</b> ya no verá a ningún niño en el portal familiar.
                </>
              )}
            </>
          }
          onConfirm={() => eliminarPadre(borrar.id)}
          onClose={() => setBorrar(null)}
        />
      )}
    </>
  );
}
