"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { Modal } from "@/components/ui/modal";
import { CheckList, TextField, idsFrom, labelClass, submitWith } from "@/components/dashboard/forms";
import { buttonClass, inputClass } from "@/lib/dashboard/cred";
import { ESTABLECIMIENTOS } from "@/lib/sisnat/catalog";
import { todayISO } from "@/lib/sisnat/dates";
import { ninosEnAlcance, padresDe } from "@/lib/sisnat/logic";
import type { Nino, Padre } from "@/lib/sisnat/types";

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** Registrar o editar un niño, con sus padres vinculados. */
export function ChildFormModal({ nino, onClose, onSaved }: { nino?: Nino; onClose: () => void; onSaved?: (id: number) => void }) {
  const { db, alcance, guardarNino } = useSisnat();
  const [pending, setPending] = useState(false);
  const establecimientos = ESTABLECIMIENTOS.filter((e) => !alcance.microRed || e.microRed === alcance.microRed);
  const siguientePadron = `PAD-${String(250300 + (Math.max(0, ...db.ninos.map((n) => n.id)) + 1) * 17).padStart(7, "0")}`;

  async function submit(form: FormData) {
    setPending(true);
    const id = await guardarNino(
      {
        nombre: text(form.get("nombre")),
        sexo: form.get("sexo") === "M" ? "M" : "F",
        fechaNacimiento: text(form.get("fechaNacimiento")),
        dni: text(form.get("dni")) || null,
        codPadron: text(form.get("codPadron")) || siguientePadron,
        establecimiento: text(form.get("establecimiento")),
        nombreMadre: text(form.get("nombreMadre")),
        celular: text(form.get("celular")),
        condicionRn: text(form.get("condicionRn")) || null,
        padreIds: idsFrom(form, "padres"),
      },
      nino?.id,
    );
    setPending(false);
    if (id !== null) {
      onClose();
      onSaved?.(id);
    }
  }

  return (
    <Modal title={nino ? "Editar niño" : "Registrar niño"} subtitle={nino ? nino.nombre : "Datos del padrón nominal"} onClose={onClose}>
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <TextField label="Nombres y apellidos" name="nombre" required defaultValue={nino?.nombre} placeholder="Ej. Sofía Quispe Huamán" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className={labelClass}>
            <span>
              Sexo<span className="text-destructive"> *</span>
            </span>
            <select name="sexo" defaultValue={nino?.sexo ?? "F"} className={inputClass}>
              <option value="F">Niña</option>
              <option value="M">Niño</option>
            </select>
          </label>
          <TextField label="Fecha de nacimiento" name="fechaNacimiento" type="date" required max={todayISO()} defaultValue={nino?.fechaNacimiento} />
          <TextField label="DNI" name="dni" inputMode="numeric" maxLength={8} defaultValue={nino?.dni} placeholder="Opcional" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Código de padrón" name="codPadron" defaultValue={nino?.codPadron ?? siguientePadron} />
          <label className={labelClass}>
            <span>
              Establecimiento<span className="text-destructive"> *</span>
            </span>
            <select name="establecimiento" required defaultValue={nino?.establecimiento ?? ""} className={inputClass}>
              <option value="">Seleccionar</option>
              {establecimientos.map((e) => (
                <option key={e.nombre} value={e.nombre}>
                  {e.nombre} · {e.microRed}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="Nombre de la madre" name="nombreMadre" defaultValue={nino?.nombreMadre} />
          <TextField label="Celular de contacto" name="celular" inputMode="tel" defaultValue={nino?.celular} />
          <label className={labelClass}>
            Condición al nacer
            <select name="condicionRn" defaultValue={nino?.condicionRn ?? ""} className={inputClass}>
              <option value="">Normal</option>
              <option value="PREMATURO">Prematuro</option>
              <option value="BAJO PESO">Bajo peso</option>
              <option value="PREMATURO/BAJO PESO">Prematuro y bajo peso</option>
            </select>
          </label>
        </div>
        <CheckList
          label="Padres o apoderados"
          name="padres"
          items={db.padres}
          defaultSelected={nino ? padresDe(db, nino.id).map((p) => p.id) : []}
          searchText={(p) => `${p.nombre} ${p.dni}`}
          empty="No hay padres registrados todavía."
          render={(p) => (
            <>
              <span className="block font-medium">{p.nombre}</span>
              <span className="block text-xs text-muted-foreground">
                {p.parentesco} · DNI {p.dni}
              </span>
            </>
          )}
        />
        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : nino ? "Guardar cambios" : "Registrar niño"}
        </button>
      </form>
    </Modal>
  );
}

/** Registrar o editar un padre / apoderado y vincular sus hijos. */
export function ParentFormModal({ padre, onClose }: { padre?: Padre; onClose: () => void }) {
  const { db, alcance, guardarPadre } = useSisnat();
  const [pending, setPending] = useState(false);
  // Personal de salud: solo puede vincular niños de su micro red (conserva los ya vinculados de otras).
  const disponibles = ninosEnAlcance(db, { microRed: alcance.microRed, ninoIds: null });

  async function submit(form: FormData) {
    setPending(true);
    const visibles = new Set(disponibles.map((n) => n.id));
    const ocultos = (padre?.hijos ?? []).filter((id) => !visibles.has(id));
    const ok = await guardarPadre(
      {
        nombre: text(form.get("nombre")),
        dni: text(form.get("dni")),
        celular: text(form.get("celular")),
        email: text(form.get("email")),
        parentesco: text(form.get("parentesco")) || "Apoderado",
        usuario: padre?.usuario ?? null,
        hijos: [...ocultos, ...idsFrom(form, "hijos")],
      },
      padre?.id,
    );
    setPending(false);
    if (ok) onClose();
  }

  return (
    <Modal title={padre ? "Editar padre o apoderado" : "Registrar padre o apoderado"} subtitle={padre?.nombre ?? "Datos de contacto y niños a su cargo"} onClose={onClose}>
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <TextField label="Nombres y apellidos" name="nombre" required defaultValue={padre?.nombre} placeholder="Ej. Rosa Quispe Llamocca" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="DNI" name="dni" required inputMode="numeric" maxLength={8} defaultValue={padre?.dni} placeholder="8 dígitos" />
          <label className={labelClass}>
            Parentesco
            <select name="parentesco" defaultValue={padre?.parentesco ?? "Madre"} className={inputClass}>
              <option>Madre</option>
              <option>Padre</option>
              <option>Abuelo(a)</option>
              <option>Tío(a)</option>
              <option>Apoderado</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Celular" name="celular" inputMode="tel" defaultValue={padre?.celular} placeholder="9xx xxx xxx" />
          <TextField label="Correo" name="email" type="email" defaultValue={padre?.email} placeholder="Opcional" />
        </div>
        <CheckList
          label="Hijos a su cargo"
          name="hijos"
          items={disponibles}
          defaultSelected={(padre?.hijos ?? []).filter((id) => disponibles.some((n) => n.id === id))}
          searchText={(n) => `${n.nombre} ${n.dni ?? ""} ${n.codPadron}`}
          render={(n) => (
            <>
              <span className="block font-medium">{n.nombre}</span>
              <span className="block text-xs text-muted-foreground">
                {n.codPadron} · {n.establecimiento}
              </span>
            </>
          )}
        />
        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : padre ? "Guardar cambios" : "Registrar"}
        </button>
      </form>
    </Modal>
  );
}
