"use client";

import { Ban, CheckCircle2, MonitorSmartphone, RefreshCw, ShieldAlert, ShieldCheck, UserX, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useBackendAction, useBackendQuery } from "@/hooks/use-backend";
import { closeAlert, loadAlerts, scanAlerts, setDeviceTrusted, setUserBlocked } from "@/lib/actions/admin/audit";
import type { AlertStatus, ApiResult, BlockScope, Device, SecurityAlert, User } from "@/lib/api/types";
import { buttonClass, secondaryButtonClass } from "@/lib/dashboard/cred";
import { PageTitle, StatusBadge } from "@/components/dashboard/shared";
import { labelClass, submitWith, textareaClass } from "@/components/dashboard/forms";
import { LoadState, Pagination, usePage } from "@/components/dashboard/admin/common";
import { describeAgent, formatDateTime } from "@/components/dashboard/admin/audit-labels";
import { Modal } from "@/components/ui/modal";

const statusTabs: { value: AlertStatus; label: string }[] = [
  { value: "open", label: "Abiertas" },
  { value: "resolved", label: "Resueltas" },
  { value: "dismissed", label: "Descartadas" },
];

/** Una acción que pide motivo antes de ejecutarse (bloquear, descartar, resolver). */
type Pending = {
  title: string;
  message: React.ReactNode;
  confirmText: string;
  defaultReason: string;
  danger?: boolean;
  scope?: boolean;
  run: (reason: string, scope: BlockScope) => Promise<boolean>;
};

