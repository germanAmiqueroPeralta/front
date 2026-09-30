"use client";

import { ArrowLeft, ArrowRight, KeyRound, Link2, Pencil, Plus, Save, Search, Unlink, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useBackendAction, useBackendQuery } from "@/hooks/use-backend";
import { deleteGuardian, linkChild, loadPeople, saveGuardian, unlinkChild, updateLink } from "@/lib/actions/admin/people";
import { RELATIONSHIPS, childName, type Child, type Guardian, type User } from "@/lib/api/types";
import { buttonClass, inputClass, secondaryButtonClass } from "@/lib/dashboard/cred";
import { ageDays, formatAge } from "@/lib/sisnat/dates";
import { EmptyRow, FilterBar, PageTitle, PersonCell, StatusBadge, Table, Td, Tr } from "@/components/dashboard/shared";
import { RowActions } from "@/components/dashboard/row-actions";
import { TextField, submitWith } from "@/components/dashboard/forms";
import { LoadState, Pagination, SearchField, SelectField, matches, optional, required, usePage } from "@/components/dashboard/admin/common";
import { ChildFormModal } from "@/components/dashboard/admin/child-form-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

type People = NonNullable<ReturnType<typeof usePeople>["data"]>;

/** Padres, niños y sus vínculos: las dos pantallas comparten la misma carga. */
export function usePeople() {
  return useBackendQuery("people", loadPeople);
}

/** Cuentas con rol apoderado que todavía no están vinculadas a otro padre. */
function freeGuardianAccounts(people: People, current?: Guardian): User[] {
  const guardianRole = people.roles.find((r) => r.name === "guardian")?.id;
  const taken = new Set(people.guardians.filter((g) => g.id !== current?.id).map((g) => g.user_id));
  return people.users.filter((u) => u.role_id === guardianRole && !taken.has(u.id));
}

/* ───────────── Lista de padres ───────────── */

