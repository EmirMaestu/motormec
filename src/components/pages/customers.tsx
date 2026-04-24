import { useMemo, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { formatDateToDDMMYYYY } from "../../lib/dateUtils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "../ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "../ui/dropdown-menu"
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
  RefreshCcw,
  GitMerge,
  ArrowUpDown,
  AlertTriangle,
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

type SortKey = "recent" | "name" | "spend" | "vehicles" | "lastVisit"

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "?"
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "Sin visitas"
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return "Sin visitas"
  const diff = Date.now() - d
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return "Hoy"
  if (days === 1) return "Ayer"
  if (days < 30) return `Hace ${days} días`
  const months = Math.floor(days / 30)
  if (months < 12) return `Hace ${months} ${months === 1 ? "mes" : "meses"}`
  const years = Math.floor(months / 12)
  return `Hace ${years} ${years === 1 ? "año" : "años"}`
}

export default function Customers() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAssociationDialogOpen, setIsAssociationDialogOpen] = useState(false)
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false)
  const [mergeSource, setMergeSource] = useState<Customer | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState<string>("")
  const [mergeSearch, setMergeSearch] = useState("")
  const [isMerging, setIsMerging] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("recent")
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    documentType: "",
    documentNumber: "",
    notes: "",
  })

  const customers = useQuery(api.customers.getActiveCustomers) || []
  const customersStats = useQuery(api.customers.getCustomersStats)

  const validSelectedCustomerVehicles = useQuery(
    api.customers.getCustomerVehicles,
    { customerId: selectedCustomer?._id as any }
  )
  const validSelectedCustomerMetrics = useQuery(
    api.customers.getCustomerMetrics,
    { customerId: selectedCustomer?._id as any }
  )

  const createCustomer = useMutation(api.customers.createCustomer)
  const updateCustomer = useMutation(api.customers.updateCustomer)
  const removeCustomerFromVehicle = useMutation(api.vehicles.removeCustomerFromVehicle)
  const mergeCustomers = useMutation(api.customers.mergeCustomers)

  const filteredCustomers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    const list = q
      ? customers.filter((c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(searchTerm) ||
          (c.email && c.email.toLowerCase().includes(q))
        )
      : [...customers]

    switch (sortKey) {
      case "name":
        return list.sort((a, b) => a.name.localeCompare(b.name))
      case "spend":
        return list.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
      case "vehicles":
        return list.sort((a, b) => (b.totalVehicles || 0) - (a.totalVehicles || 0))
      case "lastVisit":
        return list.sort((a, b) => {
          const ta = a.lastVisit ? new Date(a.lastVisit).getTime() : 0
          const tb = b.lastVisit ? new Date(b.lastVisit).getTime() : 0
          return tb - ta
        })
      case "recent":
      default:
        return list.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
    }
  }, [customers, searchTerm, sortKey])

  const mergeCandidates = useMemo(() => {
    if (!mergeSource) return []
    const q = mergeSearch.trim().toLowerCase()
    return customers
      .filter((c) => c._id !== mergeSource._id)
      .filter((c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(mergeSearch) ||
        (c.email && c.email.toLowerCase().includes(q))
      )
      .slice(0, 50)
  }, [customers, mergeSource, mergeSearch])

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createCustomer(formData)
      setIsCreateDialogOpen(false)
      setFormData({
        name: "", phone: "", email: "", address: "",
        documentType: "", documentNumber: "", notes: "",
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

  const openMergeDialog = (customer: Customer) => {
    setMergeSource(customer)
    setMergeTargetId("")
    setMergeSearch("")
    setIsMergeDialogOpen(true)
  }

  const handleConfirmMerge = async () => {
    if (!mergeSource || !mergeTargetId) return
    setIsMerging(true)
    try {
      await mergeCustomers({
        sourceCustomerId: mergeSource._id as any,
        targetCustomerId: mergeTargetId as any,
      })
      setIsMergeDialogOpen(false)
      if (selectedCustomer?._id === mergeSource._id) {
        setSelectedCustomer(null)
      }
      setMergeSource(null)
      setMergeTargetId("")
    } catch (error) {
      console.error("Error merging customers:", error)
      alert(error instanceof Error ? error.message : "Error al unir clientes")
    } finally {
      setIsMerging(false)
    }
  }

  const handleUnlinkVehicle = async (vehicleId: string) => {
    try {
      await removeCustomerFromVehicle({ vehicleId: vehicleId as any })
    } catch (error) {
      console.error("Error unlinking vehicle:", error)
    }
  }

  const mergeTarget = mergeTargetId
    ? customers.find((c) => c._id === mergeTargetId)
    : undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
            Gestión de Clientes
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
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
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono *</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div>
                  <Label htmlFor="address">Dirección</Label>
                  <Input id="address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="documentType">Tipo Documento</Label>
                    <Select value={formData.documentType} onValueChange={(value) => setFormData({...formData, documentType: value})}>
                      <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DNI">DNI</SelectItem>
                        <SelectItem value="CUIT">CUIT</SelectItem>
                        <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="documentNumber">Número</Label>
                    <Input id="documentNumber" value={formData.documentNumber} onChange={(e) => setFormData({...formData, documentNumber: e.target.value})} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Crear Cliente</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats compactos */}
      {customersStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Clientes</span>
              <Users className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
            </div>
            <div className="text-xl font-bold mt-1 text-gray-900 dark:text-zinc-100">
              {customersStats.totalCustomers}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Ingresos</span>
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
              ${customersStats.totalSpent.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Vehículos</span>
              <Car className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
            </div>
            <div className="text-xl font-bold mt-1 text-gray-900 dark:text-zinc-100">
              {customersStats.totalVehicles}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Promedio</span>
              <DollarSign className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
            </div>
            <div className="text-xl font-bold mt-1 text-gray-900 dark:text-zinc-100">
              ${Math.round(customersStats.averageSpentPerCustomer).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Clientes
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-zinc-400">
                    {filteredCustomers.length}
                  </span>
                </CardTitle>
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <ArrowUpDown className="h-3 w-3 mr-1.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Recientes</SelectItem>
                    <SelectItem value="name">Alfabético</SelectItem>
                    <SelectItem value="spend">Mayor gasto</SelectItem>
                    <SelectItem value="vehicles">Más vehículos</SelectItem>
                    <SelectItem value="lastVisit">Última visita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 h-4 w-4" />
                <Input
                  placeholder="Buscar por nombre, teléfono o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[640px] overflow-y-auto">
              {filteredCustomers.map((customer) => {
                const isSelected = selectedCustomer?._id === customer._id
                const spent = customer.totalSpent || 0
                const vehicles = customer.totalVehicles || 0
                return (
                  <div
                    key={customer._id}
                    onClick={() => setSelectedCustomer(customer)}
                    className={`group p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800/70"
                        : "border-gray-100 dark:border-zinc-800 hover:border-gray-200 dark:hover:border-zinc-700 hover:bg-gray-50/50 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-semibold">
                        {getInitials(customer.name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                            {customer.name}
                          </p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 opacity-60 group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => { setSelectedCustomer(customer); setIsAssociationDialogOpen(true) }}>
                                <LinkIcon className="h-3.5 w-3.5 mr-2" />
                                Asociar vehículos
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                                <Edit className="h-3.5 w-3.5 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openMergeDialog(customer)}>
                                <GitMerge className="h-3.5 w-3.5 mr-2" />
                                Unir con otro cliente
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Phone className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
                          <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                            {customer.phone || "Sin teléfono"}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-2 gap-2">
                          <div className="flex items-center gap-1">
                            <span className={`text-xs font-semibold ${spent > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-zinc-500"}`}>
                              ${spent.toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-300 dark:text-zinc-600">·</span>
                            <span className="text-xs text-gray-500 dark:text-zinc-400">
                              {vehicles} {vehicles === 1 ? "vehículo" : "vehículos"}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                            {timeAgo(customer.lastVisit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {filteredCustomers.length === 0 && (
                <div className="text-center py-10 text-gray-500 dark:text-zinc-400">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No se encontraron clientes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detalle */}
        <div className="lg:col-span-2">
          {selectedCustomer && validSelectedCustomerMetrics ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-semibold">
                      {getInitials(validSelectedCustomerMetrics.name)}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-xl text-gray-900 dark:text-zinc-100 truncate">
                        {validSelectedCustomerMetrics.name}
                      </CardTitle>
                      <p className="text-sm text-gray-500 dark:text-zinc-400">
                        Cliente desde {formatDateToDDMMYYYY(validSelectedCustomerMetrics.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                      Activo
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(selectedCustomer)}>
                          <Edit className="h-3.5 w-3.5 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsAssociationDialogOpen(true)}>
                          <LinkIcon className="h-3.5 w-3.5 mr-2" />
                          Asociar vehículos
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openMergeDialog(selectedCustomer)}>
                          <GitMerge className="h-3.5 w-3.5 mr-2" />
                          Unir con otro cliente
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
                    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-emerald-500" />
                          <p className="text-xs text-gray-500 dark:text-zinc-400">Total gastado</p>
                        </div>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                          ${validSelectedCustomerMetrics.totalSpent.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-3">
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                          <p className="text-xs text-gray-500 dark:text-zinc-400">Vehículos</p>
                        </div>
                        <p className="text-lg font-bold text-gray-900 dark:text-zinc-100 mt-1">
                          {validSelectedCustomerMetrics.totalVehicles}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-purple-500" />
                          <p className="text-xs text-gray-500 dark:text-zinc-400">Visitas</p>
                        </div>
                        <p className="text-lg font-bold text-gray-900 dark:text-zinc-100 mt-1">
                          {validSelectedCustomerMetrics.visitCount}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-3">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-orange-500" />
                          <p className="text-xs text-gray-500 dark:text-zinc-400">Última visita</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 mt-1">
                          {validSelectedCustomerMetrics.lastVisit
                            ? formatDateToDDMMYYYY(validSelectedCustomerMetrics.lastVisit)
                            : "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-3">Estado</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-zinc-400">Completados</span>
                            <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900">
                              {validSelectedCustomerMetrics.completedVehicles}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-zinc-400">Activos</span>
                            <Badge variant="outline" className="bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">
                              {validSelectedCustomerMetrics.activeVehicles}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {validSelectedCustomerMetrics.notes && (
                        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Notas
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-zinc-400 whitespace-pre-wrap">
                            {validSelectedCustomerMetrics.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="vehicles" className="space-y-3">
                    {validSelectedCustomerVehicles?.map((vehicle) => (
                      <div key={vehicle._id} className="rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-zinc-100">
                              {vehicle.plate} — {vehicle.brand} {vehicle.model}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-zinc-400 truncate">
                              Servicios: {vehicle.services.join(", ") || "—"}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant={
                                vehicle.status === "Entregado" ? "default" :
                                vehicle.status === "Listo" ? "secondary" : "outline"
                              }>
                                {vehicle.status}
                              </Badge>
                              <span className="text-xs text-gray-500 dark:text-zinc-500">
                                Ingreso: {formatDateToDDMMYYYY(vehicle.entryDate)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="font-medium text-gray-900 dark:text-zinc-100">${vehicle.cost.toLocaleString()}</p>
                              {vehicle.exitDate && (
                                <p className="text-xs text-gray-500 dark:text-zinc-500">
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
                                  className="text-red-600"
                                  onClick={() => handleUnlinkVehicle(vehicle._id)}
                                >
                                  <Unlink className="h-4 w-4 mr-2" />
                                  Desvincular
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsAssociationDialogOpen(true)}>
                                  <RefreshCcw className="h-4 w-4 mr-2" />
                                  Cambiar cliente
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!validSelectedCustomerVehicles || validSelectedCustomerVehicles.length === 0) && (
                      <div className="text-center py-8 text-gray-500 dark:text-zinc-400">
                        <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Sin vehículos registrados</p>
                        <Button size="sm" variant="outline" className="mt-3" onClick={() => setIsAssociationDialogOpen(true)}>
                          <LinkIcon className="h-3.5 w-3.5 mr-2" />
                          Asociar vehículos
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="contact" className="space-y-3">
                    <div className="rounded-xl border border-gray-200 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
                      {validSelectedCustomerMetrics.phone && (
                        <div className="flex items-center gap-3 p-3">
                          <Phone className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">Teléfono</p>
                            <p className="text-sm text-gray-900 dark:text-zinc-100">{validSelectedCustomerMetrics.phone}</p>
                          </div>
                        </div>
                      )}
                      {validSelectedCustomerMetrics.email && (
                        <div className="flex items-center gap-3 p-3">
                          <Mail className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">Email</p>
                            <p className="text-sm text-gray-900 dark:text-zinc-100">{validSelectedCustomerMetrics.email}</p>
                          </div>
                        </div>
                      )}
                      {validSelectedCustomerMetrics.address && (
                        <div className="flex items-center gap-3 p-3">
                          <MapPin className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">Dirección</p>
                            <p className="text-sm text-gray-900 dark:text-zinc-100">{validSelectedCustomerMetrics.address}</p>
                          </div>
                        </div>
                      )}
                      {validSelectedCustomerMetrics.documentType && validSelectedCustomerMetrics.documentNumber && (
                        <div className="flex items-center gap-3 p-3">
                          <FileText className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">Documento</p>
                            <p className="text-sm text-gray-900 dark:text-zinc-100">
                              {validSelectedCustomerMetrics.documentType}: {validSelectedCustomerMetrics.documentNumber}
                            </p>
                          </div>
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
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-zinc-600" />
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                    Selecciona un cliente
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">
                    Elegí uno de la lista para ver sus detalles.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Editar */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateCustomer} className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="edit-name">Nombre *</Label>
                <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div>
                <Label htmlFor="edit-phone">Teléfono *</Label>
                <Input id="edit-phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <Label htmlFor="edit-address">Dirección</Label>
                <Input id="edit-address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="edit-documentType">Tipo Documento</Label>
                  <Select value={formData.documentType} onValueChange={(value) => setFormData({...formData, documentType: value})}>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DNI">DNI</SelectItem>
                      <SelectItem value="CUIT">CUIT</SelectItem>
                      <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-documentNumber">Número</Label>
                  <Input id="edit-documentNumber" value={formData.documentNumber} onChange={(e) => setFormData({...formData, documentNumber: e.target.value})} />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-notes">Notas</Label>
                <Textarea id="edit-notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Actualizar Cliente</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Asociar vehículos */}
      <VehicleCustomerAssociation
        isOpen={isAssociationDialogOpen}
        onOpenChange={setIsAssociationDialogOpen}
        selectedCustomer={selectedCustomer}
      />

      {/* Unir clientes */}
      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" />
              Unir clientes
            </DialogTitle>
            <DialogDescription>
              Mueve todos los vehículos, historial y datos del cliente origen al cliente destino.
              El cliente origen se desactivará.
            </DialogDescription>
          </DialogHeader>

          {mergeSource && (
            <div className="space-y-4">
              {/* Origen */}
              <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-3 bg-gray-50 dark:bg-zinc-900/40">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-zinc-400">Cliente origen (se desactivará)</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="w-9 h-9 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center text-xs font-semibold">
                    {getInitials(mergeSource.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">{mergeSource.name}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      {mergeSource.phone} · {mergeSource.totalVehicles || 0} vehículos · ${(mergeSource.totalSpent || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Destino */}
              <div>
                <Label className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Cliente destino</Label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 h-4 w-4" />
                  <Input
                    placeholder="Buscar cliente destino..."
                    value={mergeSearch}
                    onChange={(e) => setMergeSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="mt-2 max-h-[220px] overflow-y-auto rounded-xl border border-gray-200 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
                  {mergeCandidates.map((c) => {
                    const checked = mergeTargetId === c._id
                    return (
                      <button
                        type="button"
                        key={c._id}
                        onClick={() => setMergeTargetId(c._id)}
                        className={`w-full text-left p-2.5 flex items-center gap-3 transition-colors ${
                          checked
                            ? "bg-indigo-50 dark:bg-indigo-950/40"
                            : "hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-[10px] font-semibold">
                          {getInitials(c.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">{c.name}</p>
                          <p className="text-xs text-gray-500 dark:text-zinc-400">
                            {c.phone} · {c.totalVehicles || 0} vehículos
                          </p>
                        </div>
                        {checked && (
                          <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">SELECCIONADO</span>
                        )}
                      </button>
                    )
                  })}
                  {mergeCandidates.length === 0 && (
                    <div className="p-4 text-center text-xs text-gray-500 dark:text-zinc-400">
                      Sin coincidencias
                    </div>
                  )}
                </div>
              </div>

              {mergeTarget && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                      <p className="font-medium">
                        Vas a mover {mergeSource.totalVehicles || 0} {mergeSource.totalVehicles === 1 ? "vehículo" : "vehículos"} a <strong>{mergeTarget.name}</strong>.
                      </p>
                      <p>
                        Los datos de contacto del destino tienen prioridad; solo se copian los campos que estén vacíos. Las notas se consolidan. Esta acción no puede deshacerse automáticamente.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)} disabled={isMerging}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmMerge}
              disabled={!mergeTargetId || isMerging}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <GitMerge className="h-4 w-4 mr-2" />
              {isMerging ? "Uniendo..." : "Unir clientes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
