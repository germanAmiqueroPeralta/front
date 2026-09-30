import { StatusBadge, Progress, toneFor } from "@/components/dashboard/shared";
import { paqueteLabel } from "@/lib/dashboard/cred";
import type { PaqueteNino } from "@/lib/sisnat/logic";

/** Tarjeta de paquete de un niño (vigente / historial), usada en directorio y portal familiar. */
export function PackageCard({ paquete: p, onClick }: { paquete: PaqueteNino; onClick?: () => void }) {
  const pct = p.prestaciones ? Math.round((p.cumplidas * 100) / p.prestaciones) : 0;
  const estado = p.estado === "HISTORIAL" && p.retrasadas ? { label: "Vencido", tone: "danger" as const } : paqueteLabel[p.estado];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-xl border bg-background p-4 text-left ${p.estado === "ACTIVO" ? "border-primary/40" : "border-border"} ${onClick ? "transition hover:border-primary/60 hover:bg-primary/5" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold tracking-wide text-primary">{p.codigo}</span>
        <StatusBadge tone={estado.tone}>{estado.label}</StatusBadge>
      </div>
      <strong>{p.nombre}</strong>
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
          <span>
            {p.cumplidas}/{p.prestaciones} prestaciones cumplidas
          </span>
          <span className="font-semibold text-foreground">{pct}%</span>
        </div>
        <Progress value={pct} tone={p.prestaciones ? toneFor(pct) : "default"} />
      </div>
      {p.retrasadas > 0 && <p className="text-xs font-medium text-destructive">{p.retrasadas} retrasadas</p>}
    </Tag>
  );
}
