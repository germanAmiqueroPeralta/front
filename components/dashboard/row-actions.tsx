"use client";

import { Pencil, Trash2 } from "lucide-react";

const base = "inline-flex size-9 items-center justify-center rounded-lg border border-border transition hover:bg-accent";

/** Botones de ícono para editar / eliminar una fila de tabla. */
export function RowActions({
  label,
  onEdit,
  onDelete,
  children,
}: {
  label: string;
  onEdit?: () => void;
  onDelete?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <span className="flex items-center justify-end gap-2">
      {children}
      {onEdit && (
        <button className={base} onClick={onEdit} aria-label={`Editar ${label}`} title="Editar">
          <Pencil className="size-4" />
        </button>
      )}
      {onDelete && (
        <button
          className={`${base} text-destructive hover:bg-destructive/10`}
          onClick={onDelete}
          aria-label={`Eliminar ${label}`}
          title="Eliminar"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </span>
  );
}
