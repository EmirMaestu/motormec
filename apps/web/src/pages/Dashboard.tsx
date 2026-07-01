import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CardRow, DataList } from "@/components/DataList";
import { Badge, Card, PageHeader, SkeletonList, StatCard } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Transaction, Vehicle, VehicleStats } from "@/lib/types";

interface DashboardData {
  role: "admin" | "mecanico";
  vehicleStats: VehicleStats;
  myVehicles: Vehicle[];
  workDay: { totalAssigned: number; inProgress: number; completed: number };
  finance: {
    totalIngresos: number;
    totalEgresos: number;
    balance: number;
    recentTransactions: Transaction[];
  } | null;
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/api/dashboard"),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader eyebrow="Resumen" title="Dashboard" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-[16px] bg-deep-forest/10 animate-pulse" />
          ))}
        </div>
        <SkeletonList rows={4} />
      </div>
    );
  }
  const s = data.vehicleStats;

  return (
    <div>
      <PageHeader eyebrow="Resumen" title="Dashboard" />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard label="En el taller" value={s.inTaller} hint={`${s.total} en total`} />
        <StatCard label="Listos para entregar" value={s.byStatus.listos} accent />
        <StatCard label="En reparación" value={s.byStatus.enReparacion} />
        {data.finance ? (
          <StatCard label="Balance" value={formatCurrency(data.finance.balance)} />
        ) : (
          <StatCard label="Mis vehículos" value={data.workDay.totalAssigned} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="font-display text-[22px] text-deep-forest mb-3">
            {data.role === "admin" ? "Vehículos en el taller" : "Mis vehículos"}
          </h2>
          <DataList
            items={data.myVehicles.slice(0, 8)}
            keyOf={(v) => v.id}
            emptyTitle="Sin vehículos para mostrar"
            columns={[
              { header: "Patente", cell: (v) => <span className="font-medium">{v.plate}</span> },
              { header: "Vehículo", cell: (v) => `${v.brand} ${v.model}`.trim() || "—" },
              { header: "Estado", cell: (v) => <Badge tone={v.status}>{v.status}</Badge> },
              { header: "Ingreso", cell: (v) => formatDate(v.entryDate) },
            ]}
            card={(v) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-[18px] text-deep-forest">{v.plate}</div>
                    <div className="text-[13px] text-charcoal">{`${v.brand} ${v.model}`.trim() || "—"}</div>
                  </div>
                  <Badge tone={v.status}>{v.status}</Badge>
                </div>
                <CardRow label="Ingreso">{formatDate(v.entryDate)}</CardRow>
              </div>
            )}
          />
        </div>

        <div>
          <h2 className="font-display text-[22px] text-deep-forest mb-3">
            {data.finance ? "Movimientos recientes" : "Mi jornada"}
          </h2>
          {data.finance ? (
            <Card className="space-y-3">
              {data.finance.recentTransactions.length === 0 ? (
                <p className="text-charcoal text-[14px]">Sin movimientos.</p>
              ) : (
                data.finance.recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[14px]">{t.description}</div>
                      <div className="text-[12px] text-charcoal">{formatDate(t.date)}</div>
                    </div>
                    <span className={t.type === "Ingreso" ? "text-vivid-green font-medium" : "text-red-700 font-medium"}>
                      {t.type === "Ingreso" ? "+" : "−"}
                      {formatCurrency(Math.abs(t.amount))}
                    </span>
                  </div>
                ))
              )}
            </Card>
          ) : (
            <Card className="space-y-3">
              <Row label="Asignados" value={data.workDay.totalAssigned} />
              <Row label="En progreso" value={data.workDay.inProgress} />
              <Row label="Completados" value={data.workDay.completed} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-charcoal text-[14px]">{label}</span>
      <span className="font-display text-[22px] text-deep-forest">{value}</span>
    </div>
  );
}
