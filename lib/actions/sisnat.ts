"use server";

/**
 * Server actions falsas: validan permisos y datos como lo haría el backend
 * (mismas reglas que la API de la Red de Salud) pero no persisten nada.
 * El estado vive en el cliente (hooks/use-sisnat.tsx) mientras no exista la API real.
 */

import { cookies } from "next/headers";
import type { SessionRole } from "@/lib/backend";
import type { EstadoReclamo } from "@/lib/sisnat/types";

type Result = { ok: true } | { ok: false; error: string };

const delay = () => new Promise((r) => setTimeout(r, 250));

async function requireRole(allowed: SessionRole[]): Promise<string | null> {
  const role = (await cookies()).get("session_role")?.value as SessionRole | undefined;
  if (!role) return "Sesión no válida";
  if (!allowed.includes(role)) return "No tiene permisos para esta acción";
  return null;
}

export async function saveRecordAction(input: {
  fechaNacimiento: string;
  fechaAtencion: string;
  establecimiento: string;
  observaciones: string;
}): Promise<Result> {
  await delay();
  const denied = await requireRole(["admin", "health_staff"]);
  if (denied) return { ok: false, error: denied };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fechaAtencion))
    return { ok: false, error: "Fecha de atención inválida" };
  const today = new Date().toISOString().slice(0, 10);
  if (input.fechaAtencion > today || input.fechaAtencion < input.fechaNacimiento)
    return { ok: false, error: "La fecha debe estar entre el nacimiento y hoy" };
  if (!input.establecimiento) return { ok: false, error: "Seleccione un establecimiento" };
  return { ok: true };
}

const EVIDENCE_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export async function createClaimAction(form: FormData): Promise<Result> {
  await delay();
  const denied = await requireRole(["guardian"]);
  if (denied) return { ok: false, error: denied };
  for (const field of ["nino_id", "dni_solicitante", "dni_nino", "identificador_nino", "establecimiento", "mensaje"]) {
    if (!String(form.get(field) ?? "").trim()) return { ok: false, error: "Complete los campos obligatorios" };
  }
  if (!/^\d{8}$/.test(String(form.get("dni_solicitante"))))
    return { ok: false, error: "El DNI del solicitante debe tener 8 dígitos" };
  const files = form.getAll("evidencias").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 5) return { ok: false, error: "Máximo 5 evidencias" };
  if (files.some((f) => !EVIDENCE_TYPES.includes(f.type)))
    return { ok: false, error: "Solo se aceptan archivos JPG, PNG o PDF" };
  return { ok: true };
}

export async function updateClaimAction(input: { estado: EstadoReclamo; respuesta: string }): Promise<Result> {
  await delay();
  const denied = await requireRole(["admin"]);
  if (denied) return { ok: false, error: denied };
  if (!["PENDIENTE", "EN_REVISION", "RESUELTO", "RECHAZADO"].includes(input.estado))
    return { ok: false, error: "Estado inválido" };
  return { ok: true };
}

/* ───────────── Catálogo: paquetes y atenciones (solo administrador) ───────────── */

const CODE_RE = /^[A-Z0-9_]{2,20}$/;

function rangoInvalido(min: number, max: number) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 0) return "Las edades deben ser días enteros positivos";
  if (min > max) return "La edad mínima no puede ser mayor que la máxima";
  return null;
}

export async function savePackageAction(input: {
  codigo: string;
  nombre: string;
  descripcion: string;
  edadMinDias: number;
  edadMaxDias: number;
}): Promise<Result> {
  await delay();
  const denied = await requireRole(["admin"]);
  if (denied) return { ok: false, error: denied };
  if (!CODE_RE.test(input.codigo)) return { ok: false, error: "Código inválido: use MAYÚSCULAS, números o _ (2 a 20)" };
  if (!input.nombre.trim()) return { ok: false, error: "El nombre del paquete es obligatorio" };
  const rango = rangoInvalido(input.edadMinDias, input.edadMaxDias);
  return rango ? { ok: false, error: rango } : { ok: true };
}

export async function savePrestationAction(input: {
  codigo: string;
  nombre: string;
  grupo: string;
  edadMinDias: number;
  edadMaxDias: number;
}): Promise<Result> {
  await delay();
  const denied = await requireRole(["admin"]);
  if (denied) return { ok: false, error: denied };
  if (!CODE_RE.test(input.codigo)) return { ok: false, error: "Código inválido: use MAYÚSCULAS, números o _ (2 a 20)" };
  if (!input.nombre.trim() || !input.grupo.trim()) return { ok: false, error: "Nombre y grupo son obligatorios" };
  const rango = rangoInvalido(input.edadMinDias, input.edadMaxDias);
  return rango ? { ok: false, error: rango } : { ok: true };
}

export async function deleteCatalogAction(): Promise<Result> {
  await delay();
  const denied = await requireRole(["admin"]);
  return denied ? { ok: false, error: denied } : { ok: true };
}

/* ───────────── Niños y padres ───────────── */

const DNI_RE = /^\d{8}$/;

export async function saveChildAction(input: {
  nombre: string;
  dni: string;
  fechaNacimiento: string;
  establecimiento: string;
}): Promise<Result> {
  await delay();
  const denied = await requireRole(["admin", "health_staff"]);
  if (denied) return { ok: false, error: denied };
  if (input.nombre.trim().split(/\s+/).length < 2) return { ok: false, error: "Ingrese nombres y apellidos" };
  if (input.dni && !DNI_RE.test(input.dni)) return { ok: false, error: "El DNI debe tener 8 dígitos" };
  const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fechaNacimiento) || input.fechaNacimiento > today)
    return { ok: false, error: "Fecha de nacimiento inválida" };
  if (!input.establecimiento) return { ok: false, error: "Seleccione un establecimiento" };
  return { ok: true };
}

export async function saveParentAction(input: { nombre: string; dni: string; email: string }): Promise<Result> {
  await delay();
  const denied = await requireRole(["admin", "health_staff"]);
  if (denied) return { ok: false, error: denied };
  if (input.nombre.trim().split(/\s+/).length < 2) return { ok: false, error: "Ingrese nombres y apellidos" };
  if (!DNI_RE.test(input.dni)) return { ok: false, error: "El DNI debe tener 8 dígitos" };
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return { ok: false, error: "Correo inválido" };
  return { ok: true };
}

export async function deletePersonAction(): Promise<Result> {
  await delay();
  const denied = await requireRole(["admin"]);
  return denied ? { ok: false, error: denied } : { ok: true };
}
