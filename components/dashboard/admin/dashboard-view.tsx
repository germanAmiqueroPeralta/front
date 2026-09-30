"use client";

import {
  Baby,
  CalendarClock,
  CheckCircle2,
  Contact,
  FileWarning,
  RefreshCw,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useBackendQuery } from "@/hooks/use-backend";
import { loadDashboard } from "@/lib/actions/admin/dashboard";
import { applicableServices } from "@/lib/api/cred";
import { childName, claimStatusLabels, type Child, type ClaimStatus } from "@/lib/api/types";
import { secondaryButtonClass, type Tone } from "@/lib/dashboard/cred";
import { addDays, ageDays, formatAge, formatDate, todayISO } from "@/lib/sisnat/dates";
import { PageTitle, StatusBadge, toneFor } from "@/components/dashboard/shared";
import { LoadState } from "@/components/dashboard/admin/common";
import { tableLabels } from "@/components/dashboard/admin/audit-labels";
import type { Nav } from "@/components/dashboard/views/packages-view";

type Data = NonNullable<ReturnType<typeof useDashboard>["data"]>;

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const claimTone: Record<ClaimStatus, Tone> = { pending: "warn", in_review: "default", resolved: "good", rejected: "danger" };

const pct = (done: number, due: number) => (due ? Math.round((done / due) * 100) : 0);

function useDashboard() {
  return useBackendQuery("dashboard", loadDashboard);
}

/** Todas las cifras del panel, calculadas una vez a partir de lo que devuelve el backend. */
function summarize(data: Data) {
  const today = todayISO();
  const completed = new Map<string, Set<string>>();
  for (const c of data.controls) {
    if (c.status !== "completed") continue;
    if (!completed.has(c.child_id)) completed.set(c.child_id, new Set());
    completed.get(c.child_id)!.add(c.service_id);
  }

  const facilityById = new Map(data.facilities.map((f) => [f.id, f]));
  const byRegion = new Map<string, { done: number; due: number; children: number }>();
  const byPackage = new Map<string, { done: number; due: number }>();
  const overdue: { child: Child; count: number; due: number }[] = [];
  let done = 0;
  let due = 0;

  for (const child of data.children) {
    const age = ageDays(child.birth_date, today);
    const got = completed.get(child.id) ?? new Set<string>();
    const regionId = facilityById.get(child.health_facility_id)?.region_id ?? "";
    const region = byRegion.get(regionId) ?? { done: 0, due: 0, children: 0 };
    region.children++;
    let late = 0;
    let childDue = 0;

    for (const s of applicableServices(child, data.packages, data.services)) {
      if (age < s.min_age_days) continue;
      const ok = got.has(s.id);
      const pkg = byPackage.get(s.package_id) ?? { done: 0, due: 0 };
      pkg.due++;
      region.due++;
      childDue++;
      due++;
      if (ok) {
        pkg.done++;
        region.done++;
        done++;
      } else if (age > s.max_age_days) {
        late++;
      }
      byPackage.set(s.package_id, pkg);
    }
    byRegion.set(regionId, region);
    if (late) overdue.push({ child, count: late, due: childDue });
  }

  const regionName = new Map(data.regions.map((r) => [r.id, r.name]));
  const regions = [...byRegion.entries()]
    .map(([id, v]) => ({ label: regionName.get(id) ?? "Sin micro red", ...v, value: pct(v.done, v.due) }))
    .sort((a, b) => b.value - a.value);
  const packages = data.packages
    .filter((p) => byPackage.has(p.id))
    .map((p) => ({ label: p.name, ...byPackage.get(p.id)!, value: pct(byPackage.get(p.id)!.done, byPackage.get(p.id)!.due) }))
    .sort((a, b) => b.value - a.value);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - (11 - i));
    return { key: d.toISOString().slice(0, 7), label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, value: 0 };
  });
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  for (const c of data.controls) {
    const i = c.completed_date ? monthIndex.get(c.completed_date.slice(0, 7)) : undefined;
    if (i !== undefined) months[i].value++;
  }

  const inWeek = addDays(today, 7);
  const childById = new Map(data.children.map((c) => [c.id, c]));
  const serviceById = new Map(data.services.map((s) => [s.id, s]));
  const upcoming = data.controls
    .filter((c) => c.status !== "completed" && c.scheduled_date && c.scheduled_date >= today && childById.has(c.child_id))
    .sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!));

  const claims = (Object.keys(claimStatusLabels) as ClaimStatus[]).map((status) => ({
    status,
    count: data.claims.filter((c) => c.status === status).length,
  }));

  return {
    done,
    due,
    coverage: pct(done, due),
    newborns: data.children.filter((c) => ageDays(c.birth_date, today) <= 28).length,
    atRisk: data.children.filter((c) => c.birth_condition !== "none").length,
    withAccount: data.guardians.filter((g) => g.user_id).length,
    thisWeek: upcoming.filter((c) => c.scheduled_date! <= inWeek).length,
    upcoming: upcoming.slice(0, 6).map((c) => ({ control: c, child: childById.get(c.child_id)!, service: serviceById.get(c.service_id) })),
    overdue: overdue.sort((a, b) => b.count - a.count).slice(0, 6),
    regions,
    packages,
    months,
    claims,
    activeUsers: data.users.filter((u) => u.active && !u.blocked).length,
  };
}

