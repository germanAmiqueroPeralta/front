"use client";

import { AlertTriangle, CheckCircle2, ClipboardList, Clock, Percent, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import { agrupar, directorio, modulosActivos } from "@/lib/sisnat/logic";
import type { Filtros } from "@/lib/sisnat/types";
import { Stat } from "@/components/dashboard/stat";
import {
  EmptyRow,
  FilterBar,
  LocationFilters,
  PageTitle,
  Progress,
  ResetButton,
  Table,
  Td,
  Tr,
  toneFor,
} from "@/components/dashboard/shared";

export function StatsView() {
  const { db, alcance } = useSisnat();
  const inicial: Filtros = { microRed: alcance.microRed ?? "", establecimiento: "" };
  const [filtros, setFiltros] = useState(inicial);
  const rows = useMemo(() => directorio(db, alcance, { busqueda: "", filtros }), [db, alcance, filtros]);

  const total = rows.length;
  const promedio = total ? Math.round(rows.reduce((s, r) => s + r.porcentaje, 0) / total) : 0;
  const alDia = rows.filter((r) => r.porcentaje >= 80).length;
  const retrasos = rows.filter((r) => r.porcentaje >= 50 && r.porcentaje < 80).length;
  const vencidos = rows.filter((r) => r.porcentaje < 50).length;
  const microData = agrupar(rows, (r) => r.nino.microRed);
  const eessData = agrupar(rows, (r) => r.nino.establecimiento);

  return (
    <>
      <PageTitle kicker="Centro de control"
        title="Estadísticas"
        subtitle="Indicadores operativos del programa y comparativos por microred y establecimiento."
      />
      <FilterBar>
        <LocationFilters alcance={alcance} value={filtros} onChange={setFiltros} />
        <ResetButton onClick={() => setFiltros(inicial)} />
      </FilterBar>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <Stat label="Total de niños" value={String(total)} detail="En el filtro actual" icon={Users} />
        <Stat label="Promedio de cumplimiento" value={`${promedio}%`} detail="Indicador general" icon={Percent} />
        <Stat label="Niños al día" value={String(alDia)} detail="Con cumplimiento ≥ 80%" icon={CheckCircle2} />
        <Stat label="Retrasos" value={String(retrasos)} detail="Entre 50% y 79%" icon={Clock} />
        <Stat label="Vencidos" value={String(vencidos)} detail="Menos de 50%" icon={AlertTriangle} />
        <Stat label="Paquetes activos" value={String(modulosActivos(db).length)} detail="Módulos visibles" icon={ClipboardList} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ComparisonCard title="Microredes" label="Microred" data={microData} />
        <ComparisonCard title="Establecimientos" label="Establecimiento" data={eessData} />
      </div>
    </>
  );
}

function ComparisonCard({
  title,
  label,
  data,
}: {
  title: string;
  label: string;
  data: { label: string; total: number; cumplidos: number; porcentaje: number }[];
}) {
  return (
    <section className="min-w-0">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card md:hidden">
        {data.length ? (
          data.map((item) => (
            <li key={item.label} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">
                  {item.cumplidos} de {item.total} niños al día
                </p>
              </div>
              <div className="w-20">
                <Progress value={item.porcentaje} tone={toneFor(item.porcentaje)} />
              </div>
              <span className="w-10 text-right text-sm font-semibold">{item.porcentaje}%</span>
            </li>
          ))
        ) : (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">Sin datos para mostrar.</li>
        )}
      </ul>
      <div className="max-md:hidden">
      <Table head={[label, "Niños", "Al día", "Cumplimiento"]} minWidth={420}>
        {data.length ? (
          data.map((item) => (
            <Tr key={item.label}>
              <Td className="font-medium">{item.label}</Td>
              <Td>{item.total}</Td>
              <Td>{item.cumplidos}</Td>
              <Td className="md:w-40">
                <div className="w-full min-w-28">
                  <div className="mb-1 text-xs font-semibold">{item.porcentaje}%</div>
                  <Progress value={item.porcentaje} tone={toneFor(item.porcentaje)} />
                </div>
              </Td>
            </Tr>
          ))
        ) : (
          <EmptyRow colSpan={4}>Sin datos para mostrar.</EmptyRow>
        )}
      </Table>
      </div>
    </section>
  );
}
