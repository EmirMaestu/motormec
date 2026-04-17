import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { formatDateToDDMMYYYY } from "../../lib/dateUtils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { 
  Users, 
  DollarSign, 
  Car, 
  Phone, 
  Mail, 
  MapPin,
  Search,
  Edit,
  Eye,
  Calendar,
  FileText,
  UserPlus,
  Link as LinkIcon,
  MoreHorizontal,
  Unlink,
  RefreshCcw
} from "lucide-react"
import VehicleCustomerAssociation from "../ui/vehicle-customer-association"
interface Customer {
  _id: string
  name: string
  email?: string
  phone: string
  address?: string
  documentType?: string
  documentNumber?: string
  notes?: string
  createdAt: string
  active: boolean
  totalVehicles?: number
  totalSpent?: number
  lastVisit?: string
  visitCount?: number
}

export default function Customers() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAssociationDialogOpen, setIsAssociationDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    documentType: "",
    documentNumber: "",
    notes: "",
  })

  // Queries - siempre ejecutar los hooks en el mismo orden
  const customers = useQuery(api.customers.getActiveCustomers) || []
  const customersStats = useQuery(api.customers.getCustomersStats)
  
  // Usar undefined cuando no hay cliente seleccionado
  const validSelectedCustomerVehicles = useQuery(
    api.customers.getCustomerVehicles, 
    { customerId: selectedCustomer?._id as any }
  )
  const validSelectedCustomerMetrics = useQuery(
    api.customers.getCustomerMetrics, 
    { customerId: selectedCustomer?._id as any }
  )

  // Mutations
  const createCustomer = useMutation(api.customers.createCustomer)
  const updateCustomer = useMutation(api.customers.updateCustomer)
  const removeCustomerFromVehicle = useMutation(api.vehicles.removeCustomerFromVehicle)

  // Filtrar clientes por término de búsqueda
  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createCustomer(formData)
      setIsCreateDialogOpen(false)
      setFormData({
        name: "",
        phone: "",
        email: "",
        address: "",
        documentType: "",
        documentNumber: "",
        notes: "",
      })
    } catch (error) {
      console.error("Error creating customer:", error)
    }
  }

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer) return
    
    try {
      await updateCustomer({
        customerId: selectedCustomer._id as any,
        ...formData,
      })
      setIsEditDialogOpen(false)
      setSelectedCustomer(null)
    } catch (error) {
      console.error("Error updating customer:", error)
    }
  }

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer)
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      address: customer.address || "",
      documentType: customer.documentType || "",
      documentNumber: customer.documentNumber || "",
      notes: customer.notes || "",
    })
    setIsEditDialogOpen(true)
  }

  const handleUnlinkVehicle = async (vehicleId: string) => {
    try {
      await removeCustomerFromVehicle({
        vehicleId: vehicleId as any
      })
    } catch (error) {
      console.error("Error unlinking vehicle:", error)
    }
  }

  const handleChangeCustomer = (_vehicleId: string) => {
    // Cerrar el detalle actual y abrir el modal de asociación
    // El modal permitirá cambiar al cliente
    setIsAssociationDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Gestión de Clientes</h1>
            <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
              Administra la información de tus clientes y sus vehículos
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Cliente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateCustomer} className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="name">Nombre *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Teléfono *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Dirección</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="documentType">Tipo Documento</Label>
                      <Select value={formData.documentType} onValueChange={(value) => setFormData({...formData, documentType: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DNI">DNI</SelectItem>
                          <SelectItem value="CUIT">CUIT</SelectItem>
                          <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="documentNumber">Número</Label>
                      <Input
                        id="documentNumber"
                        value={formData.documentNumber}
                        onChange={(e) => setFormData({...formData, documentNumber: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notas</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Crear Cliente</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

      {/* Estadísticas generales */}
      {customersStats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
              <Users className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customersStats.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">Clientes activos</p>
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
              <p className="text-xs text-muted-foreground">De todos los clientes</p>
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
              <p className="text-xs text-muted-foreground">Total histórico</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Promedio por Cliente</CardTitle>
              <DollarSign className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                ${Math.round(customersStats.averageSpentPerCustomer).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Gasto promedio</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista de clientes */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Clientes</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
              {filteredCustomers.map((customer) => (
                <div 
                  key={customer._id}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedCustomer?._id === customer._id
                      ? 'border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800'
                      : 'border-gray-100 dark:border-zinc-800 hover:border-gray-200 dark:hover:border-zinc-700 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50'
                  }`}
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {customer.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="h-3 w-3 text-gray-400" />
                        <p className="text-xs text-gray-500">{customer.phone}</p>
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-2 mt-1">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-green-600 font-medium">
                          ${(customer.totalSpent || 0).toLocaleString()}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {customer.totalVehicles || 0} vehículos
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCustomer(customer)
                          setIsAssociationDialogOpen(true)
                        }}
                        title="Asociar vehículos"
                      >
                        <LinkIcon className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditDialog(customer)
                        }}
                        title="Editar cliente"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredCustomers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No se encontraron clientes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detalles del cliente seleccionado */}
        <div className="lg:col-span-2">
          {selectedCustomer && validSelectedCustomerMetrics ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{validSelectedCustomerMetrics.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Cliente desde {formatDateToDDMMYYYY(validSelectedCustomerMetrics.createdAt)}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                    Activo
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="overview" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="overview">Resumen</TabsTrigger>
                    <TabsTrigger value="vehicles">Vehículos</TabsTrigger>
                    <TabsTrigger value="contact">Contacto</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    {/* Métricas del cliente */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="text-lg font-bold text-green-600">
                                ${validSelectedCustomerMetrics.totalSpent.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">Total gastado</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <Car className="h-5 w-5 text-gray-500 dark:text-zinc-400" />
                            <div>
                              <p className="text-lg font-bold">{validSelectedCustomerMetrics.totalVehicles}</p>
                              <p className="text-xs text-muted-foreground">Vehículos</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-5 w-5 text-purple-600" />
                            <div>
                              <p className="text-lg font-bold">{validSelectedCustomerMetrics.visitCount}</p>
                              <p className="text-xs text-muted-foreground">Visitas</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <Eye className="h-5 w-5 text-orange-600" />
                            <div>
                              <p className="text-sm font-bold">
                                {validSelectedCustomerMetrics.lastVisit 
                                  ? formatDateToDDMMYYYY(validSelectedCustomerMetrics.lastVisit)
                                  : "N/A"
                                }
                              </p>
                              <p className="text-xs text-muted-foreground">Última visita</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Acción para asociar vehículos */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <LinkIcon className="h-5 w-5 text-purple-600" />
                            Gestión de Vehículos
                          </CardTitle>
                          <Button 
                            onClick={() => setIsAssociationDialogOpen(true)}
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Car className="h-4 w-4 mr-2" />
                            Asociar Vehículos
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600">
                          Asocia vehículos existentes a este cliente o gestiona los vehículos ya asignados.
                        </p>
                      </CardContent>
                    </Card>

                    {/* Estado actual */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Estado Actual</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Vehículos completados:</span>
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                {validSelectedCustomerMetrics.completedVehicles}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Vehículos activos:</span>
                              <Badge variant="outline" className="bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">
                                {validSelectedCustomerMetrics.activeVehicles}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {validSelectedCustomerMetrics.notes && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Notas
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-gray-600">
                              {validSelectedCustomerMetrics.notes}
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="vehicles" className="space-y-4">
                    <div className="space-y-3">
                      {validSelectedCustomerVehicles?.map((vehicle) => (
                        <Card key={vehicle._id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium">
                                  {vehicle.plate} - {vehicle.brand} {vehicle.model}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Servicios: {vehicle.services.join(", ")}
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
                                    Ingreso: {formatDateToDDMMYYYY(vehicle.entryDate)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="font-medium">${vehicle.cost.toLocaleString()}</p>
                                  {vehicle.exitDate && (
                                    <p className="text-xs text-muted-foreground">
                                      Salida: {formatDateToDDMMYYYY(vehicle.exitDate)}
                                    </p>
                                  )}
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      className="text-red-600 cursor-pointer"
                                      onClick={() => handleUnlinkVehicle(vehicle._id)}
                                    >
                                      <Unlink className="h-4 w-4 mr-2" />
                                      Desvincular de este cliente
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer"
                                      onClick={() => handleChangeCustomer(vehicle._id)}
                                    >
                                      <RefreshCcw className="h-4 w-4 mr-2" />
                                      Cambiar a otro cliente
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {(!validSelectedCustomerVehicles || validSelectedCustomerVehicles.length === 0) && (
                        <div className="text-center py-8 text-gray-500">
                          <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No hay vehículos registrados</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="contact" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Información de Contacto</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4">
                          {validSelectedCustomerMetrics.phone && (
                            <div className="flex items-center gap-3">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium">Teléfono</p>
                                <p className="text-sm text-gray-600">{validSelectedCustomerMetrics.phone}</p>
                              </div>
                            </div>
                          )}
                          {validSelectedCustomerMetrics.email && (
                            <div className="flex items-center gap-3">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium">Email</p>
                                <p className="text-sm text-gray-600">{validSelectedCustomerMetrics.email}</p>
                              </div>
                            </div>
                          )}
                          {validSelectedCustomerMetrics.address && (
                            <div className="flex items-center gap-3">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium">Dirección</p>
                                <p className="text-sm text-gray-600">{validSelectedCustomerMetrics.address}</p>
                              </div>
                            </div>
                          )}
                          {validSelectedCustomerMetrics.documentType && validSelectedCustomerMetrics.documentNumber && (
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium">Documento</p>
                                <p className="text-sm text-gray-600">
                                  {validSelectedCustomerMetrics.documentType}: {validSelectedCustomerMetrics.documentNumber}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
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
                    Selecciona un cliente
                  </h3>
                  <p className="text-gray-500">
                    Haz clic en un cliente de la lista para ver sus detalles.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog para editar cliente */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateCustomer} className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="edit-name">Nombre *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Teléfono *</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit-address">Dirección</Label>
                <Input
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="edit-documentType">Tipo Documento</Label>
                  <Select value={formData.documentType} onValueChange={(value) => setFormData({...formData, documentType: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DNI">DNI</SelectItem>
                      <SelectItem value="CUIT">CUIT</SelectItem>
                      <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-documentNumber">Número</Label>
                  <Input
                    id="edit-documentNumber"
                    value={formData.documentNumber}
                    onChange={(e) => setFormData({...formData, documentNumber: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-notes">Notas</Label>
                <Textarea
                  id="edit-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Actualizar Cliente</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal para asociar vehículos */}
      <VehicleCustomerAssociation
        isOpen={isAssociationDialogOpen}
        onOpenChange={setIsAssociationDialogOpen}
        selectedCustomer={selectedCustomer}
      />
    </div>
  )
}