export function GuardiansView({ nav }: { nav: Nav }) {
  const { data, loading, error, reload } = usePeople();
  const run = useBackendAction();
  const [q, setQ] = useState("");
  const [withoutChildren, setWithoutChildren] = useState(false);
  const [form, setForm] = useState<{ guardian?: Guardian } | null>(null);
  const [remove, setRemove] = useState<Guardian | null>(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const children = new Map(data.children.map((c) => [c.id, c]));
    const users = new Map(data.users.map((u) => [u.id, u]));
    return data.guardians
      .map((g) => ({
        guardian: g,
        account: g.user_id ? users.get(g.user_id) : undefined,
        kids: data.links
          .filter((l) => l.guardian_id === g.id)
          .map((l) => children.get(l.child_id))
          .filter((c): c is Child => !!c),
      }))
      .filter(({ kids }) => !withoutChildren || !kids.length)
      .filter(({ guardian, kids }) =>
        matches(q, guardian.full_name, guardian.dni, guardian.phone, ...kids.map((k) => childName(k))),
      )
      .sort((a, b) => a.guardian.full_name.localeCompare(b.guardian.full_name));
  }, [data, q, withoutChildren]);
  const { items, pager } = usePage(rows, `${q}|${withoutChildren}`);

  return (
    <>
      <PageTitle
        kicker="Padres y niños"
        title="Padres y apoderados"
        subtitle="Registra al padre y, dentro de su ficha, a sus hijos."
        action={
          <button className={buttonClass} onClick={() => setForm({})} disabled={!data}>
            <Plus className="size-4" />
            Nuevo padre
          </button>
        }
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        <FilterBar>
          <SearchField value={q} onChange={setQ} placeholder="Nombre, DNI, celular o nombre del hijo" />
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={withoutChildren}
              onChange={(e) => setWithoutChildren(e.target.checked)}
              className="size-4 accent-(--primary)"
            />
            Solo sin hijos registrados
          </label>
          <p className="ml-auto self-center text-sm text-muted-foreground">{rows.length} padres</p>
        </FilterBar>
        <Table head={["Padre o apoderado", "DNI", "Contacto", "Hijos", "Portal", ""]} minWidth={900}>
          {rows.length ? (
            items.map(({ guardian: g, account, kids }) => (
              <Tr key={g.id}>
                <Td>
                  <button className="text-left hover:underline" onClick={() => nav.go({ name: "guardianDetail", guardianId: g.id })}>
                    <PersonCell name={g.full_name} detail="Ver ficha y registrar hijos" />
                  </button>
                </Td>
                <Td>{g.dni}</Td>
                <Td>
                  <span className="grid max-md:text-right">
                    <span>{g.phone || "—"}</span>
                    {g.email && <span className="text-xs text-muted-foreground">{g.email}</span>}
                  </span>
                </Td>
                <Td>
                  {kids.length ? (
                    <span className="flex flex-wrap gap-1.5 max-md:justify-end">
                      {kids.map((k) => (
                        <span key={k.id} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {k.first_names.split(" ")[0]} {k.last_names.split(" ")[0]}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <StatusBadge tone="warn">Sin hijos</StatusBadge>
                  )}
                </Td>
                <Td>
                  {g.user_id ? (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <KeyRound className="size-3.5 text-success" />
                      {/* El coordinador no lee la lista de usuarios: sabe que tiene cuenta, no su usuario. */}
                      {account ? <span className="font-mono">{account.username}</span> : "Con cuenta"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin cuenta</span>
                  )}
                </Td>
                <Td>
                  <RowActions label={g.full_name} onEdit={() => setForm({ guardian: g })} onDelete={() => setRemove(g)}>
                    <button
                      className={`${secondaryButtonClass} h-9`}
                      onClick={() => nav.go({ name: "guardianDetail", guardianId: g.id })}
                    >
                      Ficha
                      <ArrowRight className="size-4" />
                    </button>
                  </RowActions>
                </Td>
              </Tr>
            ))
          ) : (
            <EmptyRow colSpan={6}>
              {q || withoutChildren ? "No hay padres para esta búsqueda." : "Aún no hay padres. Registra el primero."}
            </EmptyRow>
          )}
        </Table>
        <Pagination pager={pager} label="padres" />
      </LoadState>

      {form && data && (
        <GuardianFormModal
          guardian={form.guardian}
          accounts={freeGuardianAccounts(data, form.guardian)}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            reload();
            if (!form.guardian) nav.go({ name: "guardianDetail", guardianId: saved.id });
          }}
        />
      )}
      {remove && (
        <ConfirmModal
          title="Dar de baja al padre"
          confirmText="Dar de baja"
          message={
            <>
              <b>{remove.full_name}</b> dejará de aparecer en la lista. Sus hijos <b>no</b> se borran y siguen en el
              padrón.
            </>
          }
          onConfirm={async () => {
            const ok = await run(deleteGuardian(remove.id));
            if (ok) reload();
            return ok !== null;
          }}
          onClose={() => setRemove(null)}
        />
      )}
    </>
  );
}

function GuardianFormModal({
  guardian,
  accounts,
  onClose,
  onSaved,
}: {
  guardian?: Guardian;
  accounts: User[];
  onClose: () => void;
  onSaved: (saved: Guardian) => void;
}) {
  const run = useBackendAction();
  const [pending, setPending] = useState(false);
  const hasAccount = !!guardian?.user_id;
  // Crear la cuenta del portal junto con el padre (el coordinador no ve la lista de usuarios, solo puede crearla).
  const [newAccount, setNewAccount] = useState(false);
  const canPickExisting = accounts.length > 0;

  async function submit(form: FormData) {
    setPending(true);
    const dni = required(form, "dni");
    const account = newAccount
      ? { account_username: required(form, "account_username") || dni, account_password: required(form, "account_password") }
      : canPickExisting
        ? { user_id: optional(form, "user_id") }
        : {};
    const saved = await run(
      saveGuardian(
        {
          full_name: required(form, "full_name"),
          dni,
          phone: optional(form, "phone"),
          email: optional(form, "email"),
          ...account,
        },
        guardian?.id,
      ),
      guardian ? "Datos del padre actualizados" : "Padre registrado. Ahora registra a sus hijos.",
    );
    setPending(false);
    if (saved) {
      onSaved(saved);
      onClose();
    }
  }

  return (
    <Modal
      title={guardian ? "Editar padre o apoderado" : "Nuevo padre o apoderado"}
      subtitle={guardian?.full_name ?? "Datos de contacto"}
      onClose={onClose}
    >
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <TextField label="Nombres y apellidos" name="full_name" required defaultValue={guardian?.full_name} placeholder="Ej. María Quispe Huamán" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="DNI" name="dni" required inputMode="numeric" maxLength={8} pattern="\d{8}" defaultValue={guardian?.dni} placeholder="8 dígitos" />
          <TextField label="Celular" name="phone" inputMode="tel" defaultValue={guardian?.phone} placeholder="9xx xxx xxx" />
          <TextField label="Correo" name="email" type="email" defaultValue={guardian?.email} placeholder="Opcional" />
        </div>
        <fieldset className="grid gap-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Cuenta del portal familiar</legend>
          {hasAccount && !canPickExisting ? (
            <p className="flex items-center gap-2 text-sm">
              <KeyRound className="size-4 text-success" />
              Ya tiene cuenta: entra al portal con su usuario y contraseña.
            </p>
          ) : (
            <>
              {!hasAccount && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newAccount}
                    onChange={(e) => setNewAccount(e.target.checked)}
                    className="size-4 accent-(--primary)"
                  />
                  Crear su cuenta para que vea a sus hijos desde el portal
                </label>
              )}
              {newAccount ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField label="Usuario" name="account_username" placeholder="Su DNI" hint="Si lo dejas vacío, su usuario será su DNI." />
                  <TextField
                    label="Contraseña"
                    name="account_password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    hint="Mínimo 6 caracteres. Entrégasela al padre."
                  />
                </div>
              ) : (
                canPickExisting && (
                  <SelectField
                    label="O vincular una cuenta existente"
                    name="user_id"
                    defaultValue={guardian?.user_id}
                    placeholder="Sin cuenta"
                    options={accounts.map((u) => ({ value: u.id, label: `${u.full_name} (@${u.username})` }))}
                  />
                )
              )}
            </>
          )}
        </fieldset>
        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : guardian ? "Guardar cambios" : "Registrar padre"}
        </button>
      </form>
    </Modal>
  );
}

