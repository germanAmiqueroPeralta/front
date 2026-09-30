"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { buttonClass } from "@/lib/dashboard/cred";
import { formatAge } from "@/lib/sisnat/dates";
import { moduloDe, prestacionesDe } from "@/lib/sisnat/logic";
import type { Prestacion } from "@/lib/sisnat/types";
import { EmptyRow, GroupRow, PageTitle, PersonCell, Table, Td, Tr, groupBy } from "@/components/dashboard/shared";
import { PrestationFormModal } from "@/components/dashboard/modals/catalog-modals";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const iconButton = "inline-flex size-9 items-center justify-center rounded-lg border border-border transition hover:bg-accent";

/** Administración de las atenciones (prestaciones) de un paquete. */
export function PackageConfigView({ code }: { code: string }) {
  const { db, eliminarPrestacion } = useSisnat();
  const [form, setForm] = useState<{ prestacion?: Prestacion } | null>(null);
  const [borrar, setBorrar] = useState<Prestacion | null>(null);
  const modulo = moduloDe(db, code);
  if (!modulo) return <p className="text-muted-foreground">Paquete no encontrado.</p>;

  const lista = prestacionesDe(db, code);
  const registrosDe = (id: number) => db.registros.filter((r) => r.prestacionId === id).length;

  return (
    <>
      <PageTitle
        kicker={`${code} · Configuración`}
        title={`Atenciones de ${modulo.nombre}`}
        subtitle={`El paquete aplica de ${formatAge(modulo.edadMinDias)} a ${formatAge(modulo.edadMaxDias)}.`}
        action={
          <button className={buttonClass} onClick={() => setForm({})}>
            <Plus className="size-4" />
            Nueva atención
          </button>
        }
      />
      <Table head={["Atención", "Código", "Desde", "Hasta", "Registradas", ""]} minWidth={720}>
        {lista.length ? (
          groupBy(lista, (p) => p.grupo).map(([grupo, items]) => [
            <GroupRow key={grupo} colSpan={6}>
              {grupo}
            </GroupRow>,
            ...items.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <PersonCell name={p.nombre} detail={p.grupo} />
                </Td>
                <Td className="font-mono text-xs">{p.codigo}</Td>
                <Td>{formatAge(p.edadMinDias)}</Td>
                <Td>{formatAge(p.edadMaxDias)}</Td>
                <Td>{registrosDe(p.id)}</Td>
                <Td>
                  <span className="flex gap-2">
                    <button className={iconButton} onClick={() => setForm({ prestacion: p })} aria-label={`Editar ${p.nombre}`} title="Editar">
                      <Pencil className="size-4" />
                    </button>
                    <button
                      className={`${iconButton} text-destructive hover:bg-destructive/10`}
                      onClick={() => setBorrar(p)}
                      aria-label={`Eliminar ${p.nombre}`}
                      title="Eliminar"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </span>
                </Td>
              </Tr>
            )),
          ])
        ) : (
          <EmptyRow colSpan={6}>Este paquete aún no tiene atenciones. Agrega la primera con “Nueva atención”.</EmptyRow>
        )}
      </Table>

      {form && <PrestationFormModal modulo={modulo} prestacion={form.prestacion} onClose={() => setForm(null)} />}
      {borrar && (
        <ConfirmModal
          title="Eliminar atención"
          message={
            <>
              Se quitará <b>{borrar.nombre}</b> del paquete.
              {registrosDe(borrar.id) > 0 && (
                <>
                  {" "}
                  También se borrarán sus <b>{registrosDe(borrar.id)} atenciones registradas</b> a niños.
                </>
              )}
            </>
          }
          onConfirm={() => eliminarPrestacion(borrar.id)}
          onClose={() => setBorrar(null)}
        />
      )}
    </>
  );
}
