import { ESTABLECIMIENTOS } from "@/lib/sisnat/catalog";
import { ageDays } from "@/lib/sisnat/dates";
import type {
  EstadoPaquete,
  EstadoPrestacion,
  Filtros,
  Modulo,
  Nino,
  Padre,
  Prestacion,
  Registro,
} from "@/lib/sisnat/types";

/* ───────────── Reglas de negocio (mismas que la Red de Salud) ───────────── */

const CONDICIONES_IAG09 = ["PREMATURO", "BAJO PESO", "PREMATURO/BAJO PESO"];

export function elegibleIag09(nino: Nino) {
  return CONDICIONES_IAG09.includes((nino.condicionRn ?? "").toUpperCase());
}

export function estadoPaquete(nino: Nino, modulo: Modulo, edad = ageDays(nino.fechaNacimiento)): EstadoPaquete {
  if (modulo.codigo === "IAG_09" && !elegibleIag09(nino)) return "FUTURO";
  if (edad < modulo.edadMinDias) return "FUTURO";
  return edad <= modulo.edadMaxDias ? "ACTIVO" : "HISTORIAL";
}

/** La prestación ya le corresponde al niño (aunque el paquete esté en historial). */
export function prestacionAplica(nino: Nino, modulo: Modulo, p: Prestacion, edad: number) {
  if (modulo.codigo === "IAG_09" && !elegibleIag09(nino)) return false;
  return edad >= modulo.edadMinDias && edad >= p.edadMinDias;
}

/** El niño está dentro del rango de edad vigente del paquete y la prestación ya le toca. */
function enPaqueteVigente(nino: Nino, modulo: Modulo, p: Prestacion, edad: number) {
  return (
    prestacionAplica(nino, modulo, p, edad) &&
    edad >= modulo.edadMinDias &&
    edad <= modulo.edadMaxDias
  );
}

export function estadoPrestacion(edad: number, registro: Registro | undefined, p: Prestacion): EstadoPrestacion {
  if (registro) return "CUMPLIDO";
  return edad > p.edadMaxDias ? "VENCIDO" : "PENDIENTE";
}

/* ───────────── Base de datos en memoria ───────────── */

export type Db = {
  ninos: Nino[];
  registros: Registro[];
  modulos: Modulo[];
  prestaciones: Prestacion[];
  padres: Padre[];
};

/** Paquetes activos (los desactivados no cuentan en ninguna consulta). */
export function modulosActivos(db: Db) {
  return db.modulos.filter((m) => m.activo);
}

export function moduloDe(db: Db, codigo: string) {
  return db.modulos.find((m) => m.codigo === codigo);
}

export function prestacionDe(db: Db, id: number) {
  return db.prestaciones.find((p) => p.id === id);
}

export function prestacionesDe(db: Db, codigo: string) {
  return db.prestaciones
    .filter((p) => p.moduloCodigo === codigo)
    .sort((a, b) => a.grupoOrden - b.grupoOrden || a.orden - b.orden);
}

export function padresDe(db: Db, ninoId: number) {
  return db.padres.filter((p) => p.hijos.includes(ninoId));
}

/** Niños activos vinculados a un padre. */
export function hijosDe(db: Db, padre: Padre) {
  return db.ninos.filter((n) => n.activo && padre.hijos.includes(n.id));
}

export type Alcance = { microRed: string | null; ninoIds: number[] | null };

type Indice = Map<string, Registro>;
const indices = new WeakMap<Registro[], Indice>();

function indice(registros: Registro[]) {
  let idx = indices.get(registros);
  if (!idx) {
    idx = new Map(registros.map((r) => [`${r.ninoId}:${r.prestacionId}`, r]));
    indices.set(registros, idx);
  }
  return idx;
}

export function registroDe(db: Db, ninoId: number, prestacionId: number) {
  return indice(db.registros).get(`${ninoId}:${prestacionId}`);
}

export function ninosEnAlcance(db: Db, alcance: Alcance, filtros?: Partial<Filtros>) {
  return db.ninos.filter(
    (n) =>
      n.activo &&
      (!alcance.microRed || n.microRed === alcance.microRed) &&
      (!alcance.ninoIds || alcance.ninoIds.includes(n.id)) &&
      (!filtros?.microRed || n.microRed === filtros.microRed) &&
      (!filtros?.establecimiento || n.establecimiento === filtros.establecimiento),
  );
}

function coincide(n: Nino, busqueda: string) {
  const q = busqueda.trim().toLowerCase();
  return !q || `${n.nombre} ${n.dni ?? ""} ${n.codPadron}`.toLowerCase().includes(q);
}

const pct = (hechos: number, total: number) => (total ? Math.round((hechos * 100) / total) : 0);

