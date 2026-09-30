"use client";

import { Children, cloneElement, createContext, isValidElement, useContext } from "react";
import { Badge } from "@/components/ui/badge";
import { inputClass, secondaryButtonClass, type Tone } from "@/lib/dashboard/cred";
import { opcionesFiltro, type Alcance } from "@/lib/sisnat/logic";
import type { Filtros } from "@/lib/sisnat/types";

export function PageTitle({
  kicker,
  title,
  subtitle,
  action,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 md:flex-row md:items-end lg:mb-6 lg:pr-16 [&>button]:max-md:w-full">
      <div>
        <p className="text-sm font-medium text-primary">{kicker}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <Badge tone={tone}>{children}</Badge>;
}

export function Progress({ value, tone = "default" }: { value: number; tone?: Tone }) {
  const color =
    tone === "good" ? "bg-success" : tone === "danger" ? "bg-destructive" : tone === "warn" ? "bg-warning" : "bg-primary";
  return (
    <div className="h-2 rounded-full bg-muted">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function toneFor(pct: number): Tone {
  return pct >= 80 ? "good" : pct >= 50 ? "warn" : "danger";
}

/** Selectores de microred y establecimiento (el establecimiento depende de la microred). */
export function LocationFilters({
  alcance,
  value,
  onChange,
}: {
  alcance: Alcance;
  value: Filtros;
  onChange: (value: Filtros) => void;
}) {
  const { microRedes, establecimientos } = opcionesFiltro(alcance, value.microRed);
  return (
    <>
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        Microred
        <select
          className={inputClass}
          value={value.microRed}
          onChange={(e) => onChange({ microRed: e.target.value, establecimiento: "" })}
        >
          {!alcance.microRed && <option value="">Todas</option>}
          {microRedes.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        Establecimiento
        <select
          className={inputClass}
          value={value.establecimiento}
          onChange={(e) => onChange({ ...value, establecimiento: e.target.value })}
        >
          <option value="">Todos</option>
          {establecimientos.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </label>
    </>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 max-sm:[&>button]:w-full max-sm:[&>label]:w-full max-sm:[&_select]:w-full max-sm:[&>p]:ml-0">
      {children}
    </div>
  );
}

export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={`${secondaryButtonClass} h-10`} onClick={onClick}>
      Limpiar
    </button>
  );
}

const TableHead = createContext<string[] | null>(null);

/**
 * Tabla responsiva: en tablet/escritorio es una tabla normal; en celular cada fila
 * se muestra como tarjeta (primera columna como título y el resto como "etiqueta: valor").
 */
export function Table({ head, children, minWidth = 720 }: { head: string[]; children: React.ReactNode; minWidth?: number }) {
  return (
    <TableHead.Provider value={head}>
      <div className="md:overflow-x-auto md:rounded-xl md:border md:border-border md:bg-card">
        <table
          className="w-full text-left text-sm max-md:block md:min-w-(--table-min)"
          style={{ "--table-min": `${Math.min(minWidth, 680)}px` } as React.CSSProperties}
        >
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground max-md:hidden">
            <tr>
              {head.map((h, i) => (
                <th key={i} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:grid max-md:gap-3">{children}</tbody>
        </table>
      </div>
    </TableHead.Provider>
  );
}

type TdProps = { children?: React.ReactNode; className?: string; label?: string; first?: boolean };

export function Td({ children, className = "", label, first }: TdProps) {
  const mobile = first
    ? "max-md:block max-md:border-b max-md:border-border/60 max-md:pb-2.5 max-md:mb-1"
    : label
      ? "max-md:flex max-md:items-center max-md:justify-between max-md:gap-3 max-md:text-right"
      : "max-md:flex max-md:justify-end max-md:pt-2.5";
  return (
    <td className={`px-4 py-3 align-middle max-md:px-0 max-md:py-1.5 ${mobile} ${className}`}>
      {label && !first && <span className="shrink-0 text-left text-xs text-muted-foreground md:hidden">{label}</span>}
      {label && !first ? <span className="min-w-0 max-md:flex max-md:flex-wrap max-md:justify-end">{children}</span> : children}
    </td>
  );
}

export function Tr({ children }: { children: React.ReactNode }) {
  const head = useContext(TableHead);
  const cells = Children.toArray(children).filter(isValidElement) as React.ReactElement<TdProps>[];
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/30 max-md:block max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-4 max-md:last:border max-md:hover:bg-card">
      {head ? cells.map((cell, i) => cloneElement(cell, { label: head[i] ?? "", first: i === 0 })) : children}
    </tr>
  );
}

export function GroupRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr className="border-b border-border/60 bg-primary/5 max-md:mt-2 max-md:block max-md:border-0 max-md:bg-transparent">
      <th colSpan={colSpan} className="px-4 py-2 text-xs font-semibold tracking-wide text-primary max-md:block max-md:px-1 max-md:py-0">
        {children}
      </th>
    </tr>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr className="max-md:block max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card">
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground max-md:block">
        {children}
      </td>
    </tr>
  );
}

export function PersonCell({ name, detail }: { name: string; detail: string }) {
  return (
    <>
      <p className="font-semibold">{name}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </>
  );
}

/** Agrupa una lista respetando el orden de aparición (encabezados del Excel). */
export function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return [...map.entries()];
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