export function AdminDashboardView({ nav }: { nav: Nav }) {
  const { data, loading, error, reload } = useDashboard();
  const stats = useMemo(() => (data ? summarize(data) : null), [data]);
  const userById = useMemo(() => new Map(data?.users.map((u) => [u.id, u]) ?? []), [data]);
  const childById = useMemo(() => new Map(data?.children.map((c) => [c.id, c]) ?? []), [data]);

  return (
    <>
      <PageTitle
        kicker="Administración"
        title="Panel general"
        subtitle={`Situación de la Red de Salud Huamanga al ${formatDate(todayISO())}.`}
        action={
          <button className={secondaryButtonClass} onClick={reload} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        }
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        {data && stats && (
          <div className="grid gap-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <CoverageTile coverage={stats.coverage} done={stats.done} due={stats.due} onClick={() => nav.go({ name: "controls" })} />
              <StatTile
                icon={Baby}
                label="Niños en el padrón"
                value={data.children.length}
                detail={`${stats.newborns} recién nacidos · ${stats.atRisk} en riesgo al nacer`}
                onClick={() => nav.go({ name: "children" })}
              />
              <StatTile
                icon={Contact}
                label="Padres y apoderados"
                value={data.guardians.length}
                detail={`${stats.withAccount} con cuenta en el portal familiar`}
                onClick={() => nav.go({ name: "guardians" })}
              />
              <StatTile
                icon={CalendarClock}
                label="Citas en los próximos 7 días"
                value={stats.thisWeek}
                detail={`${stats.upcoming.length ? `Próxima: ${formatDate(stats.upcoming[0].control.scheduled_date)}` : "Sin citas programadas"}`}
                onClick={() => nav.go({ name: "controls" })}
              />
              <StatTile
                icon={FileWarning}
                label="Reclamos por atender"
                value={stats.claims.find((c) => c.status === "pending")!.count}
                detail={`${stats.claims.find((c) => c.status === "in_review")!.count} en revisión`}
                onClick={() => nav.go({ name: "claims" })}
              />
              <StatTile
                icon={ShieldAlert}
                label="Alertas de riesgo"
                value={data.alerts.length}
                detail={`${data.sessions.length} sesiones activas · ${stats.activeUsers} usuarios habilitados`}
                onClick={() => nav.go({ name: "alerts" })}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card title="Cumplimiento por micro red" subtitle="Prestaciones cumplidas de las que ya le tocaban a cada niño">
                <BarList rows={stats.regions} empty="Aún no hay niños con prestaciones." />
              </Card>
              <Card title="Cumplimiento por paquete" subtitle="Mismo cálculo, separado por paquete de atención">
                <BarList rows={stats.packages} empty="Aún no hay paquetes con prestaciones vencidas o vigentes." />
              </Card>
            </section>

            <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Card title="Atenciones registradas por mes" subtitle="Controles cumplidos según su fecha de atención, últimos 12 meses">
                <MonthChart months={stats.months} />
              </Card>
              <Card title="Reclamos por estado" subtitle={`${data.claims.length} reclamos en total`} action={() => nav.go({ name: "claims" })}>
                <ul className="grid gap-4">
                  {stats.claims.map(({ status, count }) => (
                    <li key={status} className="grid gap-1.5">
                      <span className="flex items-center justify-between text-sm">
                        <StatusBadge tone={claimTone[status]}>{claimStatusLabels[status]}</StatusBadge>
                        <span className="font-semibold tabular-nums">{count}</span>
                      </span>
                      <Meter value={pct(count, data.claims.length)} />
                    </li>
                  ))}
                </ul>
              </Card>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card title="Próximas citas" subtitle="Controles pendientes con fecha programada" action={() => nav.go({ name: "controls" })}>
                <List empty="No hay citas programadas.">
                  {stats.upcoming.map(({ control, child, service }) => (
                    <ListRow
                      key={control.id}
                      onClick={() => nav.go({ name: "childControls", childId: child.id })}
                      title={childName(child)}
                      detail={service?.name ?? "Prestación"}
                      side={formatDate(control.scheduled_date)}
                    />
                  ))}
                </List>
              </Card>
              <Card title="Niños con prestaciones vencidas" subtitle="Pasó la edad límite sin registrar la atención">
                <List empty="Ningún niño tiene prestaciones vencidas.">
                  {stats.overdue.map(({ child, count, due }) => (
                    <ListRow
                      key={child.id}
                      onClick={() => nav.go({ name: "childControls", childId: child.id })}
                      title={childName(child)}
                      detail={`${formatAge(ageDays(child.birth_date))} · ${complianceLabel(pct(due - count, due))}`}
                      side={<StatusBadge tone="danger">{count} vencidas</StatusBadge>}
                    />
                  ))}
                </List>
              </Card>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card title="Reclamos recientes" action={() => nav.go({ name: "claims" })}>
                <List empty="Aún no hay reclamos.">
                  {data.claims.slice(0, 5).map((c) => {
                    const child = childById.get(c.child_id);
                    return (
                      <ListRow
                        key={c.id}
                        onClick={() => nav.go({ name: "adminClaim", claimId: c.id })}
                        title={child ? childName(child) : c.child_identifier}
                        detail={c.message}
                        side={<StatusBadge tone={claimTone[c.status]}>{claimStatusLabels[c.status]}</StatusBadge>}
                      />
                    );
                  })}
                </List>
              </Card>
              <Card title="Últimos cambios" action={() => nav.go({ name: "audit" })}>
                <List empty="Aún no hay cambios registrados.">
                  {data.changes.map((log) => (
                    <ListRow
                      key={log.id}
                      onClick={() => nav.go({ name: "audit" })}
                      title={`${{ INSERT: "Creó", UPDATE: "Editó", DELETE: "Eliminó" }[log.action]} en ${tableLabels[log.affected_table ?? ""] ?? log.affected_table}`}
                      detail={log.user_id ? (userById.get(log.user_id)?.full_name ?? "Usuario") : "Sistema"}
                      side={<span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>}
                    />
                  ))}
                </List>
              </Card>
            </section>
          </div>
        )}
      </LoadState>
    </>
  );
}

