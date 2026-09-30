"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileWarning,
  MapPin,
  Phone,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { buttonClass, linkButtonClass, secondaryButtonClass } from "@/lib/dashboard/cred";
import { addDays, ageDays, formatAge, formatDate } from "@/lib/sisnat/dates";
import { fichaNino, moduloDe, padresDe, paqueteActual, paquetesDelNino, proximasDelPaquete, type ItemFicha, type PaqueteNino } from "@/lib/sisnat/logic";
import type { Nino } from "@/lib/sisnat/types";
import { Card } from "@/components/dashboard/card";
import { PackageCard } from "@/components/dashboard/package-card";
import { PageTitle, Progress, StatusBadge, toneFor } from "@/components/dashboard/shared";
import { ClaimModal } from "@/components/dashboard/modals/claim-modal";
import type { Nav } from "@/components/dashboard/views/packages-view";

const initials = (nombre: string) =>
  nombre
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("");

function Avatar({ nino, size = "md" }: { nino: Nino; size?: "md" | "lg" }) {
  const tone = nino.sexo === "F" ? "bg-pink-500/15 text-pink-600 dark:text-pink-300" : "bg-sky-500/15 text-sky-600 dark:text-sky-300";
  const dims = size === "lg" ? "size-16 text-xl" : "size-11 text-sm";
  return <span className={`flex shrink-0 items-center justify-center rounded-full font-bold ${tone} ${dims}`}>{initials(nino.nombre)}</span>;
}

/** Anillo de avance del cumplimiento general. */
function Ring({ value, size = 88, label = "al día" }: { value: number; size?: number; label?: string }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const color = value >= 80 ? "text-success" : value >= 50 ? "text-warning" : "text-destructive";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={8} className="fill-none stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className={`fill-none stroke-current transition-all ${color}`}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <strong className="text-lg leading-none">{value}%</strong>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function resumen(items: ItemFicha[]) {
  const cumplidas = items.filter((i) => i.estado === "CUMPLIDO").length;
  return {
    cumplidas,
    pendientes: items.filter((i) => i.estado === "PENDIENTE"),
    vencidas: items.filter((i) => i.estado === "VENCIDO"),
    pct: items.length ? Math.round((cumplidas * 100) / items.length) : 0,
  };
}

/** Hijos vinculados al apoderado, con el hijo seleccionado compartido entre vistas. */
function useHijos() {
  const { db, alcance, hijoId, setHijoId } = useSisnat();
  const hijos = useMemo(() => db.ninos.filter((n) => alcance.ninoIds?.includes(n.id)), [db, alcance.ninoIds]);
  const nino = hijos.find((n) => n.id === hijoId) ?? hijos[0];
  return { hijos, nino, setHijoId };
}

function NoChildren({ title }: { title: string }) {
  return (
    <>
      <PageTitle kicker="Portal familiar" title={title} />
      <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
        No tiene hijos vinculados todavía. Acérquese a su establecimiento de salud para registrarlos.
      </div>
    </>
  );
}

