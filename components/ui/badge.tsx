import type { Tone } from "@/lib/dashboard/cred";

const toneClass: Record<Tone, string> = {
  danger: "bg-destructive/10 text-destructive",
  warn: "bg-warning/15 text-warning",
  good: "bg-success/12 text-success",
  muted: "bg-muted text-muted-foreground",
  default: "bg-primary/10 text-primary",
};

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}
