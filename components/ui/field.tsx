"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary";

export function Field({
  label,
  name,
  placeholder,
  area = false,
  autoComplete,
}: {
  label: string;
  name: string;
  placeholder: string;
  area?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {area ? (
        <textarea
          name={name}
          required
          rows={3}
          placeholder={placeholder}
          className="rounded-lg border border-input bg-background p-3 font-normal outline-none focus:ring-2 focus:ring-primary"
        />
      ) : (
        <input
          name={name}
          required
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={inputClass}
        />
      )}
    </label>
  );
}

/** Campo de contraseña oculto por defecto, con botón para mostrarla. */
export function PasswordField({
  label,
  name,
  placeholder,
  autoComplete = "current-password",
}: {
  label: string;
  name: string;
  placeholder: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <span className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          required
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`${inputClass} pr-10`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  );
}
