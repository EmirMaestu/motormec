import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { DashboardCards } from "../module-cards"
import { useUser } from "@clerk/clerk-react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Car, Clock, Play, Square, Pause } from "lucide-react"
import { WorkTimer } from "../ui/work-timer"

export default function Dashboard() {
  const { user } = useUser()

  // Determinar si el usuario es admin
  const isAdmin = user?.organizationMemberships?.[0]?.role === "org:admin"
  
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
                        <span className="font-medium">Ingresado:</span> {new Date(vehicle.entryDate).toLocaleDateString()}
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
                        <span className="font-medium">Ingresado:</span> {new Date(vehicle.entryDate).toLocaleDateString()}
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

  // Vista para administradores (mantener la vista original)
  return (
    <div className="space-y-6">
      {/* Cards de estadísticas con carousel */}
      <DashboardCards />

      {/* Actividad reciente */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Toyota Corolla 2020 - Mantenimiento completo</p>
                <p className="text-xs text-muted-foreground">Hace 2 horas</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Honda Civic 2019 - Reparación de frenos</p>
                <p className="text-xs text-muted-foreground">Hace 4 horas</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Ford Focus 2021 - Diagnóstico eléctrico</p>
                <p className="text-xs text-muted-foreground">Hace 6 horas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximas Citas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-l-4 border-red-500 pl-4">
              <div>
                <p className="text-sm font-medium">Chevrolet Aveo 2018</p>
                <p className="text-xs text-muted-foreground">Cambio de aceite</p>
              </div>
              <span className="text-xs text-red-600 font-medium">Urgente</span>
            </div>
            <div className="flex items-center justify-between border-l-4 border-yellow-500 pl-4">
              <div>
                <p className="text-sm font-medium">Nissan Sentra 2020</p>
                <p className="text-xs text-muted-foreground">Revisión general</p>
              </div>
              <span className="text-xs text-yellow-600 font-medium">Mañana</span>
            </div>
            <div className="flex items-center justify-between border-l-4 border-blue-500 pl-4">
              <div>
                <p className="text-sm font-medium">Hyundai Elantra 2019</p>
                <p className="text-xs text-muted-foreground">Alineación y balanceo</p>
              </div>
              <span className="text-xs text-blue-600 font-medium">2 días</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}