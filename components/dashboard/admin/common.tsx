"use client";

import { ChevronLeft, ChevronRight, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { labelClass } from "@/components/dashboard/forms";
import { inputClass, secondaryButtonClass } from "@/lib/dashboard/cred";

/** Mientras carga muestra un indicador; si falló, el error del backend y un botón para reintentar. */
export function LoadState({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (error)
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
        {error}
        <button className={secondaryButtonClass} onClick={onRetry}>
          <RefreshCw className="size-4" />
          Reintentar
        </button>
      </div>
    );
  if (loading)
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Cargando...
      </div>
    );
  return <>{children}</>;
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  required = false,
  placeholder,
  hint,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className={labelClass}>
      <span>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      <select
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className={inputClass}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="grid flex-1 gap-1.5 text-xs font-medium text-muted-foreground">
      Buscar
      <span className="relative">
        <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
        <input
          className={`${inputClass} w-full min-w-56 pl-9`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  );
}

/** Texto de un campo de formulario; vacío → null (el backend lo guarda como "sin dato"). */
export const optional = (form: FormData, name: string) => String(form.get(name) ?? "").trim() || null;
export const required = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export const matches = (q: string, ...values: (string | null | undefined)[]) =>
  !q.trim() || values.join(" ").toLowerCase().includes(q.trim().toLowerCase());

/* ───────────── Paginado ───────────── */

const PAGE_SIZES = [10, 25, 50];

export type Pager = {
  page: number;
  pages: number;
  size: number;
  total: number;
  setPage: (page: number) => void;
  setSize: (size: number) => void;
};

/**
 * Pagina una lista ya filtrada. `resetKey` son los filtros de la pantalla: cuando cambian,
 * se vuelve a la primera página (si no, una búsqueda podría quedar en una página vacía).
 */
export function usePage<T>(rows: T[], resetKey = "") {
  const [state, setState] = useState({ key: resetKey, page: 0, size: PAGE_SIZES[0] });
  const size = state.size;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = state.key === resetKey ? Math.min(state.page, pages - 1) : 0;
  const pager: Pager = {
    page,
    pages,
    size,
    total: rows.length,
    setPage: (next) => setState({ key: resetKey, page: next, size }),
    setSize: (next) => setState({ key: resetKey, page: 0, size: next }),
  };
  return { items: rows.slice(page * size, page * size + size), pager };
}

/** Números de página a mostrar: primera, última y las vecinas de la actual (con "…" en los saltos). */
function pageList(page: number, pages: number): (number | "gap")[] {
  const wanted = new Set([0, pages - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i && p - sorted[i - 1] > 1 ? ["gap" as const, p] : [p]));
}

const pageButton =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-border px-2 text-sm font-medium transition hover:bg-accent disabled:pointer-events-none disabled:opacity-40";

export function Pagination({ pager, label = "registros" }: { pager: Pager; label?: string }) {
  const { page, pages, size, total, setPage, setSize } = pager;
  if (total <= PAGE_SIZES[0]) return null;
  const from = page * size + 1;
  const to = Math.min(total, from + size - 1);

  return (
    <nav aria-label="Paginado" className="mt-4 flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
      <span className="flex items-center gap-3">
        <span>
          {from}–{to} de {total} {label}
        </span>
        <label className="flex items-center gap-1.5">
          <span className="max-sm:sr-only">Mostrar</span>
          <select
            aria-label="Filas por página"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </span>
      <span className="flex items-center gap-1.5 text-foreground">
        <button className={pageButton} disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior">
          <ChevronLeft className="size-4" />
        </button>
        {pageList(page, pages).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              className={`${pageButton} ${p === page ? "border-primary bg-primary text-primary-foreground hover:bg-primary" : ""}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => setPage(p)}
            >
              {p + 1}
            </button>
          ),
        )}
        <button className={pageButton} disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Página siguiente">
          <ChevronRight className="size-4" />
        </button>
      </span>
    </nav>
  );
}
