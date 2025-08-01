import { useState, useEffect } from "react"
import { useOrganization, useUser } from '@clerk/clerk-react'
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { 
  Users, 
  DollarSign, 
  Clock, 
  Car, 
  Wrench, 
  Trophy,
  Activity,
  Eye,
  Crown,
  User as UserIcon,
  CheckCircle
} from "lucide-react"
import { WorkTimer, formatWorkTime } from "../ui/work-timer"

interface OrganizationMember {
  id: string
  publicUserData: any
  role: string
}

interface PartnerStats {
  userId: string
  name: string
  isAdmin: boolean
  monthlyEarnings: number
  totalVehiclesWorked: number
  currentlyWorking: boolean
  currentVehicle?: any
  totalWorkTime: number
  completedVehicles: number
  vehiclesInProgress: number
  recentVehicles: any[]
  workSessions: any[]
}

export default function Partners() {
  const { user } = useUser()
  const { organization } = useOrganization()
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)


  // Obtener datos de vehículos para todos los usuarios
  const allVehicles = useQuery(api.vehicles.getVehiclesForUser, {
    userId: user?.id || "",
    isAdmin: true
  })

  // Obtener transacciones para calcular ingresos
  const allTransactions = useQuery(api.transactions.getActiveTransactions)

  // Obtener miembros de la organización
  useEffect(() => {
    const fetchMembers = async () => {
      if (organization) {
        try {
          setIsLoading(true)
          const memberships = await organization.getMemberships()
          setMembers(memberships.data?.filter(m => m.publicUserData) as OrganizationMember[] || [])
        } catch (error) {
          console.error('Error fetching organization members:', error)
        } finally {
          setIsLoading(false)
        }
      }
    }

    fetchMembers()
  }, [organization])

  // Calcular estadísticas por socio
  const calculatePartnerStats = (member: OrganizationMember): PartnerStats | null => {
    if (!member.publicUserData) return null
    
    const userId = member.publicUserData.userId
    const name = `${member.publicUserData.firstName || ''} ${member.publicUserData.lastName || ''}`.trim() || 'Usuario'
    const isAdmin = member.role === 'org:admin'

    // Vehículos donde el usuario ha trabajado
    const userVehicles = allVehicles?.filter(vehicle => 
      vehicle.responsibles?.some((r: any) => r.userId === userId)
    ) || []

    // Vehículo actual en el que está trabajando
    const currentVehicle = userVehicles.find(vehicle => 
      vehicle.responsibles?.some((r: any) => r.userId === userId && r.isWorking)
    )

    // Vehículos completados por este usuario
    const completedVehicles = userVehicles.filter(vehicle => 
      vehicle.status === "Entregado" || vehicle.status === "Listo"
    ).length

    // Vehículos en progreso
    const vehiclesInProgress = userVehicles.filter(vehicle => 
      vehicle.status === "En Reparación" || vehicle.status === "Ingresado"
    ).length

    // Calcular ingresos del último mes (vehículos entregados)
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    
    const monthlyEarnings = allTransactions?.filter(transaction => 
      transaction.type === "Ingreso" && 
      transaction.description.includes("🚗") &&
      new Date(transaction.date) >= lastMonth &&
      userVehicles.some(vehicle => 
        transaction.description.includes(vehicle.plate) &&
        vehicle.responsibles?.some((r: any) => r.userId === userId)
      )
    ).reduce((sum, transaction) => sum + transaction.amount, 0) || 0

    // Calcular tiempo total trabajado
    const totalWorkTime = userVehicles.reduce((total, vehicle) => {
      const responsible = vehicle.responsibles?.find((r: any) => r.userId === userId)
      return total + (responsible?.totalWorkTime || 0)
    }, 0)

    // Obtener vehículos recientes (últimos 5)
    const recentVehicles = userVehicles
      .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
      .slice(0, 5)

    // Obtener sesiones de trabajo
    const workSessions = userVehicles.flatMap(vehicle => {
      const responsible = vehicle.responsibles?.find((r: any) => r.userId === userId)
      return responsible?.workSessions || []
    }).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())

    return {
      userId,
      name,
      isAdmin,
      monthlyEarnings,
      totalVehiclesWorked: userVehicles.length,
      currentlyWorking: !!currentVehicle,
      currentVehicle,
      totalWorkTime,
      completedVehicles,
      vehiclesInProgress,
      recentVehicles,
      workSessions: workSessions.slice(0, 10) // Últimas 10 sesiones
    }
  }

  // Calcular estadísticas para todos los miembros
  const partnersStats = members.map(calculatePartnerStats)
    .filter((stats): stats is PartnerStats => stats !== null) // Filtrar nulls
    .sort((a, b) => b.monthlyEarnings - a.monthlyEarnings) // Ordenar por ingresos

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando información de socios...</p>
        </div>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No hay organización</h3>
          <p className="text-gray-500">Necesitas estar en una organización para ver los socios.</p>
        </div>
      </div>
    )
  }

  const selectedPartner = selectedMember ? partnersStats.find(p => p.userId === selectedMember) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Socios</h1>
        <p className="text-gray-600 mt-1">
          Rendimiento y estadísticas del equipo de trabajo
        </p>
      </div>

      {/* Estadísticas generales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Socios</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
            <p className="text-xs text-muted-foreground">
              {members.filter(m => m.role === 'org:admin').length} administradores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${partnersStats.reduce((sum, partner) => sum + partner.monthlyEarnings, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Último mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trabajos Activos</CardTitle>
            <Activity className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {partnersStats.filter(p => p.currentlyWorking).length}
            </div>
            <p className="text-xs text-muted-foreground">Socios trabajando ahora</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vehículos Completados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {partnersStats.reduce((sum, partner) => sum + partner.completedVehicles, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista de socios */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Socios del Taller</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {partnersStats.map((partner) => {
                const member = members.find(m => m.publicUserData.userId === partner.userId)
                if (!member) return null

                return (
                  <div 
                    key={partner.userId}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                      selectedMember === partner.userId 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedMember(partner.userId)}
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.publicUserData.imageUrl} />
                        <AvatarFallback>
                          {partner.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {partner.name}
                          </p>
                          {partner.isAdmin ? (
                            <Crown className="h-3 w-3 text-yellow-600" />
                          ) : (
                            <UserIcon className="h-3 w-3 text-blue-600" />
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-green-600 font-medium">
                            ${partner.monthlyEarnings.toLocaleString()}
                          </p>
                          {partner.currentlyWorking && (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              Trabajando
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {partner.totalVehiclesWorked} vehículos • {formatWorkTime(partner.totalWorkTime)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Detalles del socio seleccionado */}
        <div className="lg:col-span-2">
          {selectedPartner ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={members.find(m => m.publicUserData?.userId === selectedPartner.userId)?.publicUserData?.imageUrl || ''} />
                      <AvatarFallback className="text-lg">
                        {selectedPartner.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{selectedPartner.name}</CardTitle>
                        {selectedPartner.isAdmin ? (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <Crown className="h-3 w-3 mr-1" />
                            Administrador
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <UserIcon className="h-3 w-3 mr-1" />
                            Mecánico
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedPartner.currentlyWorking ? 'Trabajando actualmente' : 'Disponible'}
                      </p>
                    </div>
                  </div>
                  {selectedPartner.currentlyWorking && selectedPartner.currentVehicle && (
                    <WorkTimer 
                      userId={selectedPartner.userId} 
                      vehicle={selectedPartner.currentVehicle} 
                      isWorking={true}
                      className="text-sm"
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="overview" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="overview">Resumen</TabsTrigger>
                    <TabsTrigger value="vehicles">Vehículos</TabsTrigger>
                    <TabsTrigger value="work-sessions">Sesiones de Trabajo</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    {/* Métricas principales */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="text-lg font-bold text-green-600">
                                ${selectedPartner.monthlyEarnings.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">Ingresos mes</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <Car className="h-5 w-5 text-blue-600" />
                            <div>
                              <p className="text-lg font-bold">{selectedPartner.totalVehiclesWorked}</p>
                              <p className="text-xs text-muted-foreground">Vehículos totales</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-5 w-5 text-purple-600" />
                            <div>
                              <p className="text-lg font-bold">{formatWorkTime(selectedPartner.totalWorkTime)}</p>
                              <p className="text-xs text-muted-foreground">Tiempo total</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <Trophy className="h-5 w-5 text-yellow-600" />
                            <div>
                              <p className="text-lg font-bold">{selectedPartner.completedVehicles}</p>
                              <p className="text-xs text-muted-foreground">Completados</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Trabajo actual */}
                    {selectedPartner.currentVehicle && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-orange-600" />
                            Trabajo Actual
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-orange-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">
                                  {selectedPartner.currentVehicle.plate} - {selectedPartner.currentVehicle.brand} {selectedPartner.currentVehicle.model}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Cliente: {selectedPartner.currentVehicle.owner}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge>{selectedPartner.currentVehicle.status}</Badge>
                                  <Badge variant="outline" className="bg-green-100 text-green-800">
                                    🔧 Trabajando
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="vehicles" className="space-y-4">
                    <div className="space-y-3">
                      {selectedPartner.recentVehicles.map((vehicle) => (
                        <Card key={vehicle._id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium">
                                  {vehicle.plate} - {vehicle.brand} {vehicle.model} {vehicle.year}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Cliente: {vehicle.owner}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant={
                                    vehicle.status === "Entregado" ? "default" : 
                                    vehicle.status === "Listo" ? "secondary" : 
                                    "outline"
                                  }>
                                    {vehicle.status}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    Ingresado: {new Date(vehicle.entryDate).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">${vehicle.cost.toLocaleString()}</p>
                                {vehicle.responsibles?.find((r: any) => r.userId === selectedPartner.userId)?.totalWorkTime && (
                                  <p className="text-xs text-muted-foreground">
                                    {formatWorkTime(vehicle.responsibles.find((r: any) => r.userId === selectedPartner.userId)?.totalWorkTime || 0)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {selectedPartner.recentVehicles.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No hay vehículos asignados</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="work-sessions" className="space-y-4">
                    <div className="space-y-3">
                      {selectedPartner.workSessions.map((session, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">
                                  {new Date(session.startTime).toLocaleDateString('es-ES', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(session.startTime).toLocaleTimeString('es-ES', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                  {session.endTime && (
                                    <> - {new Date(session.endTime).toLocaleTimeString('es-ES', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}</>
                                  )}
                                </p>
                              </div>
                              <div className="text-right">
                                {session.duration && (
                                  <Badge variant="outline" className="font-mono">
                                    {formatWorkTime(session.duration)}
                                  </Badge>
                                )}
                                {!session.endTime && (
                                  <Badge className="bg-green-100 text-green-800">
                                    En progreso
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {selectedPartner.workSessions.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No hay sesiones de trabajo registradas</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Eye className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">
                    Selecciona un socio
                  </h3>
                  <p className="text-gray-500">
                    Haz clic en un socio de la lista para ver sus detalles y estadísticas.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}