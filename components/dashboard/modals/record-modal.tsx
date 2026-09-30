"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { Modal } from "@/components/ui/modal";
import { buttonClass, inputClass } from "@/lib/dashboard/cred";
import { ESTABLECIMIENTOS } from "@/lib/sisnat/catalog";
import { todayISO } from "@/lib/sisnat/dates";
import type { ItemFicha } from "@/lib/sisnat/logic";
import type { Nino } from "@/lib/sisnat/types";
import { submitWith } from "@/components/dashboard/forms";

/** Registrar o modificar el cumplimiento de una prestación (solo admin / personal de salud). */
export function RecordModal({ nino, item, onClose }: { nino: Nino; item: ItemFicha; onClose: () => void }) {
  const { guardarRegistro } = useSisnat();
  const [pending, setPending] = useState(false);
  const editing = Boolean(item.registro);

  async function submit(form: FormData) {
    setPending(true);
    const ok = await guardarRegistro({
      ninoId: nino.id,
      prestacionId: item.prestacion.id,
      fechaAtencion: String(form.get("fecha")),
      establecimiento: String(form.get("establecimiento")),
      observaciones: String(form.get("observaciones") ?? ""),
    });
    setPending(false);
    if (ok) onClose();
  }

  return (
    <Modal
      title={editing ? "Modificar atención" : "Registrar atención"}
      subtitle={`${nino.nombre} · ${item.prestacion.nombre}`}
      onClose={onClose}
    >
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <label className="grid gap-1.5 text-sm font-medium">
          Fecha de atención
          <input
            type="date"
            name="fecha"
            required
            className={inputClass}
            min={nino.fechaNacimiento}
            max={todayISO()}
            defaultValue={item.registro?.fechaAtencion ?? todayISO()}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Establecimiento
          <select
            name="establecimiento"
            required
            className={inputClass}
            defaultValue={item.registro?.establecimiento ?? nino.establecimiento}
          >
            <option value="">Seleccionar establecimiento</option>
            {ESTABLECIMIENTOS.map((e) => (
              <option key={e.nombre} value={e.nombre}>
                {e.nombre} · {e.microRed}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Observaciones
          <textarea
            name="observaciones"
            rows={3}
            defaultValue={item.registro?.observaciones ?? ""}
            placeholder="Detalle opcional de la atención"
            className="rounded-lg border border-input bg-background p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <button className={buttonClass} type="submit" disabled={pending}>
          <CheckCircle2 className="size-4" />
          {pending ? "Guardando..." : editing ? "Guardar modificación" : "Guardar cumplimiento"}
        </button>
      </form>
    </Modal>
  );
}
