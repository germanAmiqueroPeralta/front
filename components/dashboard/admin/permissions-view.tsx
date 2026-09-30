"use client";

import { Info, Plus, Save } from "lucide-react";
import { useState } from "react";
import { useBackendAction, useBackendQuery } from "@/hooks/use-backend";
import { deletePermission, loadPermissions, savePermission } from "@/lib/actions/admin/security";
import type { Permission } from "@/lib/api/types";
import { buttonClass } from "@/lib/dashboard/cred";
import { EmptyRow, FilterBar, GroupRow, PageTitle, Table, Td, Tr, groupBy } from "@/components/dashboard/shared";
import { RowActions } from "@/components/dashboard/row-actions";
import { TextField, submitWith } from "@/components/dashboard/forms";
import { LoadState, Pagination, SearchField, matches, optional, required, usePage } from "@/components/dashboard/admin/common";
import { moduleLabel, moduleOf } from "@/components/dashboard/admin/labels";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";

export function PermissionsView() {
  const { data, loading, error, reload } = useBackendQuery("permissions", loadPermissions);
  const run = useBackendAction();
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ permission?: Permission } | null>(null);
  const [remove, setRemove] = useState<Permission | null>(null);

  const rows = (data ?? [])
    .filter((p) => matches(q, p.code, p.description, moduleLabel(p.code)))
    .sort((a, b) => a.code.localeCompare(b.code));
  const { items, pager } = usePage(rows, q);

  return (
    <>
      <PageTitle
        kicker="Usuarios"
        title="Permisos"
        subtitle="Acciones que se pueden permitir a cada rol. Se asignan desde Roles."
        action={
          <button className={buttonClass} onClick={() => setForm({})}>
            <Plus className="size-4" />
            Nuevo permiso
          </button>
        }
      />
      <p className="mb-5 flex gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        Los permisos del sistema los crea el backend y cada pantalla revisa su código. Normalmente no hace falta
        crear ni borrar ninguno: solo asignarlos a los roles.
      </p>
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        <FilterBar>
          <SearchField value={q} onChange={setQ} placeholder="Código, descripción o módulo" />
          <p className="ml-auto self-center text-sm text-muted-foreground">{rows.length} permisos</p>
        </FilterBar>
        <Table head={["Código", "Descripción", ""]} minWidth={640}>
          {rows.length ? (
            groupBy(items, (p) => moduleOf(p.code)).map(([mod, perms]) => [
              <GroupRow key={`g-${mod}`} colSpan={3}>
                {moduleLabel(perms[0].code)}
              </GroupRow>,
              ...perms.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <span className="font-mono text-sm">{p.code}</span>
                  </Td>
                  <Td>{p.description ?? "—"}</Td>
                  <Td>
                    <RowActions label={p.code} onEdit={() => setForm({ permission: p })} onDelete={() => setRemove(p)} />
                  </Td>
                </Tr>
              )),
            ])
          ) : (
            <EmptyRow colSpan={3}>No hay permisos para esta búsqueda.</EmptyRow>
          )}
        </Table>
        <Pagination pager={pager} label="permisos" />
      </LoadState>

      {form && <PermissionFormModal permission={form.permission} onClose={() => setForm(null)} onSaved={reload} />}
      {remove && (
        <ConfirmModal
          title="Eliminar permiso"
          message={
            <>
              Se eliminará <b className="font-mono">{remove.code}</b> y todos los roles lo perderán. Si el sistema lo usa,
              esa pantalla quedará bloqueada hasta volver a ejecutar el seed del backend.
            </>
          }
          onConfirm={async () => {
            const ok = await run(deletePermission(remove.id));
            if (ok) reload();
            return ok !== null;
          }}
          onClose={() => setRemove(null)}
        />
      )}
    </>
  );
}

function PermissionFormModal({
  permission,
  onClose,
  onSaved,
}: {
  permission?: Permission;
  onClose: () => void;
  onSaved: () => void;
}) {
  const run = useBackendAction();
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    const saved = await run(
      savePermission({ code: required(form, "code"), description: optional(form, "description") }, permission?.id),
      permission ? "Permiso actualizado" : "Permiso creado",
    );
    setPending(false);
    if (saved) {
      onSaved();
      onClose();
    }
  }

  return (
    <Modal title={permission ? "Editar permiso" : "Nuevo permiso"} subtitle={permission?.code} onClose={onClose}>
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <TextField
          label="Código"
          name="code"
          required
          defaultValue={permission?.code}
          placeholder="modulo.accion"
          pattern="[a-z_]+\.[a-z_]+(:[a-z_]+)?"
          hint="Minúsculas: módulo.acción, por ejemplo claim.get o claim.get:own"
        />
        <TextField label="Descripción" name="description" defaultValue={permission?.description} placeholder="Ej. Ver sus propios reclamos" />
        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : permission ? "Guardar cambios" : "Crear permiso"}
        </button>
      </form>
    </Modal>
  );
}
