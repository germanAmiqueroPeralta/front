"use client";

import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { buttonClass, linkButtonClass, prestacionTone, secondaryButtonClass } from "@/lib/dashboard/cred";
import { ageDays, formatAge, formatDate } from "@/lib/sisnat/dates";
import { fichaNino, moduloDe, type ItemFicha } from "@/lib/sisnat/logic";
import {
  EmptyRow,
  GroupRow,
  PageTitle,
  PersonCell,
  StatusBadge,
  Table,
  Td,
  Tr,
  groupBy,
} from "@/components/dashboard/shared";
import { Stat } from "@/components/dashboard/stat";
import { AttentionDetailModal } from "@/components/dashboard/modals/attention-detail-modal";
import { RecordModal } from "@/components/dashboard/modals/record-modal";

export function ChildView({ childId, code }: { childId: number; code?: string }) {
  const { db, session } = useSisnat();
  const nino = db.ninos.find((n) => n.id === childId);
  const items = useMemo(() => (nino ? fichaNino(db, nino, code) : []), [db, nino, code]);
  const [detail, setDetail] = useState<ItemFicha | null>(null);
  const [record, setRecord] = useState<ItemFicha | null>(null);
  const readOnly = session.role === "guardian";

  if (!nino) return <p className="text-muted-foreground">Niño no encontrado.</p>;

  const modulo = code ? moduloDe(db, code) : undefined;
  const grupos = groupBy(items, (i) => (code ? i.prestacion.grupo : `${i.modulo.codigo} · ${i.modulo.nombre}`));
  const count = (estado: string) => items.filter((i) => i.estado === estado).length;
  const cols = readOnly ? 5 : 6;

  return (
    <>
      <PageTitle kicker={modulo ? `${modulo.codigo} · ${modulo.nombre}` : "Historial de prestaciones"}
        title={nino.nombre}
        subtitle={`${nino.codPadron} · ${nino.establecimiento} · ${formatAge(ageDays(nino.fechaNacimiento))}`}
      />
      <section className="mb-5 grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 sm:p-5 md:grid-cols-4">
        {[
          ["DNI", nino.dni ?? "Sin DNI"],
          ["Nacimiento", formatDate(nino.fechaNacimiento)],
          ["Madre", nino.nombreMadre],
          ["Celular de contacto", nino.celular],
          ["Micro red", nino.microRed],
          ["Establecimiento", nino.establecimiento],
          ["Condición al nacer", nino.condicionRn ?? "Normal"],
          ["Sexo", nino.sexo === "F" ? "Niña" : "Niño"],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="break-words font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <div className="mb-5 grid grid-cols-3 gap-3 sm:gap-4">
        <Stat label="Cumplidas" value={String(count("CUMPLIDO"))} detail="Atenciones registradas" icon={CheckCircle2} />
        <Stat label="Pendientes" value={String(count("PENDIENTE"))} detail="Dentro de su ventana de edad" icon={Clock} />
        <Stat label="Vencidas" value={String(count("VENCIDO"))} detail="Fuera de la edad máxima" icon={AlertTriangle} />
      </div>
      <Table head={["Prestación", "Módulo", "Estado", "Fecha", "Ficha", ...(readOnly ? [] : ["Acción"])]} minWidth={800}>
        {grupos.length ? (
          grupos.map(([grupo, list]) => [
            <GroupRow key={grupo} colSpan={cols}>
              {grupo}
            </GroupRow>,
            ...list.map((item) => (
              <Tr key={item.prestacion.id}>
                <Td>
                  <PersonCell name={item.prestacion.nombre} detail={item.prestacion.codigo} />
                </Td>
                <Td className="text-xs text-muted-foreground">{item.modulo.codigo}</Td>
                <Td>
                  <StatusBadge tone={prestacionTone[item.estado]}>{item.estado}</StatusBadge>
                </Td>
                <Td>{item.registro ? formatDate(item.registro.fechaAtencion) : "Pendiente"}</Td>
                <Td>
                  <button className={linkButtonClass} onClick={() => setDetail(item)}>
                    Ver ficha
                  </button>
                </Td>
                {!readOnly && (
                  <Td>
                    <button
                      className={item.registro ? secondaryButtonClass : `${buttonClass} px-3 py-2`}
                      onClick={() => setRecord(item)}
                    >
                      {item.registro ? "Modificar" : "Registrar"}
                    </button>
                  </Td>
                )}
              </Tr>
            )),
          ])
        ) : (
          <EmptyRow colSpan={cols}>No hay atenciones para este paquete.</EmptyRow>
        )}
      </Table>
      {detail && <AttentionDetailModal nino={nino} item={detail} onClose={() => setDetail(null)} />}
      {record && <RecordModal nino={nino} item={record} onClose={() => setRecord(null)} />}
    </>
  );
}
