"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { inputClass } from "@/lib/dashboard/cred";
import { formatAge } from "@/lib/sisnat/dates";

/** Piezas de formulario compartidas por los modales de creación / edición. */

export const labelClass = "grid min-w-0 gap-1.5 text-sm font-medium";
export const textareaClass =
  "w-full min-w-0 rounded-lg border border-input bg-background p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary";

export function TextField({
  label,
  name,
  defaultValue,
  placeholder,
  required = false,
  hint,
  ...rest
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  required?: boolean;
  hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  return (
    <label className={labelClass}>
      <span>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className={inputClass}
        {...rest}
      />
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

const UNIDADES = { dias: 1, meses: 30, anios: 365 } as const;
type Unidad = keyof typeof UNIDADES;

function mejorUnidad(dias: number): Unidad {
  if (dias && dias % 365 === 0) return "anios";
  if (dias && dias % 30 === 0) return "meses";
  return "dias";
}

/** Edad expresada en días, meses o años; envía siempre el total en días (campo oculto). */
export function AgeField({ label, name, defaultDays }: { label: string; name: string; defaultDays: number }) {
  const [unidad, setUnidad] = useState<Unidad>(mejorUnidad(defaultDays));
  const [valor, setValor] = useState(String(defaultDays / UNIDADES[mejorUnidad(defaultDays)]));
  const dias = Math.round(Number(valor || 0) * UNIDADES[unidad]);
  return (
    <div className={labelClass}>
      <span>
        {label}
        <span className="text-destructive"> *</span>
      </span>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          step="any"
          required
          aria-label={label}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className={`${inputClass} flex-1`}
        />
        <select
          aria-label={`Unidad de ${label.toLowerCase()}`}
          value={unidad}
          onChange={(e) => setUnidad(e.target.value as Unidad)}
          className={`${inputClass} w-28! flex-none`}
        >
          <option value="dias">días</option>
          <option value="meses">meses</option>
          <option value="anios">años</option>
        </select>
      </div>
      <input type="hidden" name={name} value={dias} />
      <span className="text-xs font-normal text-muted-foreground">
        = {dias} días ({formatAge(dias)})
      </span>
    </div>
  );
}

/** Lista con búsqueda y casillas para vincular varios elementos (hijos ↔ padres). */
export function CheckList<T extends { id: number }>({
  label,
  name,
  items,
  defaultSelected,
  render,
  searchText,
  empty = "No hay elementos para vincular.",
}: {
  label: string;
  name: string;
  items: T[];
  defaultSelected: number[];
  render: (item: T) => React.ReactNode;
  searchText: (item: T) => string;
  empty?: string;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number[]>(defaultSelected);
  const visibles = items
    .filter((i) => !q || searchText(i).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(selected.includes(b.id)) - Number(selected.includes(a.id)));

  return (
    <fieldset className="grid min-w-0 gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">
        {label} <span className="font-normal text-muted-foreground">({selected.length} seleccionados)</span>
      </legend>
      <div className="relative">
        <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o DNI"
          aria-label={`Buscar en ${label.toLowerCase()}`}
          className={`${inputClass} pl-9`}
        />
      </div>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-border [scrollbar-width:thin]">
        {visibles.length ? (
          visibles.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-3 py-2 text-sm last:border-0 hover:bg-muted/40"
            >
              <input
                type="checkbox"
                name={name}
                value={item.id}
                checked={selected.includes(item.id)}
                onChange={(e) =>
                  setSelected((s) => (e.target.checked ? [...s, item.id] : s.filter((x) => x !== item.id)))
                }
                className="size-4 accent-(--primary)"
              />
              <span className="min-w-0 flex-1">{render(item)}</span>
            </label>
          ))
        ) : (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">{q ? "Sin resultados." : empty}</p>
        )}
      </div>
    </fieldset>
  );
}

export const idsFrom = (form: FormData, name: string) => form.getAll(name).map(Number);

/**
 * Envío con onSubmit en lugar de `action`: React 19 limpia el formulario tras una `action`,
 * y si la validación falla el usuario perdería lo que escribió.
 */
export function submitWith(fn: (form: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fn(new FormData(e.currentTarget));
  };
}
