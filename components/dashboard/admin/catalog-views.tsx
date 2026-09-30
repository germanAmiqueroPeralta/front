"use client";

import { ArrowLeft, ArrowRight, Pencil, Plus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useBackendAction, useBackendQuery } from "@/hooks/use-backend";
import {
  deleteCarePackage,
  deleteCareService,
  loadCatalog,
  saveCarePackage,
  saveCareService,
} from "@/lib/actions/admin/catalog";
import type { CarePackage, CareService } from "@/lib/api/types";
import { buttonClass, inputClass, secondaryButtonClass } from "@/lib/dashboard/cred";
import { formatAge } from "@/lib/sisnat/dates";
import { EmptyRow, FilterBar, GroupRow, PageTitle, StatusBadge, Table, Td, Tr, groupBy } from "@/components/dashboard/shared";
import { RowActions } from "@/components/dashboard/row-actions";
import { AgeField, TextField, labelClass, submitWith, textareaClass } from "@/components/dashboard/forms";
import { LoadState, Pagination, SearchField, SelectField, matches, optional, required, usePage } from "@/components/dashboard/admin/common";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

const DEFAULT_GROUP = "DIRECT";

export const ageRange = (min: number, max: number) => `${formatAge(min)} – ${formatAge(max)}`;

const codeHint = "Solo mayúsculas, números y guion bajo (ej. CRED_RN).";
const toCode = (form: FormData, name: string) => required(form, name).toUpperCase().replace(/[\s-]+/g, "_");
const toInt = (form: FormData, name: string, fallback: number) => {
  const raw = required(form, name);
  return raw === "" ? fallback : Math.trunc(Number(raw));
};

function useCatalog() {
  return useBackendQuery("catalog", loadCatalog);
}

/* ───────────── Paquetes ───────────── */

export function CarePackagesView({ nav }: { nav: Nav }) {
  const { data, loading, error, reload } = useCatalog();
  const run = useBackendAction();
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ pkg?: CarePackage } | null>(null);
  const [remove, setRemove] = useState<CarePackage | null>(null);

  const servicesPer = useMemo(() => {
    const count = new Map<string, number>();
    data?.services.forEach((s) => count.set(s.package_id, (count.get(s.package_id) ?? 0) + 1));
    return count;
  }, [data]);
  const rows = (data?.packages ?? []).filter((p) => matches(q, p.code, p.name, p.description));
  const { items, pager } = usePage(rows, q);

  return (
    <>
      <PageTitle
        kicker="Catálogo SISNAT"
        title="Paquetes de atención"
        subtitle="Cada paquete cubre un rango de edad y agrupa las prestaciones que el niño debe recibir."
        action={
          <button className={buttonClass} onClick={() => setForm({})} disabled={!data}>
            <Plus className="size-4" />
            Nuevo paquete
          </button>
        }
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        <FilterBar>
          <SearchField value={q} onChange={setQ} placeholder="Código o nombre del paquete" />
          <p className="ml-auto self-center text-sm text-muted-foreground">{rows.length} paquetes</p>
        </FilterBar>
        <Table head={["Paquete", "Edad", "Aplica a", "Prestaciones", ""]} minWidth={860}>
          {rows.length ? (
            items.map((p) => {
              const count = servicesPer.get(p.id) ?? 0;
              return (
                <Tr key={p.id}>
                  <Td>
                    <button className="text-left hover:underline" onClick={() => nav.go({ name: "carePackage", packageId: p.id })}>
                      <p className="font-semibold">{p.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                    </button>
                  </Td>
                  <Td>{ageRange(p.min_age_days, p.max_age_days)}</Td>
                  <Td>
                    {p.at_risk_newborn_only ? (
                      <StatusBadge tone="warn">Solo RN en riesgo</StatusBadge>
                    ) : (
                      <StatusBadge tone="muted">Todos los niños</StatusBadge>
                    )}
                  </Td>
                  <Td>
                    {count ? (
                      `${count} prestación${count === 1 ? "" : "es"}`
                    ) : (
                      <StatusBadge tone="warn">Sin prestaciones</StatusBadge>
                    )}
                  </Td>
                  <Td>
                    <RowActions label={p.name} onEdit={() => setForm({ pkg: p })} onDelete={() => setRemove(p)}>
                      <button
                        className={`${secondaryButtonClass} h-9`}
                        onClick={() => nav.go({ name: "carePackage", packageId: p.id })}
                      >
                        Prestaciones
                        <ArrowRight className="size-4" />
                      </button>
                    </RowActions>
                  </Td>
                </Tr>
              );
            })
          ) : (
            <EmptyRow colSpan={5}>
              {q ? "No hay paquetes para esta búsqueda." : "Aún no hay paquetes. Crea el primero."}
            </EmptyRow>
          )}
        </Table>
        <Pagination pager={pager} label="paquetes" />
      </LoadState>

      {form && (
        <PackageFormModal
          pkg={form.pkg}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            reload();
            if (!form.pkg) nav.go({ name: "carePackage", packageId: saved.id });
          }}
        />
      )}
      {remove && (
        <ConfirmModal
          title="Eliminar paquete"
          message={
            <>
              ¿Eliminar <b>{remove.name}</b>? Si ya tiene prestaciones, solo se desactivará para no perder los controles
              registrados.
            </>
          }
          onConfirm={async () => {
            const ok = await run(deleteCarePackage(remove.id));
            if (ok) reload();
            return ok !== null;
          }}
          onClose={() => setRemove(null)}
        />
      )}
    </>
  );
}

