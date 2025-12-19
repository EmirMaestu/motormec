import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUser } from "@clerk/clerk-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { 
  DollarSign, 
  Users, 
  Package, 
  Wrench, 
  Handshake, 
  Car, 
  TrendingUp,
  BarChart3,
  PieChart,
  Activity
} from "lucide-react";
import { ReportFilters } from "../reports/ReportFilters";
import { ReportExport } from "../reports/ReportExport";
import { ReportTemplates } from "../reports/ReportTemplates";
import { Badge } from "../ui/badge";

export default function ReportsNew() {
  const { user } = useUser();
  const isAdmin = user?.organizationMemberships?.[0]?.role === "org:admin";

  // Estados para filtros
  const [financialFilters, setFinancialFilters] = useState<any>({});
  const [customerFilters, setCustomerFilters] = useState<any>({});
  const [inventoryFilters, setInventoryFilters] = useState<any>({});
  const [mechanicsFilters, setMechanicsFilters] = useState<any>({});
  const [partnersFilters, setPartnersFilters] = useState<any>({});

  // Obtener datos
  const customers = useQuery(api.customers.getActiveCustomers);
  const transactions = useQuery(api.transactions.getActiveTransactions);
  
  // Queries de reportes
  const financialReport = useQuery(
    api.reports.getFinancialReport,
    financialFilters
  );
  const customerReport = useQuery(
    api.reports.getCustomerReport,
    customerFilters
  );
  const inventoryReport = useQuery(
    api.reports.getInventoryReport,
    inventoryFilters
  );
  const mechanicsReport = useQuery(
    api.reports.getMechanicsReport,
    mechanicsFilters
  );
  const partnersReport = useQuery(
    api.reports.getPartnersReport,
    partnersFilters
  );
  const operationalReport = useQuery(
    api.reports.getOperationalReport,
    {}
  );
  const strategicReport = useQuery(
    api.reports.getStrategicReport
  );

  // Obtener categorías y métodos de pago únicos
  const categories = Array.from(new Set(transactions?.map(t => t.category) || []));
  const paymentMethods = Array.from(new Set(
    transactions?.map(t => t.paymentMethod).filter((pm): pm is string => pm !== undefined) || []
  ));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Sistema de Reportes</h2>
          <p className="text-muted-foreground">
            Análisis completo del rendimiento del taller
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {isAdmin ? "Vista Administrador" : "Vista Mecánico"}
        </Badge>
      </div>

      {/* Tabs de reportes */}
      <Tabs defaultValue="financial" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="financial" className="flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Financiero</span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Inventario</span>
          </TabsTrigger>
          <TabsTrigger value="mechanics" className="flex items-center gap-1">
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">Mecánicos</span>
          </TabsTrigger>
          <TabsTrigger value="partners" className="flex items-center gap-1">
            <Handshake className="h-4 w-4" />
            <span className="hidden sm:inline">Socios</span>
          </TabsTrigger>
          <TabsTrigger value="operational" className="flex items-center gap-1">
            <Car className="h-4 w-4" />
            <span className="hidden sm:inline">Operacional</span>
          </TabsTrigger>
          <TabsTrigger value="strategic" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Estratégico</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Plantillas</span>
          </TabsTrigger>
        </TabsList>

        {/* 💰 REPORTE FINANCIERO */}
        <TabsContent value="financial" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold">Reporte Financiero</h3>
            {financialReport && (
              <ReportExport
                data={financialReport}
                reportName="Reporte_Financiero"
              />
            )}
          </div>

          <ReportFilters
            filters={financialFilters}
            onFiltersChange={setFinancialFilters}
            availableFilters={{
              showDateRange: true,
              showCategory: true,
              showPaymentMethod: true,
            }}
            categories={categories}
            paymentMethods={paymentMethods}
          />

          {financialReport && (
            <>
              {/* Resumen */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Ingresos Totales
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      ${financialReport.resumen.ingresos.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {financialReport.detalle.filter((t: any) => t.type === "Ingreso").length} transacciones
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Egresos Totales
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      ${financialReport.resumen.egresos.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {financialReport.detalle.filter((t: any) => t.type === "Egreso").length} transacciones
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Balance
                    </CardTitle>
                    <Activity className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${
                      financialReport.resumen.balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${financialReport.resumen.balance.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Diferencia neta
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Ticket Promedio
                    </CardTitle>
                    <BarChart3 className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      ${Math.round(financialReport.resumen.ticketPromedio).toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Por ingreso
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Por categoría */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Ingresos y Egresos por Categoría
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {financialReport.porCategoria.map((item: any) => (
                      <div key={item.categoria} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{item.categoria}</span>
                          <div className="flex gap-4 text-sm">
                            <span className="text-green-600">
                              +${item.ingresos.toLocaleString()}
                            </span>
                            <span className="text-red-600">
                              -${item.egresos.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 h-2">
                          <div
                            className="bg-green-500 rounded-full"
                            style={{
                              width: `${(item.ingresos / (item.ingresos + item.egresos)) * 100}%`,
                            }}
                          />
                          <div
                            className="bg-red-500 rounded-full"
                            style={{
                              width: `${(item.egresos / (item.ingresos + item.egresos)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tendencia mensual */}
              {financialReport.tendenciaMensual.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Tendencia Mensual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {financialReport.tendenciaMensual.map((mes: any) => (
                        <div key={mes.mes} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{mes.mes}</span>
                            <span className={`font-bold ${
                              mes.balance >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              ${mes.balance.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>Ingresos: ${mes.ingresos.toLocaleString()}</span>
                            <span>Egresos: ${mes.egresos.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* 👥 REPORTE DE CLIENTES */}
        <TabsContent value="customers" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold">Reporte de Clientes</h3>
            {customerReport && (
              <ReportExport
                data={customerReport}
                reportName="Reporte_Clientes"
              />
            )}
          </div>

          <ReportFilters
            filters={customerFilters}
            onFiltersChange={setCustomerFilters}
            availableFilters={{
              showDateRange: true,
              showCustomer: true,
            }}
            customers={customers || []}
          />

          {customerReport && (
            <>
              {/* Resumen */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Clientes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {customerReport.resumen.totalClientes}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Ingresos Total
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      ${customerReport.resumen.ingresosTotal.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Promedio por Cliente
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      ${Math.round(customerReport.resumen.promedioPorCliente).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Clientes Activos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {customerReport.resumen.clientesActivos}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top clientes */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Clientes</CardTitle>
                  <CardDescription>Ordenados por total gastado</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {customerReport.clientes.slice(0, 10).map((cliente: any, index: number) => (
                      <div key={cliente._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-blue-600">
                              {index + 1}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{cliente.name}</p>
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <span>{cliente.cantidadVehiculos} vehículos</span>
                              <span>•</span>
                              <span>{cliente.visitCount || 0} visitas</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            ${cliente.totalGastado.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Total gastado</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* 📦 REPORTE DE INVENTARIO */}
        <TabsContent value="inventory" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold">Reporte de Inventario</h3>
            {inventoryReport && (
              <ReportExport
                data={inventoryReport}
                reportName="Reporte_Inventario"
              />
            )}
          </div>

          <ReportFilters
            filters={inventoryFilters}
            onFiltersChange={setInventoryFilters}
            availableFilters={{
              showDateRange: true,
            }}
          />

          {inventoryReport && (
            <>
              {/* Resumen */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Productos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {inventoryReport.resumen.totalProductos}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Valor Inventario
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      ${inventoryReport.resumen.valorTotalInventario.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Bajo Stock
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {inventoryReport.resumen.productosBajoStock}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Sin Stock
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {inventoryReport.resumen.productosSinStock}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Productos más utilizados */}
              <Card>
                <CardHeader>
                  <CardTitle>Productos Más Utilizados</CardTitle>
                  <CardDescription>Basado en disminuciones de stock</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {inventoryReport.productosUtilizados.slice(0, 10).map((producto: any) => (
                      <div key={producto.nombre} className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{producto.nombre}</p>
                          <p className="text-sm text-muted-foreground">
                            {producto.veces} veces utilizado
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {producto.cantidad} unidades
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* 👨‍🔧 REPORTE DE MECÁNICOS */}
        <TabsContent value="mechanics" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold">Reporte de Mecánicos</h3>
            {mechanicsReport && (
              <ReportExport
                data={mechanicsReport}
                reportName="Reporte_Mecanicos"
              />
            )}
          </div>

          <ReportFilters
            filters={mechanicsFilters}
            onFiltersChange={setMechanicsFilters}
            availableFilters={{
              showDateRange: true,
            }}
          />

          {mechanicsReport && (
            <>
              {/* Resumen */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Mecánicos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {mechanicsReport.resumen.totalMecanicos}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Tiempo Total
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round(mechanicsReport.resumen.tiempoTotalTrabajado / (1000 * 60 * 60))}h
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Vehículos Atendidos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {mechanicsReport.resumen.vehiculosTotalAtendidos}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Ingresos Generados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      ${Math.round(mechanicsReport.resumen.ingresosTotales).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detalle por mecánico */}
              <Card>
                <CardHeader>
                  <CardTitle>Rendimiento por Mecánico</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mechanicsReport.mecanicos.map((mecanico: any) => (
                      <div key={mecanico.userId} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold">{mecanico.nombre}</h4>
                            <p className="text-sm text-muted-foreground">
                              {mecanico.vehiculosAtendidos} vehículos • {mecanico.sesionesTotal} sesiones
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-green-600">
                            ${Math.round(mecanico.ingresosGenerados).toLocaleString()}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Tiempo total:</span>
                            <span className="ml-2 font-medium">
                              {Math.round(mecanico.tiempoTotal / (1000 * 60 * 60))}h
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Promedio por vehículo:</span>
                            <span className="ml-2 font-medium">
                              {Math.round(mecanico.tiempoPromedio / (1000 * 60 * 60))}h
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* 🤝 REPORTE DE SOCIOS */}
        <TabsContent value="partners" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold">Reporte de Socios</h3>
            {partnersReport && (
              <ReportExport
                data={partnersReport}
                reportName="Reporte_Socios"
              />
            )}
          </div>

          <ReportFilters
            filters={partnersFilters}
            onFiltersChange={setPartnersFilters}
            availableFilters={{
              showDateRange: true,
            }}
          />

          {partnersReport && (
            <>
              {/* Resumen */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Socios
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {partnersReport.resumen.totalSocios}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Inversión Total
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      ${partnersReport.resumen.inversionTotal.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Ganancias Período
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${
                      partnersReport.resumen.gananciasPeriodo >= 0 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      ${partnersReport.resumen.gananciasPeriodo.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Balance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${(partnersReport.resumen.ingresosPeriodo - partnersReport.resumen.egresosPeriodo).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Distribución por socio */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribución de Ganancias</CardTitle>
                  <CardDescription>Basado en porcentajes de inversión</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {partnersReport.socios.map((socio: any) => (
                      <div key={socio._id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <h4 className="font-semibold">{socio.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {socio.porcentajeInversion}% de participación
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">
                              ${Math.round(socio.gananciaPeriodo).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Ganancia período
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Inversión total: ${socio.totalContributed.toLocaleString()}</span>
                          <span>Aporte mensual: ${socio.monthlyContribution.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* 🚗 REPORTE OPERACIONAL */}
        <TabsContent value="operational" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold">Reporte Operacional</h3>
            {operationalReport && (
              <ReportExport
                data={operationalReport}
                reportName="Reporte_Operacional"
              />
            )}
          </div>

          {operationalReport && (
            <>
              {/* Resumen */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Vehículos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {operationalReport.resumen.totalVehiculos}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      En Taller
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {operationalReport.resumen.vehiculosEnTaller}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Entregados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {operationalReport.resumen.vehiculosEntregados}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Ingresos Totales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      ${operationalReport.resumen.ingresosTotales.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Vehículos por estado */}
              <Card>
                <CardHeader>
                  <CardTitle>Vehículos por Estado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {operationalReport.porEstado.map((item: any) => (
                      <div key={item.estado} className="flex justify-between items-center">
                        <span className="font-medium">{item.estado}</span>
                        <Badge variant="secondary">{item.cantidad} vehículos</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Servicios más frecuentes */}
              <Card>
                <CardHeader>
                  <CardTitle>Servicios Más Frecuentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {operationalReport.serviciosMasFrecuentes.slice(0, 10).map((servicio: any) => (
                      <div key={servicio.servicio} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{servicio.servicio}</span>
                          <div className="flex gap-4 text-sm">
                            <span>{servicio.count} veces</span>
                            <span className="text-green-600">
                              ${Math.round(servicio.ingresos).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(servicio.count / operationalReport.serviciosMasFrecuentes[0].count) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* 📈 REPORTE ESTRATÉGICO */}
        <TabsContent value="strategic" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold">Reporte Estratégico</h3>
            {strategicReport && (
              <ReportExport
                data={strategicReport}
                reportName="Reporte_Estrategico"
              />
            )}
          </div>

          {strategicReport && (
            <>
              {/* KPIs principales */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Tasa de Retención
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {strategicReport.kpis.tasaRetencion}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Clientes que regresan
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Ticket Promedio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      ${Math.round(strategicReport.kpis.ticketPromedio).toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Por vehículo
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Clientes Nuevos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {strategicReport.kpis.clientesNuevos}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Últimos 3 meses
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Predicción Mensual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      ${Math.round(strategicReport.kpis.prediccionIngresosMensual).toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Basado en tendencia
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Clientes más rentables */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Top 10 Clientes Más Rentables
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {strategicReport.clientesRentables.slice(0, 10).map((cliente: any, index: number) => (
                      <div key={cliente._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-white">
                              {index + 1}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{cliente.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {cliente.cantidadVehiculos} vehículos
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-green-600 font-bold">
                          ${cliente.totalGastado.toLocaleString()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Servicios rentables */}
              <Card>
                <CardHeader>
                  <CardTitle>Servicios Más Rentables</CardTitle>
                  <CardDescription>Ordenados por ingresos totales</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {strategicReport.serviciosRentables.slice(0, 10).map((servicio: any) => (
                      <div key={servicio.servicio} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{servicio.servicio}</p>
                          <p className="text-sm text-muted-foreground">
                            {servicio.cantidad} veces • Promedio: ${Math.round(servicio.promedio).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            ${Math.round(servicio.ingresoTotal).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Alerta de clientes en riesgo */}
              {strategicReport.clientesEnRiesgo > 0 && (
                <Card className="border-orange-300 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="text-orange-600 flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Clientes en Riesgo
                    </CardTitle>
                    <CardDescription>
                      {strategicReport.clientesEnRiesgo} clientes no han regresado en más de 90 días
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      Considera implementar estrategias de retención para recuperar estos clientes.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* 📋 PLANTILLAS Y PROGRAMACIÓN */}
        <TabsContent value="templates" className="space-y-6">
          <ReportTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
}

