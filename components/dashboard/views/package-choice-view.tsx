"use client";

import { ClipboardCheck, Pencil, Settings2, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { secondaryButtonClass } from "@/lib/dashboard/cred";
import { formatAge } from "@/lib/sisnat/dates";
import { moduloDe, prestacionesDe } from "@/lib/sisnat/logic";
import { PageTitle, StatusBadge } from "@/components/dashboard/shared";
import { PackageFormModal } from "@/components/dashboard/modals/catalog-modals";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

export function PackageChoiceView({ nav, code }: { nav: Nav; code: string }) {
  const { db, session, eliminarPaquete } = useSisnat();
  const [editar, setEditar] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const modulo = moduloDe(db, code);
  if (!modulo) return <p className="text-muted-foreground">Paquete no encontrado.</p>;

  const admin = session.role === "admin";
  const atenciones = prestacionesDe(db, code).length;
  const options = [
    {
      icon: Users,
      title: "Ver niños",
      text: "Niños que pertenecen a este paquete por su edad, con su avance.",
      onClick: () => nav.go({ name: "moduleChildren", code }),
    },
    {
      icon: ClipboardCheck,
      title: "Ver atenciones",
      text: "Atenciones del paquete agrupadas según los encabezados de cada Excel.",
      onClick: () => nav.go({ name: "modulePrestations", code }),
    },
    ...(admin
      ? [
          {
            icon: Settings2,
            title: "Configurar atenciones",
            text: `Agregar, editar o quitar las ${atenciones} atenciones que incluye el paquete.`,
            onClick: () => nav.go({ name: "packageConfig", code }),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageTitle
        kicker={code}
        title={modulo.nombre}
        subtitle={`${modulo.descripcion || "Sin descripción"} · De ${formatAge(modulo.edadMinDias)} a ${formatAge(modulo.edadMaxDias)}`}
        action={
          admin && (
            <div className="flex gap-2 max-md:w-full [&>button]:max-md:flex-1">
              <button className={secondaryButtonClass} onClick={() => setEditar(true)}>
                <Pencil className="size-4" />
                Editar
              </button>
              <button className={`${secondaryButtonClass} text-destructive hover:bg-destructive/10`} onClick={() => setBorrar(true)}>
                <Trash2 className="size-4" />
                Eliminar
              </button>
            </div>
          )
        }
      />
      {!modulo.activo && (
        <div className="mb-5">
          <StatusBadge tone="muted">Paquete desactivado: no aparece en el seguimiento</StatusBadge>
        </div>
      )}
      <div className={`grid gap-4 md:grid-cols-2 ${admin ? "xl:grid-cols-3" : ""}`}>
        {options.map(({ icon: Icon, title, text, onClick }) => (
          <button
            key={title}
            onClick={onClick}
            className="flex items-start gap-4 rounded-xl border border-border bg-card p-6 text-left transition hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="rounded-xl bg-primary/10 p-3 text-primary">
              <Icon className="size-6" />
            </span>
            <span>
              <strong className="block text-lg">{title}</strong>
              <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
            </span>
          </button>
        ))}
      </div>

      {editar && <PackageFormModal paquete={modulo} onClose={() => setEditar(false)} />}
      {borrar && (
        <ConfirmModal
          title={`Eliminar ${modulo.codigo}`}
          message={
            <>
              Se eliminará el paquete <b>{modulo.nombre}</b> con sus {atenciones} atenciones. Si ya tiene atenciones
              registradas a niños, <b>solo se desactivará</b> para conservar el historial (podrás reactivarlo).
            </>
          }
          onConfirm={async () => {
            const ok = await eliminarPaquete(code);
            if (ok) nav.go({ name: "packages" });
            return ok;
          }}
          onClose={() => setBorrar(false)}
        />
      )}
    </>
  );
}
