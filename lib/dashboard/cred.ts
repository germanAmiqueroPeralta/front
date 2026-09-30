import {
  Baby,
  BarChart3,
  ClipboardCheck,
  ListChecks,
  Contact,
  FileWarning,
  HeartHandshake,
  Hospital,
  KeyRound,
  History,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  MapIcon,
  MonitorSmartphone,
  MapPinned,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { SessionRole } from "@/lib/backend";
import type { View } from "@/hooks/use-view-history";
import type { EstadoPaquete, EstadoPrestacion, EstadoReclamo } from "@/lib/sisnat/types";

/** Etiquetas del rol real de sesión (viene del backend vía role_id). */
export const sessionRoleLabels: Record<SessionRole, string> = {
  guardian: "Apoderado",
  health_staff: "Coordinador de salud",
  admin: "Administrador",
};

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-accent disabled:pointer-events-none disabled:opacity-50";

export const linkButtonClass = "whitespace-nowrap text-sm font-semibold text-primary hover:underline";

export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary";

export type Tone = "default" | "danger" | "warn" | "good" | "muted";

export type NavItem = { label: string; icon: LucideIcon; view: View };
export type NavGroup = { label: string; icon: LucideIcon; items: NavItem[] };
export type NavEntry = NavItem | NavGroup;

export const isGroup = (entry: NavEntry): entry is NavGroup => "items" in entry;

/** Menú del administrador: primero lo que hay que llenar (en ese orden), luego lo demás. */
const adminNav: NavEntry[] = [
  { label: "Panel general", icon: LayoutDashboard, view: { name: "dashboard" } },
  {
    label: "Usuarios",
    icon: UserCog,
    items: [
      { label: "Roles", icon: ShieldCheck, view: { name: "roles" } },
      { label: "Usuarios", icon: Users, view: { name: "users" } },
      { label: "Permisos", icon: KeyRound, view: { name: "permissions" } },
    ],
  },
  {
    label: "Territorio",
    icon: MapPinned,
    items: [
      { label: "Micro redes", icon: MapIcon, view: { name: "regions" } },
      { label: "Establecimientos", icon: Hospital, view: { name: "facilities" } },
    ],
  },
  {
    label: "Padres y niños",
    icon: HeartHandshake,
    items: [
      { label: "Padres", icon: Contact, view: { name: "guardians" } },
      { label: "Niños", icon: Baby, view: { name: "children" } },
    ],
  },
  {
    label: "Atención CRED",
    icon: Stethoscope,
    items: [
      { label: "Seguimiento", icon: Search, view: { name: "search" } },
      { label: "Paquetes", icon: LayoutGrid, view: { name: "packages" } },
      { label: "Prestaciones", icon: ListChecks, view: { name: "services" } },
      { label: "Controles", icon: ClipboardCheck, view: { name: "controls" } },
      { label: "Reclamos", icon: FileWarning, view: { name: "claims" } },
    ],
  },
  { label: "Estadísticas", icon: BarChart3, view: { name: "stats" } },
  {
    label: "Seguridad",
    icon: ScrollText,
    items: [
      { label: "Alertas de riesgo", icon: ShieldAlert, view: { name: "alerts" } },
      { label: "Sesiones", icon: LogIn, view: { name: "sessions" } },
      { label: "Dispositivos", icon: MonitorSmartphone, view: { name: "devices" } },
      { label: "Cambios", icon: History, view: { name: "audit" } },
    ],
  },
];

/** Menú del coordinador (personal de salud): padres, niños, controles y reclamos. */
const staffNav: NavEntry[] = [
  { label: "Seguimiento", icon: Search, view: { name: "search" } },
  { label: "Padres", icon: Contact, view: { name: "guardians" } },
  { label: "Niños", icon: Baby, view: { name: "children" } },
  { label: "Controles", icon: ClipboardCheck, view: { name: "controls" } },
  { label: "Reclamos", icon: FileWarning, view: { name: "claims" } },
];

/** Menú lateral por rol (mismas secciones que la Red de Salud). */
export function navFor(role: SessionRole): NavEntry[] {
  if (role === "admin") return adminNav;
  if (role === "guardian")
    return [
      { label: "Mis hijos", icon: HeartHandshake, view: { name: "myChildren" } },
      { label: "Mis reclamos", icon: FileWarning, view: { name: "claims" } },
    ];
  return staffNav;
}

/** Sección del menú a la que pertenece cada vista (para resaltar el ítem activo). */
export function sectionOf(view: View, role: SessionRole): View["name"] {
  switch (view.name) {
    case "packageChoice":
    case "moduleChildren":
    case "modulePrestations":
    case "prestationChildren":
    case "packageConfig":
      return "packages";
    case "child":
      if (role === "guardian") return view.code ? "myChildren" : "tracking";
      return view.code ? "packages" : "directory";
    case "directoryChild":
      return "directory";
    case "guardianChild":
      return "myChildren";
    case "claimDetail":
    case "adminClaim":
      return "claims";
    case "carePackage":
      return "packages";
    case "childControls":
      return "controls";
    case "guardianDetail":
      return "guardians";
    default:
      return view.name;
  }
}

export const prestacionTone: Record<EstadoPrestacion, Tone> = {
  CUMPLIDO: "good",
  PENDIENTE: "warn",
  VENCIDO: "danger",
};

export const reclamoTone: Record<EstadoReclamo, Tone> = {
  PENDIENTE: "warn",
  EN_REVISION: "default",
  RESUELTO: "good",
  RECHAZADO: "danger",
};

export const paqueteLabel: Record<EstadoPaquete, { label: string; tone: Tone }> = {
  ACTIVO: { label: "Vigente", tone: "default" },
  HISTORIAL: { label: "Historial", tone: "muted" },
  FUTURO: { label: "Futuro", tone: "muted" },
};
