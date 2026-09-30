/** Tipos del dominio SISNAT (mismo modelo que la Red de Salud). */

export type Modulo = {
  codigo: string;
  nombre: string;
  edadMinDias: number;
  edadMaxDias: number;
  descripcion: string;
  activo: boolean;
};

export type Prestacion = {
  id: number;
  moduloCodigo: string;
  codigo: string;
  nombre: string;
  grupo: string;
  grupoOrden: number;
  orden: number;
  edadMinDias: number;
  edadMaxDias: number;
};

export type Establecimiento = { nombre: string; microRed: string };

/** Padre, madre o apoderado. `usuario` es su cuenta de acceso al portal familiar. */
export type Padre = {
  id: number;
  nombre: string;
  dni: string;
  celular: string;
  email: string;
  parentesco: string;
  usuario: string | null;
  hijos: number[]; // ids de niños vinculados
};

export type Nino = {
  id: number;
  codPadron: string;
  dni: string | null;
  nombre: string;
  sexo: "M" | "F";
  fechaNacimiento: string; // YYYY-MM-DD
  microRed: string;
  establecimiento: string;
  nombreMadre: string;
  celular: string;
  condicionRn: string | null; // "PREMATURO", "BAJO PESO", ...
  activo: boolean;
};

/** Atención registrada para un niño en una prestación. */
export type Registro = {
  id: number;
  ninoId: number;
  prestacionId: number;
  fechaAtencion: string;
  establecimiento: string;
  observaciones: string;
  registradoPor: string;
};

export type EstadoPrestacion = "CUMPLIDO" | "PENDIENTE" | "VENCIDO";
export type EstadoPaquete = "ACTIVO" | "HISTORIAL" | "FUTURO";
export type EstadoReclamo = "PENDIENTE" | "EN_REVISION" | "RESUELTO" | "RECHAZADO";

export type Evidencia = { id: number; nombre: string; url?: string };

export type Reclamo = {
  id: number;
  estado: EstadoReclamo;
  ninoId: number;
  usuarioNombre: string;
  propio: boolean; // lo envió el apoderado de la sesión actual
  dniSolicitante: string;
  dniNino: string;
  identificadorNino: string;
  establecimiento: string;
  fechaAtencion: string | null;
  mensaje: string;
  respuesta: string;
  evidencias: Evidencia[];
  creadoEn: string;
};

export type Auditoria = {
  id: number;
  fechaHora: string;
  usuario: string;
  accion: string;
  entidad: string;
  detalle: string;
};

export type Filtros = { microRed: string; establecimiento: string };
