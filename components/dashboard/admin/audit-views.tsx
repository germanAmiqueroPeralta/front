"use client";

import { ChevronLeft, ChevronRight, Eye, LogOut, ShieldBan, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useBackendAction, useBackendQuery } from "@/hooks/use-backend";
import {
  loadAuditLogs,
  loadAuditUsers,
  loadSessionsPage,
  revokeSession,
  setDeviceTrusted,
} from "@/lib/actions/admin/audit";
import type { AuditAction, AuditFilters, AuditLog, Device, User, UserSession } from "@/lib/api/types";
import { inputClass, secondaryButtonClass } from "@/lib/dashboard/cred";
import { EmptyRow, FilterBar, PageTitle, PersonCell, ResetButton, StatusBadge, Table, Td, Tr } from "@/components/dashboard/shared";
import { LoadState, Pagination, usePage } from "@/components/dashboard/admin/common";
import { ReasonModal } from "@/components/dashboard/admin/security-views";
import {
  actionLabels,
  changedFields,
  describeAgent,
  formatDateTime,
  formatValue,
  revokedReasonLabels,
  summarize,
  tableLabels,
} from "@/components/dashboard/admin/audit-labels";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";

const PAGE_SIZE = 50;

function UserFilter({ users, value, onChange }: { users: User[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      Usuario
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todos</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name}
          </option>
        ))}
      </select>
    </label>
  );
}

const userName = (users: Map<string, User>, userId: string | null) =>
  userId ? (users.get(userId)?.full_name ?? "Usuario desactivado") : "Sistema / consola";

/* ───────────── Registro de cambios (audit_log) ───────────── */

type Filters = Omit<AuditFilters, "limit" | "offset">;

