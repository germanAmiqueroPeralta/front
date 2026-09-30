"use client";

import { useState } from "react";
import { ChevronDown, HeartPulse, LogOut, ShieldCheck, X } from "lucide-react";
import type { Session } from "@/lib/backend";
import type { View } from "@/hooks/use-view-history";
import { isGroup, navFor, sessionRoleLabels, type NavItem } from "@/lib/dashboard/cred";

export function Sidebar({
  session,
  activeSection,
  onSelect,
  mobile,
  onCloseMobile,
  onLogout,
  badges,
}: {
  session: Session;
  activeSection: View["name"];
  onSelect: (view: View) => void;
  mobile: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  badges?: Partial<Record<View["name"], number>>;
}) {
  const entries = navFor(session.role);
  // Grupos desplegables: se abren con la pantalla actual y quedan abiertos hasta que el usuario los pliegue.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      entries.filter(isGroup).filter((g) => g.items.some((i) => i.view.name === activeSection)).map((g) => [g.label, true]),
    ),
  );
  const initials = session.name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");

  function item({ label, icon: Icon, view }: NavItem, group?: string) {
    const active = activeSection === view.name;
    const badge = badges?.[view.name];
    const nested = group !== undefined;
    return (
      <button
        key={label}
        onClick={() => {
          if (group) setOpen((o) => ({ ...o, [group]: true }));
          onSelect(view);
        }}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${nested ? "pl-9" : ""} ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent"}`}
      >
        <Icon className="size-4" />
        {label}
        {badge ? (
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? "bg-white/20" : "bg-destructive/10 text-destructive"}`}
          >
            {badge}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-4/5 max-w-xs flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:w-64 lg:max-w-none lg:translate-x-0 ${mobile ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HeartPulse className="size-5" />
        </div>
        <div>
          <p className="font-semibold text-sidebar-foreground">CRED Huamanga</p>
          <p className="text-xs text-sidebar-foreground/60">Red de Salud</p>
        </div>
        <button className="ml-auto lg:hidden" onClick={onCloseMobile} aria-label="Cerrar menú">
          <X className="size-5" />
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        {entries.map((entry) => {
          if (!isGroup(entry)) return item(entry);
          const Icon = entry.icon;
          const expanded = open[entry.label] ?? entry.items.some((i) => i.view.name === activeSection);
          return (
            <div key={entry.label} className="grid gap-1">
              <button
                onClick={() => setOpen((o) => ({ ...o, [entry.label]: !expanded }))}
                aria-expanded={expanded}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <Icon className="size-4" />
                {entry.label}
                <ChevronDown className={`ml-auto size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && entry.items.map((i) => item(i, entry.label))}
            </div>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-sidebar-border p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-sidebar-foreground/70">
          <ShieldCheck className="size-4 text-success" />
          Sesión segura
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{session.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{sessionRoleLabels[session.role]}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/10"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
