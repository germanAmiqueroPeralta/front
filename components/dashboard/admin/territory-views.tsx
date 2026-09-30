"use client";

import { ArrowRight, Plus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useBackendAction, useBackendQuery } from "@/hooks/use-backend";
import { deleteFacility, deleteRegion, loadTerritory, saveFacility, saveRegion } from "@/lib/actions/admin/territory";
import type { HealthFacility, Region } from "@/lib/api/types";
import { buttonClass, inputClass } from "@/lib/dashboard/cred";
import { EmptyRow, FilterBar, PageTitle, StatusBadge, Table, Td, Tr } from "@/components/dashboard/shared";
import { RowActions } from "@/components/dashboard/row-actions";
import { TextField, submitWith } from "@/components/dashboard/forms";
import { LoadState, Pagination, SearchField, SelectField, matches, required, usePage } from "@/components/dashboard/admin/common";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

const DEFAULT_NETWORK = "Huamanga Health Network";

/* ───────────── Micro redes ───────────── */

export function RegionsView({ nav }: { nav: Nav }) {
  const { data, loading, error, reload } = useBackendQuery("territory", loadTerritory);
  const run = useBackendAction();
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ region?: Region } | null>(null);
  const [remove, setRemove] = useState<Region | null>(null);

  const facilitiesPer = useMemo(() => {
    const count = new Map<string, number>();
    data?.facilities.forEach((f) => count.set(f.region_id, (count.get(f.region_id) ?? 0) + 1));
    return count;
  }, [data]);
  const rows = (data?.regions ?? []).filter((r) => matches(q, r.name, r.health_network));
  const { items, pager } = usePage(rows, q);

  return (
    <>
      <PageTitle
        kicker="Territorio"
        title="Micro redes"
        subtitle="Primer paso del territorio: cada establecimiento de salud pertenece a una micro red."
        action={
          <button className={buttonClass} onClick={() => setForm({})}>
            <Plus className="size-4" />
            Nueva micro red
          </button>
        }
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        <FilterBar>
          <SearchField value={q} onChange={setQ} placeholder="Nombre de la micro red" />
          <p className="ml-auto self-center text-sm text-muted-foreground">{rows.length} micro redes</p>
        </FilterBar>
        <Table head={["Micro red", "Red de salud", "Establecimientos", ""]} minWidth={640}>
          {rows.length ? (
            items.map((r) => {
              const count = facilitiesPer.get(r.id) ?? 0;
              return (
                <Tr key={r.id}>
                  <Td>
                    <span className="font-semibold">{r.name}</span>
                  </Td>
                  <Td>{r.health_network ?? "—"}</Td>
                  <Td>
                    {count ? (
                      <button className="text-sm font-semibold text-primary hover:underline" onClick={() => nav.go({ name: "facilities" })}>
                        {count} establecimiento{count === 1 ? "" : "s"}
                      </button>
                    ) : (
                      <StatusBadge tone="warn">Sin establecimientos</StatusBadge>
                    )}
                  </Td>
                  <Td>
                    <RowActions label={r.name} onEdit={() => setForm({ region: r })} onDelete={() => setRemove(r)} />
                  </Td>
                </Tr>
              );
            })
          ) : (
            <EmptyRow colSpan={4}>
              {q ? "No hay micro redes para esta búsqueda." : "Aún no hay micro redes. Empieza creando la primera."}
            </EmptyRow>
          )}
        </Table>
        <Pagination pager={pager} label="micro redes" />
      </LoadState>

      {form && <RegionFormModal region={form.region} onClose={() => setForm(null)} onSaved={reload} />}
      {remove && (
        <ConfirmModal
          title="Eliminar micro red"
          message={
            <>
              ¿Eliminar <b>{remove.name}</b>? Si ya tiene establecimientos o personal asignado, solo se desactivará para
              conservar el historial.
            </>
          }
          onConfirm={async () => {
            const ok = await run(deleteRegion(remove.id));
            if (ok) reload();
            return ok !== null;
          }}
          onClose={() => setRemove(null)}
        />
      )}
    </>
  );
}

function RegionFormModal({ region, onClose, onSaved }: { region?: Region; onClose: () => void; onSaved: () => void }) {
  const run = useBackendAction();
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    const network = required(form, "health_network");
    const saved = await run(
      saveRegion({ name: required(form, "name"), ...(network ? { health_network: network } : {}) }, region?.id),
      region ? "Micro red actualizada" : "Micro red creada. Ahora registra sus establecimientos.",
    );
    setPending(false);
    if (saved) {
      onSaved();
      onClose();
    }
  }

  return (
    <Modal title={region ? "Editar micro red" : "Nueva micro red"} subtitle={region?.name} onClose={onClose}>
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <TextField label="Nombre" name="name" required defaultValue={region?.name} placeholder="Ej. Micro Red San Juan Bautista" />
        <TextField
          label="Red de salud"
          name="health_network"
          defaultValue={region?.health_network}
          placeholder={DEFAULT_NETWORK}
          hint="Si lo dejas vacío se usa la Red de Salud Huamanga."
        />
        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : region ? "Guardar cambios" : "Crear micro red"}
        </button>
      </form>
    </Modal>
  );
}