export function AuditLogView() {
  const [filters, setFilters] = useState<Filters>({});
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const query: AuditFilters = { ...filters, limit: PAGE_SIZE, offset };

  const people = useBackendQuery("audit-users", loadAuditUsers);
  const logs = useBackendQuery(JSON.stringify(query), () => loadAuditLogs(query));
  const users = useMemo(() => new Map(people.data?.map((u) => [u.id, u]) ?? []), [people.data]);

  const change = (patch: Filters) => {
    setFilters((f) => ({ ...f, ...patch }));
    setOffset(0);
  };
  const total = logs.data?.total ?? 0;

  return (
    <>
      <PageTitle
        kicker="Auditoría"
        title="Registro de cambios"
        subtitle="Cada creación, edición o eliminación en el sistema: quién, cuándo, desde dónde y qué cambió."
      />
      <FilterBar>
        <UserFilter users={people.data ?? []} value={filters.user_id ?? ""} onChange={(v) => change({ user_id: v || undefined })} />
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          Módulo
          <select
            className={inputClass}
            value={filters.affected_table ?? ""}
            onChange={(e) => change({ affected_table: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {Object.entries(tableLabels).map(([table, label]) => (
              <option key={table} value={table}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          Acción
          <select
            className={inputClass}
            value={filters.action ?? ""}
            onChange={(e) => change({ action: (e.target.value || undefined) as AuditAction | undefined })}
          >
            <option value="">Todas</option>
            {Object.entries(actionLabels).map(([action, { label }]) => (
              <option key={action} value={action}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          Desde
          <input type="date" className={inputClass} value={filters.date_from ?? ""} onChange={(e) => change({ date_from: e.target.value || undefined })} />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          Hasta
          <input type="date" className={inputClass} value={filters.date_to ?? ""} onChange={(e) => change({ date_to: e.target.value || undefined })} />
        </label>
        <ResetButton onClick={() => change({ user_id: undefined, affected_table: undefined, action: undefined, date_from: undefined, date_to: undefined })} />
        <p className="ml-auto self-center text-sm text-muted-foreground">{logs.loading && logs.data ? "Actualizando..." : `${total} registros`}</p>
      </FilterBar>

      <LoadState loading={logs.loading && !logs.data} error={logs.error} onRetry={logs.reload}>
        <Table head={["Fecha y hora", "Usuario", "Acción", "Módulo", "Registro", "Desde", ""]} minWidth={1000}>
          {logs.data?.items.length ? (
            logs.data.items.map((log) => (
              <Tr key={log.id}>
                <Td className="whitespace-nowrap font-mono text-xs">{formatDateTime(log.created_at)}</Td>
                <Td>{userName(users, log.user_id)}</Td>
                <Td>
                  <StatusBadge tone={actionLabels[log.action]?.tone ?? "muted"}>{actionLabels[log.action]?.label ?? log.action}</StatusBadge>
                </Td>
                <Td>{tableLabels[log.affected_table ?? ""] ?? log.affected_table}</Td>
                <Td>
                  <span className="font-medium">{summarize(log)}</span>
                </Td>
                <Td>
                  <span className="grid text-xs max-md:text-right">
                    <span>{describeAgent(log.user_agent)}</span>
                    <span className="text-muted-foreground">{log.ip_address ?? ""}</span>
                  </span>
                </Td>
                <Td>
                  <button className={`${secondaryButtonClass} h-9`} onClick={() => setDetail(log)}>
                    <Eye className="size-4" />
                    Ver
                  </button>
                </Td>
              </Tr>
            ))
          ) : (
            <EmptyRow colSpan={7}>No hay cambios registrados con estos filtros.</EmptyRow>
          )}
        </Table>
        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
            </span>
            <span className="flex gap-2">
              <button className={secondaryButtonClass} disabled={offset === 0 || logs.loading} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
                <ChevronLeft className="size-4" />
                Anteriores
              </button>
              <button
                className={secondaryButtonClass}
                disabled={offset + PAGE_SIZE >= total || logs.loading}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Siguientes
                <ChevronRight className="size-4" />
              </button>
            </span>
          </div>
        )}
      </LoadState>

      {detail && <AuditDetailModal log={detail} userLabel={userName(users, detail.user_id)} onClose={() => setDetail(null)} />}
    </>
  );
}

function AuditDetailModal({ log, userLabel, onClose }: { log: AuditLog; userLabel: string; onClose: () => void }) {
  const [showAll, setShowAll] = useState(log.action !== "UPDATE");
  const fields = changedFields(log).filter((f) => showAll || f.changed);
  const action = actionLabels[log.action] ?? { label: log.action, tone: "muted" as const };

  return (
    <Modal
      wide
      title={`${action.label} en ${tableLabels[log.affected_table ?? ""] ?? log.affected_table}`}
      subtitle={summarize(log)}
      onClose={onClose}
    >
      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-3">
        {[
          ["Fecha y hora", formatDateTime(log.created_at)],
          ["Usuario", userLabel],
          ["Navegador", describeAgent(log.user_agent)],
          ["IP", log.ip_address ?? "—"],
          ["Resultado", log.result],
          ["Registro", log.record_id ?? JSON.stringify(log.record_key)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {log.action === "UPDATE" && (
        <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="size-4 accent-(--primary)" />
          Mostrar también los campos que no cambiaron
        </label>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Campo</th>
              {log.action !== "INSERT" && <th className="px-3 py-2 font-medium">Antes</th>}
              {log.action !== "DELETE" && <th className="px-3 py-2 font-medium">Después</th>}
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.key} className={`border-b border-border/60 last:border-0 ${log.action === "UPDATE" && f.changed ? "bg-warning/10" : ""}`}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{f.key}</td>
                {log.action !== "INSERT" && (
                  <td className={`break-all px-3 py-2 ${log.action === "UPDATE" && f.changed ? "text-destructive line-through" : ""}`}>
                    {formatValue(f.before)}
                  </td>
                )}
                {log.action !== "DELETE" && (
                  <td className={`break-all px-3 py-2 ${log.action === "UPDATE" && f.changed ? "font-semibold text-success" : ""}`}>
                    {formatValue(f.after)}
                  </td>
                )}
              </tr>
            ))}
            {!fields.length && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  Sin detalle de campos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Las contraseñas y tokens nunca se guardan en la auditoría.</p>
    </Modal>
  );
}

/* ───────────── Sesiones ───────────── */

function sessionState(s: UserSession): { label: string; tone: "good" | "muted" | "warn" } {
  if (s.revoked) return { label: revokedReasonLabels[s.revoked_reason ?? ""] ?? "Cerrada", tone: "muted" };
  if (new Date(s.expires_at) < new Date()) return { label: "Vencida", tone: "warn" };
  return { label: "Activa", tone: "good" };
}

export function SessionsView() {
  const [onlyActive, setOnlyActive] = useState(true);
  const [userFilter, setUserFilter] = useState("");
  const [revoke, setRevoke] = useState<UserSession | null>(null);
  const { data, loading, error, reload } = useBackendQuery(`sessions-${onlyActive}`, () => loadSessionsPage(onlyActive));
  const run = useBackendAction();

  const users = useMemo(() => new Map(data?.users.map((u) => [u.id, u]) ?? []), [data]);
  const devices = useMemo(() => new Map(data?.devices.map((d) => [d.id, d]) ?? []), [data]);
  const rows = (data?.sessions ?? []).filter((s) => !userFilter || s.user_id === userFilter);
  const { items, pager } = usePage(rows, `${onlyActive}|${userFilter}`);
  const isCurrent = (s: UserSession) => s.id === data?.current.sessionId;

  return (
    <>
      <PageTitle
        kicker="Auditoría"
        title="Sesiones"
        subtitle="Quién tiene la sesión abierta y desde qué dispositivo. Cerrar una sesión la invalida al instante."
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        <FilterBar>
          <UserFilter users={data?.users ?? []} value={userFilter} onChange={setUserFilter} />
          <label className="flex h-10 cursor-pointer items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="size-4 accent-(--primary)" />
            Solo sesiones activas
          </label>
          <p className="ml-auto self-center text-sm text-muted-foreground">{loading ? "Actualizando..." : `${rows.length} sesiones`}</p>
        </FilterBar>
        <Table head={["Usuario", "Dispositivo", "IP", "Inicio", "Vence", "Estado", ""]} minWidth={1000}>
          {rows.length ? (
            items.map((s) => {
              const state = sessionState(s);
              return (
                <Tr key={s.id}>
                  <Td>
                    <PersonCell name={users.get(s.user_id)?.full_name ?? "Usuario desactivado"} detail={`@${users.get(s.user_id)?.username ?? "—"}`} />
                  </Td>
                  <Td>{describeAgent(devices.get(s.device_id)?.user_agent)}</Td>
                  <Td className="font-mono text-xs">{s.ip_address ?? "—"}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(s.created_at)}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(s.expires_at)}</Td>
                  <Td>
                    <span className="flex flex-wrap gap-1.5 max-md:justify-end">
                      <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                      {isCurrent(s) && <StatusBadge tone="default">Esta sesión</StatusBadge>}
                    </span>
                  </Td>
                  <Td>
                    {state.label === "Activa" && (
                      <button className={`${secondaryButtonClass} h-9 text-destructive`} onClick={() => setRevoke(s)}>
                        <LogOut className="size-4" />
                        Cerrar
                      </button>
                    )}
                  </Td>
                </Tr>
              );
            })
          ) : (
            <EmptyRow colSpan={7}>No hay sesiones {onlyActive ? "activas " : ""}con estos filtros.</EmptyRow>
          )}
        </Table>
        <Pagination pager={pager} label="sesiones" />
      </LoadState>

      {revoke && (
        <ConfirmModal
          title="Cerrar sesión"
          confirmText="Cerrar sesión"
          message={
            isCurrent(revoke) ? (
              <>
                Esta es <b>tu propia sesión</b>: al cerrarla volverás a la pantalla de ingreso.
              </>
            ) : (
              <>
                <b>{users.get(revoke.user_id)?.full_name ?? "El usuario"}</b> será desconectado de{" "}
                {describeAgent(devices.get(revoke.device_id)?.user_agent)} en su siguiente acción. Podrá volver a ingresar
                con su contraseña.
              </>
            )
          }
          onConfirm={async () => {
            const ok = await run(revokeSession(revoke.id));
            if (ok) reload();
            return ok !== null;
          }}
          onClose={() => setRevoke(null)}
        />
      )}
    </>
  );
}

/* ───────────── Dispositivos ───────────── */

export function DevicesView() {
  const [userFilter, setUserFilter] = useState("");
  const [toggle, setToggle] = useState<Device | null>(null);
  const { data, loading, error, reload } = useBackendQuery("devices", () => loadSessionsPage(true));
  const run = useBackendAction();

  const users = useMemo(() => new Map(data?.users.map((u) => [u.id, u]) ?? []), [data]);
  const activeSessions = useMemo(() => {
    const count = new Map<string, number>();
    data?.sessions.forEach((s) => count.set(s.device_id, (count.get(s.device_id) ?? 0) + 1));
    return count;
  }, [data]);
  const rows = (data?.devices ?? []).filter((d) => !userFilter || d.user_id === userFilter);
  const { items, pager } = usePage(rows, userFilter);

  return (
    <>
      <PageTitle
        kicker="Auditoría"
        title="Dispositivos"
        subtitle="Navegadores desde donde cada usuario inició sesión. Bloquear uno cierra sus sesiones y le impide volver a ingresar."
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        <FilterBar>
          <UserFilter users={data?.users ?? []} value={userFilter} onChange={setUserFilter} />
          <p className="ml-auto self-center text-sm text-muted-foreground">{rows.length} dispositivos</p>
        </FilterBar>
        <Table head={["Usuario", "Navegador", "Primera vez", "Última vez", "Sesiones activas", "Estado", ""]} minWidth={1000}>
          {rows.length ? (
            items.map((d) => {
              const current = d.id === data?.current.deviceId;
              return (
                <Tr key={d.id}>
                  <Td>
                    <PersonCell name={users.get(d.user_id)?.full_name ?? "Usuario desactivado"} detail={`@${users.get(d.user_id)?.username ?? "—"}`} />
                  </Td>
                  <Td>
                    <span className="grid max-md:text-right" title={d.user_agent ?? undefined}>
                      <span>{describeAgent(d.user_agent)}</span>
                      <span className="font-mono text-xs text-muted-foreground">#{d.browser}</span>
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(d.first_seen_at)}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(d.last_seen_at)}</Td>
                  <Td>{activeSessions.get(d.id) ?? 0}</Td>
                  <Td>
                    <span className="grid gap-1 max-md:justify-items-end">
                      <span className="flex flex-wrap gap-1.5 max-md:justify-end">
                        <StatusBadge tone={d.trusted ? "good" : "danger"}>
                          {d.trusted ? "Confiable" : d.block_scope === "browser" ? "Navegador bloqueado" : "Bloqueado"}
                        </StatusBadge>
                        {current && <StatusBadge tone="default">Este dispositivo</StatusBadge>}
                      </span>
                      {!d.trusted && d.blocked_reason && (
                        <span className="max-w-56 text-xs text-destructive" title={d.blocked_reason}>
                          {d.blocked_reason}
                          {d.blocked_at && <span className="block text-muted-foreground">{formatDateTime(d.blocked_at)}</span>}
                        </span>
                      )}
                    </span>
                  </Td>
                  <Td>
                    {d.trusted ? (
                      !current && (
                        <button className={`${secondaryButtonClass} h-9 text-destructive`} onClick={() => setToggle(d)}>
                          <ShieldBan className="size-4" />
                          Bloquear
                        </button>
                      )
                    ) : (
                      <button
                        className={`${secondaryButtonClass} h-9`}
                        onClick={async () => {
                          if (await run(setDeviceTrusted(d.id, true, undefined, d.block_scope ?? "account"))) reload();
                        }}
                      >
                        <ShieldCheck className="size-4" />
                        Desbloquear
                      </button>
                    )}
                  </Td>
                </Tr>
              );
            })
          ) : (
            <EmptyRow colSpan={7}>No hay dispositivos registrados.</EmptyRow>
          )}
        </Table>
        <Pagination pager={pager} label="dispositivos" />
      </LoadState>

      {toggle && (
        <ReasonModal
          onClose={() => setToggle(null)}
          pending={{
            title: "Bloquear dispositivo",
            confirmText: "Bloquear",
            danger: true,
            scope: true,
            defaultReason: "",
            message: (
              <>
                Se cerrarán las sesiones de <b>{users.get(toggle.user_id)?.full_name ?? "este usuario"}</b> en{" "}
                {describeAgent(toggle.user_agent)} (#{toggle.browser}) y no podrá volver a ingresar desde ahí hasta que lo
                desbloquees.
              </>
            ),
            run: async (reason, scope) => {
              const ok = await run(setDeviceTrusted(toggle.id, false, reason, scope));
              if (ok) reload();
              return ok !== null;
            },
          }}
        />
      )}
    </>
  );
}
