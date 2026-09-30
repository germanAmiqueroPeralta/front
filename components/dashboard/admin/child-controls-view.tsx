"use client";

import { ArrowLeft, ArrowRight, Plus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useBackendAction, useBackendQuery } from "@/hooks/use-backend";
import { createChildControl, deleteChildControl, loadChildControls, updateChildControl } from "@/lib/actions/admin/catalog";
import {
  birthConditionLabels,
  childName,
  controlStatusLabels,
  type CareService,
  type Child,
  type ChildControl,
  type ControlStatus,
  type HealthFacility,
} from "@/lib/api/types";
import { buttonClass, inputClass, secondaryButtonClass, type Tone } from "@/lib/dashboard/cred";
import { addDays, ageDays, formatAge, formatDate, todayISO } from "@/lib/sisnat/dates";
import { EmptyRow, FilterBar, GroupRow, PageTitle, PersonCell, Progress, StatusBadge, Table, Td, Tr, groupBy, toneFor } from "@/components/dashboard/shared";
import { RowActions } from "@/components/dashboard/row-actions";
import { TextField, labelClass, submitWith, textareaClass } from "@/components/dashboard/forms";
import { LoadState, Pagination, SearchField, SelectField, matches, optional, required, usePage } from "@/components/dashboard/admin/common";
import { usePeople } from "@/components/dashboard/admin/guardian-views";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

/* ───────────── Elegir niño ───────────── */

export function ControlsView({ nav }: { nav: Nav }) {
  const { data, loading, error, reload } = usePeople();
  const [q, setQ] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("");

  const facilityById = useMemo(() => new Map(data?.facilities.map((f) => [f.id, f]) ?? []), [data]);
  const rows = (data?.children ?? [])
    .filter((c) => !facilityFilter || c.health_facility_id === facilityFilter)
    .filter((c) => matches(q, childName(c), c.dni, c.padron_code, c.mother_name))
    .sort((a, b) => a.last_names.localeCompare(b.last_names));
  const { items, pager } = usePage(rows, `${q}|${facilityFilter}`);

  return (
    <>
      <PageTitle
        kicker="Atención CRED"
        title="Controles"
        subtitle="Elige un niño para ver y registrar sus controles según los paquetes que le corresponden."
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        <FilterBar>
          <SearchField value={q} onChange={setQ} placeholder="Nombre, DNI, padrón o nombre de la madre" />
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Establecimiento
            <select className={inputClass} value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)}>
              <option value="">Todos</option>
              {data?.facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <p className="ml-auto self-center text-sm text-muted-foreground">{rows.length} niños</p>
        </FilterBar>
        <Table head={["Niño", "Edad", "Establecimiento", "Condición", ""]} minWidth={800}>
          {rows.length ? (
            items.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <button className="text-left hover:underline" onClick={() => nav.go({ name: "childControls", childId: c.id })}>
                    <PersonCell name={childName(c)} detail={`Padrón ${c.padron_code}`} />
                  </button>
                </Td>
                <Td>{formatAge(ageDays(c.birth_date))}</Td>
                <Td>{facilityById.get(c.health_facility_id)?.name ?? "—"}</Td>
                <Td>
                  <StatusBadge tone={c.birth_condition === "none" ? "muted" : "warn"}>
                    {birthConditionLabels[c.birth_condition]}
                  </StatusBadge>
                </Td>
                <Td>
                  <button className={`${secondaryButtonClass} h-9`} onClick={() => nav.go({ name: "childControls", childId: c.id })}>
                    Ver controles
                    <ArrowRight className="size-4" />
                  </button>
                </Td>
              </Tr>
            ))
          ) : (
            <EmptyRow colSpan={5}>
              {q || facilityFilter ? "No hay niños para esta búsqueda." : "Aún no hay niños. Regístralos desde la ficha de su padre."}
            </EmptyRow>
          )}
        </Table>
        <Pagination pager={pager} label="niños" />
      </LoadState>
    </>
  );
}

/* ───────────── Controles de un niño ───────────── */

const statusTone: Record<ControlStatus, Tone> = {
  completed: "good",
  pending: "warn",
  overdue: "danger",
  not_applicable: "muted",
};

/** Estado a mostrar cuando la prestación todavía no tiene control registrado (según la edad del niño). */
function withoutControl(age: number, service: CareService): { label: string; tone: Tone } {
  if (age < service.min_age_days) return { label: "Próximo", tone: "muted" };
  if (age > service.max_age_days) return { label: "Sin registrar (fuera de plazo)", tone: "danger" };
  return { label: "Sin registrar", tone: "warn" };
}

