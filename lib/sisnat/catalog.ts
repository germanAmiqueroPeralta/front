import type { Establecimiento, Modulo, Prestacion } from "@/lib/sisnat/types";

/** Catálogo inicial: los 13 paquetes de atención (mismo que la Red de Salud). Luego se editan en el panel. */
export const MODULOS_INICIALES: Modulo[] = ([
  { codigo: "INMUNIZACIONES", nombre: "Inmunizaciones 2026", edadMinDias: 0, edadMaxDias: 1460, descripcion: "Esquema de vacunación por hito de edad" },
  { codigo: "IAG_08", nombre: "Neonatos", edadMinDias: 0, edadMaxDias: 28, descripcion: "CNV, atención inmediata, tamizaje y seguimiento del recién nacido" },
  { codigo: "IAG_09", nombre: "Prematuros o bajo peso", edadMinDias: 0, edadMaxDias: 730, descripcion: "Culminación de suplementación con hierro" },
  { codigo: "IAG_10", nombre: "Menores de 1 año", edadMinDias: 0, edadMaxDias: 365, descripcion: "CRED, vacunas, SOFE, hemoglobina y hierro" },
  { codigo: "IAG_11", nombre: "Menores de 12 meses", edadMinDias: 0, edadMaxDias: 365, descripcion: "Visitas domiciliarias con consejería" },
  { codigo: "IAG_13", nombre: "1 año", edadMinDias: 365, edadMaxDias: 729, descripcion: "CRED, inmunizaciones, hemoglobina y hierro" },
  { codigo: "IAG_17", nombre: "2 años", edadMinDias: 730, edadMaxDias: 1094, descripcion: "CRED, hemoglobina, suplementación y antiparasitario" },
  { codigo: "IAG_18", nombre: "2 años con crecimiento inadecuado", edadMinDias: 730, edadMaxDias: 1094, descripcion: "Seguimiento nutricional a 60 y 100 días" },
  { codigo: "IAG_19", nombre: "3 años", edadMinDias: 1095, edadMaxDias: 1459, descripcion: "CRED, hemoglobina, suplementación y antiparasitario" },
  { codigo: "IAG_20", nombre: "4 años", edadMinDias: 1460, edadMaxDias: 1824, descripcion: "CRED, hemoglobina, inmunizaciones, hierro y antiparasitario" },
  { codigo: "IAG_25", nombre: "5 a 11 años", edadMinDias: 1825, edadMaxDias: 4379, descripcion: "CRED, hemoglobina y entregas sucesivas de SOFE" },
  { codigo: "IAG_26", nombre: "Menores de 12 meses (ALI)", edadMinDias: 0, edadMaxDias: 365, descripcion: "Sesión demostrativa de preparación de alimentos ALI" },
  { codigo: "AG_21", nombre: "6 meses a 6 años", edadMinDias: 182, edadMaxDias: 2555, descripcion: "Paquete odontológico PAQ I / PAQ II" },
] as Omit<Modulo, "activo">[]).map((m) => ({ ...m, activo: true }));

type Punto = [codigo: string, nombre: string, min: number, max: number];

const VACUNAS: Punto[] = [
  ["RN_BCG", "BCG al nacer", 0, 60],
  ["RN_HVB", "Hepatitis B al nacer", 0, 60],
  ["IPV1", "IPV 1.a dosis", 60, 150],
  ["PENTA1", "Penta 1.a dosis", 60, 150],
  ["ROTAVIRUS1", "Rotavirus 1.a dosis", 60, 180],
  ["NEUMO1", "Neumococo 1.a dosis", 60, 180],
  ["IPV2", "IPV 2.a dosis", 120, 300],
  ["PENTA2", "Penta 2.a dosis", 120, 300],
  ["ROTAVIRUS2", "Rotavirus 2.a dosis", 120, 240],
  ["NEUMO2", "Neumococo 2.a dosis", 120, 300],
  ["IPV3", "IPV 3.a dosis", 180, 365],
  ["PENTA3", "Penta 3.a dosis", 180, 365],
  ["INFLUENZA", "Influenza pediátrica", 180, 730],
  ["SPR1", "SPR 1.a dosis", 365, 540],
  ["DPT1", "DPT 1.er refuerzo", 365, 730],
];

