"use client";

import { Lock, Plus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { useBackendAction, useBackendQuery } from "@/hooks/use-backend";
import { deleteUser, loadUsersPage, saveUser } from "@/lib/actions/admin/security";
import type { Region, Role, User, UserInput } from "@/lib/api/types";
import { buttonClass, inputClass, sessionRoleLabels } from "@/lib/dashboard/cred";
import { EmptyRow, FilterBar, PageTitle, PersonCell, StatusBadge, Table, Td, Tr } from "@/components/dashboard/shared";
import { RowActions } from "@/components/dashboard/row-actions";
import { TextField, labelClass, submitWith } from "@/components/dashboard/forms";
import { LoadState, Pagination, SearchField, SelectField, matches, optional, required, usePage } from "@/components/dashboard/admin/common";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";

export function UsersView() {
  const { session } = useSisnat();
  const { data, loading, error, reload } = useBackendQuery("users", loadUsersPage);
  const run = useBackendAction();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [form, setForm] = useState<{ user?: User } | null>(null);
  const [remove, setRemove] = useState<User | null>(null);

  const roleById = useMemo(() => new Map(data?.roles.map((r) => [r.id, r]) ?? []), [data]);
  const regionById = useMemo(() => new Map(data?.regions.map((r) => [r.id, r]) ?? []), [data]);

  const rows = (data?.users ?? []).filter(
    (u) => (!roleFilter || u.role_id === roleFilter) && matches(q, u.full_name, u.username, u.dni, u.email),
  );
  const { items, pager } = usePage(rows, `${q}|${roleFilter}`);

  return (
    <>
      <PageTitle
        kicker="Usuarios"
        title="Usuarios"
        subtitle="Cuentas que pueden ingresar al sistema. Al personal de salud asígnale sus micro redes."
        action={
          <button className={buttonClass} onClick={() => setForm({})} disabled={!data}>
            <Plus className="size-4" />
            Nuevo usuario
          </button>
        }
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        <FilterBar>
          <SearchField value={q} onChange={setQ} placeholder="Nombre, usuario, DNI o correo" />
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Rol
            <select className={inputClass} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">Todos</option>
              {data?.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {sessionRoleLabels[r.name]}
                </option>
              ))}
            </select>
          </label>
          <p className="ml-auto self-center text-sm text-muted-foreground">{rows.length} usuarios</p>
        </FilterBar>
        <Table head={["Usuario", "Rol", "DNI", "Contacto", "Micro redes", "Estado", ""]} minWidth={960}>
          {rows.length ? (
            items.map((u) => {
              const role = roleById.get(u.role_id);
              return (
                <Tr key={u.id}>
                  <Td>
                    <PersonCell name={u.full_name} detail={`@${u.username}`} />
                  </Td>
                  <Td>{role ? sessionRoleLabels[role.name] : "—"}</Td>
                  <Td>{u.dni ?? "—"}</Td>
                  <Td>
                    <span className="grid max-md:text-right">
                      <span>{u.phone || "—"}</span>
                      {u.email && <span className="text-xs text-muted-foreground">{u.email}</span>}
                    </span>
                  </Td>
                  <Td>
                    {u.region_ids.length ? (
                      <span className="flex flex-wrap gap-1.5 max-md:justify-end">
                        {u.region_ids.map((id) => (
                          <span key={id} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            {regionById.get(id)?.name ?? "Micro red inactiva"}
                          </span>
                        ))}
                      </span>
                    ) : role?.name === "health_staff" ? (
                      <StatusBadge tone="warn">Sin asignar</StatusBadge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No aplica</span>
                    )}
                  </Td>
                  <Td>
                    {u.blocked ? (
                      <span title={u.blocked_reason ?? undefined}>
                        <StatusBadge tone="danger">Bloqueado</StatusBadge>
                      </span>
                    ) : (
                      <StatusBadge tone="good">Activo</StatusBadge>
                    )}
                  </Td>
                  <Td>
                    <RowActions
                      label={u.full_name}
                      onEdit={() => setForm({ user: u })}
                      onDelete={u.id !== session.id ? () => setRemove(u) : undefined}
                    />
                  </Td>
                </Tr>
              );
            })
          ) : (
            <EmptyRow colSpan={7}>No hay usuarios para esta búsqueda.</EmptyRow>
          )}
        </Table>
        <Pagination pager={pager} label="usuarios" />
      </LoadState>

      {form && data && (
        <UserFormModal
          user={form.user}
          roles={data.roles}
          regions={data.regions}
          onClose={() => setForm(null)}
          onSaved={reload}
        />
      )}
      {remove && (
        <ConfirmModal
          title="Desactivar usuario"
          confirmText="Desactivar"
          message={
            <>
              <b>{remove.full_name}</b> ya no podrá ingresar al sistema. Sus registros e historial se conservan.
            </>
          }
          onConfirm={async () => {
            const ok = await run(deleteUser(remove.id));
            if (ok) reload();
            return ok !== null;
          }}
          onClose={() => setRemove(null)}
        />
      )}
    </>
  );
}