/* ───────────── Ficha del padre (con sus hijos) ───────────── */

export function GuardianDetailView({ nav, guardianId }: { nav: Nav; guardianId: string }) {
  const { data, loading, error, reload } = usePeople();
  const run = useBackendAction();
  const [editing, setEditing] = useState(false);
  const [newChild, setNewChild] = useState(false);
  const [linking, setLinking] = useState(false);
  const [editChild, setEditChild] = useState<Child | null>(null);
  const [unlink, setUnlink] = useState<Child | null>(null);

  const guardian = data?.guardians.find((g) => g.id === guardianId);

  const kids = useMemo(() => {
    if (!data) return [];
    const children = new Map(data.children.map((c) => [c.id, c]));
    const guardians = new Map(data.guardians.map((g) => [g.id, g]));
    return data.links
      .filter((l) => l.guardian_id === guardianId && children.has(l.child_id))
      .map((l) => ({
        child: children.get(l.child_id)!,
        relationship: l.relationship,
        others: data.links
          .filter((o) => o.child_id === l.child_id && o.guardian_id !== guardianId && guardians.has(o.guardian_id))
          .map((o) => `${guardians.get(o.guardian_id)!.full_name.split(" ")[0]} (${o.relationship})`),
      }))
      .sort((a, b) => a.child.birth_date.localeCompare(b.child.birth_date));
  }, [data, guardianId]);
  const { items: kidsPage, pager } = usePage(kids);

  const facilityById = useMemo(() => new Map(data?.facilities.map((f) => [f.id, f]) ?? []), [data]);
  const noFacilities = data !== null && data.facilities.length === 0;
  const back = (
    <button className={secondaryButtonClass} onClick={() => nav.go({ name: "guardians" })}>
      <ArrowLeft className="size-4" />
      Volver a padres
    </button>
  );

  return (
    <LoadState loading={loading && !data} error={error} onRetry={reload}>
      {data && !guardian ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
          Este padre ya no existe o fue dado de baja.
          {back}
        </div>
      ) : (
        guardian &&
        data && (
          <>
            <PageTitle kicker="Ficha del padre" title={guardian.full_name} subtitle={`DNI ${guardian.dni}`} action={back} />

            <section className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-border bg-card p-5 text-sm">
              <span>
                <span className="block text-xs text-muted-foreground">Celular</span>
                {guardian.phone || "—"}
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">Correo</span>
                {guardian.email || "—"}
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">Portal familiar</span>
                {guardian.user_id ? (
                  <span className="inline-flex items-center gap-1.5">
                    <KeyRound className="size-3.5 text-success" />@
                    {data.users.find((u) => u.id === guardian.user_id)?.username ?? "cuenta"}
                  </span>
                ) : (
                  "Sin cuenta"
                )}
              </span>
              <button className={`${secondaryButtonClass} ml-auto`} onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
                Editar datos
              </button>
            </section>

            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="text-lg font-semibold">Hijos ({kids.length})</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button className={secondaryButtonClass} onClick={() => setLinking(true)}>
                  <Link2 className="size-4" />
                  Vincular hijo existente
                </button>
                <button className={buttonClass} onClick={() => setNewChild(true)} disabled={noFacilities}>
                  <UserPlus className="size-4" />
                  Registrar hijo
                </button>
              </div>
            </div>

            {noFacilities && (
              <div className="mb-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground sm:flex-row sm:text-left">
                Para registrar un hijo primero debe existir al menos un establecimiento de salud.
                <button className={`${secondaryButtonClass} sm:ml-auto`} onClick={() => nav.go({ name: "facilities" })}>
                  Ir a Establecimientos
                  <ArrowRight className="size-4" />
                </button>
              </div>
            )}

            <Table head={["Niño", "Edad", "Establecimiento", "Parentesco", "Otros apoderados", ""]} minWidth={900}>
              {kids.length ? (
                kidsPage.map(({ child, relationship, others }) => (
                  <Tr key={child.id}>
                    <Td>
                      <PersonCell name={childName(child)} detail={`Padrón ${child.padron_code}`} />
                    </Td>
                    <Td>{formatAge(ageDays(child.birth_date))}</Td>
                    <Td>{facilityById.get(child.health_facility_id)?.name ?? "—"}</Td>
                    <Td>
                      <select
                        key={`${child.id}-${relationship}`}
                        aria-label={`Parentesco con ${childName(child)}`}
                        className={`${inputClass} h-9 w-36`}
                        defaultValue={relationship}
                        onChange={async (e) => {
                          const value = e.target.value;
                          const ok = await run(updateLink(guardian.id, child.id, value), "Parentesco actualizado");
                          if (ok) reload();
                        }}
                      >
                        {[...new Set([relationship, ...RELATIONSHIPS])].map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      <span className="text-xs text-muted-foreground">{others.join(", ") || "—"}</span>
                    </Td>
                    <Td>
                      <RowActions label={childName(child)} onEdit={() => setEditChild(child)}>
                        <button
                          className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-destructive transition hover:bg-destructive/10"
                          onClick={() => setUnlink(child)}
                          aria-label={`Desvincular a ${childName(child)}`}
                          title="Desvincular"
                        >
                          <Unlink className="size-4" />
                        </button>
                      </RowActions>
                    </Td>
                  </Tr>
                ))
              ) : (
                <EmptyRow colSpan={6}>
                  Este padre aún no tiene hijos registrados. Usa <b>Registrar hijo</b>, o <b>Vincular hijo existente</b> si
                  el otro padre ya lo registró.
                </EmptyRow>
              )}
            </Table>
            <Pagination pager={pager} label="hijos" />

            {editing && (
              <GuardianFormModal
                guardian={guardian}
                accounts={freeGuardianAccounts(data, guardian)}
                onClose={() => setEditing(false)}
                onSaved={reload}
              />
            )}
            {newChild && (
              <ChildFormModal
                guardian={guardian}
                facilities={data.facilities}
                regions={data.regions}
                onClose={() => setNewChild(false)}
                onSaved={reload}
              />
            )}
            {editChild && (
              <ChildFormModal
                child={editChild}
                facilities={data.facilities}
                regions={data.regions}
                onClose={() => setEditChild(null)}
                onSaved={reload}
              />
            )}
            {linking && (
              <LinkChildModal
                guardian={guardian}
                candidates={data.children.filter((c) => !kids.some((k) => k.child.id === c.id))}
                onClose={() => setLinking(false)}
                onSaved={reload}
              />
            )}
            {unlink && (
              <ConfirmModal
                title="Desvincular hijo"
                confirmText="Desvincular"
                message={
                  <>
                    <b>{childName(unlink)}</b> dejará de estar a cargo de <b>{guardian.full_name}</b>. El niño{" "}
                    <b>no se borra</b>: sigue en el padrón y con sus otros apoderados.
                  </>
                }
                onConfirm={async () => {
                  const ok = await run(unlinkChild(guardian.id, unlink.id), "Hijo desvinculado");
                  if (ok) reload();
                  return ok !== null;
                }}
                onClose={() => setUnlink(null)}
              />
            )}
          </>
        )
      )}
    </LoadState>
  );
}

