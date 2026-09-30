import type { LucideIcon } from "lucide-react";

export function Stat({
  label,
  value,
  detail,
  icon: Icon,
  className = "",
}: {
  className?: string;
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <div className={`min-w-0 rounded-xl border border-border bg-card p-3.5 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
        <span className="rounded-lg bg-primary/10 p-2 text-primary max-sm:hidden">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-1.5 break-words text-2xl font-bold sm:mt-3 sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground max-sm:hidden">{detail}</p>
    </div>
  );
}
