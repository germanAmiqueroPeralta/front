/** Fechas como "YYYY-MM-DD" en UTC para que el cálculo de edad no dependa de la zona horaria. */

const DAY = 86_400_000;

function parse(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function todayISO() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    .toISOString()
    .slice(0, 10);
}

export function addDays(iso: string, days: number) {
  return new Date(parse(iso) + days * DAY).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((parse(to) - parse(from)) / DAY);
}

export function ageDays(birth: string, today = todayISO()) {
  return Math.max(0, daysBetween(birth, today));
}

export function formatAge(days: number) {
  if (days < 60) return `${days} días`;
  const months = Math.floor(days / 30.4);
  if (months < 24) return `${months} meses`;
  const years = Math.floor(days / 365.25);
  const rest = Math.floor((days - years * 365.25) / 30.4);
  return rest ? `${years} a ${rest} m` : `${years} años`;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}