/** Grupos (encabezados del Excel) y sus puntos de atención por paquete. */
const PUNTOS: Record<string, [grupo: string, puntos: Punto[]][]> = {
  INMUNIZACIONES: [["DIRECTO", VACUNAS]],
  IAG_08: [
    ["CNV EN LINEA", [["CNV_LIGA", "Liga / corte CNV", 0, 28], ["CNV_LACTANCIA", "Cumple lactancia precoz CNV", 0, 28], ["CNV", "Cumple CNV", 0, 28]]],
    ["ATENCION INMEDIATA DEL RECIEN NACIDO", [["BCG", "BCG", 0, 28], ["HVB", "Hepatitis B", 0, 28], ["CPP", "Contacto piel a piel", 0, 28], ["LME", "Lactancia materna exclusiva primera hora", 0, 28]]],
    ["TAMIZAJE NEONATAL", [["TAMIZAJE", "Tamizaje neonatal", 0, 28]]],
    ["CONTROL CRED RN", [["CRED_RN_1", "CRED N.° 01", 0, 28], ["CRED_RN_2", "CRED N.° 02", 0, 28], ["CRED_RN_3", "CRED N.° 03", 0, 28], ["CRED_RN_4", "CRED N.° 04", 0, 28]]],
    ["VISITA DOMICILIARIA", [["VISITA_ANAMNESIS", "Anamnesis y examen físico", 0, 28], ["VISITA_FAMILIAR", "Visita familiar", 0, 28], ["VISITA_CUIDADO", "Cuidado neonatal", 0, 28], ["VISITA_LACTANCIA", "Consejería de lactancia materna", 0, 28], ["VISITA_CORDON", "Cuidado del cordón umbilical", 0, 28], ["VISITA_ALARMA", "Signos de alarma", 0, 28], ["VISITA_HIGIENE", "Higiene del recién nacido", 0, 28]]],
  ],
  IAG_09: [["DIRECTO", [["HIERRO_PREMATURO", "Culminación de suplementación con hierro", 0, 730], ["HB_PREMATURO", "Dosaje de hemoglobina", 0, 730]]]],
  IAG_10: [
    ["CRED RECIEN NACIDO", [["CRED_RN", "CRED recién nacido", 0, 365]]],
    ["CRED DE 1 A 11 MESES", [["CRED_MENOR", "CRED de 1 a 11 meses", 0, 365]]],
    ["VACUNAS", [["NEUMO", "Neumococo", 60, 365], ["ROTAVIRUS", "Rotavirus", 60, 365], ["IPV", "IPV", 60, 365], ["PENTA", "Pentavalente", 60, 365]]],
    ["ENTREGA DE SOFE", [["SOFE", "Entrega de sulfato ferroso", 60, 365]]],
    ["DOSAJE DE HEMOGLOBINA", [["HB", "Dosaje de hemoglobina", 180, 365]]],
    ["SUPLEMENTACION CON HIERRO", [["HIERRO", "Suplementación con hierro", 60, 365]]],
  ],
  IAG_11: [
    ["VISITA DOMICILIARIA RECIEN NACIDO", [["VISITA_RN", "Visita RN: lactancia, cordón y signos de alarma", 0, 60]]],
    ["VISITA 04 MESES", [["VISITA_4M", "Visita domiciliaria 4 meses", 90, 150]]],
    ["VISITA 06 MESES", [["VISITA_6M", "Visita domiciliaria 6 meses", 150, 240]]],
    ["VISITA DOMICILIARIA 08 MESES", [["VISITA_8M", "Visita domiciliaria 8 meses", 210, 300]]],
    ["VISITA DOMICILIARIA 09 MESES", [["VISITA_9M", "Visita domiciliaria 9 meses", 240, 365]]],
  ],
  IAG_13: [
    ["CRED 01 AÑO", [["CRED_1", "CRED 01 año", 365, 729]]],
    ["INMUNIZACIONES", [["INMUNIZACION_1", "Inmunizaciones del año", 365, 729]]],
    ["DOSAJE DE HEMOGLOBINA", [["HB_1", "Dosaje de hemoglobina", 365, 729]]],
    ["SUPLEMENTACION CON HIERRO", [["HIERRO_1", "Suplementación con hierro", 365, 729]]],
  ],
  IAG_17: [
    ["CRED 02 AÑOS", [["CRED_2", "CRED 02 años", 730, 1094]]],
    ["DOSAJE DE HEMOGLOBINA", [["HB_2", "Dosaje de hemoglobina", 730, 1094]]],
    ["SUPLEMENTACION - ESQUEMA 2 AÑOS", [["HIERRO_2", "Suplementación esquema 2 años", 730, 1094]]],
    ["PROFILAXIS ANTIPARASITARIA", [["ANTIPARASITARIO_2", "Profilaxis antiparasitaria", 730, 1094]]],
  ],
  IAG_18: [["DIRECTO", [["NUTRICION_60", "Seguimiento nutricional a 60 días", 730, 1094], ["NUTRICION_100", "Seguimiento nutricional a 100 días", 730, 1094]]]],
  IAG_19: [
    ["CRED 03 AÑOS", [["CRED_3", "CRED 03 años", 1095, 1459]]],
    ["DOSAJE DE HEMOGLOBINA", [["HB_3", "Dosaje de hemoglobina", 1095, 1459]]],
    ["SUPLEMENTACION - ESQUEMA 03 AÑOS", [["HIERRO_3", "Suplementación esquema 3 años", 1095, 1459]]],
    ["PROFILAXIS ANTIPARASITARIA", [["ANTIPARASITARIO_3", "Profilaxis antiparasitaria", 1095, 1459]]],
  ],
  IAG_20: [
    ["CRED 04 AÑOS", [["CRED_4", "CRED 04 años", 1460, 1824]]],
    ["DOSAJE DE HEMOGLOBINA", [["HB_4", "Dosaje de hemoglobina", 1460, 1824]]],
    ["INMUNIZACIONES", [["INMUNIZACION_4", "Inmunizaciones de 4 años", 1460, 1824]]],
    ["SUPLEMENTACION - ESQUEMA 04 AÑOS", [["HIERRO_4", "Suplementación esquema 4 años", 1460, 1824]]],
    ["PROFILAXIS ANTIPARASITARIA", [["ANTIPARASITARIO_4", "Profilaxis antiparasitaria", 1460, 1824]]],
  ],
  IAG_25: [
    ["NIÑAS/NIÑOS DE 5 A 11 AÑOS", [["CRED_5_11", "CRED 5 a 11 años", 1825, 4379], ["HB_5_11", "Dosaje de hemoglobina", 1825, 4379], ["SOFE1", "1.a entrega sucesiva de SOFE", 1825, 4379], ["SOFE2", "2.a entrega sucesiva de SOFE", 1825, 4379], ["SOFE3", "3.a entrega sucesiva de SOFE", 1825, 4379], ["SOFE_TA", "Entrega adicional de SOFE", 1825, 4379], ["ANTIPARASITARIO_5_11", "Profilaxis antiparasitaria", 1825, 4379], ["VPH", "Vacuna VPH", 1825, 4379]]],
  ],
  IAG_26: [["RECIBE SESIONES DEMOSTRATIVA EN ALI", [["ALI", "Sesión demostrativa de preparación de alimentos ALI", 0, 365], ["ALI_GOBIERNO_LOCAL", "Sesión promovida por gobierno local", 0, 365]]]],
  AG_21: [["CARTERA ODONTOLÓGICA", [["EVAL_ORAL", "Evaluación oral", 182, 2555], ["PAQ_ODONT_1", "Paquete odontológico preventivo I", 182, 2555], ["PAQ_ODONT_2", "Paquete odontológico preventivo II", 182, 2555]]]],
};

