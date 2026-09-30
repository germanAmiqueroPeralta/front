"use client";

import {
  Baby,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClipboardCheck,
  Contact,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useBackendQuery } from "@/hooks/use-backend";
import { loadTracking } from "@/lib/actions/admin/catalog";
import { applicableServices, packagePhase, serviceState, type ServiceState } from "@/lib/api/cred";
import {
  birthConditionLabels,
  childName,
  type CarePackage,
  type CareService,
  type Child,
  type ChildControl,
  type Guardian,
} from "@/lib/api/types";
import { secondaryButtonClass } from "@/lib/dashboard/cred";
import { addDays, ageDays, formatAge, formatDate } from "@/lib/sisnat/dates";
import { PageTitle, Progress, StatusBadge, groupBy, toneFor } from "@/components/dashboard/shared";
import { LoadState, SearchField, matches } from "@/components/dashboard/admin/common";
import { ControlFormModal } from "@/components/dashboard/admin/child-controls-view";
import { Modal } from "@/components/ui/modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

type Mode = "guardian" | "child";

export type ServiceRow = { service: CareService; control?: ChildControl; state: ServiceState };
type PackageRow = { pkg: CarePackage; phase: "current" | "past" | "future"; services: ServiceRow[]; done: number; due: number };
export type Followup = {
  child: Child;
  age: number;
  packages: PackageRow[];
  counts: Record<ServiceState, number>;
  coverage: number;
};

export const states: Record<ServiceState, { label: string; icon: LucideIcon; box: string; iconClass: string }> = {
  completed: { label: "Cumplido", icon: CheckCircle2, box: "border-success/30 bg-success/10", iconClass: "text-success" },
  overdue: { label: "No cumplido", icon: XCircle, box: "border-destructive/30 bg-destructive/10", iconClass: "text-destructive" },
  due: { label: "Falta", icon: Clock, box: "border-warning/40 bg-warning/10", iconClass: "text-warning" },
  upcoming: { label: "Próximo", icon: CalendarClock, box: "border-border bg-muted/40", iconClass: "text-muted-foreground" },
  not_applicable: { label: "No aplica", icon: MinusCircle, box: "border-border bg-muted/40", iconClass: "text-muted-foreground" },
};

function useTracking() {
  return useBackendQuery("tracking", loadTracking);
}

/** Paquetes del niño con el estado de cada prestación (cumplida, vencida, falta o próxima). */
export function followup(
  child: Child,
  data: { controls: ChildControl[]; packages: CarePackage[]; services: CareService[] },
): Followup {
  const age = ageDays(child.birth_date);
  const controls = new Map(data.controls.filter((c) => c.child_id === child.id).map((c) => [c.service_id, c]));
  const services = applicableServices(child, data.packages, data.services);
  const counts: Record<ServiceState, number> = { completed: 0, overdue: 0, due: 0, upcoming: 0, not_applicable: 0 };

  const packages = data.packages
    .map((pkg) => {
      const rows = services
        .filter((s) => s.package_id === pkg.id)
        .sort((a, b) => a.group_order - b.group_order || a.sort_order - b.sort_order)
        .map((service) => {
          const control = controls.get(service.id);
          const state = serviceState(age, service, control);
          counts[state]++;
          return { service, control, state };
        });
      const done = rows.filter((r) => r.state === "completed").length;
      const due = rows.filter((r) => r.state !== "upcoming" && r.state !== "not_applicable").length;
      return { pkg, phase: packagePhase(age, pkg), services: rows, done, due };
    })
    .filter((p) => p.services.length);

  const due = counts.completed + counts.overdue + counts.due;
  return { child, age, packages, counts, coverage: due ? Math.round((counts.completed / due) * 100) : 100 };
}

/* ───────────── Pantalla de búsqueda ───────────── */