/** Para el segundo padre: busca al niño que ya registró el otro y solo lo vincula. */
function LinkChildModal({
  guardian,
  candidates,
  onClose,
  onSaved,
}: {
  guardian: Guardian;
  candidates: Child[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const run = useBackendAction();
  const [q, setQ] = useState("");
  const [childId, setChildId] = useState<string | null>(null);
  const [relationship, setRelationship] = useState("Padre");
  const [pending, setPending] = useState(false);
  const visible = candidates.filter((c) => matches(q, childName(c), c.dni, c.padron_code, c.mother_name)).slice(0, 50);

  async function submit() {
    if (!childId) return;
    setPending(true);
    const ok = await run(linkChild(guardian.id, childId, relationship), "Hijo vinculado correctamente");
    setPending(false);
    if (ok) {
      onSaved();
      onClose();
    }
  }

  return (
    <Modal title="Vincular hijo existente" subtitle={`Niño ya registrado que también está a cargo de ${guardian.full_name}`} onClose={onClose}>
      <form onSubmit={submitWith(submit)} className="grid gap-4">
        <span className="relative">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, DNI, padrón o nombre de la madre"
            aria-label="Buscar niño"
            className={`${inputClass} pl-9`}
          />
        </span>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border [scrollbar-width:thin]">
          {visible.length ? (
            visible.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-3 py-2 text-sm last:border-0 hover:bg-muted/40">
                <input
                  type="radio"
                  name="child"
                  checked={childId === c.id}
                  onChange={() => setChildId(c.id)}
                  className="size-4 accent-(--primary)"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{childName(c)}</span>
                  <span className="block text-xs text-muted-foreground">
                    Padrón {c.padron_code} · {formatAge(ageDays(c.birth_date))}
                    {c.mother_name ? ` · Madre: ${c.mother_name}` : ""}
                  </span>
                </span>
              </label>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {q ? "Ningún niño coincide con la búsqueda." : "No hay otros niños registrados."}
            </p>
          )}
        </div>
        <SelectField
          label="Parentesco"
          name="relationship"
          required
          defaultValue={relationship}
          onChange={setRelationship}
          options={RELATIONSHIPS.map((r) => ({ value: r, label: r }))}
        />
        <button className={buttonClass} type="submit" disabled={pending || !childId}>
          <Link2 className="size-4" />
          {pending ? "Vinculando..." : "Vincular"}
        </button>
      </form>
    </Modal>
  );
}