function PackageFormModal({
  pkg,
  onClose,
  onSaved,
}: {
  pkg?: CarePackage;
  onClose: () => void;
  onSaved: (saved: CarePackage) => void;
}) {
  const run = useBackendAction();
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    const saved = await run(
      saveCarePackage(
        {
          code: toCode(form, "code"),
          name: required(form, "name"),
          description: optional(form, "description"),
          min_age_days: toInt(form, "min_age_days", 0),
          max_age_days: toInt(form, "max_age_days", 0),
          at_risk_newborn_only: form.get("at_risk_newborn_only") === "on",
          sort_order: toInt(form, "sort_order", 1),
        },
        pkg?.id,
      ),
      pkg ? "Paquete actualizado" : "Paquete creado. Ahora agrega sus prestaciones.",
    );
    setPending(false);
    if (saved) {
      onSaved(saved);
      onClose();
    }
  }

  return (
    <Modal title={pkg ? "Editar paquete" : "Nuevo paquete"} subtitle={pkg?.name} onClose={onClose}>
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="Código" name="code" required defaultValue={pkg?.code} placeholder="CRED_RN" hint={codeHint} />
          <div className="sm:col-span-2">
            <TextField label="Nombre" name="name" required defaultValue={pkg?.name} placeholder="Ej. Recién nacido" />
          </div>
        </div>
        <label className={labelClass}>
          Descripción
          <textarea name="description" rows={2} defaultValue={pkg?.description ?? ""} placeholder="Qué incluye el paquete" className={textareaClass} />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AgeField label="Edad mínima" name="min_age_days" defaultDays={pkg?.min_age_days ?? 0} />
          <AgeField label="Edad máxima" name="max_age_days" defaultDays={pkg?.max_age_days ?? 28} />
        </div>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
          <TextField label="Orden" name="sort_order" type="number" min={1} defaultValue={pkg?.sort_order ?? 1} hint="Posición en la lista de paquetes." />
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="at_risk_newborn_only"
              defaultChecked={pkg?.at_risk_newborn_only}
              className="size-4 accent-(--primary)"
            />
            Solo recién nacidos en riesgo
          </label>
        </div>
        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : pkg ? "Guardar cambios" : "Crear paquete"}
        </button>
      </form>
    </Modal>
  );
}

/* ───────────── Ficha del paquete (con sus prestaciones) ───────────── */