export function ChildControlsView({ nav, childId }: { nav: Nav; childId: string }) {
  const { data, loading, error, reload } = useBackendQuery(`controls:${childId}`, () => loadChildControls(childId));
  const run = useBackendAction();
  const [form, setForm] = useState<{ service: CareService; control?: ChildControl } | null>(null);
  const [remove, setRemove] = useState<{ service: CareService; control: ChildControl } | null>(null);

  const child = data?.child;
  const age = child ? ageDays(child.birth_date) : 0;
  const facilityById = useMemo(() => new Map(data?.facilities.map((f) => [f.id, f]) ?? []), [data]);
  const controlByService = useMemo(() => new Map(data?.controls.map((c) => [c.service_id, c]) ?? []), [data]);

  /** Paquetes que le corresponden al niño (los de RN en riesgo solo si nació prematuro o con bajo peso). */
  const packages = useMemo(() => {
    if (!data) return [];
    return data.packages
      .filter((p) => !p.at_risk_newborn_only || data.child.birth_condition !== "none")
      .map((p) => ({
        pkg: p,
        groups: groupBy(
          data.services
            .filter((s) => s.package_id === p.id)
            .sort((a, b) => a.group_order - b.group_order || a.sort_order - b.sort_order),
          (s) => s.group_name,
        ),
      }))
      .filter(({ groups }) => groups.length);
  }, [data]);

  const applicable = packages.flatMap(({ groups }) => groups.flatMap(([, items]) => items));
  const due = applicable.filter((s) => age >= s.min_age_days);
  const done = due.filter((s) => controlByService.get(s.id)?.status === "completed").length;
  const pct = due.length ? Math.round((done / due.length) * 100) : 100;

  const back = (
    <button className={secondaryButtonClass} onClick={() => nav.go({ name: "controls" })}>
      <ArrowLeft className="size-4" />
      Volver a controles
    </button>
  );

  return (
    <LoadState loading={loading && !data} error={error} onRetry={reload}>
      {child && data && (
        <>
          <PageTitle
            kicker="Controles del niño"
            title={childName(child)}
            subtitle={`Padrón ${child.padron_code}${child.dni ? ` · DNI ${child.dni}` : ""}`}
            action={back}
          />

          <section className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <span>
              <span className="block text-xs text-muted-foreground">Nacimiento</span>
              {formatDate(child.birth_date)} · {formatAge(age)}
            </span>
            <span>
              <span className="block text-xs text-muted-foreground">Condición al nacer</span>
              {birthConditionLabels[child.birth_condition]}
            </span>
            <span>
              <span className="block text-xs text-muted-foreground">Establecimiento</span>
              {facilityById.get(child.health_facility_id)?.name ?? "—"}
            </span>
            <span className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">
                Cumplidas {done} de {due.length} que ya le tocaban
              </span>
              <Progress value={pct} tone={toneFor(pct)} />
            </span>
          </section>

          {!child.active && (
            <p className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
              Este niño está dado de baja: se puede ver su historial, pero no registrar controles nuevos.
            </p>
          )}

          {packages.length ? (
            packages.map(({ pkg, groups }) => (
              <section key={pkg.id} className="mb-8">
                <h2 className="mb-3 flex flex-wrap items-baseline gap-x-3 text-lg font-semibold">
                  {pkg.name}
                  <span className="text-sm font-normal text-muted-foreground">
                    {formatAge(pkg.min_age_days)} – {formatAge(pkg.max_age_days)}
                  </span>
                </h2>
                <Table head={["Prestación", "Le corresponde", "Estado", "Fecha", "Establecimiento", ""]} minWidth={960}>
                  {groups.map(([group, items]) => [
                    <GroupRow key={`g-${pkg.id}-${group}`} colSpan={6}>
                      {group}
                    </GroupRow>,
                    ...items.map((s) => {
                      const control = controlByService.get(s.id);
                      const pending = control ? null : withoutControl(age, s);
                      return (
                        <Tr key={s.id}>
                          <Td>
                            <p className="font-semibold">{s.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{s.code}</p>
                          </Td>
                          <Td>
                            <span className="grid max-md:text-right">
                              <span>
                                {formatDate(addDays(child.birth_date, s.min_age_days))} – {formatDate(addDays(child.birth_date, s.max_age_days))}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatAge(s.min_age_days)} – {formatAge(s.max_age_days)}
                              </span>
                            </span>
                          </Td>
                          <Td>
                            {control ? (
                              <StatusBadge tone={statusTone[control.status]}>{controlStatusLabels[control.status]}</StatusBadge>
                            ) : (
                              <StatusBadge tone={pending!.tone}>{pending!.label}</StatusBadge>
                            )}
                          </Td>
                          <Td>
                            {control?.completed_date ? (
                              formatDate(control.completed_date)
                            ) : control?.scheduled_date ? (
                              <span className="text-muted-foreground">Cita {formatDate(control.scheduled_date)}</span>
                            ) : (
                              "—"
                            )}
                          </Td>
                          <Td>{control?.health_facility_id ? (facilityById.get(control.health_facility_id)?.name ?? "—") : "—"}</Td>
                          <Td>
                            {control ? (
                              <RowActions
                                label={s.name}
                                onEdit={() => setForm({ service: s, control })}
                                onDelete={() => setRemove({ service: s, control })}
                              />
                            ) : (
                              child.active && (
                                <button className={`${secondaryButtonClass} h-9`} onClick={() => setForm({ service: s })}>
                                  <Plus className="size-4" />
                                  Registrar
                                </button>
                              )
                            )}
                          </Td>
                        </Tr>
                      );
                    }),
                  ])}
                </Table>
              </section>
            ))
          ) : (
            <Table head={["Prestación"]}>
              <EmptyRow colSpan={1}>
                No hay paquetes con prestaciones para este niño. Créalos en <b>Paquetes</b>.
              </EmptyRow>
            </Table>
          )}

          {form && (
            <ControlFormModal
              child={child}
              service={form.service}
              control={form.control}
              facilities={data.facilities}
              onClose={() => setForm(null)}
              onSaved={reload}
            />
          )}
          {remove && (
            <ConfirmModal
              title="Eliminar control"
              message={
                <>
                  ¿Eliminar el registro de <b>{remove.service.name}</b>? La prestación volverá a figurar como sin registrar.
                </>
              }
              onConfirm={async () => {
                const ok = await run(deleteChildControl(remove.control.id));
                if (ok) reload();
                return ok !== null;
              }}
              onClose={() => setRemove(null)}
            />
          )}
        </>
      )}
    </LoadState>
  );
}