export function AlertsView() {
  const [status, setStatus] = useState<AlertStatus>("open");
  const { data, loading, error, reload } = useBackendQuery(`alerts-${status}`, () => loadAlerts(status));
  const run = useBackendAction();
  const [scanning, setScanning] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const users = useMemo(() => new Map(data?.users.map((u) => [u.id, u]) ?? []), [data]);
  const devices = useMemo(() => new Map(data?.devices.map((d) => [d.id, d]) ?? []), [data]);
  const { items, pager } = usePage(data?.alerts ?? [], status);

  async function scan() {
    setScanning(true);
    const result = await run(scanAlerts());
    setScanning(false);
    if (result) reload();
  }

  /** Ejecuta la acción y, si corresponde, deja la alerta resuelta con lo que se hizo y por qué. */
  function act(
    alert: SecurityAlert | null,
    label: string,
    action: (reason: string, scope: BlockScope) => Promise<ApiResult<unknown>>,
  ) {
    return async (reason: string, scope: BlockScope) => {
      const done = await run(action(reason, scope));
      if (done === null) return false;
      if (alert) await run(closeAlert(alert.id, "resolved", `${label}. Motivo: ${reason}`), "Alerta resuelta");
      reload();
      return true;
    };
  }

  const blockUser = (alert: SecurityAlert | null, user: { id: string; name: string }) =>
    setPending({
      title: "Bloquear cuenta",
      message: (
        <>
          <b>{user.name}</b> no podrá iniciar sesión y se cerrarán todas sus sesiones abiertas.
        </>
      ),
      confirmText: "Bloquear cuenta",
      defaultReason: "Posible riesgo: actividad inusual en la cuenta",
      danger: true,
      run: act(alert, `Cuenta de ${user.name} bloqueada`, (reason) => setUserBlocked(user.id, true, reason)),
    });

  const blockDevice = (alert: SecurityAlert | null, device: { id: string; label: string }, browserWide: boolean) =>
    setPending({
      title: browserWide ? "Bloquear navegador" : "Bloquear dispositivo",
      message: browserWide ? (
        <>
          Nadie podrá iniciar sesión desde <b>{device.label}</b>, con ninguna cuenta. Se cierran todas sus sesiones.
        </>
      ) : (
        <>
          Esta cuenta no podrá volver a entrar desde <b>{device.label}</b>. Se cierran sus sesiones en ese navegador.
        </>
      ),
      confirmText: "Bloquear",
      defaultReason: browserWide ? "Posible riesgo: varias cuentas en el mismo navegador" : "Posible riesgo: dispositivo no reconocido",
      danger: true,
      run: act(alert, browserWide ? `Navegador ${device.label} bloqueado para todas las cuentas` : `Dispositivo ${device.label} bloqueado`, (reason) =>
        setDeviceTrusted(device.id, false, reason, browserWide ? "browser" : "account"),
      ),
    });

  const close = (alert: SecurityAlert, next: "resolved" | "dismissed") =>
    setPending({
      title: next === "dismissed" ? "Descartar alerta" : "Marcar como resuelta",
      message:
        next === "dismissed"
          ? "La alerta se archiva. Si el caso crece (más cuentas o más dispositivos) volverá a aparecer."
          : "Anota qué se hizo, queda en el historial.",
      confirmText: next === "dismissed" ? "Descartar" : "Resolver",
      defaultReason: next === "dismissed" ? "Uso normal: computadora compartida del establecimiento" : "",
      run: async (reason) => {
        const ok = await run(closeAlert(alert.id, next, reason));
        if (ok) reload();
        return ok !== null;
      },
    });

  return (
    <>
      <PageTitle
        kicker="Seguridad"
        title="Alertas de riesgo"
        subtitle="Se crean solas al iniciar sesión: un navegador usado por 3 o más cuentas, o una cuenta que entra desde 3 o más dispositivos (últimos 30 días)."
        action={
          <button className={secondaryButtonClass} onClick={scan} disabled={scanning}>
            <RefreshCw className={`size-4 ${scanning ? "animate-spin" : ""}`} />
            Revisar ahora
          </button>
        }
      />
      <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1" role="tablist">
        {statusTabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={status === t.value}
            onClick={() => setStatus(t.value)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${status === t.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        {items.length ? (
          <div className="grid gap-4">
            {items.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                users={users}
                devices={devices}
                onBlockUser={(u) => blockUser(alert, u)}
                onBlockDevice={(d, wide) => blockDevice(alert, d, wide)}
                onUnblockUser={async (u) => {
                  if (await run(setUserBlocked(u, false), "Cuenta desbloqueada")) reload();
                }}
                onUnblockDevice={async (d, wide) => {
                  if (await run(setDeviceTrusted(d, true, undefined, wide ? "browser" : "account"))) reload();
                }}
                onClose={(next) => close(alert, next)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            <ShieldCheck className="size-8 text-success" />
            {status === "open" ? "No hay alertas abiertas. Todo en orden." : "No hay alertas en esta lista."}
          </div>
        )}
        <Pagination pager={pager} label="alertas" />
      </LoadState>

      {pending && <ReasonModal pending={pending} onClose={() => setPending(null)} />}
    </>
  );
}

function AlertCard({
  alert,
  users,
  devices,
  onBlockUser,
  onBlockDevice,
  onUnblockUser,
  onUnblockDevice,
  onClose,
}: {
  alert: SecurityAlert;
  users: Map<string, User>;
  devices: Map<string, Device>;
  onBlockUser: (user: { id: string; name: string }) => void;
  onBlockDevice: (device: { id: string; label: string }, browserWide: boolean) => void;
  onUnblockUser: (userId: string) => void;
  onUnblockDevice: (deviceId: string, browserWide: boolean) => void;
  onClose: (next: "resolved" | "dismissed") => void;
}) {
  const open = alert.status === "open";
  const shared = alert.kind === "shared_device";
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? Infinity : 5;
  const firstDevice = shared ? devices.get(alert.detail.items[0]?.device_id) : undefined;
  const browserLabel = shared ? `${describeAgent(alert.detail.items[0]?.user_agent ?? null)} #${alert.browser}` : "";
  const browserBlocked = firstDevice?.block_scope === "browser" && !firstDevice.trusted;
  const account = !shared && alert.user_id ? users.get(alert.user_id) : undefined;

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-start gap-3 border-b border-border p-5">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${open ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
        >
          {shared ? <Users className="size-5" /> : <MonitorSmartphone className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">
            {shared
              ? `Un mismo navegador usado por ${alert.detail.total} cuentas`
              : `${alert.detail.full_name} entró desde ${alert.detail.total} dispositivos`}
          </h2>
          <p className="text-xs text-muted-foreground">
            {shared ? browserLabel : `@${alert.detail.username}`} · detectada {formatDateTime(alert.created_at)}
            {alert.updated_at !== alert.created_at && ` · actualizada ${formatDateTime(alert.updated_at)}`}
          </p>
        </div>
        <StatusBadge tone={open ? "danger" : alert.status === "resolved" ? "good" : "muted"}>
          {open ? "Posible riesgo" : alert.status === "resolved" ? "Resuelta" : "Descartada"}
        </StatusBadge>
      </header>

      <ul className="divide-y divide-border/60">
        {shared
          ? alert.detail.items.slice(0, limit).map((item) => {
              const user = users.get(item.user_id);
              const blocked = user?.blocked ?? false;
              return (
                <Row
                  key={item.device_id}
                  title={item.full_name}
                  detail={`@${item.username} · último ingreso ${formatDateTime(item.last_seen_at)}`}
                  badge={blocked ? <StatusBadge tone="danger">Cuenta bloqueada</StatusBadge> : null}
                  reason={blocked ? user?.blocked_reason : null}
                  action={
                    blocked ? (
                      <SmallButton icon={ShieldCheck} onClick={() => onUnblockUser(item.user_id)}>
                        Desbloquear
                      </SmallButton>
                    ) : (
                      <SmallButton icon={UserX} danger onClick={() => onBlockUser({ id: item.user_id, name: item.full_name })}>
                        Bloquear cuenta
                      </SmallButton>
                    )
                  }
                />
              );
            })
          : alert.detail.items.slice(0, limit).map((item) => {
              const device = devices.get(item.device_id);
              const blocked = device ? !device.trusted : false;
              const label = `${describeAgent(item.user_agent)} #${item.browser}`;
              return (
                <Row
                  key={item.device_id}
                  title={label}
                  detail={`Último ingreso ${formatDateTime(item.last_seen_at)}`}
                  badge={blocked ? <StatusBadge tone="danger">Bloqueado</StatusBadge> : null}
                  reason={blocked ? device?.blocked_reason : null}
                  action={
                    blocked ? (
                      <SmallButton icon={ShieldCheck} onClick={() => onUnblockDevice(item.device_id, device?.block_scope === "browser")}>
                        Desbloquear
                      </SmallButton>
                    ) : (
                      <SmallButton icon={Ban} danger onClick={() => onBlockDevice({ id: item.device_id, label }, false)}>
                        Bloquear dispositivo
                      </SmallButton>
                    )
                  }
                />
              );
            })}
        {alert.detail.items.length > 5 && (
          <li className="px-5 py-2">
            <button className="text-sm font-semibold text-primary hover:underline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Ver menos" : `Ver todos (${alert.detail.items.length})`}
            </button>
          </li>
        )}
      </ul>

      <footer className="flex flex-wrap items-center gap-2 border-t border-border p-4">
        {open ? (
          <>
            {shared && firstDevice && !browserBlocked && (
              <button className={`${buttonClass} bg-destructive!`} onClick={() => onBlockDevice({ id: firstDevice.id, label: browserLabel }, true)}>
                <Ban className="size-4" />
                Bloquear este navegador
              </button>
            )}
            {!shared && account && !account.blocked && (
              <button className={`${buttonClass} bg-destructive!`} onClick={() => onBlockUser({ id: account.id, name: account.full_name })}>
                <UserX className="size-4" />
                Bloquear la cuenta
              </button>
            )}
            {shared && browserBlocked && firstDevice && (
              <SmallButton icon={ShieldCheck} onClick={() => onUnblockDevice(firstDevice.id, true)}>
                Desbloquear navegador
              </SmallButton>
            )}
            {!shared && account?.blocked && (
              <SmallButton icon={ShieldCheck} onClick={() => onUnblockUser(account.id)}>
                Desbloquear cuenta
              </SmallButton>
            )}
            <span className="ml-auto flex gap-2">
              <button className={secondaryButtonClass} onClick={() => onClose("resolved")}>
                <CheckCircle2 className="size-4" />
                Marcar resuelta
              </button>
              <button className={secondaryButtonClass} onClick={() => onClose("dismissed")}>
                Descartar
              </button>
            </span>
          </>
        ) : (
          <p className="text-sm">
            <span className="text-muted-foreground">
              {alert.status === "resolved" ? "Resuelta" : "Descartada"} por {users.get(alert.resolved_by ?? "")?.full_name ?? "—"} el{" "}
              {formatDateTime(alert.resolved_at)}:
            </span>{" "}
            {alert.resolution}
          </p>
        )}
      </footer>
    </section>
  );
}

function Row({
  title,
  detail,
  badge,
  reason,
  action,
}: {
  title: string;
  detail: string;
  badge: React.ReactNode;
  reason?: string | null;
  action: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {title} {badge}
        </span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
        {reason && <span className="block text-xs text-destructive">Motivo: {reason}</span>}
      </span>
      {action}
    </li>
  );
}

function SmallButton({
  icon: Icon,
  danger,
  onClick,
  children,
}: {
  icon: typeof Ban;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className={`${secondaryButtonClass} h-9 ${danger ? "text-destructive" : ""}`} onClick={onClick}>
      <Icon className="size-4" />
      {children}
    </button>
  );
}

/** Pide el motivo (y, al bloquear un dispositivo, el alcance) antes de ejecutar la acción. */
export function ReasonModal({ pending, onClose }: { pending: Pending; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<BlockScope>("account");

  async function submit(form: FormData) {
    setBusy(true);
    const ok = await pending.run(String(form.get("reason") ?? "").trim(), scope);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={pending.title} subtitle="Queda registrado quién lo hizo, cuándo y por qué" onClose={onClose}>
      <form onSubmit={submitWith(submit)} className="grid gap-4 text-sm">
        <div className={`flex gap-3 rounded-lg border p-4 ${pending.danger ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"}`}>
          <ShieldAlert className={`mt-0.5 size-5 shrink-0 ${pending.danger ? "text-destructive" : "text-primary"}`} />
          <div>{pending.message}</div>
        </div>
        {pending.scope && (
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 font-medium">Alcance</legend>
            {(
              [
                ["account", "Solo esta cuenta en este navegador"],
                ["browser", "Todo el navegador: ninguna cuenta podrá entrar desde él"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="scope" checked={scope === value} onChange={() => setScope(value)} className="size-4 accent-(--primary)" />
                {label}
              </label>
            ))}
          </fieldset>
        )}
        <label className={labelClass}>
          <span>
            Motivo<span className="text-destructive"> *</span>
          </span>
          <textarea name="reason" rows={3} required defaultValue={pending.defaultReason} className={textareaClass} />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={secondaryButtonClass} onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className={`${buttonClass} ${pending.danger ? "bg-destructive!" : ""}`} disabled={busy}>
            {busy ? "Procesando..." : pending.confirmText}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export type { Pending as ReasonAction };
