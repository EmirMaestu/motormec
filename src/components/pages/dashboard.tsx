import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { DashboardCards } from "../module-cards"
import { useUser } from "@clerk/clerk-react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Car, Clock, Play, Square, Pause, DollarSign, TrendingUp, Users, Wrench, Plus, ChevronDown } from "lucide-react"
import { WorkTimer } from "../ui/work-timer"
import { useNavigate } from "react-router-dom"
import { formatDateToDDMMYYYY } from "../../lib/dateUtils"

export default function Dashboard() {
  const { user } = useUser()
  const navigate = useNavigate()

  // Determinar si el usuario es admin
  const isAdmin = user?.organizationMemberships?.[0]?.role === "org:admin"

  // Estado de colapso de las secciones del dashboard
  const [openVehiculos, setOpenVehiculos] = useState(true)
  const [openTransacciones, setOpenTransacciones] = useState(true)
  const [openRendimiento, setOpenRendimiento] = useState(false)
  const [openEstado, setOpenEstado] = useState(false)
  
  // Obtener vehículos específicos para el usuario
  const vehicles = useQuery(api.vehicles.getVehiclesForUser, {
    userId: user?.id || "",
    isAdmin: isAdmin || false
  })

  const closeWorkDay = useMutation(api.vehicles.closeWorkDay)
  const startWorkOnVehicle = useMutation(api.vehicles.startWorkOnVehicle)
  const pauseWorkOnVehicle = useMutation(api.vehicles.pauseWorkOnVehicle)
  const completeWorkOnVehicle = useMutation(api.vehicles.completeWorkOnVehicle)
  const workDaySummary = useQuery(api.vehicles.getWorkDaySummary, {
    userId: user?.id || ""
  })

  // Datos adicionales para admin
  const financialSummary = useQuery(api.transactions.getFinancialSummary)
  const recentTransactions = useQuery(api.transactions.getActiveTransactions)
  const allVehiclesAdmin = useQuery(api.vehicles.getVehiclesForUser, {
    userId: user?.id || "",
    isAdmin: true
  })

  // Separar vehículos asignados y disponibles
  const assignedVehicles = vehicles?.filter(vehicle => 
    vehicle.responsibles?.some(r => r.userId === user?.id)
  ) || []
  
  const availableVehicles = vehicles?.filter(vehicle => 
    !vehicle.responsibles || vehicle.responsibles.length === 0
  ) || []

  const handleStartWork = async (vehicleId: string) => {
    if (!user) return
    
    await startWorkOnVehicle({
      vehicleId: vehicleId as any,
      userId: user.id,
      userName: user.fullName || user.firstName || "Usuario",
      isAdmin: isAdmin
    })
  }

  const handlePauseWork = async (vehicleId: string) => {
    if (!user) return
    
    try {
      const result = await pauseWorkOnVehicle({
        vehicleId: vehicleId as any,
        userId: user.id
      })
      console.log("Trabajo pausado:", result)
    } catch (error) {
      console.error("Error al pausar trabajo:", error)
      alert("Error al pausar el trabajo. Por favor intenta de nuevo.")
    }
  }

  const handleCompleteWork = async (vehicleId: string) => {
    if (!user) return
    
    try {
      const result = await completeWorkOnVehicle({
        vehicleId: vehicleId as any,
        userId: user.id
      })
      console.log("Trabajo completado:", result)
    } catch (error) {
      console.error("Error al completar trabajo:", error)
      alert("Error al completar el trabajo. Por favor intenta de nuevo.")
    }
  }

  // Función helper para determinar si el usuario está trabajando en un vehículo
  const isUserWorking = (vehicle: any) => {
    return vehicle.responsibles?.find((r: any) => r.userId === user?.id)?.isWorking || false
  }

  const handleCloseWorkDay = async () => {
    if (!user?.id) return
    
    const result = await closeWorkDay({
      userId: user.id
    })
    
    // Mostrar mensaje de confirmación (puedes usar un toast aquí)
    alert(`Día cerrado exitosamente. ${result.message}`)
    
    // Limpiar estado local si fuera necesario
  }

  if (!isAdmin) {
    // Vista para mecánicos (members)
    return (
      <div className="space-y-6">
        {/* Header de bienvenida */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900">¡Hola, {user?.firstName}!</h1>
          <p className="text-gray-600 mt-1">Aquí tienes el resumen de tu jornada de trabajo</p>
        </div>

        {/* Vehículos asignados */}
        {assignedVehicles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Mis Vehículos Asignados ({assignedVehicles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignedVehicles.map((vehicle) => (
                <div key={vehicle._id} className="border rounded-lg bg-blue-50 overflow-hidden">
                  {/* Header con información principal */}
                  <div className="p-4 pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <h3 className="font-semibold text-base">
                          {vehicle.brand} {vehicle.model} {vehicle.year}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">{vehicle.plate}</Badge>
                          <Badge 
                            variant={vehicle.status === "En Reparación" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {vehicle.status}
                          </Badge>
                          {isUserWorking(vehicle) && (
                            <Badge className="bg-green-500 text-white animate-pulse text-xs">
                              🔧 Trabajando
                            </Badge>
                          )}
                          {user && (
                            <WorkTimer 
                              userId={user.id} 
                              vehicle={vehicle} 
                              isWorking={isUserWorking(vehicle)}
                              showIcon={false}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Información del cliente y servicios */}
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Cliente:</span> {vehicle.owner}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Servicios:</span> {vehicle.services.join(", ")}
                      </p>
                      <p className="text-xs text-gray-500">
                        <span className="font-medium">Ingresado:</span> {formatDateToDDMMYYYY(vehicle.entryDate)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Footer con botones */}
                  <div className="px-4 py-3 bg-white/50 border-t border-blue-100">
                    <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                      {vehicle.status === "Listo" ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 w-fit">
                          ✅ Trabajo Completado
                        </Badge>
                      ) : isUserWorking(vehicle) ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            onClick={() => handlePauseWork(vehicle._id)}
                            variant="outline"
                            size="sm"
                            className="bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100 w-full sm:w-auto"
                          >
                            <Pause className="h-4 w-4 mr-2" />
                            Pausar
                          </Button>
                          <Button
                            onClick={() => handleCompleteWork(vehicle._id)}
                            variant="outline"
                            size="sm"
                            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 w-full sm:w-auto"
                          >
                            <Square className="h-4 w-4 mr-2" />
                            Completar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleStartWork(vehicle._id)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Iniciar Trabajo
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Vehículos disponibles */}
        {availableVehicles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Vehículos Disponibles ({availableVehicles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {availableVehicles.map((vehicle) => (
                <div key={vehicle._id} className="border rounded-lg overflow-hidden">
                  {/* Header con información principal */}
                  <div className="p-4 pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <h3 className="font-semibold text-base">
                          {vehicle.brand} {vehicle.model} {vehicle.year}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">{vehicle.plate}</Badge>
                          <Badge variant="secondary" className="text-xs">{vehicle.status}</Badge>
                        </div>
                      </div>
                    </div>
                    
                    {/* Información del cliente y servicios */}
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Cliente:</span> {vehicle.owner}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Servicios:</span> {vehicle.services.join(", ")}
                      </p>
                      <p className="text-xs text-gray-500">
                        <span className="font-medium">Ingresado:</span> {formatDateToDDMMYYYY(vehicle.entryDate)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Footer con botón */}
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                    <div className="flex justify-end">
                      <Button
                        onClick={() => handleStartWork(vehicle._id)}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Iniciar Trabajo
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {assignedVehicles.length === 0 && availableVehicles.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Car className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No hay vehículos para trabajar</h3>
              <p className="text-gray-500">No tienes vehículos asignados ni hay vehículos disponibles en este momento.</p>
            </CardContent>
          </Card>
        )}

        {/* Resumen del día y botón cerrar día */}
        {workDaySummary && (
          <Card>
            <CardHeader>
              <CardTitle>Resumen del Día</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{workDaySummary.totalAssigned}</p>
                  <p className="text-sm text-gray-600">Total Asignados</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">{workDaySummary.inProgress}</p>
                  <p className="text-sm text-gray-600">En Proceso</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{workDaySummary.completed}</p>
                  <p className="text-sm text-gray-600">Completados</p>
                </div>
              </div>
              
              <div className="flex justify-center">
                <Button 
                  onClick={handleCloseWorkDay}
                  variant="outline" 
                  size="lg"
                  className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                  disabled={workDaySummary.inProgress === 0}
                >
                  <Square className="h-5 w-5 mr-2" />
                  {workDaySummary.inProgress > 0 
                    ? `Cerrar Día (${workDaySummary.inProgress} trabajos en proceso)`
                    : "Día Cerrado - No hay trabajos en proceso"
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Vista completa para administradores
  return (
    <div className="space-y-6">
      {/* Header de bienvenida */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-gray-600 mt-1">Vista general completa del taller - {user?.firstName}</p>
      </div>

      {/* Cards de estadísticas con carousel */}
      <DashboardCards />

      {/* Resumen financiero */}
      {financialSummary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${financialSummary.totalIngresos?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Vehículos entregados
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Egresos Totales</CardTitle>
              <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                ${financialSummary.totalEgresos?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Gastos operativos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ganancia Neta</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                (financialSummary.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ${financialSummary.balance?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Balance mensual
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accesos rápidos */}
      <Card>
        <CardHeader>
          <CardTitle>Accesos Rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => navigate("/vehiculos")}
            >
              <Car className="h-6 w-6" />
              <span className="text-sm">Vehículos</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => navigate("/finanzas")}
            >
              <DollarSign className="h-6 w-6" />
              <span className="text-sm">Finanzas</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => navigate("/vehiculos")}
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm">Nuevo Vehículo</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => navigate("/socios")}
            >
              <Users className="h-6 w-6" />
              <span className="text-sm">Socios</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vehículos recientes y transacciones */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Vehículos en taller */}
        <Card className="flex flex-col">
          <CardHeader
            className="flex flex-row items-center justify-between pb-3 cursor-pointer select-none"
            onClick={() => setOpenVehiculos(o => !o)}
          >
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openVehiculos ? "" : "-rotate-90"}`} />
              Vehículos en Taller
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={(e) => { e.stopPropagation(); navigate("/vehiculos") }}>
              Ver todos
            </Button>
          </CardHeader>
          {openVehiculos && <CardContent className="flex-1 p-0">
            <div className="divide-y divide-gray-100">
              {allVehiclesAdmin?.slice(0, 5).map((vehicle) => (
                <div key={vehicle._id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50">
                    <Car className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{vehicle.plate} · {vehicle.brand} {vehicle.model}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant={
                        vehicle.status === "Listo" ? "default" :
                        vehicle.status === "En Reparación" ? "secondary" : "outline"
                      } className="text-[10px] h-4 px-1.5 py-0">
                        {vehicle.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate">{vehicle.owner}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">${vehicle.cost.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDateToDDMMYYYY(vehicle.entryDate)}</p>
                  </div>
                </div>
              ))}
              {(!allVehiclesAdmin || allVehiclesAdmin.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <Car className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No hay vehículos en el taller</p>
                </div>
              )}
            </div>
          </CardContent>}
        </Card>

        {/* Transacciones recientes */}
        <Card className="flex flex-col">
          <CardHeader
            className="flex flex-row items-center justify-between pb-3 cursor-pointer select-none"
            onClick={() => setOpenTransacciones(o => !o)}
          >
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openTransacciones ? "" : "-rotate-90"}`} />
              Transacciones Recientes
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={(e) => { e.stopPropagation(); navigate("/finanzas") }}>
              Ver todas
            </Button>
          </CardHeader>
          {openTransacciones && <CardContent className="flex-1 p-0">
            <div className="divide-y divide-gray-100">
              {recentTransactions?.slice(0, 5).map((transaction) => {
                // Tomar solo la primera parte antes de " - Cliente:" para no repetir info
                const shortDesc = transaction.description.split(" - Cliente:")[0];
                return (
                  <div key={transaction._id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      transaction.type === "Ingreso" ? "bg-green-50" : "bg-red-50"
                    }`}>
                      <DollarSign className={`h-4 w-4 ${
                        transaction.type === "Ingreso" ? "text-green-600" : "text-red-600"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{shortDesc}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant={transaction.type === "Ingreso" ? "default" : "destructive"} className="text-[10px] h-4 px-1.5 py-0">
                          {transaction.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">{transaction.category}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${
                        transaction.type === "Ingreso" ? "text-green-600" : "text-red-600"
                      }`}>
                        {transaction.type === "Egreso" ? "-" : "+"}${Math.abs(transaction.amount).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{formatDateToDDMMYYYY(transaction.date)}</p>
                    </div>
                  </div>
                );
              })}
              {(!recentTransactions || recentTransactions.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <DollarSign className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No hay transacciones registradas</p>
                </div>
              )}
            </div>
          </CardContent>}
        </Card>
      </div>

      {/* Métricas de rendimiento */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setOpenRendimiento(o => !o)}
          >
            <CardTitle className="flex items-center gap-2">
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openRendimiento ? "" : "-rotate-90"}`} />
              Rendimiento del Equipo
            </CardTitle>
          </CardHeader>
          {openRendimiento && <CardContent>
            <div className="space-y-4">
              {allVehiclesAdmin && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Vehículos con mecánico asignado</span>
                    </div>
                    <span className="text-sm font-medium">
                      {allVehiclesAdmin.filter(v => v.responsibles && v.responsibles.length > 0).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-orange-600" />
                      <span className="text-sm">Trabajos en proceso</span>
                    </div>
                    <span className="text-sm font-medium">
                      {allVehiclesAdmin.filter(v => v.responsibles?.some((r: any) => r.isWorking)).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-600" />
                      <span className="text-sm">Vehículos listos para entregar</span>
                    </div>
                    <span className="text-sm font-medium">
                      {allVehiclesAdmin.filter(v => v.status === "Listo").length}
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>}
        </Card>

        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setOpenEstado(o => !o)}
          >
            <CardTitle className="flex items-center gap-2">
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openEstado ? "" : "-rotate-90"}`} />
              Estado General
            </CardTitle>
          </CardHeader>
          {openEstado && <CardContent>
            <div className="space-y-4">
              {allVehiclesAdmin && (
                <>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {allVehiclesAdmin.length}
                    </div>
                    <p className="text-sm text-muted-foreground">Total vehículos</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-orange-600">
                        {allVehiclesAdmin.filter(v => v.status === "En Reparación").length}
                      </div>
                      <p className="text-xs text-muted-foreground">En reparación</p>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-green-600">
                        {allVehiclesAdmin.filter(v => v.status === "Listo").length}
                      </div>
                      <p className="text-xs text-muted-foreground">Listos</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>}
        </Card>
      </div>
    </div>
  )
}