export function CarePackageDetailView({ nav, packageId }: { nav: Nav; packageId: string }) {
  const { data, loading, error, reload } = useCatalog();
  const run = useBackendAction();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ service?: CareService } | null>(null);
  const [remove, setRemove] = useState<CareService | null>(null);

  const pkg = data?.packages.find((p) => p.id === packageId);
  const services = useMemo(
    () =>
      (data?.services ?? [])
        .filter((s) => s.package_id === packageId)
        .sort((a, b) => a.group_order - b.group_order || a.sort_order - b.sort_order),
    [data, packageId],
  );
  const { items: pageServices, pager } = usePage(services);
  const groups = groupBy(pageServices, (s) => s.group_name);
  const groupNames = [...new Set(services.map((s) => s.group_name))];
  const total = services.length;
  const back = (
    <button className={secondaryButtonClass} onClick={() => nav.go({ name: "packages" })}>
      <ArrowLeft className="size-4" />
      Volver a paquetes
    </button>
  );

  return (
    <LoadState loading={loading && !data} error={error} onRetry={reload}>
      {data && !pkg ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
          Este paquete ya no existe o fue desactivado.
          {back}
        </div>
      ) : (
        pkg &&
        data && (
          <>
            <PageTitle kicker="Paquete de atención" title={pkg.name} subtitle={pkg.description ?? undefined} action={back} />

            <section className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-border bg-card p-5 text-sm">
              <span>
                <span className="block text-xs text-muted-foreground">Código</span>
                <span className="font-mono">{pkg.code}</span>
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">Edad</span>
                {ageRange(pkg.min_age_days, pkg.max_age_days)}
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">Aplica a</span>
                {pkg.at_risk_newborn_only ? "Solo recién nacidos en riesgo" : "Todos los niños"}
              </span>
              <button className={`${secondaryButtonClass} ml-auto`} onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
                Editar paquete
              </button>
            </section>

            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="text-lg font-semibold">Prestaciones ({total})</h2>
              <button className={buttonClass} onClick={() => setForm({})}>
                <Plus className="size-4" />
                Nueva prestación
              </button>
            </div>
            <Table head={["Prestación", "Edad", "Intervalo mínimo", "Orden", ""]} minWidth={820}>
              {total ? (
                groups.map(([group, items]) => [
                  <GroupRow key={`g-${group}`} colSpan={5}>
                    {group}
                  </GroupRow>,
                  ...items.map((s) => (
                    <Tr key={s.id}>
                      <Td>
                        <p className="font-semibold">{s.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{s.code}</p>
                      </Td>
                      <Td>{ageRange(s.min_age_days, s.max_age_days)}</Td>
                      <Td>{s.min_interval_days ? `${s.min_interval_days} días` : "—"}</Td>
                      <Td>
                        {s.group_order}.{s.sort_order}
                      </Td>
                      <Td>
                        <RowActions label={s.name} onEdit={() => setForm({ service: s })} onDelete={() => setRemove(s)} />
                      </Td>
                    </Tr>
                  )),
                ])
              ) : (
                <EmptyRow colSpan={5}>Este paquete aún no tiene prestaciones.</EmptyRow>
              )}
            </Table>
            <Pagination pager={pager} label="prestaciones" />

            {editing && <PackageFormModal pkg={pkg} onClose={() => setEditing(false)} onSaved={reload} />}
            {form && (
              <ServiceFormModal
                service={form.service}
                pkg={pkg}
                packages={data.packages}
                groups={groupNames}
                onClose={() => setForm(null)}
                onSaved={reload}
              />
            )}
            {remove && (
              <ConfirmModal
                title="Eliminar prestación"
                message={
                  <>
                    ¿Eliminar <b>{remove.name}</b>? Si ya tiene controles o reclamos registrados, solo se desactivará.
                  </>
                }
                onConfirm={async () => {
                  const ok = await run(deleteCareService(remove.id));
                  if (ok) reload();
                  return ok !== null;
                }}
                onClose={() => setRemove(null)}
              />
            )}
          </>
        )
      )}
    </LoadState>
  );
}

function ServiceFormModal({
  service,
  pkg,
  packages,
  groups,
  onClose,
  onSaved,
}: {
  service?: CareService;
  pkg?: CarePackage;
  packages: CarePackage[];
  groups: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const run = useBackendAction();
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    const saved = await run(
      saveCareService(
        {
          package_id: required(form, "package_id") || (pkg?.id ?? ""),
          code: toCode(form, "code"),
          name: required(form, "name"),
          group_name: required(form, "group_name") || DEFAULT_GROUP,
          group_order: toInt(form, "group_order", 1),
          sort_order: toInt(form, "sort_order", 1),
          min_age_days: toInt(form, "min_age_days", 0),
          max_age_days: toInt(form, "max_age_days", 0),
          min_interval_days: toInt(form, "min_interval_days", 0),
        },
        service?.id,
      ),
      service ? "Prestación actualizada" : "Prestación creada",
    );
    setPending(false);
    if (saved) {
      onSaved();
      onClose();
    }
  }

  return (
    <Modal title={service ? "Editar prestación" : "Nueva prestación"} subtitle={service?.name ?? pkg?.name ?? "Elige el paquete al que pertenece"} onClose={onClose} wide>
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="Código" name="code" required defaultValue={service?.code} placeholder="CRED_RN_1" hint={codeHint} />
          <div className="sm:col-span-2">
            <TextField label="Nombre" name="name" required defaultValue={service?.name} placeholder="Ej. Control CRED 1" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <TextField
              label="Grupo"
              name="group_name"
              defaultValue={service?.group_name ?? groups[0]}
              placeholder={DEFAULT_GROUP}
              list="care-service-groups"
              hint="Encabezado bajo el que aparece (ej. Vacunas, Controles CRED)."
            />
            <datalist id="care-service-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <TextField label="Orden del grupo" name="group_order" type="number" min={1} defaultValue={service?.group_order ?? 1} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AgeField label="Edad mínima" name="min_age_days" defaultDays={service?.min_age_days ?? pkg?.min_age_days ?? 0} />
          <AgeField label="Edad máxima" name="max_age_days" defaultDays={service?.max_age_days ?? pkg?.max_age_days ?? 28} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField
            label="Intervalo mínimo (días)"
            name="min_interval_days"
            type="number"
            min={0}
            defaultValue={service?.min_interval_days ?? 0}
            hint="Días desde la prestación anterior."
          />
          <TextField label="Orden en el grupo" name="sort_order" type="number" min={1} defaultValue={service?.sort_order ?? 1} />
          {(service || !pkg) && (
            <SelectField
              label="Paquete"
              name="package_id"
              required
              placeholder="Seleccionar paquete"
              defaultValue={service?.package_id}
              options={packages.map((p) => ({ value: p.id, label: p.name }))}
            />
          )}
        </div>
        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : service ? "Guardar cambios" : "Crear prestación"}
        </button>
      </form>
    </Modal>
  );
}