/* ───────────── Establecimientos ───────────── */

export function FacilitiesView({ nav }: { nav: Nav }) {
  const { data, loading, error, reload } = useBackendQuery("territory", loadTerritory);
  const run = useBackendAction();
  const [q, setQ] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [form, setForm] = useState<{ facility?: HealthFacility } | null>(null);
  const [remove, setRemove] = useState<HealthFacility | null>(null);

  const regionById = useMemo(() => new Map(data?.regions.map((r) => [r.id, r]) ?? []), [data]);
  const rows = (data?.facilities ?? []).filter(
    (f) => (!regionFilter || f.region_id === regionFilter) && matches(q, f.name, regionById.get(f.region_id)?.name),
  );
  const { items, pager } = usePage(rows, `${q}|${regionFilter}`);
  const noRegions = data !== null && data.regions.length === 0;

  return (
    <>
      <PageTitle
        kicker="Territorio"
        title="Establecimientos de salud"
        subtitle="Puestos y centros de salud. Cada niño del padrón pertenece a uno."
        action={
          <button className={buttonClass} onClick={() => setForm({})} disabled={!data || noRegions}>
            <Plus className="size-4" />
            Nuevo establecimiento
          </button>
        }
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        {noRegions ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Antes de registrar establecimientos necesitas al menos una micro red.
            <button className={buttonClass} onClick={() => nav.go({ name: "regions" })}>
              Ir a Micro redes
              <ArrowRight className="size-4" />
            </button>
          </div>
        ) : (
          <>
            <FilterBar>
              <SearchField value={q} onChange={setQ} placeholder="Nombre del establecimiento" />
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Micro red
                <select className={inputClass} value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                  <option value="">Todas</option>
                  {data?.regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="ml-auto self-center text-sm text-muted-foreground">{rows.length} establecimientos</p>
            </FilterBar>
            <Table head={["Establecimiento", "Micro red", ""]} minWidth={600}>
              {rows.length ? (
                items.map((f) => (
                  <Tr key={f.id}>
                    <Td>
                      <span className="font-semibold">{f.name}</span>
                    </Td>
                    <Td>{regionById.get(f.region_id)?.name ?? "Micro red inactiva"}</Td>
                    <Td>
                      <RowActions label={f.name} onEdit={() => setForm({ facility: f })} onDelete={() => setRemove(f)} />
                    </Td>
                  </Tr>
                ))
              ) : (
                <EmptyRow colSpan={3}>
                  {q || regionFilter ? "No hay establecimientos para esta búsqueda." : "Aún no hay establecimientos registrados."}
                </EmptyRow>
              )}
            </Table>
            <Pagination pager={pager} label="establecimientos" />
          </>
        )}
      </LoadState>

      {form && data && (
        <FacilityFormModal
          facility={form.facility}
          regions={data.regions}
          defaultRegion={regionFilter}
          onClose={() => setForm(null)}
          onSaved={reload}
        />
      )}
      {remove && (
        <ConfirmModal
          title="Eliminar establecimiento"
          message={
            <>
              ¿Eliminar <b>{remove.name}</b>? Si ya tiene niños registrados, solo se desactivará para conservar su
              historial.
            </>
          }
          onConfirm={async () => {
            const ok = await run(deleteFacility(remove.id));
            if (ok) reload();
            return ok !== null;
          }}
          onClose={() => setRemove(null)}
        />
      )}
    </>
  );
}

function FacilityFormModal({
  facility,
  regions,
  defaultRegion,
  onClose,
  onSaved,
}: {
  facility?: HealthFacility;
  regions: Region[];
  defaultRegion: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const run = useBackendAction();
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    const saved = await run(
      saveFacility({ name: required(form, "name"), region_id: required(form, "region_id") }, facility?.id),
      facility ? "Establecimiento actualizado" : "Establecimiento creado",
    );
    setPending(false);
    if (saved) {
      onSaved();
      onClose();
    }
  }

  return (
    <Modal title={facility ? "Editar establecimiento" : "Nuevo establecimiento"} subtitle={facility?.name} onClose={onClose}>
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <TextField label="Nombre" name="name" required defaultValue={facility?.name} placeholder="Ej. Puesto de Salud Santa Elena" />
        <SelectField
          label="Micro red"
          name="region_id"
          required
          placeholder="Seleccionar micro red"
          defaultValue={facility?.region_id ?? defaultRegion}
          options={regions.map((r) => ({ value: r.id, label: r.name }))}
        />
        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : facility ? "Guardar cambios" : "Crear establecimiento"}
        </button>
      </form>
    </Modal>
  );
}