export const PRESTACIONES_INICIALES: Prestacion[] = (() => {
  const list: Prestacion[] = [];
  let id = 1;
  for (const modulo of MODULOS_INICIALES) {
    let orden = 1;
    (PUNTOS[modulo.codigo] ?? []).forEach(([grupo, puntos], index) => {
      for (const [codigo, nombre, min, max] of puntos) {
        list.push({
          id: id++,
          moduloCodigo: modulo.codigo,
          codigo,
          nombre,
          grupo,
          grupoOrden: index + 1,
          orden: orden++,
          edadMinDias: min,
          edadMaxDias: max,
        });
      }
    });
  }
  return list;
})();

export const ESTABLECIMIENTOS: Establecimiento[] = [
  ["Belén", "BELEN"], ["Barrios Altos", "BELEN"], ["Huascahura", "BELEN"], ["Santa Ana", "BELEN"],
  ["Carmen Alto", "CARMEN ALTO"], ["Vista Alegre", "CARMEN ALTO"], ["Yanama", "CARMEN ALTO"],
  ["Chiara", "CHIARA"], ["Allpachaca", "CHIARA"],
  ["Chontaca", "CHONTACA"], ["Acocro", "CHONTACA"],
  ["Licenciados", "LICENCIADOS"], ["Centro de Salud Nazareno", "LICENCIADOS"], ["Mollepata", "LICENCIADOS"],
  ["Muyurina", "MUYURINA"], ["Pacaycasa", "MUYURINA"], ["Simpapata", "MUYURINA"],
].map(([nombre, microRed]) => ({ nombre, microRed }));