function UserFormModal({
  user,
  roles,
  regions,
  onClose,
  onSaved,
}: {
  user?: User;
  roles: Role[];
  regions: Region[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const run = useBackendAction();
  const [pending, setPending] = useState(false);
  const [roleId, setRoleId] = useState(user?.role_id ?? "");
  const [regionIds, setRegionIds] = useState<string[]>(user?.region_ids ?? []);
  const [blocked, setBlocked] = useState(user?.blocked ?? false);
  const isStaff = roles.find((r) => r.id === roleId)?.name === "health_staff";

  async function submit(form: FormData) {
    const password = required(form, "password");
    const input: UserInput = {
      username: required(form, "username"),
      role_id: roleId,
      full_name: required(form, "full_name"),
      dni: optional(form, "dni"),
      phone: optional(form, "phone"),
      email: optional(form, "email"),
      region_ids: isStaff ? regionIds : [],
      ...(password ? { password } : {}),
      ...(user ? { blocked, blocked_reason: blocked ? optional(form, "blocked_reason") : null } : {}),
    };
    setPending(true);
    const saved = await run(saveUser(input, user?.id), user ? "Usuario actualizado" : "Usuario creado");
    setPending(false);
    if (saved) {
      onSaved();
      onClose();
    }
  }

  return (
    <Modal
      title={user ? "Editar usuario" : "Nuevo usuario"}
      subtitle={user ? `@${user.username}` : "Cuenta para ingresar al sistema"}
      onClose={onClose}
    >
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <TextField label="Nombres y apellidos" name="full_name" required defaultValue={user?.full_name} placeholder="Ej. Rosa Quispe Llamocca" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Usuario" name="username" required defaultValue={user?.username} autoComplete="off" placeholder="Ej. rquispe" />
          <TextField
            label="Contraseña"
            name="password"
            type="password"
            required={!user}
            minLength={8}
            autoComplete="new-password"
            placeholder={user ? "Dejar vacío para no cambiarla" : "Mínimo 8 caracteres"}
          />
        </div>
        <SelectField
          label="Rol"
          name="role_id"
          required
          defaultValue={roleId}
          placeholder="Seleccionar rol"
          onChange={setRoleId}
          options={roles.map((r) => ({ value: r.id, label: sessionRoleLabels[r.name] }))}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="DNI" name="dni" inputMode="numeric" maxLength={8} pattern="\d{8}" defaultValue={user?.dni} placeholder="8 dígitos" />
          <TextField label="Celular" name="phone" inputMode="tel" defaultValue={user?.phone} placeholder="9xx xxx xxx" />
          <TextField label="Correo" name="email" type="email" defaultValue={user?.email} placeholder="Opcional" />
        </div>

        {isStaff && (
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">
              Micro redes a cargo <span className="font-normal text-muted-foreground">({regionIds.length} seleccionadas)</span>
            </legend>
            {regions.length ? (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border [scrollbar-width:thin]">
                {regions.map((r) => (
                  <label key={r.id} className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-3 py-2 text-sm last:border-0 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={regionIds.includes(r.id)}
                      onChange={(e) =>
                        setRegionIds((ids) => (e.target.checked ? [...ids, r.id] : ids.filter((x) => x !== r.id)))
                      }
                      className="size-4 accent-(--primary)"
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                Aún no hay micro redes. Créalas en <b>Territorio → Micro redes</b> y luego edita este usuario para asignárselas.
              </p>
            )}
          </fieldset>
        )}

        {user && (
          <div className="grid gap-3 rounded-lg border border-border p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={blocked} onChange={(e) => setBlocked(e.target.checked)} className="size-4 accent-(--primary)" />
              <Lock className="size-4 text-destructive" />
              Bloquear acceso
            </label>
            {blocked && (
              <label className={labelClass}>
                Motivo del bloqueo
                <input name="blocked_reason" defaultValue={user.blocked_reason ?? ""} className={inputClass} placeholder="Ej. Dejó de laborar en la red" />
              </label>
            )}
          </div>
        )}

        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : user ? "Guardar cambios" : "Crear usuario"}
        </button>
      </form>
    </Modal>
  );
}
