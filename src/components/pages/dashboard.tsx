import { useUser } from "@clerk/clerk-react"
import { useOrganization } from "@clerk/clerk-react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useNavigate } from "react-router-dom"
import { formatDateToDDMMYYYY } from "../../lib/dateUtils"
import { useState } from "react"
import {
  Car,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wrench,
  Clock,
  CheckCircle2,
  Play,
  Pause,
  Square,
  ChevronRight,
  AlertCircle,
} from "lucide-react"
import { WorkTimer } from "../ui/work-timer"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"

// ── Helpers ──────────────────────────────────────────────────────────────────

function greeting(name?: string | null) {
  const h = new Date().getHours()
  const saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"
  return `${saludo}${name ? `, ${name}` : ""}`
}

function todayLabel() {
  return new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  trend?: "up" | "down" | "neutral"
  color: "green" | "red" | "blue" | "violet"
}) {
  const colors = {
    green: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    red: "bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400",
    blue: "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300",
    violet: "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300",
  }
  const valueColors = {
    green: "text-emerald-600 dark:text-emerald-400",
    red: "text-red-500 dark:text-red-400",
    blue: "text-gray-900 dark:text-zinc-100",
    violet: "text-gray-900 dark:text-zinc-100",
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-3 sm:p-5 flex flex-col gap-2 sm:gap-3 shadow-sm min-w-0">
      <div className="flex items-start justify-between gap-1">
        <span className="text-[9px] sm:text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider leading-tight">{label}</span>
        <div className={cn("p-1.5 sm:p-2 rounded-xl flex-shrink-0", colors[color])}>
          <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
        </div>
      </div>
      <div className="min-w-0">
        <p className={cn("text-base sm:text-2xl font-bold leading-tight truncate", valueColors[color])}>{value}</p>
        {sub && <p className="text-[10px] sm:text-xs text-gray-400 dark:text-zinc-500 mt-0.5 truncate">{sub}</p>}
      </div>
      {trend && (
        <div className="flex items-center gap-1">
          {trend === "up" && <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500" />}
          {trend === "down" && <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-400" />}
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    "En Reparación": "bg-amber-400",
    "Listo": "bg-emerald-400",
    "Esperando Repuestos": "bg-gray-400",
    "Presupuestado": "bg-gray-400",
  }
  return (
    <span className={cn("inline-block h-2 w-2 rounded-full flex-shrink-0", map[status] ?? "bg-gray-300")} />
  )
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────

function AdminDashboard({ userId }: { userId: string }) {
  const navigate = useNavigate()

  const allVehicles = useQuery(api.vehicles.getVehiclesForUser, {
    userId,
    isAdmin: true,
  })

  const financialSummary = useQuery(api.transactions.getFinancialSummary)
  const recentTransactions = useQuery(api.transactions.getActiveTransactions)

  const vehiclesInTaller = allVehicles?.filter(
    (v) => v.status !== "Entregado"
  ) ?? []

  const enReparacion = vehiclesInTaller.filter((v) => v.status === "En Reparación").length
  const listos = vehiclesInTaller.filter((v) => v.status === "Listo").length
  const esperando = vehiclesInTaller.filter(
    (v) => v.status === "Esperando Repuestos" || v.status === "Presupuestado"
  ).length

  const ingresos = financialSummary?.totalIngresos ?? 0
  const egresos = financialSummary?.totalEgresos ?? 0
  const balance = financialSummary?.balance ?? 0

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
        <div>
          <p className="text-xs text-gray-400 dark:text-zinc-500 capitalize">{todayLabel()}</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mt-0.5">Panel de control</h1>
        </div>
        <button
          onClick={() => navigate("/vehiculos")}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
        >
          <span>Ver todos los vehículos</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <KpiCard
          label="En taller"
          value={vehiclesInTaller.length}
          sub={`${enReparacion} en reparación`}
          icon={Wrench}
          color="blue"
        />
        <KpiCard
          label="Listos p/ entregar"
          value={listos}
          sub={listos === 1 ? "vehículo" : "vehículos"}
          icon={CheckCircle2}
          color="green"
        />
        <KpiCard
          label="Ingresos del mes"
          value={`$${ingresos.toLocaleString("es-AR")}`}
          sub="total facturado"
          icon={TrendingUp}
          color="green"
          trend="up"
        />
        <KpiCard
          label="Balance mensual"
          value={`$${balance.toLocaleString("es-AR")}`}
          sub={`egresos: $${egresos.toLocaleString("es-AR")}`}
          icon={DollarSign}
          color={balance >= 0 ? "green" : "red"}
          trend={balance >= 0 ? "up" : "down"}
        />
      </div>

      {/* ── Main content ── */}
      <div className="grid gap-4 lg:grid-cols-5 min-w-0">
        {/* Vehículos en taller — takes 3 cols */}
        <div className="lg:col-span-3 min-w-0 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Vehículos en taller</h2>
              <span className="ml-1 text-xs bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full font-medium">
                {vehiclesInTaller.length}
              </span>
            </div>
          </div>

          <div className="divide-y divide-gray-50 dark:divide-zinc-800/50">
            {vehiclesInTaller.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300 dark:text-zinc-600">
                <Car className="h-10 w-10 mb-3" />
                <p className="text-sm">No hay vehículos en el taller</p>
              </div>
            )}

            {vehiclesInTaller.slice(0, 6).map((vehicle) => (
              <button
                key={vehicle._id}
                onClick={() => navigate(`/vehiculos/${vehicle.plate}/detalle`)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors text-left group overflow-hidden min-w-0"
              >
                <StatusDot status={vehicle.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                    {vehicle.plate}
                    <span className="font-normal text-gray-400 dark:text-zinc-500 ml-2">
                      {vehicle.brand} {vehicle.model}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 truncate mt-0.5">
                    {vehicle.owner} · {formatDateToDDMMYYYY(vehicle.entryDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn(
                    "hidden sm:inline text-[11px] font-medium px-2 py-0.5 rounded-full",
                    vehicle.status === "Listo"
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                      : vehicle.status === "En Reparación"
                      ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
                      : "bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"
                  )}>
                    {vehicle.status}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-zinc-600 group-hover:text-gray-500 dark:group-hover:text-zinc-400 transition-colors" />
                </div>
              </button>
            ))}

            {vehiclesInTaller.length > 6 && (
              <button
                onClick={() => navigate("/vehiculos")}
                className="w-full px-5 py-3 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors text-center"
              >
                Ver {vehiclesInTaller.length - 6} más →
              </button>
            )}
          </div>
        </div>

        {/* Right column — takes 2 cols */}
        <div className="lg:col-span-2 min-w-0 space-y-4">
          {/* Estado rápido */}
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm p-5 min-w-0 overflow-hidden">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-4">Estado del taller</h2>
            <div className="space-y-3">
              {[
                { label: "En reparación", count: enReparacion, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/40" },
                { label: "Listos", count: listos, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
                { label: "En espera", count: esperando, color: "text-gray-600 dark:text-zinc-300", bg: "bg-gray-100 dark:bg-zinc-800" },
              ].map(({ label, count, color, bg }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", bg)}>
                    <span className={cn("text-sm font-bold", color)}>{count}</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-zinc-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transacciones recientes */}
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden min-w-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Últimas transacciones</h2>
              </div>
              <button
                onClick={() => navigate("/finanzas")}
                className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
              >
                Ver todas
              </button>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-zinc-800/50">
              {(!recentTransactions || recentTransactions.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-300 dark:text-zinc-600">
                  <DollarSign className="h-8 w-8 mb-2" />
                  <p className="text-xs">Sin transacciones</p>
                </div>
              )}
              {recentTransactions?.slice(0, 4).map((tx) => {
                const desc = tx.description.split(" - Cliente:")[0]
                const isIngreso = tx.type === "Ingreso"
                return (
                  <div key={tx._id} className="flex items-center gap-3 px-5 py-3 overflow-hidden min-w-0">
                    <div className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0",
                      isIngreso ? "bg-emerald-50 dark:bg-emerald-950/50" : "bg-red-50 dark:bg-red-950/50"
                    )}>
                      {isIngreso
                        ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                        : <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-zinc-200 truncate">{desc}</p>
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500">{formatDateToDDMMYYYY(tx.date)}</p>
                    </div>
                    <p className={cn(
                      "text-sm font-semibold flex-shrink-0",
                      isIngreso ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                    )}>
                      {isIngreso ? "+" : "-"}${Math.abs(tx.amount).toLocaleString("es-AR")}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Mechanic Dashboard ────────────────────────────────────────────────────────

function MechanicDashboard({ userId, userName }: { userId: string; userName: string }) {
  const vehicles = useQuery(api.vehicles.getVehiclesForUser, {
    userId,
    isAdmin: false,
  })

  const workDaySummary = useQuery(api.vehicles.getWorkDaySummary, { userId })

  const startWork = useMutation(api.vehicles.startWorkOnVehicle)
  const pauseWork = useMutation(api.vehicles.pauseWorkOnVehicle)
  const completeWork = useMutation(api.vehicles.completeWorkOnVehicle)
  const closeWorkDay = useMutation(api.vehicles.closeWorkDay)

  const [loading, setLoading] = useState<string | null>(null)

  const assignedVehicles = vehicles?.filter((v) =>
    v.responsibles?.some((r: any) => r.userId === userId)
  ) ?? []

  const availableVehicles = vehicles?.filter(
    (v) => !v.responsibles || v.responsibles.length === 0
  ) ?? []

  const isWorking = (v: any) =>
    v.responsibles?.find((r: any) => r.userId === userId)?.isWorking ?? false

  const handle = async (fn: () => Promise<any>, id: string) => {
    setLoading(id)
    try { await fn() } catch (e) { console.error(e) } finally { setLoading(null) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-gray-400 dark:text-zinc-500 capitalize">{todayLabel()}</p>
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mt-0.5">{greeting(userName)}</h1>
      </div>

      {/* Work day summary */}
      {workDaySummary && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Asignados", value: workDaySummary.totalAssigned, color: "text-gray-700 dark:text-zinc-300" },
            { label: "En proceso", value: workDaySummary.inProgress, color: "text-amber-600 dark:text-amber-400" },
            { label: "Completados", value: workDaySummary.completed, color: "text-emerald-600 dark:text-emerald-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-4 text-center shadow-sm">
              <p className={cn("text-2xl font-bold", color)}>{value}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Assigned vehicles */}
      {assignedVehicles.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Mis vehículos</h2>
            <span className="ml-1 text-xs bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full font-medium">
              {assignedVehicles.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-zinc-800/50">
            {assignedVehicles.map((vehicle) => {
              const working = isWorking(vehicle)
              const done = vehicle.status === "Listo"
              return (
                <div key={vehicle._id} className="flex items-center gap-3 px-5 py-4">
                  <StatusDot status={vehicle.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                        {vehicle.plate}
                      </p>
                      <span className="text-xs text-gray-400 dark:text-zinc-500">
                        {vehicle.brand} {vehicle.model}
                      </span>
                      {working && (
                        <WorkTimer userId={userId} vehicle={vehicle} isWorking showIcon={false} />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 truncate mt-0.5">
                      {vehicle.services.join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {done ? (
                      <span className="text-xs font-medium text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Listo
                      </span>
                    ) : working ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                          disabled={loading === vehicle._id + "pause"}
                          onClick={() => handle(() => pauseWork({ vehicleId: vehicle._id as any, userId }), vehicle._id + "pause")}
                        >
                          <Pause className="h-3 w-3 mr-1" /> Pausar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                          disabled={loading === vehicle._id + "done"}
                          onClick={() => handle(() => completeWork({ vehicleId: vehicle._id as any, userId }), vehicle._id + "done")}
                        >
                          <Square className="h-3 w-3 mr-1" /> Listo
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-700 dark:hover:bg-zinc-300"
                        disabled={loading === vehicle._id + "start"}
                        onClick={() => handle(() => startWork({
                          vehicleId: vehicle._id as any,
                          userId,
                          userName,
                          isAdmin: false,
                        }), vehicle._id + "start")}
                      >
                        <Play className="h-3 w-3 mr-1" /> Iniciar
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Available vehicles */}
      {availableVehicles.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Disponibles para tomar</h2>
            <span className="ml-1 text-xs bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full font-medium">
              {availableVehicles.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-zinc-800/50">
            {availableVehicles.map((vehicle) => (
              <div key={vehicle._id} className="flex items-center gap-3 px-5 py-4">
                <StatusDot status={vehicle.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                    {vehicle.plate}
                    <span className="font-normal text-gray-400 dark:text-zinc-500 ml-2">
                      {vehicle.brand} {vehicle.model}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 truncate mt-0.5">
                    {vehicle.services.join(", ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-700 dark:hover:bg-zinc-300 flex-shrink-0"
                  disabled={loading === vehicle._id + "start"}
                  onClick={() => handle(() => startWork({
                    vehicleId: vehicle._id as any,
                    userId,
                    userName,
                    isAdmin: false,
                  }), vehicle._id + "start")}
                >
                  <Play className="h-3 w-3 mr-1" /> Iniciar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {assignedVehicles.length === 0 && availableVehicles.length === 0 && (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-10 flex flex-col items-center text-gray-300 dark:text-zinc-600 shadow-sm">
          <Car className="h-10 w-10 mb-3" />
          <p className="text-sm font-medium text-gray-400 dark:text-zinc-500">Sin vehículos asignados</p>
          <p className="text-xs text-gray-300 dark:text-zinc-600 mt-1">Consultá con el administrador</p>
        </div>
      )}

      {/* Close day */}
      {workDaySummary && workDaySummary.inProgress > 0 && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-400">
              {workDaySummary.inProgress} {workDaySummary.inProgress === 1 ? "trabajo en proceso" : "trabajos en proceso"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50"
            onClick={async () => {
              await closeWorkDay({ userId })
            }}
          >
            Cerrar día
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useUser()
  const { membership } = useOrganization()

  const isAdmin = membership?.role === "org:admin"
  const userId = user?.id ?? ""
  const userName = user?.firstName ?? user?.fullName ?? "Usuario"

  if (!userId) return null

  if (isAdmin) {
    return <AdminDashboard userId={userId} />
  }

  return <MechanicDashboard userId={userId} userName={userName} />
}
