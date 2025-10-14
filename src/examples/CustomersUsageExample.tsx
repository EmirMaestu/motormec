import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { 
  Users, 
  DollarSign, 
  Car, 
  Phone,
  Play,
  CheckCircle,
  AlertCircle
} from "lucide-react"

export default function CustomersUsageExample() {
  const [isInitializing, setIsInitializing] = useState(false)
  const [initResult, setInitResult] = useState<any>(null)

  // Queries
  const customers = useQuery(api.customers.getActiveCustomers)
  const customersStats = useQuery(api.customers.getCustomersStats)
  const vehiclesWithCustomers = useQuery(api.vehicles.getVehiclesWithCustomers)

  // Mutations
  const initializeModule = useMutation(api.initCustomers.initializeCustomersModule)

  const handleInitialize = async () => {
    setIsInitializing(true)
    try {
      const result = await initializeModule()
      setInitResult(result)
    } catch (error) {
      console.error("Error initializing customers module:", error)
      setInitResult({
        success: false,
        message: "Error al inicializar el módulo",
        error: error instanceof Error ? error.message : "Error desconocido"
      })
    } finally {
      setIsInitializing(false)
    }
  }

  // Estadísticas de ejemplo
  const moduleStats = {
    totalCustomers: customers?.length || 0,
    vehiclesWithCustomers: vehiclesWithCustomers?.filter(v => v.customer).length || 0,
    vehiclesWithoutCustomers: vehiclesWithCustomers?.filter(v => !v.customer).length || 0,
    totalRevenue: customersStats?.totalSpent || 0
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Ejemplo de Uso - Módulo de Clientes
        </h1>
        <p className="text-gray-600">
          Demostración de la funcionalidad del nuevo módulo de gestión de clientes
        </p>
      </div>

      {/* Estado del módulo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Registrados</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {moduleStats.totalCustomers}
            </div>
            <p className="text-xs text-muted-foreground">Total en sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vehículos Asociados</CardTitle>
            <Car className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {moduleStats.vehiclesWithCustomers}
            </div>
            <p className="text-xs text-muted-foreground">
              {moduleStats.vehiclesWithoutCustomers} sin asociar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              ${moduleStats.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">De todos los clientes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado del Módulo</CardTitle>
            {moduleStats.totalCustomers > 0 ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-orange-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {moduleStats.totalCustomers > 0 ? "Activo" : "Pendiente"}
            </div>
            <p className="text-xs text-muted-foreground">
              {moduleStats.totalCustomers > 0 ? "Con datos" : "Necesita inicialización"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Inicialización del módulo */}
      {moduleStats.totalCustomers === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-blue-600" />
              Inicializar Módulo de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              El módulo de clientes está listo para usar. Haz clic en el botón para:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-sm text-gray-600">
              <li>Agregar "Clientes" al menú de navegación</li>
              <li>Migrar vehículos existentes a clientes automáticamente</li>
              <li>Calcular métricas iniciales de clientes</li>
              <li>Configurar relaciones cliente-vehículo</li>
            </ul>
            
            <Button 
              onClick={handleInitialize} 
              disabled={isInitializing}
              className="w-full"
            >
              {isInitializing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Inicializando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Inicializar Módulo de Clientes
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resultado de la inicialización */}
      {initResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {initResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              {initResult.success ? "Inicialización Exitosa" : "Error en Inicialización"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className={`text-sm ${initResult.success ? 'text-green-700' : 'text-red-700'}`}>
              {initResult.message}
            </p>
            
            {initResult.success && initResult.stats && (
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">Clientes Creados</p>
                  <p className="text-lg font-bold text-blue-600">{initResult.stats.createdCustomers}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-green-900">Vehículos Actualizados</p>
                  <p className="text-lg font-bold text-green-600">{initResult.stats.updatedVehicles}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-purple-900">Métricas Calculadas</p>
                  <p className="text-lg font-bold text-purple-600">{initResult.stats.updatedCustomers}</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-orange-900">Total Clientes</p>
                  <p className="text-lg font-bold text-orange-600">{initResult.stats.totalCustomers}</p>
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <Button 
                onClick={() => window.location.href = '/clientes'}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Users className="h-4 w-4 mr-2" />
                Ir al Módulo de Clientes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de clientes existentes */}
      {customers && customers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Clientes Registrados ({customers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {customers.slice(0, 10).map((customer) => (
                <div key={customer._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600">
                        {customer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-gray-400" />
                        <p className="text-xs text-gray-500">{customer.phone}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {customer.totalVehicles || 0} vehículos
                    </Badge>
                    <p className="text-sm font-medium text-green-600">
                      ${(customer.totalSpent || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {customers.length > 10 && (
                <div className="text-center py-2">
                  <p className="text-sm text-gray-500">
                    Y {customers.length - 10} clientes más...
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instrucciones de uso */}
      <Card>
        <CardHeader>
          <CardTitle>Cómo Usar el Módulo de Clientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">🚀 Funcionalidades Principales:</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Gestión completa de clientes</li>
                <li>• Asociación automática con vehículos</li>
                <li>• Métricas y estadísticas detalladas</li>
                <li>• Dashboard analítico</li>
                <li>• Búsqueda y filtrado avanzado</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">📊 Métricas Disponibles:</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Total gastado por cliente</li>
                <li>• Cantidad de vehículos atendidos</li>
                <li>• Frecuencia de visitas</li>
                <li>• Top clientes más valiosos</li>
                <li>• Análisis de retención</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 Tip:</strong> Los clientes se crean automáticamente cuando ingresas un vehículo 
              con un número de teléfono nuevo. También puedes crear clientes manualmente desde la 
              página de gestión.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}