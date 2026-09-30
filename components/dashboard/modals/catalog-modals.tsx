"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { Modal } from "@/components/ui/modal";
import { AgeField, TextField, labelClass, textareaClass, submitWith } from "@/components/dashboard/forms";
import { buttonClass } from "@/lib/dashboard/cred";
import { prestacionesDe } from "@/lib/sisnat/logic";
import type { Modulo, Prestacion } from "@/lib/sisnat/types";

const upper = (v: FormDataEntryValue | null) => String(v ?? "").trim().toUpperCase();
const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** Crear o editar un paquete de atención (solo administrador). */
export function PackageFormModal({
  paquete,
  onClose,
  onSaved,
}: {
  paquete?: Modulo;
  onClose: () => void;
  onSaved?: (codigo: string) => void;
}) {
  const { guardarPaquete } = useSisnat();
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    const codigo = paquete?.codigo ?? upper(form.get("codigo"));
    const ok = await guardarPaquete(
      {
        codigo,
        nombre: text(form.get("nombre")),
        descripcion: text(form.get("descripcion")),
        edadMinDias: Number(form.get("edadMin")),
        edadMaxDias: Number(form.get("edadMax")),
      },
      paquete?.codigo,
    );
    setPending(false);
    if (ok) {
      onClose();
      onSaved?.(codigo);
    }
  }

  return (
    <Modal
      title={paquete ? "Editar paquete" : "Nuevo paquete"}
      subtitle={paquete ? `${paquete.codigo} · ${paquete.nombre}` : "Define a qué edades aplica. Después podrás agregarle atenciones."}
      onClose={onClose}
    >
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_1fr]">
          <TextField
            label="Código"
            name="codigo"
            required
            defaultValue={paquete?.codigo}
            disabled={Boolean(paquete)}
            placeholder="IAG_30"
            className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm uppercase outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          />
          <TextField label="Nombre" name="nombre" required defaultValue={paquete?.nombre} placeholder="Ej. 6 años" />
        </div>
        <label className={labelClass}>
          Descripción
          <textarea name="descripcion" rows={2} defaultValue={paquete?.descripcion} placeholder="Qué incluye el paquete" className={textareaClass} />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AgeField label="Edad mínima" name="edadMin" defaultDays={paquete?.edadMinDias ?? 0} />
          <AgeField label="Edad máxima" name="edadMax" defaultDays={paquete?.edadMaxDias ?? 365} />
        </div>
        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : paquete ? "Guardar cambios" : "Crear paquete"}
        </button>
      </form>
    </Modal>
  );
}

/** Crear o editar una atención (prestación) dentro de un paquete (solo administrador). */
export function PrestationFormModal({
  modulo,
  prestacion,
  onClose,
}: {
  modulo: Modulo;
  prestacion?: Prestacion;
  onClose: () => void;
}) {
  const { db, guardarPrestacion } = useSisnat();
  const [pending, setPending] = useState(false);
  const grupos = [...new Set(prestacionesDe(db, modulo.codigo).map((p) => p.grupo))];

  async function submit(form: FormData) {
    setPending(true);
    const ok = await guardarPrestacion(
      modulo.codigo,
      {
        codigo: upper(form.get("codigo")),
        nombre: text(form.get("nombre")),
        grupo: upper(form.get("grupo")) || "DIRECTO",
        edadMinDias: Number(form.get("edadMin")),
        edadMaxDias: Number(form.get("edadMax")),
      },
      prestacion?.id,
    );
    setPending(false);
    if (ok) onClose();
  }

  return (
    <Modal
      title={prestacion ? "Editar atención" : "Nueva atención"}
      subtitle={`Paquete ${modulo.codigo} · ${modulo.nombre}`}
      onClose={onClose}
    >
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_1fr]">
          <TextField label="Código" name="codigo" required defaultValue={prestacion?.codigo} placeholder="CRED_6" className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm uppercase outline-none focus:ring-2 focus:ring-primary" />
          <TextField label="Nombre" name="nombre" required defaultValue={prestacion?.nombre} placeholder="Ej. Control CRED 6 años" />
        </div>
        <TextField
          label="Grupo"
          name="grupo"
          list="grupos-paquete"
          defaultValue={prestacion?.grupo}
          placeholder="DIRECTO"
          hint="Encabezado bajo el que se agrupa (como en el Excel). Elige uno existente o escribe uno nuevo."
        />
        <datalist id="grupos-paquete">
          {grupos.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AgeField label="Desde la edad" name="edadMin" defaultDays={prestacion?.edadMinDias ?? modulo.edadMinDias} />
          <AgeField label="Hasta la edad" name="edadMax" defaultDays={prestacion?.edadMaxDias ?? modulo.edadMaxDias} />
        </div>
        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : prestacion ? "Guardar cambios" : "Agregar atención"}
        </button>
      </form>
    </Modal>
  );
}