export function ControlFormModal({
  child,
  service,
  control,
  facilities,
  onClose,
  onSaved,
}: {
  child: Child;
  service: CareService;
  control?: ChildControl;
  facilities: HealthFacility[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const run = useBackendAction();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<ControlStatus>(control?.status ?? "completed");
  const completed = status === "completed";

  async function submit(form: FormData) {
    setPending(true);
    const input = {
      status,
      completed_date: completed ? required(form, "completed_date") : null,
      scheduled_date: optional(form, "scheduled_date"),
      health_facility_id: optional(form, "health_facility_id"),
      batch_number: optional(form, "batch_number"),
      book_page: optional(form, "book_page"),
      book_record: optional(form, "book_record"),
      notes: optional(form, "notes"),
    };
    const saved = await run(
      control ? updateChildControl(control.id, input) : createChildControl(child.id, service.id, input),
      control ? "Control actualizado" : "Control registrado",
    );
    setPending(false);
    if (saved) {
      onSaved();
      onClose();
    }
  }

  return (
    <Modal title={control ? "Editar control" : "Registrar control"} subtitle={`${service.name} · ${childName(child)}`} onClose={onClose}>
      <form onSubmit={submitWith(submit)} className="grid grid-cols-1 gap-4">
        <SelectField
          label="Estado"
          name="status"
          required
          defaultValue={status}
          onChange={(v) => setStatus(v as ControlStatus)}
          options={(Object.keys(controlStatusLabels) as ControlStatus[]).map((s) => ({ value: s, label: controlStatusLabels[s] }))}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {completed && (
            <TextField
              label="Fecha de atención"
              name="completed_date"
              type="date"
              required
              min={child.birth_date}
              max={todayISO()}
              defaultValue={control?.completed_date ?? todayISO()}
            />
          )}
          <TextField
            label="Fecha de cita"
            name="scheduled_date"
            type="date"
            min={child.birth_date}
            defaultValue={control?.scheduled_date}
            hint={completed ? "Opcional." : "Cuándo le toca volver."}
          />
        </div>
        <SelectField
          label="Establecimiento"
          name="health_facility_id"
          placeholder="Sin especificar"
          defaultValue={control ? control.health_facility_id : child.health_facility_id}
          options={facilities.map((f) => ({ value: f.id, label: f.name }))}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="Lote" name="batch_number" defaultValue={control?.batch_number} placeholder="Vacunas" />
          <TextField label="Folio del libro" name="book_page" defaultValue={control?.book_page} />
          <TextField label="N° de registro" name="book_record" defaultValue={control?.book_record} />
        </div>
        <label className={labelClass}>
          Observaciones
          <textarea name="notes" rows={2} defaultValue={control?.notes ?? ""} className={textareaClass} />
        </label>
        <button className={buttonClass} type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Guardando..." : control ? "Guardar cambios" : "Registrar control"}
        </button>
      </form>
    </Modal>
  );
}
