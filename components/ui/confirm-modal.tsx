"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { secondaryButtonClass } from "@/lib/dashboard/cred";

/** Confirmación para acciones destructivas (eliminar, dar de baja, desactivar). */
export function ConfirmModal({
  title,
  message,
  confirmText = "Eliminar",
  onConfirm,
  onClose,
}: {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  onConfirm: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Modal title={title} subtitle="Esta acción requiere confirmación" onClose={onClose}>
      <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div>{message}</div>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className={secondaryButtonClass} onClick={onClose} disabled={pending}>
          Cancelar
        </button>
        <button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const ok = await onConfirm();
            setPending(false);
            if (ok) onClose();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Procesando..." : confirmText}
        </button>
      </div>
    </Modal>
  );
}
