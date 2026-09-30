"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Session } from "@/lib/backend";
import {
  createClaimAction,
  deleteCatalogAction,
  deletePersonAction,
  saveChildAction,
  savePackageAction,
  saveParentAction,
  savePrestationAction,
  saveRecordAction,
  updateClaimAction,
} from "@/lib/actions/sisnat";
import { ESTABLECIMIENTOS } from "@/lib/sisnat/catalog";
import { nowStamp, todayISO } from "@/lib/sisnat/dates";
import { nextId, type Alcance, type Db } from "@/lib/sisnat/logic";
import { GUARDIAN_PADRE_ID, STAFF_MICRO_RED, buildSeed } from "@/lib/sisnat/seed";
import type {
  Auditoria,
  EstadoReclamo,
  Modulo,
  Nino,
  Padre,
  Prestacion,
  Reclamo,
  Registro,
} from "@/lib/sisnat/types";

type Toast = { text: string; tone: "good" | "danger" } | null;
type Result = { ok: true } | { ok: false; error: string };

type RegistroInput = {
  ninoId: number;
  prestacionId: number;
  fechaAtencion: string;
  establecimiento: string;
  observaciones: string;
};

export type PaqueteInput = Pick<Modulo, "codigo" | "nombre" | "descripcion" | "edadMinDias" | "edadMaxDias">;
export type PrestacionInput = Pick<Prestacion, "codigo" | "nombre" | "grupo" | "edadMinDias" | "edadMaxDias">;
export type NinoInput = Omit<Nino, "id" | "activo" | "microRed"> & { padreIds: number[] };
export type PadreInput = Omit<Padre, "id">;

type SisnatContext = {
  session: Session;
  alcance: Alcance;
  db: Db;
  reclamos: Reclamo[];
  auditoria: Auditoria[];
  toast: Toast;
  hijoId: number | null;
  setHijoId: (id: number) => void;
  dismissToast: () => void;
  notify: (text: string, tone?: "good" | "danger") => void;
  guardarRegistro: (input: RegistroInput) => Promise<boolean>;
  crearReclamo: (form: FormData) => Promise<boolean>;
  actualizarReclamo: (id: number, estado: EstadoReclamo, respuesta: string) => Promise<boolean>;
  guardarPaquete: (input: PaqueteInput, editando?: string) => Promise<boolean>;
  eliminarPaquete: (codigo: string) => Promise<boolean>;
  reactivarPaquete: (codigo: string) => Promise<boolean>;
  guardarPrestacion: (moduloCodigo: string, input: PrestacionInput, id?: number) => Promise<boolean>;
  eliminarPrestacion: (id: number) => Promise<boolean>;
  guardarNino: (input: NinoInput, id?: number) => Promise<number | null>;
  eliminarNino: (id: number) => Promise<boolean>;
  guardarPadre: (input: PadreInput, id?: number) => Promise<boolean>;
  eliminarPadre: (id: number) => Promise<boolean>;
};

const Ctx = createContext<SisnatContext | null>(null);

