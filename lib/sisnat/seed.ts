import { ESTABLECIMIENTOS, MODULOS_INICIALES, PRESTACIONES_INICIALES } from "@/lib/sisnat/catalog";
import { addDays, ageDays, nowStamp } from "@/lib/sisnat/dates";
import { prestacionAplica } from "@/lib/sisnat/logic";
import type { Auditoria, Nino, Padre, Reclamo, Registro } from "@/lib/sisnat/types";

/** Micro red asignada al personal de salud mock (restringe su alcance como en la Red de Salud). */
export const STAFF_MICRO_RED = "BELEN";

/** Padre del mock que corresponde a la cuenta de apoderado que inicia sesión. */
export const GUARDIAN_PADRE_ID = 1;

/** Hijos iniciales de la familia del apoderado de la sesión. */
const GUARDIAN_CHILD_IDS = [1, 2, 3];

type Semilla = [
  nombre: string,
  sexo: "M" | "F",
  edadDias: number,
  eess: number, // índice en ESTABLECIMIENTOS
  madre: string,
  condicionRn: string | null,
  cumplimiento: number, // 0-1: probabilidad de que cada prestación esté atendida
];

const SEMILLAS: Semilla[] = [
  ["Valentina Cárdenas Huamán", "F", 250, 0, "María Huamán Quispe", null, 0.55],
  ["Mateo Cárdenas Huamán", "M", 1150, 0, "María Huamán Quispe", null, 0.8],
  ["Luciana Cárdenas Huamán", "F", 20, 0, "María Huamán Quispe", "PREMATURO", 0.4],
  ["Diego Rojas Palomino", "M", 12, 1, "Carmen Palomino Soto", null, 0.9],
  ["Camila Quispe Llamocca", "F", 45, 2, "Rosa Llamocca Pariona", "BAJO PESO", 0.6],
  ["Thiago Gamboa Ccori", "M", 100, 3, "Julia Ccori Tineo", null, 0.85],
  ["Sofía Pariona Yupanqui", "F", 170, 4, "Elena Yupanqui Mendoza", null, 0.35],
  ["Santiago Mendoza Ayala", "M", 320, 5, "Lucía Ayala Prado", null, 0.7],
  ["Isabella Tineo Barboza", "F", 400, 6, "Carla Barboza Janampa", null, 0.95],
  ["Gael Huamaní Cisneros", "M", 500, 7, "Nancy Cisneros Ore", null, 0.5],
  ["Ariana Janampa Vila", "F", 620, 8, "Pilar Vila Gutiérrez", "PREMATURO", 0.65],
  ["Adrián Ore Sulca", "M", 700, 9, "Yolanda Sulca Ramos", null, 0.3],
  ["Emma Gutiérrez Pillaca", "F", 800, 10, "Silvia Pillaca Díaz", null, 0.9],
  ["Lucas Ramos Chávez", "M", 900, 11, "Doris Chávez León", null, 0.6],
  ["Mía Díaz Quicaño", "F", 1000, 12, "Gloria Quicaño Bautista", null, 0.75],
  ["Benjamín León Ñaupa", "M", 1300, 13, "Irma Ñaupa Huayta", null, 0.45],
  ["Renata Bautista Ccente", "F", 1500, 14, "Flor Ccente Arango", null, 0.85],
  ["Joaquín Huayta Palomino", "M", 1700, 15, "Martha Palomino Rojas", null, 0.55],
  ["Antonella Arango Cuba", "F", 1900, 16, "Rocío Cuba Sánchez", null, 0.7],
  ["Dylan Sánchez Taipe", "M", 2300, 1, "Lourdes Taipe Mitma", null, 0.4],
  ["Valeria Mitma Condori", "F", 2800, 2, "Norma Condori Huillca", null, 0.8],
  ["Samuel Condori Galindo", "M", 3200, 3, "Betty Galindo Poma", null, 0.6],
  ["Zoe Poma Rivera", "F", 360, 0, "Ana Rivera Loayza", null, 0.25],
  ["Leonardo Loayza Paucar", "M", 60, 1, "Carmen Paucar Villa", null, 0.8],
];

