import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { 
  Users, 
  DollarSign, 
  Car, 
  TrendingUp,
  Calendar,
  BarChart3,
  PieChart,
  Activity
} from "lucide-react"
import { CustomerCards } from "../module-cards"

interface CustomerAnalytics {
  period: string
  totalRevenue: number
  totalCustomers: number
  totalVehicles: number
  averageTicket: number
  newCustomers: number
  returningCustomers: number
  topCustomers: Array<{
    id: string
    name: string
    revenue: number
    vehicleCount: number
  }>
  revenueByMonth: Array<{
    month: string
    revenue: number
    customers: number
  }>
}

export default function CustomerDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("thisMonth")
  const [selectedView, setSelectedView] = useState("overview")

  // Queries
  const customers = useQuery(api.customers.getActiveCustomers) || []
  const vehiclesWithCustomers = useQuery(api.vehicles.getVehiclesWithCustomers) || []

  // Calcular métricas por período
  const calculatePeriodMetrics = (): CustomerAnalytics => {
    const now = new Date()
    let startDate = new Date()
    let periodLabel = ""

    switch (selectedPeriod) {
      case "thisWeek":
        startDate.setDate(now.getDate() - 7)
        periodLabel = "Esta Semana"
        break
      case "thisMonth":
        startDate.setMonth(now.getMonth())
        startDate.setDate(1)
        periodLabel = "Este Mes"
        break
      case "last3Months":
        startDate.setMonth(now.getMonth() - 3)
        periodLabel = "Últimos 3 Meses"
        break
      case "thisYear":
        startDate.setFullYear(now.getFullYear())
        startDate.setMonth(0)
        startDate.setDate(1)
        periodLabel = "Este Año"
        break
      default:
        startDate.setMonth(now.getMonth())
        startDate.setDate(1)
        periodLabel = "Este Mes"
    }

    // Filtrar vehículos por período
    const periodVehicles = vehiclesWithCustomers.filter(vehicle => 
      new Date(vehicle.entryDate) >= startDate
    )

    // Calcular métricas
    const totalRevenue = periodVehicles.reduce((sum, vehicle) => sum + vehicle.cost, 0)
    const uniqueCustomerIds = new Set(periodVehicles.map(v => v.customerId).filter(Boolean))
    const totalCustomers = uniqueCustomerIds.size
    const totalVehicles = periodVehicles.length
    
    // Clientes nuevos en el período
    const newCustomers = customers.filter(customer => 
      new Date(customer.createdAt) >= startDate
    ).length

    // Clientes recurrentes (que tuvieron vehículos antes del período y también en el período)
    const returningCustomers = customers.filter(customer => {
      const customerVehicles = vehiclesWithCustomers.filter(v => v.customerId === customer._id)
      const beforePeriod = customerVehicles.some(v => new Date(v.entryDate) < startDate)
      const inPeriod = customerVehicles.some(v => new Date(v.entryDate) >= startDate)
      return beforePeriod && inPeriod
    }).length

    // Top clientes del período
    const customerRevenue = new Map()
    const customerVehicleCount = new Map()

    periodVehicles.forEach(vehicle => {
      if (vehicle.customer) {
        const customerId = vehicle.customer._id
        const customerName = vehicle.customer.name
        
        customerRevenue.set(customerId, (customerRevenue.get(customerId) || 0) + vehicle.cost)
        customerVehicleCount.set(customerId, (customerVehicleCount.get(customerId) || 0) + 1)
        
        if (!customerRevenue.has(`${customerId}_name`)) {
          customerRevenue.set(`${customerId}_name`, customerName)
        }
      }
    })

    const topCustomers = Array.from(customerRevenue.entries())
      .filter(([key]) => !key.toString().endsWith('_name'))
      .map(([customerId, revenue]) => ({
        id: customerId as string,
        name: customerRevenue.get(`${customerId}_name`) as string,
        revenue: revenue as number,
        vehicleCount: customerVehicleCount.get(customerId) || 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Ingresos por mes (últimos 6 meses)
    const revenueByMonth = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date()
      monthDate.setMonth(monthDate.getMonth() - i)
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
      
      const monthVehicles = vehiclesWithCustomers.filter(vehicle => {
        const vehicleDate = new Date(vehicle.entryDate)
        return vehicleDate >= monthStart && vehicleDate <= monthEnd
      })
      
      const monthRevenue = monthVehicles.reduce((sum, vehicle) => sum + vehicle.cost, 0)
      const monthCustomers = new Set(monthVehicles.map(v => v.customerId).filter(Boolean)).size
      
      revenueByMonth.push({
        month: monthDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
        revenue: monthRevenue,
        customers: monthCustomers
      })
    }

    return {
      period: periodLabel,
      totalRevenue,
      totalCustomers,
      totalVehicles,
      averageTicket: totalVehicles > 0 ? totalRevenue / totalVehicles : 0,
      newCustomers,
      returningCustomers,
      topCustomers,
      revenueByMonth
    }
  }

  const analytics = calculatePeriodMetrics()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard de Clientes</h1>
            <p className="text-gray-600 mt-1">
              Análisis detallado de clientes y métricas de rendimiento
            </p>
          </div>
          <div className="flex gap-3">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thisWeek">Esta Semana</SelectItem>
                <SelectItem value="thisMonth">Este Mes</SelectItem>
                <SelectItem value="last3Months">Últimos 3 Meses</SelectItem>
                <SelectItem value="thisYear">Este Año</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs value={selectedView} onValueChange={setSelectedView} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Resumen General</TabsTrigger>
          <TabsTrigger value="analytics">Análisis Detallado</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Métricas del período seleccionado */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos {analytics.period}</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${analytics.totalRevenue.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  De {analytics.totalCustomers} clientes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {analytics.totalCustomers}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.newCustomers > 0 && (
                    <span className="text-green-600">+{analytics.newCustomers} nuevos</span>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Vehículos Atendidos</CardTitle>
                <Car className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {analytics.totalVehicles}
                </div>
                <p className="text-xs text-muted-foreground">
                  En {analytics.period.toLowerCase()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  ${Math.round(analytics.averageTicket).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Por vehículo
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top clientes del período */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Top Clientes - {analytics.period}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topCustomers.map((customer, index) => (
                    <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-8 h-8 p-0 flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-gray-500">{customer.vehicleCount} vehículos</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600">
                          ${customer.revenue.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {analytics.topCustomers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No hay datos para el período seleccionado</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Análisis de Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-blue-900">Clientes Nuevos</p>
                      <p className="text-sm text-blue-600">Primer visita en el período</p>
                    </div>
                    <Badge className="bg-blue-600 text-white text-lg px-3 py-1">
                      {analytics.newCustomers}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-green-900">Clientes Recurrentes</p>
                      <p className="text-sm text-green-600">Volvieron en el período</p>
                    </div>
                    <Badge className="bg-green-600 text-white text-lg px-3 py-1">
                      {analytics.returningCustomers}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <div>
                      <p className="font-medium text-purple-900">Tasa de Retención</p>
                      <p className="text-sm text-purple-600">Clientes que regresan</p>
                    </div>
                    <Badge className="bg-purple-600 text-white text-lg px-3 py-1">
                      {analytics.totalCustomers > 0 
                        ? Math.round((analytics.returningCustomers / analytics.totalCustomers) * 100)
                        : 0
                      }%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tendencia de ingresos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Tendencia de Ingresos (Últimos 6 Meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.revenueByMonth.map((month, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{month.month}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600">
                          ${month.revenue.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">{month.customers} clientes</p>
                      </div>
                      <div 
                        className="bg-green-200 h-2 rounded"
                        style={{
                          width: `${Math.max((month.revenue / Math.max(...analytics.revenueByMonth.map(m => m.revenue))) * 100, 5)}px`,
                          minWidth: '20px'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Tarjetas detalladas */}
          <CustomerCards />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-blue-600" />
                  Distribución de Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Clientes con 1 vehículo:</span>
                    <Badge variant="outline">
                      {customers.filter(c => (c.totalVehicles || 0) === 1).length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Clientes con 2-5 vehículos:</span>
                    <Badge variant="outline">
                      {customers.filter(c => (c.totalVehicles || 0) >= 2 && (c.totalVehicles || 0) <= 5).length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Clientes con 5+ vehículos:</span>
                    <Badge variant="outline">
                      {customers.filter(c => (c.totalVehicles || 0) > 5).length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Segmentación por Gasto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Gasto bajo (&lt;$50,000):</span>
                    <Badge variant="outline">
                      {customers.filter(c => (c.totalSpent || 0) < 50000).length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Gasto medio ($50k-$200k):</span>
                    <Badge variant="outline">
                      {customers.filter(c => (c.totalSpent || 0) >= 50000 && (c.totalSpent || 0) < 200000).length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Gasto alto ($200k+):</span>
                    <Badge variant="outline">
                      {customers.filter(c => (c.totalSpent || 0) >= 200000).length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}