export function TrackingSearchView({ nav }: { nav: Nav }) {
  const { data, loading, error, reload } = useTracking();
  const [mode, setMode] = useState<Mode>("guardian");
  const [q, setQ] = useState("");
  const [guardianId, setGuardianId] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);

  const childrenOf = useMemo(() => {
    const map = new Map<string, { child: Child; relationship: string }[]>();
    if (!data) return map;
    const byId = new Map(data.children.map((c) => [c.id, c]));
    for (const l of data.links) {
      const child = byId.get(l.child_id);
      if (!child) continue;
      map.set(l.guardian_id, [...(map.get(l.guardian_id) ?? []), { child, relationship: l.relationship }]);
    }
    return map;
  }, [data]);

  const parentsOf = (id: string) => {
    if (!data) return [];
    const byId = new Map(data.guardians.map((g) => [g.id, g]));
    return data.links
      .filter((l) => l.child_id === id && byId.has(l.guardian_id))
      .map((l) => ({ guardian: byId.get(l.guardian_id)!, relationship: l.relationship }));
  };

  const guardianResults = (data?.guardians ?? [])
    .filter((g) => matches(q, g.full_name, g.dni, g.phone, ...(childrenOf.get(g.id) ?? []).map((k) => childName(k.child))))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const childResults = (data?.children ?? [])
    .filter((c) => matches(q, childName(c), c.dni, c.padron_code, c.mother_name))
    .sort((a, b) => a.last_names.localeCompare(b.last_names));

  const guardian = data?.guardians.find((g) => g.id === guardianId);
  const selectedChild = data?.children.find((c) => c.id === childId);
  const summaries = useMemo(() => new Map(data?.children.map((c) => [c.id, followup(c, data)]) ?? []), [data]);

  function switchMode(next: Mode) {
    setMode(next);
    setQ("");
    setGuardianId(null);
  }

  return (
    <>
      <PageTitle
        kicker="Atención CRED"
        title="Búsqueda y seguimiento"
        subtitle="Busca a un padre para ver a sus hijos, o directamente al niño, y revisa qué prestaciones cumplió."
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1" role="tablist">
              {(
                [
                  ["guardian", "Por padre", Contact],
                  ["child", "Por hijo", Baby],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => switchMode(value)}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
              <section className="grid min-w-0 content-start gap-3 self-start rounded-xl border border-border bg-card p-4">
                <SearchField
                  value={q}
                  onChange={setQ}
                  placeholder={mode === "guardian" ? "Nombre o DNI del padre, o nombre del hijo" : "Nombre, DNI, padrón o madre"}
                />
                <p className="text-xs text-muted-foreground">
                  {mode === "guardian" ? `${guardianResults.length} padres` : `${childResults.length} niños`}
                </p>
                <ul className="-mx-1 grid max-h-[32rem] grid-cols-[minmax(0,1fr)] gap-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {mode === "guardian"
                    ? guardianResults.map((g) => (
                        <ResultRow
                          key={g.id}
                          active={g.id === guardianId}
                          onClick={() => setGuardianId(g.id)}
                          title={g.full_name}
                          detail={`DNI ${g.dni} · ${(childrenOf.get(g.id) ?? []).length} hijo(s)`}
                        />
                      ))
                    : childResults.map((c) => {
                        const s = summaries.get(c.id)!;
                        return (
                          <ResultRow
                            key={c.id}
                            active={c.id === childId}
                            onClick={() => setChildId(c.id)}
                            title={childName(c)}
                            detail={`${formatAge(s.age)} · Padrón ${c.padron_code}`}
                            side={<StatusBadge tone={toneFor(s.coverage)}>{s.coverage}%</StatusBadge>}
                          />
                        );
                      })}
                  {(mode === "guardian" ? guardianResults : childResults).length === 0 && (
                    <li className="px-2 py-8 text-center text-sm text-muted-foreground">Sin resultados.</li>
                  )}
                </ul>
              </section>

              <section className="min-w-0">
                {mode === "guardian" ? (
                  guardian ? (
                    <GuardianChildren
                      guardian={guardian}
                      kids={childrenOf.get(guardian.id) ?? []}
                      summaries={summaries}
                      onOpen={setChildId}
                    />
                  ) : (
                    <Placeholder icon={Contact} text="Busca y elige a un padre para ver a sus hijos." />
                  )
                ) : (
                  <Placeholder icon={Baby} text="Busca y elige a un niño para abrir su seguimiento." />
                )}
              </section>
            </div>

            {selectedChild && (
              <FollowupModal
                followup={summaries.get(selectedChild.id)!}
                parents={parentsOf(selectedChild.id)}
                onClose={() => setChildId(null)}
                renderPick={(row, close) => (
                  <ControlFormModal
                    child={selectedChild}
                    service={row.service}
                    control={row.control}
                    facilities={data.facilities}
                    onClose={close}
                    onSaved={reload}
                  />
                )}
                footer={
                  <button
                    className={secondaryButtonClass}
                    onClick={() => nav.go({ name: "childControls", childId: selectedChild.id })}
                  >
                    <ClipboardCheck className="size-4" />
                    Abrir ficha de controles
                  </button>
                }
              />
            )}
          </>
        )}
      </LoadState>
    </>
  );
}

