"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { useBackendAction } from "@/hooks/use-backend";
import { createChildForGuardian, updateChild } from "@/lib/actions/admin/people";
import {
  RELATIONSHIPS,
  birthConditionLabels,
  childName,
  type BirthCondition,
  type Child,
  type ChildInput,
  type Guardian,
  type HealthFacility,
  type Region,
} from "@/lib/api/types";
import { buttonClass, inputClass } from "@/lib/dashboard/cred";
import { todayISO } from "@/lib/sisnat/dates";
import { TextField, labelClass, submitWith } from "@/components/dashboard/forms";
import { SelectField, optional, required } from "@/components/dashboard/admin/common";
import { Modal } from "@/components/ui/modal";

/**
 * Registrar un hijo desde la ficha de su padre (`guardian`) o editar un niño (`child`).
 * Al registrar, si el parentesco es "Madre" copia sus datos como datos de la madre.
 */
export function ChildFormModal({
  child,
  guardian,
  facilities,
  regions,
  onClose,
  onSaved,
}: {
  child?: Child;
  guardian?: Guardian;
  facilities: HealthFacility[];
  regions: Region[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const run = useBackendAction();
  const [pending, setPending] = useState(false);
  const [relationship, setRelationship] = useState("Madre");
  const [mother, setMother] = useState({
    name: child ? (child.mother_name ?? "") : (guardian?.full_name ?? ""),
    dni: child ? (child.mother_dni ?? "") : (guardian?.dni ?? ""),
  });

  function changeRelationship(value: string) {
    setRelationship(value);
    if (!guardian) return;
    if (value === "Madre") setMother({ name: guardian.full_name, dni: guardian.dni });
    else if (mother.dni === guardian.dni) setMother({ name: "", dni: "" });
  }

  async function submit(form: FormData) {
    const input: ChildInput = {
      padron_code: required(form, "padron_code"),
      medical_record_code: optional(form, "medical_record_code"),
      dni: optional(form, "dni"),
      first_names: required(form, "first_names"),
      last_names: required(form, "last_names"),
      birth_date: required(form, "birth_date"),
      gender: (optional(form, "gender") as "M" | "F" | null) ?? null,
      birth_condition: required(form, "birth_condition") as BirthCondition,
      mother_name: mother.name.trim() || null,
      mother_dni: mother.dni.trim() || null,
      address: optional(form, "address"),
      contact_phone: optional(form, "contact_phone"),
      insurance: optional(form, "insurance"),
      health_facility_id: required(form, "health_facility_id"),
    };
    setPending(true);
    const saved = child
      ? await run(updateChild(child.id, input), "Datos del niño actualizados")
      : await run(createChildForGuardian(guardian!.id, input, relationship));
    setPending(false);
    if (saved) {
      onSaved();
      onClose();
    }
  }

  return (
    <Modal
      title={child ? "Editar niño" : "Registrar hijo"}
      subtitle={child ? childName(child) : `Hijo de ${guardian?.full_name}`}
      onClose={onClose}
    >
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        {!child && guardian && (
          <SelectField
            label={`Parentesco de ${guardian.full_name.split(" ")[0]} con el niño`}
            name="relationship"
            required
            defaultValue={relationship}
            onChange={changeRelationship}
            options={RELATIONSHIPS.map((r) => ({ value: r, label: r }))}
          />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Nombres" name="first_names" required defaultValue={child?.first_names} placeholder="Ej. Ana Lucía" />
          <TextField label="Apellidos" name="last_names" required defaultValue={child?.last_names} placeholder="Ej. Quispe Huamán" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label="Sexo"
            name="gender"
            required
            defaultValue={child?.gender ?? ""}
            placeholder="Seleccionar"
            options={[
              { value: "F", label: "Niña" },
              { value: "M", label: "Niño" },
            ]}
          />
          <TextField label="Fecha de nacimiento" name="birth_date" type="date" required max={todayISO()} defaultValue={child?.birth_date} />
          <TextField label="DNI" name="dni" inputMode="numeric" maxLength={8} pattern="\d{8}" defaultValue={child?.dni} placeholder="Opcional" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Código de padrón" name="padron_code" required defaultValue={child?.padron_code} placeholder="Ej. PN-000001" />
          <TextField label="Historia clínica" name="medical_record_code" defaultValue={child?.medical_record_code} placeholder="Opcional" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            <span>
              Establecimiento<span className="text-destructive"> *</span>
            </span>
            <select name="health_facility_id" required defaultValue={child?.health_facility_id ?? ""} className={inputClass}>
              <option value="">Seleccionar</option>
              {regions.map((r) => {
                const own = facilities.filter((f) => f.region_id === r.id);
                return own.length ? (
                  <optgroup key={r.id} label={r.name}>
                    {own.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
          </label>
          <SelectField
            label="Condición al nacer"
            name="birth_condition"
            required
            defaultValue={child?.birth_condition ?? "none"}
            hint="Prematuro o bajo peso activan el paquete de recién nacido en riesgo."
            options={Object.entries(birthConditionLabels).map(([value, label]) => ({ value, label }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Nombre de la madre
            <input value={mother.name} onChange={(e) => setMother((m) => ({ ...m, name: e.target.value }))} className={inputClass} />
          </label>
          <label className={labelClass}>
            DNI de la madre
            <input
              value={mother.dni}
              onChange={(e) => setMother((m) => ({ ...m, dni: e.target.value }))}
              inputMode="numeric"
              maxLength={20}
              className={inputClass}
            />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="Dirección" name="address" defaultValue={child?.address} placeholder="Opcional" />
          <TextField
            label="Celular de contacto"
            name="contact_phone"
            inputMode="tel"
            defaultValue={child ? child.contact_phone : guardian?.phone}
            placeholder="9xx xxx xxx"
          />
          <TextField label="Seguro" name="insurance" list="insurance-options" defaultValue={child?.insurance} placeholder="Ej. SIS" />
          <datalist id="insurance-options">
            <option value="SIS" />
            <option value="EsSalud" />
            <option value="Privado" />
            <option value="Ninguno" />
          </datalist>
        </div>
        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : child ? "Guardar cambios" : "Registrar hijo"}
        </button>
      </form>
    </Modal>
  );
}
