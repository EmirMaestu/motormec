import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CardRow, DataList } from "@/components/DataList";
import { Card, PageHeader, Spinner, StatCard } from "@/components/ui";
import { cn, formatCurrency } from "@/lib/utils";

type Tab = "financial" | "operational" | "strategic";
const TABS: { key: Tab; label: string }[] = [
  { key: "financial", label: "Financiero" },
  { key: "operational", label: "Operacional" },
  { key: "strategic", label: "Estratégico" },
];

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>("financial");
  return (
    <div>
      <PageHeader eyebrow="Análisis" title="Reportes" />
      <div className="flex gap-1 mb-6 rounded-[4px] bg-pale-sage p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-[4px] px-4 py-1.5 text-[14px] font-medium transition-colors",
              tab === t.key ? "bg-deep-forest text-paper-white" : "text-deep-forest hover:bg-paper-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "financial" ? <Financial /> : tab === "operational" ? <Operational /> : <Strategic />}
    </div>
  );
}

function Financial() {
  const { data, isLoading } = useQuery({
    queryKey: ["report", "financial"],
    queryFn: () =>
      api.get<{
        resumen: { ingresos: number; egresos: number; balance: number; ticketPromedio: number };
        porCategoria: { categoria: string; ingresos: number; egresos: number; count: number }[];
      }>("/api/reports/financial"),
  });
  if (isLoading || !data) return <Spinner />;
  return (
    <div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-8">
        <StatCard label="Ingresos" value={formatCurrency(data.resumen.ingresos)} accent />
        <StatCard label="Egresos" value={formatCurrency(data.resumen.egresos)} />
        <StatCard label="Balance" value={formatCurrency(data.resumen.balance)} />
        <StatCard label="Ticket prom." value={formatCurrency(data.resumen.ticketPromedio)} />
      </div>
      <DataList
        items={data.porCategoria}
        keyOf={(c) => c.categoria}
        emptyTitle="Sin datos"
        columns={[
          { header: "Categoría", cell: (c) => <span className="font-medium">{c.categoria}</span> },
          { header: "Ingresos", cell: (c) => formatCurrency(c.ingresos) },
          { header: "Egresos", cell: (c) => formatCurrency(c.egresos) },
          { header: "Movimientos", cell: (c) => c.count },
        ]}
        card={(c) => (
          <div className="space-y-2">
            <div className="font-medium text-deep-forest">{c.categoria}</div>
            <CardRow label="Ingresos">{formatCurrency(c.ingresos)}</CardRow>
            <CardRow label="Egresos">{formatCurrency(c.egresos)}</CardRow>
            <CardRow label="Movimientos">{c.count}</CardRow>
          </div>
        )}
      />
    </div>
  );
}

function Operational() {
  const { data, isLoading } = useQuery({
    queryKey: ["report", "operational"],
    queryFn: () =>
      api.get<{
        resumen: { totalVehiculos: number; vehiculosEnTaller: number; vehiculosEntregados: number; ingresosTotales: number };
        porEstado: { estado: string; cantidad: number }[];
      }>("/api/reports/operational"),
  });
  if (isLoading || !data) return <Spinner />;
  return (
    <div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-8">
        <StatCard label="Vehículos" value={data.resumen.totalVehiculos} />
        <StatCard label="En taller" value={data.resumen.vehiculosEnTaller} accent />
        <StatCard label="Entregados" value={data.resumen.vehiculosEntregados} />
        <StatCard label="Ingresos" value={formatCurrency(data.resumen.ingresosTotales)} />
      </div>
      <Card>
        <h3 className="eyebrow mb-3">Por estado</h3>
        <div className="space-y-2">
          {data.porEstado.map((e) => (
            <div key={e.estado} className="flex justify-between">
              <span className="text-charcoal">{e.estado}</span>
              <span className="font-display text-[18px] text-deep-forest">{e.cantidad}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Strategic() {
  const { data, isLoading } = useQuery({
    queryKey: ["report", "strategic"],
    queryFn: () =>
      api.get<{
        clientesEnRiesgo: number;
        kpis: { tasaRetencion: string; ticketPromedio: number; clientesNuevos: number; prediccionIngresosMensual: number };
        clientesRentables: { id: string; name: string; totalGastado: number }[];
      }>("/api/reports/strategic"),
  });
  if (isLoading || !data) return <Spinner />;
  return (
    <div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-8">
        <StatCard label="Retención" value={`${data.kpis.tasaRetencion}%`} accent />
        <StatCard label="Ticket prom." value={formatCurrency(data.kpis.ticketPromedio)} />
        <StatCard label="Clientes nuevos" value={data.kpis.clientesNuevos} />
        <StatCard label="Pred. mensual" value={formatCurrency(data.kpis.prediccionIngresosMensual)} />
      </div>
      <DataList
        items={data.clientesRentables.slice(0, 10)}
        keyOf={(c) => c.id}
        emptyTitle="Sin datos"
        columns={[
          { header: "Cliente rentable", cell: (c) => <span className="font-medium">{c.name}</span> },
          { header: "Total gastado", cell: (c) => formatCurrency(c.totalGastado) },
        ]}
        card={(c) => (
          <div className="flex items-center justify-between">
            <span className="font-medium text-deep-forest">{c.name}</span>
            <span>{formatCurrency(c.totalGastado)}</span>
          </div>
        )}
      />
    </div>
  );
}