/** Pseudoaleatorio determinista para que el mock sea estable entre recargas. */
function rand(a: number, b: number) {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function buildSeed(today: string) {
  const ninos: Nino[] = SEMILLAS.map(([nombre, sexo, edad, eess, madre, condicion], i) => {
    const id = i + 1;
    const est = ESTABLECIMIENTOS[eess];
    const guardian = GUARDIAN_CHILD_IDS.includes(id);
    return {
      id,
      codPadron: `PAD-${String(250300 + id * 17).padStart(7, "0")}`,
      dni: edad < 30 && !guardian ? null : String(90000000 + id * 104729).slice(0, 8),
      nombre,
      sexo,
      fechaNacimiento: addDays(today, -edad),
      microRed: est.microRed,
      establecimiento: est.nombre,
      nombreMadre: madre,
      celular: `9${String(51000000 + id * 37321).slice(0, 8)}`,
      condicionRn: condicion,
      activo: true,
    };
  });

  // Padres: la familia Huamán (cuenta "usuario" del apoderado) y la madre de cada otro niño.
  const padres: Padre[] = [
    { id: GUARDIAN_PADRE_ID, nombre: "María Huamán Quispe", dni: "40125896", celular: "966 123 456", email: "maria.huaman@correo.pe", parentesco: "Madre", usuario: "usuario", hijos: [...GUARDIAN_CHILD_IDS] },
    { id: 2, nombre: "José Cárdenas Ramos", dni: "41258963", celular: "955 789 321", email: "", parentesco: "Padre", usuario: null, hijos: [...GUARDIAN_CHILD_IDS] },
    ...ninos
      .filter((n) => !GUARDIAN_CHILD_IDS.includes(n.id))
      .map((n, i) => ({
        id: i + 3,
        nombre: n.nombreMadre,
        dni: String(40000000 + n.id * 7919),
        celular: `9${String(62000000 + n.id * 1231).slice(0, 8)}`,
        email: "",
        parentesco: "Madre",
        usuario: null,
        hijos: [n.id],
      })),
  ];

  const registros: Registro[] = [];
  let registroId = 1;
  for (const nino of ninos) {
    const cumplimiento = SEMILLAS[nino.id - 1][6];
    const edad = ageDays(nino.fechaNacimiento, today);
    for (const p of PRESTACIONES_INICIALES) {
      const modulo = MODULOS_INICIALES.find((m) => m.codigo === p.moduloCodigo)!;
      if (!prestacionAplica(nino, modulo, p, edad)) continue;
      if (rand(nino.id, p.id) > cumplimiento) continue;
      const hasta = Math.min(p.edadMaxDias, edad);
      const dia = p.edadMinDias + Math.floor(rand(p.id, nino.id) * Math.max(0, hasta - p.edadMinDias));
      registros.push({
        id: registroId++,
        ninoId: nino.id,
        prestacionId: p.id,
        fechaAtencion: addDays(nino.fechaNacimiento, dia),
        establecimiento: nino.establecimiento,
        observaciones: rand(nino.id + 3, p.id) > 0.8 ? "Atención sin observaciones relevantes." : "",
        registradoPor: "importador",
      });
    }
  }

  const reclamos: Reclamo[] = [
    {
      id: 1,
      estado: "EN_REVISION",
      ninoId: 1,
      usuarioNombre: "María Huamán Quispe",
      propio: true,
      dniSolicitante: "40125896",
      dniNino: ninos[0].dni ?? "",
      identificadorNino: ninos[0].codPadron,
      establecimiento: "Belén",
      fechaAtencion: addDays(today, -40),
      mensaje: "Mi hija recibió la vacuna Pentavalente 2.a dosis pero en el sistema aparece como pendiente.",
      respuesta: "Estamos verificando el registro con el EESS Belén.",
      evidencias: [{ id: 1, nombre: "carnet_vacunacion.jpg" }],
      creadoEn: addDays(today, -35),
    },
    {
      id: 2,
      estado: "PENDIENTE",
      ninoId: 2,
      usuarioNombre: "María Huamán Quispe",
      propio: true,
      dniSolicitante: "40125896",
      dniNino: ninos[1].dni ?? "",
      identificadorNino: ninos[1].codPadron,
      establecimiento: "Belén",
      fechaAtencion: addDays(today, -10),
      mensaje: "El dosaje de hemoglobina de mi hijo se hizo hace 10 días y no figura.",
      respuesta: "",
      evidencias: [],
      creadoEn: addDays(today, -8),
    },
    {
      id: 3,
      estado: "RESUELTO",
      ninoId: 8,
      usuarioNombre: "Lucía Ayala Prado",
      propio: false,
      dniSolicitante: "40063352",
      dniNino: ninos[7].dni ?? "",
      identificadorNino: ninos[7].codPadron,
      establecimiento: "Vista Alegre",
      fechaAtencion: addDays(today, -60),
      mensaje: "La visita domiciliaria de 6 meses no está registrada.",
      respuesta: "Registro corregido por el EESS Vista Alegre.",
      evidencias: [{ id: 2, nombre: "constancia_visita.pdf" }],
      creadoEn: addDays(today, -58),
    },
  ];

  const stamp = nowStamp();
  const auditoria: Auditoria[] = [
    { id: 4, fechaHora: stamp, usuario: "admin", accion: "LOGIN", entidad: "usuarios", detalle: "Inicio de sesión" },
    { id: 3, fechaHora: `${addDays(today, -1)} 16:42`, usuario: "coordinador", accion: "ACTUALIZAR", entidad: "registros_atencion", detalle: "Isabella Tineo Barboza · CRED 01 año" },
    { id: 2, fechaHora: `${addDays(today, -2)} 10:05`, usuario: "admin", accion: "ACTUALIZAR", entidad: "reclamos", detalle: "Reclamo #3 → RESUELTO" },
    { id: 1, fechaHora: `${addDays(today, -3)} 08:30`, usuario: "sistema", accion: "IMPORTAR", entidad: "registros_atencion", detalle: `${registros.length} atenciones importadas desde Excel` },
  ];

  return {
    ninos,
    padres,
    registros,
    modulos: MODULOS_INICIALES.map((m) => ({ ...m })),
    prestaciones: PRESTACIONES_INICIALES.map((p) => ({ ...p })),
    reclamos,
    auditoria,
  };
}