export function SisnatProvider({ session, children }: { session: Session; children: React.ReactNode }) {
  const [seed] = useState(() => buildSeed(todayISO()));
  const [ninos, setNinos] = useState<Nino[]>(seed.ninos);
  const [padres, setPadres] = useState<Padre[]>(seed.padres);
  const [modulos, setModulos] = useState<Modulo[]>(seed.modulos);
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>(seed.prestaciones);
  const [registros, setRegistros] = useState<Registro[]>(seed.registros);
  const [reclamos, setReclamos] = useState<Reclamo[]>(seed.reclamos);
  const [auditoria, setAuditoria] = useState<Auditoria[]>(seed.auditoria);
  const [toast, setToast] = useState<Toast>(null);

  const db = useMemo<Db>(
    () => ({ ninos, padres, modulos, prestaciones, registros }),
    [ninos, padres, modulos, prestaciones, registros],
  );

  // El apoderado ve a los hijos activos vinculados a su registro de padre.
  const hijosSesion = useMemo(() => {
    const padre = padres.find((p) => p.id === GUARDIAN_PADRE_ID);
    return ninos.filter((n) => n.activo && padre?.hijos.includes(n.id)).map((n) => n.id);
  }, [padres, ninos]);

  const alcance = useMemo<Alcance>(
    () =>
      session.role === "guardian"
        ? { microRed: null, ninoIds: hijosSesion }
        : session.role === "health_staff"
          ? { microRed: STAFF_MICRO_RED, ninoIds: null }
          : { microRed: null, ninoIds: null },
    [session.role, hijosSesion],
  );

  const [hijoElegido, setHijoId] = useState<number | null>(null);
  const hijoId = hijoElegido !== null && hijosSesion.includes(hijoElegido) ? hijoElegido : (hijosSesion[0] ?? null);

  const notify = useCallback((text: string, tone: "good" | "danger" = "good") => {
    setToast({ text, tone });
    setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 3500);
  }, []);

  const audit = useCallback(
    (accion: string, entidad: string, detalle: string) =>
      setAuditoria((list) => [
        { id: (list[0]?.id ?? 0) + 1, fechaHora: nowStamp(), usuario: session.name, accion, entidad, detalle },
        ...list,
      ]),
    [session.name],
  );

  /** Ejecuta la server action falsa; si falla muestra el error y corta. */
  const check = useCallback(
    (res: Result) => {
      if (!res.ok) notify(res.error, "danger");
      return res.ok;
    },
    [notify],
  );
  const fail = useCallback((error: string) => (notify(error, "danger"), false), [notify]);

  /* ───────────── Atenciones y reclamos ───────────── */

  const guardarRegistro = useCallback(
    async (input: RegistroInput) => {
      const nino = ninos.find((n) => n.id === input.ninoId)!;
      if (!check(await saveRecordAction({ ...input, fechaNacimiento: nino.fechaNacimiento }))) return false;
      const existente = registros.find((r) => r.ninoId === input.ninoId && r.prestacionId === input.prestacionId);
      setRegistros((list) =>
        existente
          ? list.map((r) => (r.id === existente.id ? { ...r, ...input, registradoPor: session.name } : r))
          : [...list, { id: nextId(list), ...input, registradoPor: session.name }],
      );
      const prestacion = prestaciones.find((p) => p.id === input.prestacionId);
      audit(existente ? "ACTUALIZAR" : "CREAR", "registros_atencion", `${nino.nombre} · ${prestacion?.nombre} · ${input.fechaAtencion}`);
      notify(existente ? "Atención modificada correctamente" : "Atención registrada correctamente");
      return true;
    },
    [ninos, registros, prestaciones, session.name, audit, notify, check],
  );

  const crearReclamo = useCallback(
    async (form: FormData) => {
      if (!check(await createClaimAction(form))) return false;
      const files = form.getAll("evidencias").filter((f): f is File => f instanceof File && f.size > 0);
      const ninoId = Number(form.get("nino_id"));
      setReclamos((list) => [
        {
          id: nextId(list),
          estado: "PENDIENTE",
          ninoId,
          usuarioNombre: session.name,
          propio: true,
          dniSolicitante: String(form.get("dni_solicitante")),
          dniNino: String(form.get("dni_nino")),
          identificadorNino: String(form.get("identificador_nino")),
          establecimiento: String(form.get("establecimiento")),
          fechaAtencion: String(form.get("fecha_atencion") || "") || null,
          mensaje: String(form.get("mensaje")),
          respuesta: "",
          evidencias: files.map((f, i) => ({ id: i + 1, nombre: f.name, url: URL.createObjectURL(f) })),
          creadoEn: todayISO(),
        },
        ...list,
      ]);
      audit("CREAR", "reclamos", `Solicitud de revisión · niño #${ninoId}`);
      notify("Solicitud enviada al administrador");
      return true;
    },
    [session.name, audit, notify, check],
  );

  const actualizarReclamo = useCallback(
    async (id: number, estado: EstadoReclamo, respuesta: string) => {
      if (!check(await updateClaimAction({ estado, respuesta }))) return false;
      setReclamos((list) => list.map((r) => (r.id === id ? { ...r, estado, respuesta } : r)));
      audit("ACTUALIZAR", "reclamos", `Reclamo #${id} → ${estado}`);
      notify("Solicitud actualizada");
      return true;
    },
    [audit, notify, check],
  );

  /* ───────────── Paquetes ───────────── */

  const guardarPaquete = useCallback(
    async (input: PaqueteInput, editando?: string) => {
      if (!editando && modulos.some((m) => m.codigo === input.codigo)) return fail(`Ya existe un paquete con el código ${input.codigo}`);
      if (!check(await savePackageAction(input))) return false;
      setModulos((list) =>
        editando
          ? list.map((m) => (m.codigo === editando ? { ...m, ...input, codigo: editando } : m))
          : [...list, { ...input, activo: true }],
      );
      audit(editando ? "ACTUALIZAR" : "CREAR", "paquetes", `${editando ?? input.codigo} · ${input.nombre}`);
      notify(editando ? "Paquete actualizado" : "Paquete creado. Ahora agrega sus atenciones.");
      return true;
    },
    [modulos, audit, notify, check, fail],
  );

  /** Elimina el paquete si no tiene atenciones registradas; si las tiene, solo lo desactiva. */
  const eliminarPaquete = useCallback(
    async (codigo: string) => {
      if (!check(await deleteCatalogAction())) return false;
      const ids = prestaciones.filter((p) => p.moduloCodigo === codigo).map((p) => p.id);
      const usado = registros.some((r) => ids.includes(r.prestacionId));
      if (usado) {
        setModulos((list) => list.map((m) => (m.codigo === codigo ? { ...m, activo: false } : m)));
        audit("DESACTIVAR", "paquetes", `${codigo} (tiene atenciones registradas)`);
        notify("El paquete tiene atenciones registradas: se desactivó en lugar de eliminarse");
      } else {
        setModulos((list) => list.filter((m) => m.codigo !== codigo));
        setPrestaciones((list) => list.filter((p) => p.moduloCodigo !== codigo));
        audit("ELIMINAR", "paquetes", codigo);
        notify("Paquete eliminado");
      }
      return true;
    },
    [prestaciones, registros, audit, notify, check],
  );

  const reactivarPaquete = useCallback(
    async (codigo: string) => {
      if (!check(await deleteCatalogAction())) return false;
      setModulos((list) => list.map((m) => (m.codigo === codigo ? { ...m, activo: true } : m)));
      audit("REACTIVAR", "paquetes", codigo);
      notify("Paquete reactivado");
      return true;
    },
    [audit, notify, check],
  );

  const guardarPrestacion = useCallback(
    async (moduloCodigo: string, input: PrestacionInput, id?: number) => {
      const delModulo = prestaciones.filter((p) => p.moduloCodigo === moduloCodigo);
      if (delModulo.some((p) => p.codigo === input.codigo && p.id !== id))
        return fail(`Ya existe una atención con el código ${input.codigo} en este paquete`);
      if (!check(await savePrestationAction(input))) return false;
      const grupoOrden =
        delModulo.find((p) => p.grupo === input.grupo)?.grupoOrden ?? Math.max(0, ...delModulo.map((p) => p.grupoOrden)) + 1;
      setPrestaciones((list) =>
        id
          ? list.map((p) => (p.id === id ? { ...p, ...input, grupoOrden } : p))
          : [
              ...list,
              { id: nextId(list), moduloCodigo, ...input, grupoOrden, orden: Math.max(0, ...delModulo.map((p) => p.orden)) + 1 },
            ],
      );
      audit(id ? "ACTUALIZAR" : "CREAR", "prestaciones", `${moduloCodigo} · ${input.nombre}`);
      notify(id ? "Atención actualizada" : "Atención agregada al paquete");
      return true;
    },
    [prestaciones, audit, notify, check, fail],
  );

  const eliminarPrestacion = useCallback(
    async (id: number) => {
      if (!check(await deleteCatalogAction())) return false;
      const p = prestaciones.find((x) => x.id === id);
      setPrestaciones((list) => list.filter((x) => x.id !== id));
      setRegistros((list) => list.filter((r) => r.prestacionId !== id));
      audit("ELIMINAR", "prestaciones", `${p?.moduloCodigo} · ${p?.nombre}`);
      notify("Atención eliminada del paquete");
      return true;
    },
    [prestaciones, audit, notify, check],
  );

  /* ───────────── Niños ───────────── */

  const guardarNino = useCallback(
    async ({ padreIds, ...input }: NinoInput, id?: number) => {
      const est = ESTABLECIMIENTOS.find((e) => e.nombre === input.establecimiento);
      if (alcance.microRed && est?.microRed !== alcance.microRed)
        return (fail(`Solo puede registrar niños de la micro red ${alcance.microRed}`), null);
      if (input.dni && ninos.some((n) => n.dni === input.dni && n.id !== id))
        return (fail("Ya existe un niño con ese DNI"), null);
      if (!check(await saveChildAction({ ...input, dni: input.dni ?? "" }))) return null;
      const ninoId = id ?? nextId(ninos);
      const datos = { ...input, microRed: est?.microRed ?? "" };
      setNinos((list) =>
        id ? list.map((n) => (n.id === id ? { ...n, ...datos } : n)) : [...list, { id: ninoId, ...datos, activo: true }],
      );
      setPadres((list) =>
        list.map((p) => {
          const vinculado = padreIds.includes(p.id);
          const tiene = p.hijos.includes(ninoId);
          if (vinculado && !tiene) return { ...p, hijos: [...p.hijos, ninoId] };
          if (!vinculado && tiene) return { ...p, hijos: p.hijos.filter((h) => h !== ninoId) };
          return p;
        }),
      );
      audit(id ? "ACTUALIZAR" : "CREAR", "ninos", `${input.nombre} · ${input.codPadron}`);
      notify(id ? "Datos del niño actualizados" : "Niño registrado");
      return ninoId;
    },
    [ninos, alcance.microRed, audit, notify, check, fail],
  );

  /** Baja lógica: el niño deja de aparecer, pero su historial se conserva. */
  const eliminarNino = useCallback(
    async (id: number) => {
      if (!check(await deletePersonAction())) return false;
      const n = ninos.find((x) => x.id === id);
      setNinos((list) => list.map((x) => (x.id === id ? { ...x, activo: false } : x)));
      audit("DESACTIVAR", "ninos", n?.nombre ?? `#${id}`);
      notify("Niño dado de baja");
      return true;
    },
    [ninos, audit, notify, check],
  );

  /* ───────────── Padres ───────────── */

  const guardarPadre = useCallback(
    async (input: PadreInput, id?: number) => {
      if (padres.some((p) => p.dni === input.dni && p.id !== id)) return fail("Ya existe un padre con ese DNI");
      if (!check(await saveParentAction(input))) return false;
      setPadres((list) =>
        id ? list.map((p) => (p.id === id ? { ...p, ...input } : p)) : [...list, { id: nextId(list), ...input }],
      );
      audit(id ? "ACTUALIZAR" : "CREAR", "padres", `${input.nombre} · DNI ${input.dni}`);
      notify(id ? "Datos del padre actualizados" : "Padre registrado");
      return true;
    },
    [padres, audit, notify, check, fail],
  );

  const eliminarPadre = useCallback(
    async (id: number) => {
      if (!check(await deletePersonAction())) return false;
      const p = padres.find((x) => x.id === id);
      setPadres((list) => list.filter((x) => x.id !== id));
      audit("ELIMINAR", "padres", p?.nombre ?? `#${id}`);
      notify("Padre eliminado");
      return true;
    },
    [padres, audit, notify, check],
  );

  const value: SisnatContext = {
    session,
    alcance,
    db,
    reclamos,
    auditoria,
    toast,
    hijoId,
    setHijoId,
    dismissToast: () => setToast(null),
    notify,
    guardarRegistro,
    crearReclamo,
    actualizarReclamo,
    guardarPaquete,
    eliminarPaquete,
    reactivarPaquete,
    guardarPrestacion,
    eliminarPrestacion,
    guardarNino,
    eliminarNino,
    guardarPadre,
    eliminarPadre,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSisnat() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSisnat debe usarse dentro de <SisnatProvider>");
  return ctx;
}