/* ───────────── Consultas (equivalentes a los endpoints de la Red de Salud) ───────────── */

/** GET /api/dashboard */
export function resumenPaquetes(db: Db, alcance: Alcance, filtros?: Partial<Filtros>) {
  const ninos = ninosEnAlcance(db, alcance, filtros);
  const modulos = modulosActivos(db).map((m) => {
    let total = 0;
    let cumplidas = 0;
    for (const n of ninos) {
      const edad = ageDays(n.fechaNacimiento);
      for (const p of prestacionesDe(db, m.codigo)) {
        if (!enPaqueteVigente(n, m, p, edad)) continue;
        total++;
        if (registroDe(db, n.id, p.id)) cumplidas++;
      }
    }
    return { ...m, total, cumplidas, porcentaje: pct(cumplidas, total) };
  });
  return { totalNinos: ninos.length, modulos };
}

/** GET /api/modulos/:codigo/ninos */
export function ninosDelModulo(
  db: Db,
  alcance: Alcance,
  codigo: string,
  opts: { busqueda: string; estado: EstadoPrestacion | ""; filtros: Filtros },
) {
  const modulo = moduloDe(db, codigo)!;
  const rows = [];
  for (const n of ninosEnAlcance(db, alcance, opts.filtros)) {
    if (!coincide(n, opts.busqueda)) continue;
    const edad = ageDays(n.fechaNacimiento);
    const aplicables = prestacionesDe(db, codigo).filter((p) => enPaqueteVigente(n, modulo, p, edad));
    if (!aplicables.length) continue;
    const estados = aplicables.map((p) => estadoPrestacion(edad, registroDe(db, n.id, p.id), p));
    if (opts.estado && !estados.includes(opts.estado)) continue;
    rows.push({
      nino: n,
      edad,
      prestaciones: aplicables.length,
      cumplidas: estados.filter((e) => e === "CUMPLIDO").length,
      vencidas: estados.filter((e) => e === "VENCIDO").length,
    });
  }
  return rows.sort((a, b) => a.nino.nombre.localeCompare(b.nino.nombre));
}

/** GET /api/modulos/:codigo/prestaciones */
export function prestacionesDelModulo(db: Db, alcance: Alcance, codigo: string, filtros: Filtros) {
  const modulo = moduloDe(db, codigo)!;
  const ninos = ninosEnAlcance(db, alcance, filtros);
  return prestacionesDe(db, codigo).map((p) => {
    let total = 0;
    let atendidos = 0;
    for (const n of ninos) {
      if (!enPaqueteVigente(n, modulo, p, ageDays(n.fechaNacimiento))) continue;
      total++;
      if (registroDe(db, n.id, p.id)) atendidos++;
    }
    return { prestacion: p, total, atendidos };
  });
}

/** GET /api/modulos/:codigo/prestaciones/:id/ninos */
export function ninosDePrestacion(
  db: Db,
  alcance: Alcance,
  codigo: string,
  prestacionId: number,
  filtros: Filtros,
  mostrar: "" | "atendido" | "pendiente",
) {
  const modulo = moduloDe(db, codigo)!;
  const p = prestacionDe(db, prestacionId)!;
  return ninosEnAlcance(db, alcance, { microRed: filtros.microRed })
    .filter((n) => enPaqueteVigente(n, modulo, p, ageDays(n.fechaNacimiento)))
    .map((n) => ({ nino: n, registro: registroDe(db, n.id, p.id) }))
    .filter(
      ({ nino, registro }) =>
        !filtros.establecimiento ||
        (registro?.establecimiento ?? nino.establecimiento) === filtros.establecimiento,
    )
    .filter(({ registro }) =>
      mostrar === "atendido" ? Boolean(registro) : mostrar === "pendiente" ? !registro : true,
    )
    .sort((a, b) => a.nino.nombre.localeCompare(b.nino.nombre));
}

export type ItemFicha = {
  prestacion: Prestacion;
  modulo: Modulo;
  registro: Registro | undefined;
  estado: EstadoPrestacion;
};

/** GET /api/ninos/:id?modulo= */
export function fichaNino(db: Db, nino: Nino, codigo?: string): ItemFicha[] {
  const edad = ageDays(nino.fechaNacimiento);
  const items: ItemFicha[] = [];
  for (const m of codigo ? db.modulos.filter((x) => x.codigo === codigo) : modulosActivos(db)) {
    for (const p of prestacionesDe(db, m.codigo)) {
      if (!prestacionAplica(nino, m, p, edad)) continue;
      const registro = registroDe(db, nino.id, p.id);
      items.push({ prestacion: p, modulo: m, registro, estado: estadoPrestacion(edad, registro, p) });
    }
  }
  return items;
}

