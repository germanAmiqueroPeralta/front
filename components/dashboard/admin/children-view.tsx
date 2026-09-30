"use client";

import { ArrowRight, ClipboardCheck, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { useBackendAction } from "@/hooks/use-backend";
import { deleteChild } from "@/lib/actions/admin/people";
import { birthConditionLabels, childName, type Child } from "@/lib/api/types";
import { inputClass, secondaryButtonClass } from "@/lib/dashboard/cred";
import { ageDays, formatAge, formatDate } from "@/lib/sisnat/dates";
import { EmptyRow, FilterBar, PageTitle, PersonCell, StatusBadge, Table, Td, Tr } from "@/components/dashboard/shared";
import { RowActions } from "@/components/dashboard/row-actions";
import { LoadState, Pagination, SearchField, matches, usePage } from "@/components/dashboard/admin/common";
import { ChildFormModal } from "@/components/dashboard/admin/child-form-modal";
import { usePeople } from "@/components/dashboard/admin/guardian-views";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

export function ChildrenView({ nav }: { nav: Nav }) {
  const { data, loading, error, reload } = usePeople();
  const run = useBackendAction();
  const [q, setQ] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("");
  const [edit, setEdit] = useState<Child | null>(null);
  const [remove, setRemove] = useState<Child | null>(null);

  const facilityById = useMemo(() => new Map(data?.facilities.map((f) => [f.id, f]) ?? []), [data]);
  const regionById = useMemo(() => new Map(data?.regions.map((r) => [r.id, r]) ?? []), [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const guardians = new Map(data.guardians.map((g) => [g.id, g]));
    return data.children
      .filter((c) => !facilityFilter || c.health_facility_id === facilityFilter)
      .filter((c) => matches(q, childName(c), c.dni, c.padron_code, c.mother_name))
      .map((c) => ({
        child: c,
        parents: data.links
          .filter((l) => l.child_id === c.id && guardians.has(l.guardian_id))
          .map((l) => ({ guardian: guardians.get(l.guardian_id)!, relationship: l.relationship })),
      }))
      .sort((a, b) => a.child.last_names.localeCompare(b.child.last_names));
  }, [data, q, facilityFilter]);
  const { items, pager } = usePage(rows, `${q}|${facilityFilter}`);

  return (
    <>
      <PageTitle
        kicker="Padres y niños"
        title="Niños (padrón nominal)"
        subtitle="Todos los niños registrados. Para registrar uno nuevo, entra a la ficha de su padre."
        action={
          <button className={secondaryButtonClass} onClick={() => nav.go({ name: "guardians" })}>
            Registrar desde Padres
            <ArrowRight className="size-4" />
          </button>
        }
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
        {rows.some((r) => !r.parents.length) && (
          <p className="mb-4 flex gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-warning" />
            Hay niños sin padre vinculado: búscalos en la ficha de su padre con <b>Vincular hijo existente</b>.
          </p>
        )}
        <Table head={["Niño", "Nacimiento", "DNI", "Establecimiento", "Condición", "Padres", ""]} minWidth={1000}>
          {rows.length ? (
            items.map(({ child: c, parents }) => {
              const facility = facilityById.get(c.health_facility_id);
              return (
                <Tr key={c.id}>
                  <Td>
                    <PersonCell name={childName(c)} detail={`Padrón ${c.padron_code}`} />
                  </Td>
                  <Td>
                    <span className="grid max-md:text-right">
                      <span>{formatDate(c.birth_date)}</span>
                      <span className="text-xs text-muted-foreground">{formatAge(ageDays(c.birth_date))}</span>
                    </span>
                  </Td>
                  <Td>{c.dni ?? "—"}</Td>
                  <Td>
                    <span className="grid max-md:text-right">
                      <span>{facility?.name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{regionById.get(facility?.region_id ?? "")?.name}</span>
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge tone={c.birth_condition === "none" ? "muted" : "warn"}>
                      {birthConditionLabels[c.birth_condition]}
                    </StatusBadge>
                  </Td>
                  <Td>
                    {parents.length ? (
                      <span className="flex flex-wrap gap-1.5 max-md:justify-end">
                        {parents.map(({ guardian, relationship }) => (
                          <button
                            key={guardian.id}
                            onClick={() => nav.go({ name: "guardianDetail", guardianId: guardian.id })}
                            className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
                          >
                            {guardian.full_name.split(" ")[0]} · {relationship}
                          </button>
                        ))}
                      </span>
                    ) : (
                      <StatusBadge tone="warn">Sin padre</StatusBadge>
                    )}
                  </Td>
                  <Td>
                    <RowActions label={childName(c)} onEdit={() => setEdit(c)} onDelete={() => setRemove(c)}>
                      <button
                        className={`${secondaryButtonClass} h-9`}
                        onClick={() => nav.go({ name: "childControls", childId: c.id })}
                      >
                        <ClipboardCheck className="size-4" />
                        Controles
                      </button>
                    </RowActions>
                  </Td>
                </Tr>
              );
            })
          ) : (
            <EmptyRow colSpan={7}>
              {q || facilityFilter ? "No hay niños para esta búsqueda." : "Aún no hay niños. Regístralos desde la ficha de su padre."}
            </EmptyRow>
          )}
        </Table>
        <Pagination pager={pager} label="niños" />
      </LoadState>

      {edit && data && (
        <ChildFormModal child={edit} facilities={data.facilities} regions={data.regions} onClose={() => setEdit(null)} onSaved={reload} />
      )}
      {remove && (
        <ConfirmModal
          title="Dar de baja al niño"
          confirmText="Dar de baja"
          message={
            <>
              <b>{childName(remove)}</b> dejará de aparecer en el padrón. Su historial de controles se conserva.
            </>
          }
          onConfirm={async () => {
            const ok = await run(deleteChild(remove.id));
            if (ok) reload();
            return ok !== null;
          }}
          onClose={() => setRemove(null)}
        />
      )}
    </>
  );
}
