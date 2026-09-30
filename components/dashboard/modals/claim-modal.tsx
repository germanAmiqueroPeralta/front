"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { Modal } from "@/components/ui/modal";
import { buttonClass, inputClass } from "@/lib/dashboard/cred";
import { ESTABLECIMIENTOS } from "@/lib/sisnat/catalog";
import { todayISO } from "@/lib/sisnat/dates";
import { submitWith } from "@/components/dashboard/forms";

/** Solicitud de revisión de una atención (apoderado → administrador). */
export function ClaimModal({ onClose, defaultNinoId }: { onClose: () => void; defaultNinoId?: number }) {
  const { db, alcance, crearReclamo } = useSisnat();
  const hijos = db.ninos.filter((n) => alcance.ninoIds?.includes(n.id));
  const [ninoId, setNinoId] = useState(defaultNinoId ? String(defaultNinoId) : "");
  const [pending, setPending] = useState(false);
  const nino = hijos.find((n) => String(n.id) === ninoId);

  async function submit(form: FormData) {
    setPending(true);
    const ok = await crearReclamo(form);
    setPending(false);
    if (ok) onClose();
  }

  const label = "grid gap-1.5 text-sm font-medium";
  return (
    <Modal
      title="Solicitar revisión de atención"
      subtitle="Indica los datos para que el equipo encuentre rápidamente el caso. Las evidencias son opcionales."
      onClose={onClose}
    >
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <label className={label}>
          Niño
          <select name="nino_id" required className={inputClass} value={ninoId} onChange={(e) => setNinoId(e.target.value)}>
            <option value="">Seleccionar niño</option>
            {hijos.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre} · {n.codPadron}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={label}>
            DNI del padre o solicitante
            <input name="dni_solicitante" required inputMode="numeric" maxLength={8} placeholder="8 dígitos" className={inputClass} />
          </label>
          <label className={label}>
            DNI del niño
            <input key={`dni-${ninoId}`} name="dni_nino" required defaultValue={nino?.dni ?? ""} className={inputClass} />
          </label>
        </div>
        <label className={label}>
          Identificador del niño
          <input
            key={`cod-${ninoId}`}
            name="identificador_nino"
            required
            defaultValue={nino?.codPadron ?? ""}
            placeholder="Código de padrón"
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={label}>
            Establecimiento
            <select
              key={`eess-${ninoId}`}
              name="establecimiento"
              required
              defaultValue={nino?.establecimiento ?? ""}
              className={inputClass}
            >
              <option value="">Seleccionar</option>
              {ESTABLECIMIENTOS.map((e) => (
                <option key={e.nombre}>{e.nombre}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Fecha de atención
            <input type="date" name="fecha_atencion" max={todayISO()} className={inputClass} />
          </label>
        </div>
        <label className={label}>
          Mensaje o detalle
          <textarea
            name="mensaje"
            required
            rows={4}
            placeholder="Explica qué atención recibiste y qué aparece incorrectamente en el sistema"
            className="rounded-lg border border-input bg-background p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className={label}>
          Evidencias
          <input
            type="file"
            name="evidencias"
            multiple
            accept="image/jpeg,image/png,application/pdf"
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
          />
          <span className="text-xs font-normal text-muted-foreground">Máximo 5 archivos JPG, PNG o PDF.</span>
        </label>
        <button className={buttonClass} type="submit" disabled={pending}>
          <Send className="size-4" />
          {pending ? "Enviando..." : "Enviar solicitud"}
        </button>
      </form>
    </Modal>
  );
}