/* ───────────── Prestaciones (todas) ───────────── */

export function CareServicesView({ nav }: { nav: Nav }) {
  const { data, loading, error, reload } = useCatalog();
  const run = useBackendAction();
  const [q, setQ] = useState("");
  const [packageFilter, setPackageFilter] = useState("");
  const [form, setForm] = useState<{ service?: CareService } | null>(null);
  const [remove, setRemove] = useState<CareService | null>(null);

  const packageById = useMemo(() => new Map(data?.packages.map((p) => [p.id, p]) ?? []), [data]);
  const order = useMemo(() => new Map(data?.packages.map((p, i) => [p.id, i]) ?? []), [data]);
  const rows = (data?.services ?? [])
    .filter((s) => !packageFilter || s.package_id === packageFilter)
    .filter((s) => matches(q, s.code, s.name, s.group_name, packageById.get(s.package_id)?.name))
    .sort(
      (a, b) =>
        (order.get(a.package_id) ?? 0) - (order.get(b.package_id) ?? 0) ||
        a.group_order - b.group_order ||
        a.sort_order - b.sort_order,
    );
  const { items, pager } = usePage(rows, `${q}|${packageFilter}`);
  const groups = [...new Set((data?.services ?? []).map((s) => s.group_name))];

  return (
    <>
      <PageTitle
        kicker="Catálogo SISNAT"
        title="Prestaciones"
        subtitle="Todas las atenciones del catálogo: vacunas, controles CRED, visitas, suplementos..."
        action={
          <button className={buttonClass} onClick={() => setForm({})} disabled={!data?.packages.length}>
            <Plus className="size-4" />
            Nueva prestación
          </button>
        }
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        <FilterBar>
          <SearchField value={q} onChange={setQ} placeholder="Código, nombre o grupo" />
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Paquete
            <select className={inputClass} value={packageFilter} onChange={(e) => setPackageFilter(e.target.value)}>
              <option value="">Todos</option>
              {data?.packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <p className="ml-auto self-center text-sm text-muted-foreground">{rows.length} prestaciones</p>
        </FilterBar>
        <Table head={["Prestación", "Paquete", "Grupo", "Edad", ""]} minWidth={960}>
          {rows.length ? (
            items.map((s) => {
              const pkg = packageById.get(s.package_id);
              return (
                <Tr key={s.id}>
                  <Td>
                    <p className="font-semibold">{s.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{s.code}</p>
                  </Td>
                  <Td>
                    {pkg ? (
                      <button className="text-left text-primary hover:underline" onClick={() => nav.go({ name: "carePackage", packageId: pkg.id })}>
                        {pkg.name}
                      </button>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <span className="text-xs">{s.group_name}</span>
                  </Td>
                  <Td>{ageRange(s.min_age_days, s.max_age_days)}</Td>
                  <Td>
                    <RowActions label={s.name} onEdit={() => setForm({ service: s })} onDelete={() => setRemove(s)} />
                  </Td>
                </Tr>
              );
            })
          ) : (
            <EmptyRow colSpan={5}>
              {q || packageFilter ? "No hay prestaciones para esta búsqueda." : "Aún no hay prestaciones. Créalas desde un paquete."}
            </EmptyRow>
          )}
        </Table>
        <Pagination pager={pager} label="prestaciones" />
      </LoadState>

      {form && data && (
        <ServiceFormModal
          service={form.service}
          pkg={form.service ? packageById.get(form.service.package_id) : packageById.get(packageFilter)}
          packages={data.packages}
          groups={groups}
          onClose={() => setForm(null)}
          onSaved={reload}
        />
      )}
      {remove && (
        <ConfirmModal
          title="Eliminar prestación"
          message={
            <>
              ¿Eliminar <b>{remove.name}</b>? Si ya tiene controles o reclamos registrados, solo se desactivará.
            </>
          }
          onConfirm={async () => {
            const ok = await run(deleteCareService(remove.id));
            if (ok) reload();
            return ok !== null;
          }}
          onClose={() => setRemove(null)}
        />
      )}
    </>
  );
}