const complianceLabel = (value: number) => `${value}% cumplido`;

/* ───────────── Piezas del panel ───────────── */

function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && (
          <button className="shrink-0 text-sm font-semibold text-primary hover:underline" onClick={action}>
            Ver todo
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  detail,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary/40 hover:bg-accent/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-muted-foreground">{label}</span>
        <span className="block text-3xl font-bold tabular-nums tracking-tight">{value.toLocaleString("es-PE")}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}

function CoverageTile({ coverage, done, due, onClick }: { coverage: number; done: number; due: number; onClick: () => void }) {
  const tone = toneFor(coverage);
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary/40 hover:bg-accent/40"
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-primary" />
        Cumplimiento CRED
      </span>
      <span className="flex items-baseline gap-2">
        <span className="text-5xl font-bold tabular-nums tracking-tight">{coverage}%</span>
        <StatusBadge tone={tone}>{tone === "good" ? "Adecuado" : tone === "warn" ? "En proceso" : "Bajo"}</StatusBadge>
      </span>
      <Meter value={coverage} />
      <span className="text-xs text-muted-foreground">
        {done.toLocaleString("es-PE")} de {due.toLocaleString("es-PE")} prestaciones que ya les tocaban
      </span>
    </button>
  );
}

function Meter({ value }: { value: number }) {
  return (
    <span className="block h-2 rounded-full bg-primary/15" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, value)}%` }} />
    </span>
  );
}

/** Barras horizontales de un solo color (magnitud); el valor va escrito y el detalle aparece al pasar el mouse. */
function BarList({ rows, empty }: { rows: { label: string; value: number; done: number; due: number }[]; empty: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={r.label} className="group relative grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-3 text-sm">
          <span className="truncate" title={r.label}>
            {r.label}
          </span>
          <span className="h-3 rounded-full bg-primary/10">
            <span
              className="block h-3 rounded-full bg-primary transition-opacity group-hover:opacity-80"
              style={{ width: `${Math.max(r.value, 1)}%` }}
            />
          </span>
          <span className="text-right font-semibold tabular-nums">{r.value}%</span>
          <Tooltip>
            <b>{r.label}</b>: {r.done} de {r.due} prestaciones ({r.value}%)
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}

function MonthChart({ months }: { months: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...months.map((m) => m.value));
  const peak = months.reduce((a, b) => (b.value > a.value ? b : a), months[0]);
  const total = months.reduce((n, m) => n + m.value, 0);
  if (!total) return <p className="py-6 text-center text-sm text-muted-foreground">No hay atenciones en los últimos 12 meses.</p>;
  return (
    <div>
      <div className="flex h-44 items-end gap-1.5 border-b border-border sm:gap-2" role="img" aria-label={`Atenciones por mes, ${total} en total`}>
        {months.map((m) => (
          <div key={m.key} className="group relative flex h-full flex-1 flex-col items-center justify-end">
            {(m === peak || m === months[months.length - 1]) && m.value > 0 && (
              <span className="mb-1 text-xs font-semibold tabular-nums text-muted-foreground">{m.value}</span>
            )}
            <span
              className="w-full max-w-10 rounded-t bg-primary transition-opacity group-hover:opacity-80"
              style={{ height: `${(m.value / max) * 100}%`, minHeight: m.value ? 4 : 0 }}
            />
            <Tooltip>
              <b>{m.label}</b>: {m.value} atenciones
            </Tooltip>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 sm:gap-2">
        {months.map((m, i) => (
          <span key={m.key} className={`flex-1 text-center text-[10px] text-muted-foreground ${i % 2 ? "max-sm:invisible" : ""}`}>
            {m.label.split(" ")[0]}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{total.toLocaleString("es-PE")} atenciones en el periodo</p>
    </div>
  );
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg group-hover:block"
    >
      {children}
    </span>
  );
}

function List({ empty, children }: { empty: string; children: React.ReactNode[] }) {
  if (!children.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return <ul className="-mx-2 grid grid-cols-[minmax(0,1fr)]">{children}</ul>;
}

function ListRow({
  title,
  detail,
  side,
  onClick,
}: {
  title: string;
  detail: string;
  side: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-accent/60">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{detail}</span>
        </span>
        <span className="shrink-0 text-sm">{side}</span>
      </button>
    </li>
  );
}
