"use client";

import { AlertTriangle, KeyRound, Save, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useBackendAction, useBackendQuery } from "@/hooks/use-backend";
import { loadRolesPage, updateRolePermissions } from "@/lib/actions/admin/security";
import type { Permission, Role } from "@/lib/api/types";
import { buttonClass, inputClass, secondaryButtonClass, sessionRoleLabels } from "@/lib/dashboard/cred";
import { PageTitle, StatusBadge, groupBy } from "@/components/dashboard/shared";
import { LoadState } from "@/components/dashboard/admin/common";
import { moduleLabel, moduleOf, roleDescriptions } from "@/components/dashboard/admin/labels";
import { Modal } from "@/components/ui/modal";

export function RolesView() {
  const { data, loading, error, reload } = useBackendQuery("roles", loadRolesPage);
  const [editing, setEditing] = useState<Role | null>(null);

  return (
    <>
      <PageTitle
        kicker="Usuarios"
        title="Roles"
        subtitle="Los tres perfiles del sistema. Aquí decides qué puede hacer cada uno."
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        {data && (
          <div className="grid gap-4 md:grid-cols-3">
            {data.roles.map((role) => (
              <section key={role.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{sessionRoleLabels[role.name]}</h2>
                    <p className="font-mono text-xs text-muted-foreground">{role.name}</p>
                  </div>
                  <StatusBadge tone={role.permission_ids.length ? "good" : "muted"}>
                    {role.permission_ids.length} de {data.permissions.length} permisos
                  </StatusBadge>
                </div>
                <p className="mt-3 flex-1 text-sm text-muted-foreground">{roleDescriptions[role.name]}</p>
                <button className={`${secondaryButtonClass} mt-5`} onClick={() => setEditing(role)}>
                  <KeyRound className="size-4" />
                  Editar permisos
                </button>
              </section>
            ))}
          </div>
        )}
      </LoadState>
      {editing && data && (
        <RolePermissionsModal
          role={editing}
          permissions={data.permissions}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}

function RolePermissionsModal({
  role,
  permissions,
  onClose,
  onSaved,
}: {
  role: Role;
  permissions: Permission[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const run = useBackendAction();
  const [selected, setSelected] = useState(() => new Set(role.permission_ids));
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(false);

  const groups = useMemo(() => {
    const visible = permissions.filter((p) =>
      `${p.code} ${p.description ?? ""} ${moduleLabel(p.code)}`.toLowerCase().includes(q.trim().toLowerCase()),
    );
    return groupBy(
      [...visible].sort((a, b) => a.code.localeCompare(b.code)),
      (p) => moduleOf(p.code),
    );
  }, [permissions, q]);

  const toggle = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const removesAdminAccess = role.name === "admin" && selected.size < permissions.length;

  async function save() {
    setPending(true);
    const ok = await run(updateRolePermissions(role.id, [...selected]), "Permisos del rol actualizados");
    setPending(false);
    if (ok) {
      onSaved();
      onClose();
    }
  }

  return (
    <Modal
      title={`Permisos de ${sessionRoleLabels[role.name]}`}
      subtitle={`${selected.size} de ${permissions.length} permisos marcados`}
      onClose={onClose}
    >
      <div className="grid gap-4">
        <div className="flex gap-2">
          <span className="relative flex-1">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar permiso o módulo"
              aria-label="Buscar permiso"
              className={`${inputClass} pl-9`}
            />
          </span>
          <button className={secondaryButtonClass} onClick={() => toggle(permissions.map((p) => p.id), true)}>
            Todos
          </button>
          <button className={secondaryButtonClass} onClick={() => setSelected(new Set())}>
            Ninguno
          </button>
        </div>
        {removesAdminAccess && (
          <p className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            Si le quitas permisos al administrador, podrías perder acceso a esas pantallas. Se recupera ejecutando
            el seed del backend.
          </p>
        )}
        <div className="grid max-h-[50vh] gap-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {groups.map(([mod, perms]) => {
            const ids = perms.map((p) => p.id);
            const all = ids.every((id) => selected.has(id));
            return (
              <fieldset key={mod} className="rounded-lg border border-border">
                <legend className="sr-only">{moduleLabel(perms[0].code)}</legend>
                <label className="flex cursor-pointer items-center gap-3 border-b border-border/60 bg-muted/40 px-3 py-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={all}
                    onChange={(e) => toggle(ids, e.target.checked)}
                    className="size-4 accent-(--primary)"
                  />
                  {moduleLabel(perms[0].code)}
                </label>
                {perms.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={(e) => toggle([p.id], e.target.checked)}
                      className="size-4 accent-(--primary)"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block">{p.description ?? p.code}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{p.code}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            );
          })}
          {!groups.length && <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados.</p>}
        </div>
        <button className={buttonClass} onClick={save} disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : "Guardar permisos"}
        </button>
      </div>
    </Modal>
  );
}
