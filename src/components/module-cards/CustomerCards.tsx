import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { 
  Users, 
  DollarSign, 
  Car, 
  TrendingUp,
  Eye,
  Calendar,
  Phone
} from "lucide-react"

export default function CustomerCards() {
  
  // Obtener estadísticas de clientes
  const customersStats = useQuery(api.customers.getCustomersStats)
  const customers = useQuery(api.customers.getActiveCustomers) || []

  if (!customersStats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Calcular clientes nuevos este mes
  const thisMonthStart = new Date()
  thisMonthStart.setDate(1)
  thisMonthStart.setHours(0, 0, 0, 0)

  const newCustomersThisMonth = customers.filter(customer => 
    new Date(customer.createdAt) >= thisMonthStart
  ).length

  // Clientes activos (con vehículos este mes)
  const activeCustomers = customers.filter(customer => 
    customer.lastVisit && new Date(customer.lastVisit) >= thisMonthStart
  ).length

  return (
    <div className="space-y-6">
      {/* Tarjetas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customersStats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {newCustomersThisMonth > 0 && (
                <span className="text-green-600">
                  +{newCustomersThisMonth} este mes
                </span>
              )}
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
              ${customersStats.totalSpent.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              De todos los clientes
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
              {customersStats.totalVehicles}
            </div>
            <p className="text-xs text-muted-foreground">
              Total histórico
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Cliente</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${Math.round(customersStats.averageSpentPerCustomer).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Gasto promedio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tarjetas de actividad */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Clientes activos este mes:</span>
                <Badge className="bg-blue-100 text-blue-800">
                  {activeCustomers}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Nuevos clientes:</span>
                <Badge className="bg-green-100 text-green-800">
                  {newCustomersThisMonth}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tasa de retención:</span>
                <Badge variant="outline">
                  {customersStats.totalCustomers > 0 
                    ? Math.round((activeCustomers / customersStats.totalCustomers) * 100)
                    : 0
                  }%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Top 5 Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customersStats.topCustomers.map((customer, index) => (
                <div key={customer.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{customer.name}</p>
                      <p className="text-xs text-gray-500">{customer.totalVehicles} vehículos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-600">
                      ${customer.totalSpent.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {customersStats.topCustomers.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay datos de clientes</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Información adicional */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              Frecuencia de Visitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Visitas promedio:</span>
                <span className="text-sm font-medium">
                  {customersStats.totalCustomers > 0 
                    ? Math.round(customersStats.totalVehicles / customersStats.totalCustomers * 10) / 10
                    : 0
                  } por cliente
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Clientes recurrentes:</span>
                <span className="text-sm font-medium">
                  {customers.filter(c => (c.totalVehicles || 0) > 1).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-600" />
              Información de Contacto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Con teléfono:</span>
                <span className="text-sm font-medium">
                  {customers.filter(c => c.phone).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Con email:</span>
                <span className="text-sm font-medium">
                  {customers.filter(c => c.email).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Análisis de Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Ticket promedio:</span>
                <span className="text-sm font-medium text-green-600">
                  ${customersStats.totalVehicles > 0 
                    ? Math.round(customersStats.totalSpent / customersStats.totalVehicles).toLocaleString()
                    : 0
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Cliente más valioso:</span>
                <span className="text-sm font-medium">
                  {customersStats.topCustomers.length > 0 
                    ? `$${customersStats.topCustomers[0].totalSpent.toLocaleString()}`
                    : "N/A"
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}