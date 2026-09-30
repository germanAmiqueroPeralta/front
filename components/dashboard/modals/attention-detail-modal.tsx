"use client";

import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/dashboard/shared";
import { buttonClass, prestacionTone } from "@/lib/dashboard/cred";
import { formatDate } from "@/lib/sisnat/dates";
import type { ItemFicha } from "@/lib/sisnat/logic";
import type { Nino } from "@/lib/sisnat/types";

const rango = (min: number, max: number) => `${min} a ${max} días de edad`;

export function AttentionDetailModal({ nino, item, onClose }: { nino: Nino; item: ItemFicha; onClose: () => void }) {
  const fields = [
    ["Niño", nino.nombre],
    ["Paquete", `${item.modulo.codigo} · ${item.modulo.nombre}`],
    ["Prestación", `${item.prestacion.nombre} (${item.prestacion.codigo})`],
    ["Grupo", item.prestacion.grupo],
    ["Ventana de atención", rango(item.prestacion.edadMinDias, item.prestacion.edadMaxDias)],
    ["Centro de salud", item.registro?.establecimiento ?? "No registrado"],
    ["Fecha", item.registro ? formatDate(item.registro.fechaAtencion) : "Pendiente"],
    ["Registrado por", item.registro?.registradoPor ?? "—"],
    ["Observaciones", item.registro?.observaciones || "Sin detalles"],
  ];
  return (
    <Modal title="Ficha de atención" subtitle="Detalle del registro de la prestación" onClose={onClose}>
      <div className="mb-4">
        <StatusBadge tone={prestacionTone[item.estado]}>{item.estado}</StatusBadge>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className={`rounded-lg bg-muted p-3 ${label === "Observaciones" ? "sm:col-span-2" : ""}`}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <button className={`${buttonClass} mt-5 w-full`} onClick={onClose}>
        Cerrar ficha
      </button>
    </Modal>
  );
}
