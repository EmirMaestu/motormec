import { BarChart3, PieChart, Download, Calendar, TrendingUp, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { ReportsCards } from "../module-cards"

export default function Reports() {
  const monthlyData = [
    { mes: "Enero", servicios: 47, ingresos: 245000, clientes: 23 },
    { mes: "Diciembre", servicios: 52, ingresos: 289000, clientes: 28 },
    { mes: "Noviembre", servicios: 45, ingresos: 198000, clientes: 21 },
    { mes: "Octubre", servicios: 38, ingresos: 167000, clientes: 19 },
  ]

  const serviceTypes = [
    { tipo: "Mantenimiento General", cantidad: 18, porcentaje: 38 },
    { tipo: "Reparación de Frenos", cantidad: 8, porcentaje: 17 },
    { tipo: "Diagnóstico Eléctrico", cantidad: 6, porcentaje: 13 },
    { tipo: "Alineación y Balanceo", cantidad: 9, porcentaje: 19 },
    { tipo: "Otros", cantidad: 6, porcentaje: 13 },
  ]

  const topClients = [
    { cliente: "Transporte Rápido SA", servicios: 12, total: 84000 },
    { cliente: "Taxis del Centro", servicios: 8, total: 56000 },
    { cliente: "Logística Nacional", servicios: 6, total: 45000 },
    { cliente: "Empresas Varias", servicios: 15, total: 38000 },
  ]

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Reportes y Estadísticas</h2>
          <p className="text-muted-foreground">Análisis del rendimiento del taller</p>
        </div>
        <div className="flex gap-2">
          <Select>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Último mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mes</SelectItem>
              <SelectItem value="quarter">Último trimestre</SelectItem>
              <SelectItem value="year">Último año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Métricas principales con carousel */}
      <ReportsCards />

      {/* Gráficos principales */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Rendimiento Mensual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyData.map((data) => (
                <div key={data.mes} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{data.mes}</span>
                    <span className="text-muted-foreground">{data.servicios} servicios</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(data.servicios / 60) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>${data.ingresos.toLocaleString()}</span>
                    <span>{data.clientes} clientes</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Tipos de Servicio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {serviceTypes.map((service) => (
                <div key={service.tipo} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ 
                        backgroundColor: service.tipo === "Mantenimiento General" ? "#3B82F6" :
                                        service.tipo === "Reparación de Frenos" ? "#EF4444" :
                                        service.tipo === "Diagnóstico Eléctrico" ? "#10B981" :
                                        service.tipo === "Alineación y Balanceo" ? "#F59E0B" : "#6B7280"
                      }}
                    ></div>
                    <div>
                      <p className="text-sm font-medium">{service.tipo}</p>
                      <p className="text-xs text-muted-foreground">{service.cantidad} servicios</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium">{service.porcentaje}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clientes principales */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes Principales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topClients.map((client, index) => (
              <div key={client.cliente} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium">{client.cliente}</p>
                    <p className="text-sm text-muted-foreground">{client.servicios} servicios realizados</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">${client.total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total facturado</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resumen de tendencias */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Crecimiento Mensual</p>
                <p className="text-2xl font-bold text-green-600">+12%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Comparado con el mes anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Retención de Clientes</p>
                <p className="text-2xl font-bold text-blue-600">87%</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Clientes que regresan
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Eficiencia</p>
                <p className="text-2xl font-bold text-purple-600">94%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Trabajos completados a tiempo
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}