function ChildSelector({ hijos, selectedId, onSelect }: { hijos: Nino[]; selectedId: number; onSelect: (id: number) => void }) {
  const { db } = useSisnat();
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {hijos.map((h) => {
        const active = h.id === selectedId;
        const actual = paqueteActual(db, h);
        const faltan = actual ? fichaNino(db, h, actual.codigo).filter((i) => i.estado !== "CUMPLIDO").length : 0;
        return (
          <button
            key={h.id}
            onClick={() => onSelect(h.id)}
            aria-pressed={active}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${active ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card hover:border-primary/40"}`}
          >
            <Avatar nino={h} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{h.nombre.split(" ").slice(0, 2).join(" ")}</p>
              <p className="text-xs text-muted-foreground">{formatAge(ageDays(h.fechaNacimiento))}</p>
              {actual && (
                <p className="mt-1 truncate text-xs">
                  <span className="font-medium text-primary">{actual.nombre}</span>
                  <span className={faltan ? "text-warning" : "text-success"}> · {faltan ? `le faltan ${faltan}` : "completo"}</span>
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Portada del apoderado: un cuadro por hijo con su paquete actual, lo cumplido y lo que falta. */
export function MyChildrenView({ nav }: { nav: Nav }) {
  const { session } = useSisnat();
  const { hijos, setHijoId } = useHijos();
  if (!hijos.length) return <NoChildren title="Mis hijos" />;

  return (
    <>
      <PageTitle kicker="Portal familiar"
        title={`Hola, ${session.name.split(" ")[0]}`}
        subtitle="Toca a tu hijo para ver todos sus paquetes."
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {hijos.map((h) => (
          <ChildCard
            key={h.id}
            nino={h}
            onOpen={() => {
              setHijoId(h.id);
              nav.go({ name: "guardianChild", childId: h.id });
            }}
          />
        ))}
      </div>
    </>
  );
}

const MAX_FALTAN = 4;

function ChildCard({ nino, onOpen }: { nino: Nino; onOpen: () => void }) {
  const { db } = useSisnat();
  const actual = paqueteActual(db, nino);
  const items = useMemo(() => (actual ? fichaNino(db, nino, actual.codigo) : []), [db, nino, actual]);
  const proximas = actual ? proximasDelPaquete(db, nino, actual.codigo) : [];
  const hechas = items.filter((i) => i.estado === "CUMPLIDO").length;
  const total = items.length + proximas.length;
  const faltan = items
    .filter((i) => i.estado !== "CUMPLIDO")
    .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === "VENCIDO" ? -1 : 1));
  const pct = total ? Math.round((hechas * 100) / total) : 0;

  return (
    <button
      onClick={onOpen}
      className="group flex flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <Avatar nino={nino} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{nino.nombre.split(" ").slice(0, 2).join(" ")}</p>
          <p className="text-xs text-muted-foreground">{formatAge(ageDays(nino.fechaNacimiento))}</p>
        </div>
        <ChevronRight className="size-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      {actual ? (
        <>
          <div className="mt-5 rounded-xl bg-primary/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Paquete actual</p>
            <p className="font-semibold">{actual.nombre}</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-sm">
                <span className="text-2xl font-bold">{hechas}</span>
                <span className="text-muted-foreground"> de {total} cumplidas</span>
              </p>
              <span className="text-sm font-semibold">{pct}%</span>
            </div>
            <div className="mt-2">
              <Progress value={pct} tone={toneFor(pct)} />
            </div>
          </div>

          <div className="mt-4 flex-1">
            {faltan.length ? (
              <>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Le falta:</p>
                <ul className="grid grid-cols-1 gap-1.5">
                  {faltan.slice(0, MAX_FALTAN).map((i) => (
                    <li key={i.prestacion.id} className="flex items-center gap-2 text-sm">
                      <span className={`size-2 shrink-0 rounded-full ${i.estado === "VENCIDO" ? "bg-destructive" : "bg-warning"}`} />
                      <span className="truncate">{i.prestacion.nombre}</span>
                      {i.estado === "VENCIDO" && <span className="ml-auto shrink-0 text-[11px] font-semibold text-destructive">Vencida</span>}
                    </li>
                  ))}
                </ul>
                {faltan.length > MAX_FALTAN && (
                  <p className="mt-1.5 text-xs text-muted-foreground">y {faltan.length - MAX_FALTAN} más…</p>
                )}
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm font-medium text-success">
                <CheckCircle2 className="size-4" />
                ¡Al día! No le falta nada por ahora.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">No tiene un paquete vigente para su edad.</p>
      )}
    </button>
  );
}

/** Al tocar un hijo: todos sus paquetes, el actual primero y luego los demás. */
export function GuardianChildView({ childId }: { childId: number }) {
  const { db } = useSisnat();
  const nino = db.ninos.find((n) => n.id === childId);
  const paquetes = useMemo(() => (nino ? paquetesDelNino(db, nino) : []), [db, nino]);
  const actual = nino ? paqueteActual(db, nino) : undefined;
  const [abierto, setAbierto] = useState<string | null>(actual?.codigo ?? null);
  const listRef = useRef<HTMLOListElement>(null);
  const bodyMax = useFreeHeight(listRef, abierto);
  if (!nino) return <p className="text-muted-foreground">Niño no encontrado.</p>;

  // Historial: el actual arriba, luego los demás vigentes y al final los anteriores (del más reciente al más antiguo).
  const orden = [
    ...paquetes.filter((p) => p.codigo === actual?.codigo),
    ...paquetes.filter((p) => p.estado === "ACTIVO" && p.codigo !== actual?.codigo),
    ...paquetes
      .filter((p) => p.estado === "HISTORIAL")
      .sort((a, b) => (moduloDe(db, b.codigo)?.edadMaxDias ?? 0) - (moduloDe(db, a.codigo)?.edadMaxDias ?? 0)),
  ];

  return (
    <>
      <PageTitle kicker="Mis hijos"
        title={nino.nombre}
        subtitle={`${formatAge(ageDays(nino.fechaNacimiento))} · ${nino.establecimiento} · Toca un paquete para ver sus atenciones.`}
      />
      <ol
        ref={listRef}
        className="relative grid grid-cols-1 gap-2 before:absolute before:bottom-5 before:left-[19px] before:top-5 before:w-px before:bg-border"
      >
        {orden.map((p) => (
          <PackageAccordion
            key={p.codigo}
            nino={nino}
            paquete={p}
            esActual={p.codigo === actual?.codigo}
            open={abierto === p.codigo}
            bodyMax={bodyMax}
            onToggle={() => setAbierto((c) => (c === p.codigo ? null : p.codigo))}
          />
        ))}
      </ol>
    </>
  );
}

/**
 * Alto disponible para el contenido del paquete abierto: lo que queda de la pantalla
 * después del título y de las filas cerradas. Así la vista cabe en ~100vh y solo hay
 * scroll de página cuando de verdad no alcanza (mínimo 200px).
 */
function useFreeHeight(listRef: React.RefObject<HTMLOListElement | null>, dep: unknown) {
  const [max, setMax] = useState(360);
  useLayoutEffect(() => {
    const measure = () => {
      const list = listRef.current;
      if (!list) return;
      const top = list.getBoundingClientRect().top + window.scrollY;
      const headers = [...list.querySelectorAll<HTMLElement>("[data-acc-header]")].reduce((sum, el) => sum + el.offsetHeight + 2, 0);
      const gaps = (list.children.length - 1) * 8;
      const bottom = parseFloat(getComputedStyle(list.closest("main") ?? list).paddingBottom) || 24;
      setMax(Math.max(200, Math.floor(window.innerHeight - top - headers - gaps - bottom - 2)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [listRef, dep]);
  return max;
}

function PackageAccordion({
  nino,
  paquete: p,
  esActual,
  open,
  bodyMax,
  onToggle,
}: {
  nino: Nino;
  paquete: PaqueteNino;
  esActual: boolean;
  open: boolean;
  bodyMax: number;
  onToggle: () => void;
}) {
  const { db } = useSisnat();
  const items = useMemo(() => fichaNino(db, nino, p.codigo), [db, nino, p.codigo]);
  const proximas = useMemo(() => proximasDelPaquete(db, nino, p.codigo), [db, nino, p.codigo]);
  const ref = useRef<HTMLLIElement>(null);

  // Al abrir, espera a que termine la animación y acerca el paquete a la vista si quedó fuera.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 320);
    return () => clearTimeout(t);
  }, [open]);

  const entrada = (index: number) =>
    open
      ? {
          className: "animate-in fade-in slide-in-from-top-1 fill-mode-both duration-300 motion-reduce:animate-none",
          style: { animationDelay: `${Math.min(index, 10) * 35}ms` },
        }
      : { className: "", style: undefined };
  const pct = p.prestaciones ? Math.round((p.cumplidas * 100) / p.prestaciones) : 0;
  const etiqueta = esActual
    ? { text: "Actual", tone: "default" as const }
    : p.estado === "ACTIVO"
      ? { text: "Vigente", tone: "default" as const }
      : p.retrasadas
        ? { text: "Incompleto", tone: "danger" as const }
        : { text: "Completado", tone: "good" as const };
  const dot =
    pct === 100 ? "bg-success text-success-foreground" : esActual ? "bg-primary text-primary-foreground" : p.estado === "HISTORIAL" ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary";

  return (
    <li ref={ref} className="relative min-w-0 scroll-mt-4 pl-12">
      <span
        className={`absolute left-2 top-2.5 z-10 flex size-6 items-center justify-center rounded-full ring-4 ring-background transition-transform duration-300 motion-reduce:transition-none ${open ? "scale-110" : ""} ${dot}`}
      >
        {pct === 100 ? <CheckCircle2 className="size-3.5" /> : <span className="size-2 rounded-full bg-current" />}
      </span>
      <div
        className={`overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] duration-300 ${open ? "border-primary/40 shadow-md" : "border-border hover:border-primary/30"}`}
      >
        <button
          data-acc-header
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold tracking-wide text-primary">{p.codigo}</span>
            <span className="min-w-0 truncate font-semibold">{p.nombre}</span>
            <StatusBadge tone={etiqueta.tone}>{etiqueta.text}</StatusBadge>
          </div>
          <div className="hidden w-44 shrink-0 items-center gap-2 sm:flex">
            <div className="flex-1">
              <Progress value={pct} tone={toneFor(pct)} />
            </div>
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {p.cumplidas}/{p.prestaciones}
            </span>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground sm:hidden">
            {p.cumplidas}/{p.prestaciones}
          </span>
          <ChevronDown
            className={`size-5 shrink-0 transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180 text-primary" : "text-muted-foreground"}`}
          />
        </button>

        {/* Despliegue animado: la fila del grid pasa de 0fr a 1fr. */}
        <div
          aria-hidden={!open}
          inert={!open}
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="min-h-0 overflow-hidden">
          <div
            className="overflow-y-auto overscroll-contain border-t border-border bg-muted/20 p-3 [scrollbar-width:thin] sm:p-4"
            style={{ maxHeight: bodyMax }}
          >
            {items.length ? (
              <ul key={open ? "open" : "closed"} className="grid grid-cols-1 gap-1.5">
                {items.map((i, index) => (
                  <li
                    key={i.prestacion.id}
                    style={entrada(index).style}
                    className={`flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-sm ${entrada(index).className}`}
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${i.estado === "CUMPLIDO" ? "bg-success" : i.estado === "VENCIDO" ? "bg-destructive" : "bg-warning"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-medium">{i.prestacion.nombre}</span>
                      <span className="block truncate text-xs text-muted-foreground">{i.prestacion.grupo}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs">
                      {i.registro ? (
                        <span className="text-success">{formatDate(i.registro.fechaAtencion)}</span>
                      ) : i.estado === "VENCIDO" ? (
                        <span className="font-semibold text-destructive">Vencida</span>
                      ) : (
                        <span className="text-warning">
                          Hasta {formatDate(addDays(nino.fechaNacimiento, i.prestacion.edadMaxDias))}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
                {proximas.map((pr, index) => (
                  <li
                    key={pr.id}
                    style={entrada(items.length + index).style}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground ${entrada(items.length + index).className}`}
                  >
                    <span className="size-2 shrink-0 rounded-full border border-muted-foreground/50" />
                    <span className="min-w-0 flex-1 break-words">{pr.nombre}</span>
                    <span className="shrink-0 text-xs">Desde {formatDate(addDays(nino.fechaNacimiento, pr.edadMinDias))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aún no hay atenciones para este paquete.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" />Cumplida</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" />Pendiente</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-destructive" />Vencida</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full border border-muted-foreground/50" />Aún no le toca</span>
            </div>
          </div>
          </div>
        </div>
      </div>
    </li>
  );
}

/** Seguimiento detallado: avance general, vencidas, paquetes, historial y familia. */
export function TrackingView({ nav }: { nav: Nav }) {
  const { hijos, nino, setHijoId } = useHijos();
  const [reclamo, setReclamo] = useState(false);
  if (!nino) return <NoChildren title="Seguimiento" />;

  return (
    <>
      <PageTitle kicker="Portal familiar"
        title="Seguimiento"
        subtitle="Avance general, atenciones vencidas, paquetes e historial de cada hijo."
      />
      <ChildSelector hijos={hijos} selectedId={nino.id} onSelect={setHijoId} />
      <ChildPanel key={nino.id} nino={nino} nav={nav} onReclamo={() => setReclamo(true)} />
      {reclamo && <ClaimModal defaultNinoId={nino.id} onClose={() => setReclamo(false)} />}
    </>
  );
}

function ChildPanel({ nino, nav, onReclamo }: { nino: Nino; nav: Nav; onReclamo: () => void }) {
  const { db } = useSisnat();
  const items = useMemo(() => fichaNino(db, nino), [db, nino]);
  const paquetes = useMemo(() => paquetesDelNino(db, nino), [db, nino]);
  const [verHistorial, setVerHistorial] = useState(false);
  const [verVencidas, setVerVencidas] = useState(false);

  const { pct, cumplidas, pendientes, vencidas } = resumen(items);
  const recientes = items
    .filter((i) => i.registro)
    .sort((a, b) => b.registro!.fechaAtencion.localeCompare(a.registro!.fechaAtencion))
    .slice(0, 5);
  const vigentes = paquetes.filter((p) => p.estado === "ACTIVO");
  const historial = paquetes.filter((p) => p.estado === "HISTORIAL");

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="grid min-w-0 gap-5">
        {/* Encabezado del niño */}
        <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center">
          <Avatar nino={nino} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{nino.nombre}</h2>
            <p className="text-sm text-muted-foreground">
              {nino.sexo === "F" ? "Niña" : "Niño"} · {formatAge(ageDays(nino.fechaNacimiento))} · Nació el {formatDate(nino.fechaNacimiento)}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Padrón: <b className="text-foreground">{nino.codPadron}</b></span>
              <span>DNI: <b className="text-foreground">{nino.dni ?? "Sin DNI"}</b></span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {nino.establecimiento}
              </span>
              {nino.condicionRn && <StatusBadge tone="warn">{nino.condicionRn}</StatusBadge>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Ring value={pct} size={72} label="general" />
            <div className="text-xs text-muted-foreground">
              <p><b className="text-foreground">{cumplidas}</b> cumplidas</p>
              <p><b className="text-foreground">{pendientes.length}</b> por realizar</p>
              <p><b className="text-destructive">{vencidas.length}</b> vencidas</p>
            </div>
          </div>
        </section>

        {/* Vencidas */}
        {vencidas.length > 0 && (
          <section className="rounded-xl border border-destructive/30 bg-destructive/5">
            <button
              onClick={() => setVerVencidas((v) => !v)}
              className="flex w-full items-center gap-3 p-4 text-left"
              aria-expanded={verVencidas}
            >
              <AlertTriangle className="size-5 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="font-semibold text-destructive">
                  {vencidas.length} {vencidas.length === 1 ? "atención vencida" : "atenciones vencidas"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pasó la edad indicada sin registro. Acércate a tu establecimiento o repórtalo si ya se realizó.
                </p>
              </div>
              <ChevronDown className={`size-4 text-muted-foreground transition ${verVencidas ? "rotate-180" : ""}`} />
            </button>
            {verVencidas && (
              <ul className="grid gap-1 border-t border-destructive/20 p-3 sm:grid-cols-2">
                {vencidas.map((i) => (
                  <li key={i.prestacion.id} className="rounded-lg bg-card px-3 py-2 text-sm">
                    <p className="font-medium">{i.prestacion.nombre}</p>
                    <p className="text-xs text-muted-foreground">{i.modulo.nombre}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Paquetes vigentes */}
        <Card title="Paquetes vigentes">
          {vigentes.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {vigentes.map((p) => (
                <PackageCard key={p.codigo} paquete={p} onClick={() => nav.go({ name: "child", childId: nino.id, code: p.codigo })} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay un paquete vigente para esta edad.</p>
          )}
        </Card>

        {/* Historial */}
        {historial.length > 0 && (
          <section className="rounded-xl border border-border bg-card">
            <button
              onClick={() => setVerHistorial((v) => !v)}
              className="flex w-full items-center justify-between p-5 text-left"
              aria-expanded={verHistorial}
            >
              <span>
                <span className="font-semibold">Historial de paquetes</span>
                <span className="ml-2 text-sm text-muted-foreground">({historial.length} etapas anteriores)</span>
              </span>
              <ChevronDown className={`size-4 text-muted-foreground transition ${verHistorial ? "rotate-180" : ""}`} />
            </button>
            {verHistorial && (
              <ul className="divide-y divide-border border-t border-border">
                {historial.map((p) => {
                  const avance = p.prestaciones ? Math.round((p.cumplidas * 100) / p.prestaciones) : 0;
                  return (
                    <li key={p.codigo}>
                      <button
                        onClick={() => nav.go({ name: "child", childId: nino.id, code: p.codigo })}
                        className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.codigo} · {p.cumplidas}/{p.prestaciones} cumplidas
                          </p>
                        </div>
                        <div className="w-28">
                          <Progress value={avance} tone={toneFor(avance)} />
                        </div>
                        <span className="w-10 text-right text-xs font-semibold">{avance}%</span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Columna lateral */}
      <aside className="grid content-start gap-5">
        <Card title="Últimas atenciones">
          {recientes.length ? (
            <ol className="relative grid gap-4 border-l border-border pl-5">
              {recientes.map((i) => (
                <li key={i.prestacion.id} className="relative">
                  <span className="absolute -left-[27px] top-0.5 flex size-4 items-center justify-center rounded-full bg-success text-success-foreground">
                    <CheckCircle2 className="size-3" />
                  </span>
                  <p className="text-sm font-medium leading-tight">{i.prestacion.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(i.registro!.fechaAtencion)} · {i.registro!.establecimiento}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay atenciones registradas.</p>
          )}
          <button className={`${linkButtonClass} mt-4`} onClick={() => nav.go({ name: "child", childId: nino.id })}>
            Ver ficha completa →
          </button>
        </Card>

        <Card title="Familia registrada">
          <ul className="grid gap-3">
            {padresDe(db, nino.id).map((r) => (
              <li key={r.dni} className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="font-semibold">{r.nombre}</p>
                <p className="text-xs text-muted-foreground">{r.parentesco} · DNI {r.dni}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="size-3" />
                  {r.celular}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <p className="flex items-center gap-2 font-semibold">
            <FileWarning className="size-4 text-primary" />
            ¿Falta una atención?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Si tu hijo recibió una atención y no aparece registrada, envía una solicitud de revisión.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={buttonClass} onClick={onReclamo}>
              Reportar atención
            </button>
            <button className={secondaryButtonClass} onClick={() => nav.go({ name: "claims" })}>
              Mis solicitudes
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
