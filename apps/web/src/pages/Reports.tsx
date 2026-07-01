import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { api, qs } from "@/lib/api";
import { CardRow, DataList } from "@/components/DataList";
import { Button, Card, PageHeader, Spinner, StatCard } from "@/components/ui";
import { cn, formatCurrency } from "@/lib/utils";
import { downloadCsv, htmlTable, printDocument } from "@/lib/export";

type Tab = "financial" | "operational" | "strategic" | "calendar";
const TABS: { key: Tab; label: string }[] = [
  { key: "financial", label: "Financiero" },
  { key: "operational", label: "Operacional" },
  { key: "strategic", label: "Estratégico" },
  { key: "calendar", label: "Calendario" },
];

/** Botones CSV + PDF reutilizables para cualquier reporte. */
function ExportBar({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="mb-4 flex gap-2">
      <Button size="sm" variant="ghost" onClick={() => downloadCsv(title, headers, rows)}>
        <Download size={15} /> CSV
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          printDocument(
            title,
            `<h1>${title}</h1><div class="muted">Momec · ${new Date().toLocaleDateString("es-AR")}</div>${htmlTable(headers, rows)}`,
          )
        }
      >
        <Printer size={15} /> PDF
      </Button>
    </div>
  );
}

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
      {tab === "financial" ? (
        <Financial />
      ) : tab === "operational" ? (
        <Operational />
      ) : tab === "strategic" ? (
        <Strategic />
      ) : (
        <IntakeCalendar />
      )}
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
      <ExportBar
        title="Reporte financiero"
        headers={["Categoría", "Ingresos", "Egresos", "Movimientos"]}
        rows={data.porCategoria.map((c) => [c.categoria, c.ingresos, c.egresos, c.count])}
      />
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

/* ------------------------ Calendario de ingresos ------------------------ */

type DayEntry = {
  date: string;
  count: number;
  vehicles: { plate: string; brand: string; model: string; owner: string; status: string }[];
};
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function thisMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y!, m! - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function IntakeCalendar() {
  const [month, setMonth] = useState(thisMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["report", "intake", month],
    queryFn: () =>
      api.get<{ month: string; total: number; days: DayEntry[] }>(
        `/api/reports/intake-calendar${qs({ month })}`,
      ),
  });

  const byDay = new Map((data?.days ?? []).map((d) => [d.date, d]));
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y!, m!, 0).getDate();
  // Lunes = 0 … Domingo = 6
  const firstWeekday = (new Date(y!, m! - 1, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const sel = selected ? byDay.get(selected) : undefined;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setMonth(shiftMonth(month, -1)); setSelected(null); }}>
            <ChevronLeft size={16} />
          </Button>
          <span className="font-display text-[20px] text-deep-forest capitalize min-w-[160px] text-center">
            {MONTHS_ES[m! - 1]} {y}
          </span>
          <Button size="sm" variant="ghost" onClick={() => { setMonth(shiftMonth(month, 1)); setSelected(null); }}>
            <ChevronRight size={16} />
          </Button>
        </div>
        <span className="text-[14px] text-charcoal">{data?.total ?? 0} ingresos este mes</span>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <Card className="p-4">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[11px] font-medium uppercase tracking-[0.06em] text-charcoal pb-1">
                {w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />;
              const date = `${month}-${String(day).padStart(2, "0")}`;
              const entry = byDay.get(date);
              const count = entry?.count ?? 0;
              const isSel = selected === date;
              return (
                <button
                  key={date}
                  disabled={count === 0}
                  onClick={() => setSelected(date)}
                  className={cn(
                    "aspect-square rounded-[8px] border p-1.5 text-left transition-colors",
                    count === 0
                      ? "border-black/5 text-charcoal/50"
                      : isSel
                        ? "border-deep-forest bg-deep-forest text-paper-white"
                        : "border-black/10 bg-pale-sage hover:border-deep-forest text-deep-forest",
                  )}
                >
                  <div className="text-[13px] leading-none">{day}</div>
                  {count > 0 ? (
                    <div className={cn("mt-1 text-[11px] font-medium", isSel ? "text-chartreuse-lime" : "text-forest-mid")}>
                      {count} {count === 1 ? "auto" : "autos"}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {sel ? (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-[18px] text-deep-forest">
              Ingresos del {sel.date.split("-").reverse().join("/")}
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                downloadCsv(
                  `ingresos-${sel.date}`,
                  ["Patente", "Vehículo", "Dueño", "Estado"],
                  sel.vehicles.map((v) => [v.plate, `${v.brand} ${v.model}`, v.owner, v.status]),
                )
              }
            >
              <Download size={15} /> CSV
            </Button>
          </div>
          <DataList
            items={sel.vehicles}
            keyOf={(v) => v.plate + v.owner}
            emptyTitle="Sin ingresos"
            columns={[
              { header: "Patente", cell: (v) => <span className="font-medium">{v.plate}</span> },
              { header: "Vehículo", cell: (v) => `${v.brand} ${v.model}` },
              { header: "Dueño", cell: (v) => v.owner },
              { header: "Estado", cell: (v) => v.status },
            ]}
            card={(v) => (
              <div className="space-y-1">
                <div className="font-medium text-deep-forest">{v.plate} · {v.brand} {v.model}</div>
                <CardRow label="Dueño">{v.owner}</CardRow>
                <CardRow label="Estado">{v.status}</CardRow>
              </div>
            )}
          />
        </div>
      ) : (
        <p className="mt-4 text-[14px] text-charcoal">Tocá un día con ingresos para ver el detalle.</p>
      )}
    </div>
  );
}