function ResultRow({
  title,
  detail,
  side,
  active,
  onClick,
}: {
  title: string;
  detail: string;
  side?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        aria-pressed={active}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${active ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-accent/60"}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{detail}</span>
        </span>
        {side}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

function Placeholder({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
      <Icon className="size-8 text-primary/60" />
      {text}
    </div>
  );
}

export function GuardianChildren({
  guardian,
  kids,
  summaries,
  onOpen,
  showGuardian = true,
}: {
  guardian: Guardian;
  kids: { child: Child; relationship: string }[];
  summaries: Map<string, Followup>;
  onOpen: (childId: string) => void;
  showGuardian?: boolean;
}) {
  return (
    <div className="grid gap-4">
      <div className={`flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-border bg-card p-5 text-sm ${showGuardian ? "" : "hidden"}`}>
        <span>
          <span className="block text-xs text-muted-foreground">Padre o apoderado</span>
          <span className="font-semibold">{guardian.full_name}</span>
        </span>
        <span>
          <span className="block text-xs text-muted-foreground">DNI</span>
          {guardian.dni}
        </span>
        <span>
          <span className="block text-xs text-muted-foreground">Celular</span>
          {guardian.phone || "—"}
        </span>
      </div>
      <h2 className="text-lg font-semibold">Hijos ({kids.length})</h2>
      {kids.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {kids.map(({ child, relationship }) => {
            const s = summaries.get(child.id)!;
            return (
              <button
                key={child.id}
                onClick={() => onOpen(child.id)}
                className="grid gap-3 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary/40 hover:bg-accent/40"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{childName(child)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatAge(s.age)} · {relationship} · {birthConditionLabels[child.birth_condition]}
                    </span>
                  </span>
                  <StatusBadge tone={toneFor(s.coverage)}>{s.coverage}%</StatusBadge>
                </span>
                <Progress value={s.coverage} tone={toneFor(s.coverage)} />
                <Counts counts={s.counts} />
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Ver seguimiento
                  <ChevronRight className="size-4" />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <Placeholder icon={Baby} text="Este padre aún no tiene hijos vinculados." />
      )}
    </div>
  );
}

function Counts({ counts }: { counts: Record<ServiceState, number> }) {
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {(["completed", "overdue", "due", "upcoming"] as const).map((k) => {
        const { label, icon: Icon, iconClass } = states[k];
        return (
          <span key={k} className="inline-flex items-center gap-1">
            <Icon className={`size-3.5 ${iconClass}`} />
            <b className="tabular-nums">{counts[k]}</b> {label.toLowerCase()}
          </span>
        );
      })}
    </span>
  );
}

/* ───────────── Modal de seguimiento del niño ───────────── */

/**
 * Seguimiento de un niño: resumen y línea de tiempo de paquetes. Al elegir una prestación,
 * `renderPick` decide qué se abre encima (registrar para el admin, solo ver para el padre).
 */
export function FollowupModal({
  followup: f,
  parents,
  onClose,
  renderPick,
  footer,
}: {
  followup: Followup;
  parents: { guardian: Pick<Guardian, "full_name">; relationship: string }[];
  onClose: () => void;
  renderPick: (row: ServiceRow, close: () => void) => React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [edit, setEdit] = useState<ServiceRow | null>(null);
  const timeline = [
    ...f.packages.filter((p) => p.phase === "current").reverse(),
    ...f.packages.filter((p) => p.phase === "past").sort((a, b) => b.pkg.max_age_days - a.pkg.max_age_days),
  ];

  return (
    <>
      <Modal
        wide
        title={childName(f.child)}
        subtitle={`${formatAge(f.age)} · Padrón ${f.child.padron_code} · ${birthConditionLabels[f.child.birth_condition]}`}
        onClose={onClose}
      >
        <div className="grid gap-5">
          <div className="grid gap-3 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                Cumplimiento: <b className="tabular-nums">{f.coverage}%</b>
                <span className="text-muted-foreground"> de lo que ya le tocaba</span>
              </span>
              {parents.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {parents.map((p) => `${p.guardian.full_name} (${p.relationship})`).join(" · ")}
                </span>
              )}
            </div>
            <Progress value={f.coverage} tone={toneFor(f.coverage)} />
            <Counts counts={f.counts} />
          </div>

          {timeline.length ? (
            <ol className="grid">
              {timeline.map((p, i) => (
                <TimelineItem
                  key={p.pkg.id}
                  row={p}
                  child={f.child}
                  first={i === 0}
                  last={i === timeline.length - 1}
                  onPick={setEdit}
                />
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no le corresponde ningún paquete.</p>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <button className={secondaryButtonClass} onClick={onClose}>
              Cerrar
            </button>
            {footer}
          </div>
        </div>
      </Modal>

      {edit && renderPick(edit, () => setEdit(null))}
    </>
  );
}

/**
 * Un paquete en la línea de tiempo (del actual hacia los anteriores): cerrado muestra solo
 * nombre y descripción; al hacer clic se despliegan sus prestaciones.
 */
function TimelineItem({
  row,
  child,
  first,
  last,
  onPick,
}: {
  row: PackageRow;
  child: Child;
  first: boolean;
  last: boolean;
  onPick: (row: ServiceRow) => void;
}) {
  const [open, setOpen] = useState(first);

  return (
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3">
      <span className="relative flex justify-center">
        <span
          className={`relative z-10 mt-2 size-3 rounded-full border-2 ${first ? "border-primary bg-primary" : "border-muted-foreground/50 bg-card"}`}
        />
        {!last && <span className="absolute bottom-0 top-2 w-px bg-border" />}
      </span>
      <div className={last ? "" : "pb-3"}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-start gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-accent/50"
        >
          <span className="min-w-0 flex-1">
            <span className={`block text-sm ${first ? "font-semibold" : "font-medium"}`}>{row.pkg.name}</span>
            {row.pkg.description && <span className="block truncate text-xs text-muted-foreground">{row.pkg.description}</span>}
          </span>
          <ChevronRight className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        {open && (
          <div className="mt-2 grid gap-3 px-2">
            {groupBy(row.services, (s) => s.service.group_name).map(([group, items]) => (
              <div key={group} className="grid gap-1.5">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">{group}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {items.map((item) => (
                    <ServiceChip key={item.service.id} item={item} child={child} onClick={() => onPick(item)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function ServiceChip({ item, child, onClick }: { item: ServiceRow; child: Child; onClick: () => void }) {
  const { label, icon: Icon, box, iconClass } = states[item.state];
  const { service, control } = item;
  const when =
    item.state === "completed"
      ? `Atendido el ${formatDate(control?.completed_date)}`
      : control?.scheduled_date
        ? `Cita ${formatDate(control.scheduled_date)}`
        : item.state === "upcoming"
          ? `Desde ${formatDate(addDays(child.birth_date, service.min_age_days))}`
          : item.state === "overdue"
            ? `Venció el ${formatDate(addDays(child.birth_date, service.max_age_days))}`
            : `Hasta ${formatDate(addDays(child.birth_date, service.max_age_days))}`;

  return (
    <button
      onClick={onClick}
      disabled={!child.active}
      title={`${label} · clic para ver el detalle`}
      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition hover:brightness-95 disabled:cursor-default ${box}`}
    >
      <Icon className={`size-4 shrink-0 ${iconClass}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{service.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {label} · {when}
        </span>
      </span>
    </button>
  );
}