export type PaqueteNino = {
  codigo: string;
  nombre: string;
  estado: EstadoPaquete;
  prestaciones: number;
  cumplidas: number;
  retrasadas: number;
};

export function paquetesDelNino(db: Db, nino: Nino): PaqueteNino[] {
  const edad = ageDays(nino.fechaNacimiento);
  return modulosActivos(db).flatMap((m) => {
    const estado = estadoPaquete(nino, m, edad);
    if (estado === "FUTURO") return [];
    const aplicables = prestacionesDe(db, m.codigo).filter((p) => prestacionAplica(nino, m, p, edad));
    const hechas = aplicables.filter((p) => registroDe(db, nino.id, p.id));
    const retrasadas = aplicables.filter(
      (p) => !registroDe(db, nino.id, p.id) && (estado === "HISTORIAL" || edad > p.edadMaxDias),
    );
    return [{
      codigo: m.codigo,
      nombre: m.nombre,
      estado,
      prestaciones: aplicables.length,
      cumplidas: hechas.length,
      retrasadas: retrasadas.length,
    }];
  });
}

/** GET /api/ninos (directorio) */
export function directorio(db: Db, alcance: Alcance, opts: { busqueda: string; filtros: Filtros }) {
  return ninosEnAlcance(db, alcance, opts.filtros)
    .filter((n) => coincide(n, opts.busqueda))
    .map((n) => {
      const paquetes = paquetesDelNino(db, n);
      const total = paquetes.reduce((s, p) => s + p.prestaciones, 0);
      const cumplidas = paquetes.reduce((s, p) => s + p.cumplidas, 0);
      const retrasadas = paquetes.reduce((s, p) => s + p.retrasadas, 0);
      return { nino: n, paquetes, total, cumplidas, retrasadas, porcentaje: pct(cumplidas, total) };
    })
    .sort((a, b) => a.nino.nombre.localeCompare(b.nino.nombre));
}

export type FilaDirectorio = ReturnType<typeof directorio>[number];

/** GET /api/notificaciones: prestaciones vencidas de los hijos del apoderado. */
export function notificaciones(db: Db, ninoIds: number[]) {
  return fichasDe(db, ninoIds).filter((x) => x.estado === "VENCIDO");
}

function fichasDe(db: Db, ninoIds: number[]) {
  return db.ninos
    .filter((n) => n.activo && ninoIds.includes(n.id))
    .flatMap((n) => fichaNino(db, n).map((item) => ({ ...item, nino: n })));
}

/** Agrupa por una clave calculando niños y niños al día (>= 80%). */
export function agrupar(rows: FilaDirectorio[], clave: (r: FilaDirectorio) => string) {
  const map = new Map<string, { label: string; total: number; cumplidos: number }>();
  for (const r of rows) {
    const label = clave(r) || "Sin asignar";
    const item = map.get(label) ?? { label, total: 0, cumplidos: 0 };
    item.total++;
    if (r.porcentaje >= 80) item.cumplidos++;
    map.set(label, item);
  }
  return [...map.values()]
    .map((x) => ({ ...x, porcentaje: pct(x.cumplidos, x.total) }))
    .sort((a, b) => b.total - a.total);
}

/** Opciones de microred / establecimiento para los filtros. */
export function opcionesFiltro(alcance: Alcance, microRed = "") {
  const base = ESTABLECIMIENTOS.filter((e) => !alcance.microRed || e.microRed === alcance.microRed);
  const microRedes = [...new Set(base.map((e) => e.microRed))].sort();
  const establecimientos = base
    .filter((e) => !microRed || e.microRed === microRed)
    .map((e) => e.nombre)
    .sort();
  return { microRedes, establecimientos };
}

export function toCsv(headers: string[], rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n");
}

/** Paquete actual del niño: el vigente más específico para su edad (rango más corto). */
export function paqueteActual(db: Db, nino: Nino) {
  const edad = ageDays(nino.fechaNacimiento);
  return modulosActivos(db).filter((m) => estadoPaquete(nino, m, edad) === "ACTIVO").sort(
    (a, b) => a.edadMaxDias - a.edadMinDias - (b.edadMaxDias - b.edadMinDias),
  )[0];
}

/** Prestaciones del paquete que aún no le tocan por edad. */
export function proximasDelPaquete(db: Db, nino: Nino, codigo: string) {
  const edad = ageDays(nino.fechaNacimiento);
  return prestacionesDe(db, codigo).filter((p) => edad < p.edadMinDias);
}

/** Siguiente id libre de una lista. */
export function nextId(list: { id: number }[]) {
  return Math.max(0, ...list.map((x) => x.id)) + 1;
}
