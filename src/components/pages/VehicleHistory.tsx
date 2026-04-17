import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation } from "convex/react"
import { useOrganization } from "@clerk/clerk-react"
import { api } from "../../../convex/_generated/api"
import { Search, Filter, CheckCircle, XCircle, ArrowLeft, RotateCcw, MoreHorizontal, Eye, ArrowUp, History } from "lucide-react"
import { formatDateToDDMMYYYY } from "../../lib/dateUtils"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Badge } from "../ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "../ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog"
import { VehicleHistoryCards } from "../module-cards"
import { DateRangePicker, type DateRange } from "../ui/date-range-picker"

export default function VehicleHistory() {
  const navigate = useNavigate()
  const tableTopRef = useRef<HTMLDivElement>(null)
  const { membership } = useOrganization()
  const isAdmin = membership?.role === "org:admin"
  
  // Estado para filtros
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null })
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false)
  const [vehicleToReturn, setVehicleToReturn] = useState<any>(null)
  const [detailVehicle, setDetailVehicle] = useState<any>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  
  // Convex hooks
  const vehiclesOutOfTaller = useQuery(api.vehicles.getVehiclesOutOfTaller) ?? []
  const updateVehicle = useMutation(api.vehicles.updateVehicle)

  // Detectar scroll para mostrar/ocultar botón
  useEffect(() => {
    const handleScroll = () => {
      // Mostrar el botón si el usuario ha hecho scroll hacia abajo más de 300px
      if (window.scrollY > 300) {
        setShowScrollButton(true)
      } else {
        setShowScrollButton(false)
      }
    }

    window.addEventListener('scroll', handleScroll)
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }


  // Filtrar vehículos
  const filteredVehicles = vehiclesOutOfTaller.filter(vehicle => {
    const matchesSearch = searchTerm === "" || 
      vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.owner.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter

    // Filtro por rango de fechas
    let matchesDate = true
    if (dateRange.from && dateRange.to) {
      const vehicleDate = new Date(vehicle.exitDate || vehicle.entryDate)
      const fromDate = new Date(dateRange.from)
      const toDate = new Date(dateRange.to)
      // Ajustar toDate para incluir todo el día
      toDate.setHours(23, 59, 59, 999)
      matchesDate = vehicleDate >= fromDate && vehicleDate <= toDate
    }

    return matchesSearch && matchesStatus && matchesDate
  })

  const handleReturnToTaller = (vehicle: any) => {
    setVehicleToReturn(vehicle)
    setIsReturnDialogOpen(true)
  }

  const confirmReturnToTaller = async () => {
    if (vehicleToReturn) {
      try {
        await updateVehicle({
          id: vehicleToReturn._id,
          status: "Ingresado",
          inTaller: true,
          exitDate: undefined, // Limpiar fecha de salida
        })
        setIsReturnDialogOpen(false)
        setVehicleToReturn(null)
      } catch (error) {
        console.error('Error al devolver vehículo al taller:', error)
      }
    }
  }

  const handleViewDetail = (vehicle: any) => {
    setDetailVehicle(vehicle)
    setIsDetailDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Entregado":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Entregado</Badge>
      case "Suspendido":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Suspendido</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Estadísticas del historial
  const totalEarnings = filteredVehicles
    .filter(v => v.status === "Entregado")
    .reduce((sum, v) => sum + v.cost, 0)

  const deliveredCount = filteredVehicles.filter(v => v.status === "Entregado").length
  const suspendedCount = filteredVehicles.filter(v => v.status === "Suspendido").length

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/vehiculos")}
          className="w-fit"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Vehículos
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Historial de Vehículos</h1>
          <p className="text-muted-foreground">Vehículos entregados y suspendidos</p>
        </div>
      </div>

      {/* Cards de Estadísticas con carousel */}
      <VehicleHistoryCards
        totalVehicles={filteredVehicles.length}
        deliveredCount={deliveredCount}
        suspendedCount={suspendedCount}
        totalEarnings={isAdmin ? totalEarnings : 0}
        showEarnings={isAdmin}
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por placa, marca, modelo o cliente..." 
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Entregado">Entregados</SelectItem>
              <SelectItem value="Suspendido">Suspendidos</SelectItem>
            </SelectContent>
          </Select>

          <div className="w-[280px]">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </div>
      </div>

      {/* Tabla de Historial */}
      <div ref={tableTopRef}>
        <Card>
          <CardHeader>
            <CardTitle>Historial de Vehículos</CardTitle>
            <p className="text-sm text-muted-foreground">
              {filteredVehicles.length} vehículo{filteredVehicles.length !== 1 ? 's' : ''} encontrado{filteredVehicles.length !== 1 ? 's' : ''}
            </p>
          </CardHeader>
          <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehículo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Servicios</TableHead>
                <TableHead>Estado</TableHead>
                {isAdmin && <TableHead>Costo</TableHead>}
                <TableHead>Ingreso</TableHead>
                <TableHead>KM</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-muted-foreground">
                    No se encontraron vehículos en el historial
                  </TableCell>
                </TableRow>
              ) : (
                filteredVehicles.map((vehicle) => {
                  return (
                    <TableRow 
                      key={vehicle._id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleViewDetail(vehicle)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{vehicle.plate}</p>
                          <p className="text-sm text-muted-foreground">
                            {vehicle.brand} {vehicle.model} {vehicle.year}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{vehicle.owner}</p>
                          <p className="text-sm text-muted-foreground">{vehicle.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-48">
                          <p className="text-sm truncate">{vehicle.services.join(", ")}</p>
                          {vehicle.description && (
                            <p className="text-xs text-muted-foreground truncate">{vehicle.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <span className="font-medium">${vehicle.cost.toLocaleString()}</span>
                        </TableCell>
                      )}
                      <TableCell>
                        <span className="text-sm">{formatDateToDDMMYYYY(vehicle.entryDate)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {vehicle.mileage ? vehicle.mileage.toLocaleString() : '-'}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 w-9 p-0 border border-gray-200 hover:bg-gray-50">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => handleViewDetail(vehicle)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/vehiculos/${encodeURIComponent(vehicle.plate)}/detalle`);
                              }}
                            >
                              <History className="mr-2 h-4 w-4" />
                              Ver Historial de Arreglos
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleReturnToTaller(vehicle)}
                              className="text-blue-600 focus:text-blue-600"
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Devolver al Taller
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
        </Card>
      </div>

      {/* Diálogo de Confirmación para Devolver al Taller */}
      <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Devolver al Taller</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas devolver este vehículo al taller?
            </DialogDescription>
          </DialogHeader>
          {vehicleToReturn && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-900">
                      {vehicleToReturn.plate} - {vehicleToReturn.brand} {vehicleToReturn.model}
                    </h3>
                    <p className="text-sm text-blue-700">
                      Cliente: {vehicleToReturn.owner}
                    </p>
                    <p className="text-sm text-blue-700">
                      Estado actual: {vehicleToReturn.status}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <RotateCcw className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-blue-800">
                      Información
                    </h3>
                    <p className="text-sm text-blue-700 mt-1">
                      El vehículo será marcado como "Ingresado" y volverá a aparecer en la lista de vehículos activos del taller.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsReturnDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmReturnToTaller}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Devolver al Taller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Detalle (reutilizamos el mismo componente que en vehicles.tsx) */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del Vehículo</DialogTitle>
            <DialogDescription>
              Información completa del vehículo
            </DialogDescription>
          </DialogHeader>
          {detailVehicle && (
            <div className="space-y-4">
              {/* Información del Vehículo */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">🚗</span>
                  Información del Vehículo
                </h3>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-600 font-medium">Placa:</span>
                    <span className="text-sm font-bold text-gray-900 bg-white px-3 py-1 rounded-md">{detailVehicle.plate}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-600 font-medium">Marca:</span>
                    <span className="text-sm font-semibold text-gray-900">{detailVehicle.brand}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-600 font-medium">Modelo:</span>
                    <span className="text-sm font-semibold text-gray-900">{detailVehicle.model}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-600 font-medium">Año:</span>
                    <span className="text-sm font-semibold text-gray-900">{detailVehicle.year}</span>
                  </div>
                </div>
              </div>

              {/* Información del Cliente */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">👤</span>
                  Información del Cliente
                </h3>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-600 font-medium">Cliente:</span>
                    <span className="text-sm font-semibold text-gray-900">{detailVehicle.owner}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-600 font-medium">Teléfono:</span>
                    <span className="text-sm font-semibold text-gray-900">{detailVehicle.phone}</span>
                  </div>
                </div>
              </div>

              {/* Estado */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">✓</span>
                  Estado
                </h3>
                <div className="flex items-center justify-center">
                  {getStatusBadge(detailVehicle.status)}
                </div>
              </div>

              {/* Fechas */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-lg border border-orange-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">📅</span>
                  Fechas
                </h3>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-600 font-medium">Ingreso:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatDateToDDMMYYYY(detailVehicle.entryDate)}
                    </span>
                  </div>
                  {detailVehicle.exitDate && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm text-gray-600 font-medium">Salida:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatDateToDDMMYYYY(detailVehicle.exitDate)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Servicios */}
              <div className="bg-gradient-to-r from-cyan-50 to-sky-50 p-4 rounded-lg border border-cyan-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="bg-cyan-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">🔧</span>
                  Servicios
                </h3>
                <div className="flex flex-wrap gap-2">
                  {detailVehicle.services?.map((service: string, index: number) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="bg-blue-100 text-blue-800 border border-blue-200"
                    >
                      {service}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Costo */}
              {isAdmin && (
                <div className="bg-gradient-to-r from-green-50 to-teal-50 p-4 rounded-lg border border-green-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">💰</span>
                    Información Financiera
                  </h3>
                  {detailVehicle.costs ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-sm">
                          <p className="text-xs text-blue-600 font-semibold mb-1">Mano de Obra</p>
                          <p className="text-lg font-bold text-blue-900">
                            ${detailVehicle.costs.laborCost?.toLocaleString() || '0'}
                          </p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-purple-200 shadow-sm">
                          <p className="text-xs text-purple-600 font-semibold mb-1">Repuestos</p>
                          <p className="text-lg font-bold text-purple-900">
                            ${detailVehicle.costs.partsCost?.toLocaleString() || '0'}
                          </p>
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-green-100 to-emerald-100 p-4 rounded-lg border-2 border-green-300 shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-green-900">Costo Total:</span>
                          <span className="text-2xl font-bold text-green-900">
                            ${detailVehicle.costs.totalCost?.toLocaleString() || '0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-green-100 to-emerald-100 p-4 rounded-lg border-2 border-green-300 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-green-900">Costo Total:</span>
                        <span className="text-2xl font-bold text-green-900">
                          ${detailVehicle.cost?.toLocaleString() || '0'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Descripción */}
              {detailVehicle.description && (
                <div className="bg-gradient-to-r from-gray-50 to-slate-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="bg-gray-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">📝</span>
                    Descripción
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{detailVehicle.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsDetailDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cerrar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsDetailDialogOpen(false);
                navigate(`/vehiculos/${encodeURIComponent(detailVehicle.plate)}/detalle`);
              }}
              className="w-full sm:w-auto"
            >
              <History className="mr-2 h-4 w-4" />
              Ver Historial de Arreglos
            </Button>
            <Button 
              onClick={() => {
                setIsDetailDialogOpen(false)
                handleReturnToTaller(detailVehicle)
              }}
              className="w-full sm:w-auto"
            >
              Devolver al Taller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Botón flotante para ir arriba */}
      {showScrollButton && (
        <Button
          variant="default"
          size="icon"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50 animate-in fade-in slide-in-from-bottom-2"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  )
}