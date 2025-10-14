import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useOrganization, useUser } from '@clerk/clerk-react'
import { Plus, Search, Filter, Edit3, MoreHorizontal, Calculator, Crown, User, Play, Pause, Square, CheckCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Badge } from "../ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "../ui/dropdown-menu"
import { Label } from "../ui/label"
import { VehicleCards } from "../module-cards"
import { CreatableSelect } from "../ui/creatable-select"
import { WorkTimer, formatWorkTime } from "../ui/work-timer"
import DateRangeFilter, { type DateRangeValue } from "../ui/date-range-filter"

// Componente para seleccionar responsables
function ResponsibleSelector({ 
  responsibles, 
  onChange 
}: { 
  responsibles: { name: string; role: string; userId?: string; isAdmin?: boolean }[]; 
  onChange: (responsibles: { name: string; role: string; userId?: string; isAdmin?: boolean }[]) => void 
}) {
  const { organization } = useOrganization()
  const [orgMembers, setOrgMembers] = useState<any[]>([])
  const [selectedMember, setSelectedMember] = useState("")

  // Obtener miembros de la organización
  useEffect(() => {
    const fetchMembers = async () => {
      if (organization) {
        try {
          const members = await organization.getMemberships()
          setOrgMembers(members.data || [])
        } catch (error) {
          console.error('Error fetching organization members:', error)
        }
      }
    }

    fetchMembers()
  }, [organization])

  const addResponsible = () => {
    if (selectedMember) {
      const member = orgMembers.find(m => m.publicUserData.userId === selectedMember)
      if (member) {
        const newResponsible = {
          name: member.publicUserData.firstName + ' ' + (member.publicUserData.lastName || ''),
          role: member.role === 'org:admin' ? 'Admin' : 'Miembro',
          userId: member.publicUserData.userId,
          isAdmin: member.role === 'org:admin'
        }
        
        // Verificar que no esté ya asignado
        if (!responsibles.find(r => r.userId === newResponsible.userId)) {
          onChange([...responsibles, newResponsible])
        }
        
        setSelectedMember("")
      }
    }
  }

  const removeResponsible = (index: number) => {
    onChange(responsibles.filter((_, i) => i !== index))
  }

  const availableMembers = orgMembers.filter(member => 
    !responsibles.find(r => r.userId === member.publicUserData.userId)
  )

  return (
    <div className="space-y-2">
      {responsibles.length > 0 && (
        <div className="space-y-1">
          {responsibles.map((responsible, index) => (
            <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <div className="flex items-center gap-2">
                {responsible.isAdmin ? (
                  <Crown className="h-3 w-3 text-yellow-600" />
                ) : (
                  <User className="h-3 w-3 text-blue-600" />
                )}
                <span className="text-sm">
                  <strong>{responsible.name}</strong>
                  {responsible.isAdmin && (
                    <Badge variant="outline" className="ml-2 text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                      Admin
                    </Badge>
                  )}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeResponsible(index)}
                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}
      
      {availableMembers.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedMember} onValueChange={setSelectedMember}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Seleccionar miembro..." />
            </SelectTrigger>
            <SelectContent>
              {availableMembers.map((member) => (
                <SelectItem key={member.publicUserData.userId} value={member.publicUserData.userId}>
                  <div className="flex items-center gap-2">
                    {member.role === 'org:admin' ? (
                      <Crown className="h-3 w-3 text-yellow-600" />
                    ) : (
                      <User className="h-3 w-3 text-blue-600" />
                    )}
                    {member.publicUserData.firstName} {member.publicUserData.lastName}
                    {member.role === 'org:admin' && (
                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                        Admin
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            type="button" 
            onClick={addResponsible} 
            size="sm" 
            disabled={!selectedMember}
            className="h-10 px-3"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {availableMembers.length === 0 && orgMembers.length > 0 && (
        <p className="text-sm text-muted-foreground">Todos los miembros de la organización ya están asignados.</p>
      )}
      
      {orgMembers.length === 0 && (
        <p className="text-sm text-muted-foreground">No se encontraron miembros en la organización.</p>
      )}
    </div>
  )
}

export default function Vehicles() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { membership } = useOrganization()
  
  // Determinar si el usuario es admin
  const isAdmin = membership?.role === 'org:admin'
  const currentUserId = user?.id
  
  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [responsibleFilter, setResponsibleFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState<DateRangeValue>({
    type: 'thisMonth',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    label: 'Este Mes'
  })
  
  // Convex hooks - obtener vehículos según el rol del usuario y filtros de fecha
  const allVehiclesDefault = useQuery(
    api.vehicles.getVehiclesForUser, 
    currentUserId && typeof isAdmin === 'boolean' 
      ? { userId: currentUserId, isAdmin } 
      : "skip"
  ) ?? []
  
  const filteredVehiclesByDate = useQuery(
    api.vehicles.getVehiclesByDateRange,
    dateFilter.type !== 'thisMonth' && currentUserId && typeof isAdmin === 'boolean' ? {
      startDate: dateFilter.startDate!,
      endDate: dateFilter.endDate!,
      userId: currentUserId,
      isAdmin
    } : "skip"
  ) ?? []
  
  // Usar datos filtrados o datos generales según el filtro activo
  const allVehicles = dateFilter.type !== 'thisMonth' ? filteredVehiclesByDate : allVehiclesDefault
  
  // Aplicar filtros localmente
  const vehiclesInTaller = allVehicles.filter(vehicle => {
    // Filtro de búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchesSearch = 
        vehicle.plate.toLowerCase().includes(search) ||
        vehicle.brand.toLowerCase().includes(search) ||
        vehicle.model.toLowerCase().includes(search) ||
        vehicle.owner.toLowerCase().includes(search) ||
        vehicle.phone.toLowerCase().includes(search) ||
        (vehicle.description && vehicle.description.toLowerCase().includes(search)) ||
        vehicle.services.some((service: string) => service.toLowerCase().includes(search))
      
      if (!matchesSearch) return false
    }
    
    // Filtro de estado
    if (statusFilter !== "all") {
      if (statusFilter !== vehicle.status) return false
    }
    
    // Filtro de responsable
    if (responsibleFilter !== "all") {
      if (responsibleFilter === "unassigned") {
        if (vehicle.responsibles && vehicle.responsibles.length > 0) return false
      } else if (responsibleFilter === "assigned") {
        if (!vehicle.responsibles || vehicle.responsibles.length === 0) return false
      } else if (responsibleFilter === "mine" && currentUserId) {
        if (!vehicle.responsibles || !vehicle.responsibles.some((r: any) => r.userId === currentUserId)) return false
      }
    }
    
    return true
  })
  
  const createVehicle = useMutation(api.vehicles.createVehicle)
  const updateVehicle = useMutation(api.vehicles.updateVehicle)
  const startWorkOnVehicle = useMutation(api.vehicles.startWorkOnVehicle)
  const pauseWorkOnVehicle = useMutation(api.vehicles.pauseWorkOnVehicle)
  const completeWorkOnVehicle = useMutation(api.vehicles.completeWorkOnVehicle)


  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isDeliverDialogOpen, setIsDeliverDialogOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<any>(null)
  const [detailVehicle, setDetailVehicle] = useState<any>(null)
  const [vehicleToDeliver, setVehicleToDeliver] = useState<any>(null)
  const [newVehicle, setNewVehicle] = useState({
    plate: "",
    brand: "",
    model: "",
    year: "",
    owner: "",
    phone: "",
    services: [] as string[],
    cost: "",
    description: "",
    responsibles: [] as { name: string; role: string; userId?: string; isAdmin?: boolean }[],
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Ingresado":
        return <Badge className="bg-yellow-100 text-yellow-800">Ingresado</Badge>
      case "En Reparación":
        return <Badge className="bg-blue-100 text-blue-800">En Reparación</Badge>
      case "Listo":
        return <Badge className="bg-green-100 text-green-800">Listo</Badge>
      case "Entregado":
        return <Badge className="bg-gray-100 text-gray-800">Entregado</Badge>
      case "Suspendido":
        return <Badge variant="destructive">Suspendido</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }


  const handleAddVehicle = async () => {
    if (newVehicle.plate && newVehicle.brand && newVehicle.model && newVehicle.owner) {
      try {
        let responsibles = newVehicle.responsibles.map(r => ({
          name: r.name,
          role: r.role,
          assignedAt: new Date().toISOString(),
          userId: r.userId,
          isAdmin: r.isAdmin,
        }))

        // Si es miembro (no admin) y no se ha asignado responsables, asignarse automáticamente
        if (!isAdmin && responsibles.length === 0 && user) {
          responsibles = [{
            name: `${user.firstName} ${user.lastName}`.trim(),
            role: "Miembro",
            assignedAt: new Date().toISOString(),
            userId: user.id,
            isAdmin: false,
          }]
        }
        
        await createVehicle({
          plate: newVehicle.plate,
          brand: newVehicle.brand,
          model: newVehicle.model,
          year: parseInt(newVehicle.year) || new Date().getFullYear(),
          owner: newVehicle.owner,
          phone: newVehicle.phone,
          status: "Ingresado",
          entryDate: new Date().toISOString(),
          services: newVehicle.services.length > 0 ? newVehicle.services : ["Mantenimiento general"],
          cost: parseFloat(newVehicle.cost) || 0,
          description: newVehicle.description,
          responsibles,
        })

        setNewVehicle({
          plate: "",
          brand: "",
          model: "",
          year: "",
          owner: "",
          phone: "",
          services: [],
          cost: "",
          description: "",
          responsibles: [],
        })
        setIsDialogOpen(false)
      } catch (error) {
        console.error('Error al crear vehículo:', error)
      }
    }
  }

  const handleEditVehicle = (vehicle: any) => {
    // Los miembros no-admin solo pueden editar vehículos donde estén asignados o sin asignar
    if (!isAdmin && !canEditVehicle(vehicle)) {
      alert("Solo puedes editar vehículos asignados a ti o sin asignar.")
      return
    }
    
    setEditingVehicle({
      ...vehicle,
      services: Array.isArray(vehicle.services) ? [...vehicle.services] : [],
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateVehicle = async () => {
    if (editingVehicle && editingVehicle._id) {
      try {
        await updateVehicle({
          id: editingVehicle._id,
          plate: editingVehicle.plate,
          brand: editingVehicle.brand,
          model: editingVehicle.model,
          year: parseInt(editingVehicle.year),
          owner: editingVehicle.owner,
          phone: editingVehicle.phone,
          status: editingVehicle.status,
          services: editingVehicle.services,
          cost: parseFloat(editingVehicle.cost),
          description: editingVehicle.description,
          responsibles: editingVehicle.responsibles || [],
        })

        setIsEditDialogOpen(false)
        setEditingVehicle(null)
      } catch (error) {
        console.error('Error al actualizar vehículo:', error)
      }
    }
  }

  const handleViewDetail = (vehicle: any) => {
    setDetailVehicle(vehicle)
    setIsDetailDialogOpen(true)
  }

  const handleStartWork = async (vehicle: any) => {
    if (!user) return
    
    await startWorkOnVehicle({
      vehicleId: vehicle._id,
      userId: user.id,
      userName: user.fullName || user.firstName || "Usuario",
      isAdmin: isAdmin
    })
  }

  const handlePauseWork = async (vehicle: any) => {
    if (!user) return
    
    try {
      const result = await pauseWorkOnVehicle({
        vehicleId: vehicle._id,
        userId: user.id
      })
      console.log("Trabajo pausado:", result)
    } catch (error) {
      console.error("Error al pausar trabajo:", error)
      alert("Error al pausar el trabajo. Por favor intenta de nuevo.")
    }
  }

  const handleCompleteWork = async (vehicle: any) => {
    if (!user) return
    
    try {
      const result = await completeWorkOnVehicle({
        vehicleId: vehicle._id,
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

  // Función para determinar si el usuario está asignado al vehículo
  const isUserAssigned = (vehicle: any) => {
    return vehicle.responsibles?.some((r: any) => r.userId === user?.id) || false
  }


  const handleDeliverVehicle = (vehicle: any) => {
    // Los miembros no-admin solo pueden entregar vehículos donde estén asignados o sin asignar
    if (!isAdmin && !canEditVehicle(vehicle)) {
      alert("Solo puedes entregar vehículos asignados a ti o sin asignar.")
      return
    }
    
    setVehicleToDeliver(vehicle)
    setIsDeliverDialogOpen(true)
  }

  const createVehicleTransaction = useMutation(api.transactions.createVehicleTransaction)

  // Helper para verificar si el usuario puede editar un vehículo
  const canEditVehicle = (vehicle: any) => {
    if (isAdmin) return true
    
    // Sin responsables asignados - puede editar (está libre)
    if (!vehicle.responsibles || vehicle.responsibles.length === 0) {
      return true
    }
    
    // Si el usuario está entre los responsables asignados - puede editar
    return vehicle.responsibles.some((r: any) => r.userId === currentUserId)
  }

  const confirmDeliverVehicle = async () => {
    if (vehicleToDeliver) {
      try {
        const deliveryDate = new Date().toISOString()
        
        // Actualizar estado del vehículo
        await updateVehicle({ 
          id: vehicleToDeliver._id, 
          status: "Entregado",
          exitDate: deliveryDate
        })
        
        // Crear transacción automática en finanzas
        await createVehicleTransaction({
          vehicleId: vehicleToDeliver._id,
          vehiclePlate: vehicleToDeliver.plate,
          vehicleBrand: vehicleToDeliver.brand,
          vehicleModel: vehicleToDeliver.model,
          customerName: vehicleToDeliver.owner,
          services: vehicleToDeliver.services || [],
          amount: vehicleToDeliver.costs?.totalCost || vehicleToDeliver.cost || 0,
          deliveryDate: deliveryDate,
        })
        
        setIsDeliverDialogOpen(false)
        setVehicleToDeliver(null)
      } catch (error) {
        console.error('Error al entregar vehículo:', error)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Vehículos</h1>
          <p className="text-muted-foreground">Administra los vehículos en el taller</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => navigate("/vehiculos/historial")}
            className="flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Vehículos Completados
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Vehículo
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Ingresar Nuevo Vehículo</DialogTitle>
              <DialogDescription>
                Registra un nuevo vehículo en el taller
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="plate">Placa</Label>
                  <Input
                    id="plate"
                    value={newVehicle.plate}
                    onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value })}
                    placeholder="ABC-123"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="year">Año</Label>
                  <Input
                    id="year"
                    type="number"
                    value={newVehicle.year}
                    onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    placeholder="2024"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="brand">Marca</Label>
                  <Input
                    id="brand"
                    value={newVehicle.brand}
                    onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                    placeholder="Toyota"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Input
                    id="model"
                    value={newVehicle.model}
                    onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                    placeholder="Corolla"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="owner">Cliente</Label>
                  <Input
                    id="owner"
                    value={newVehicle.owner}
                    onChange={(e) => setNewVehicle({ ...newVehicle, owner: e.target.value })}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={newVehicle.phone}
                    onChange={(e) => setNewVehicle({ ...newVehicle, phone: e.target.value })}
                    placeholder="555-0123"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="services">Servicios</Label>
                <CreatableSelect
                  value={newVehicle.services}
                  onChange={(services) => setNewVehicle({ ...newVehicle, services })}
                  placeholder="Seleccionar o agregar servicios..."
                />
              </div>
              <div className="grid gap-2">
                <Label>Responsables</Label>
                <ResponsibleSelector
                  responsibles={newVehicle.responsibles}
                  onChange={(responsibles) => setNewVehicle({ ...newVehicle, responsibles })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cost">Costo Estimado</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={newVehicle.cost}
                  onChange={(e) => setNewVehicle({ ...newVehicle, cost: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={newVehicle.description}
                  onChange={(e) => setNewVehicle({ ...newVehicle, description: e.target.value })}
                  placeholder="Descripción detallada del problema o servicio"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddVehicle}>
                Registrar Vehículo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>

        {/* Diálogo de Edición */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Vehículo</DialogTitle>
              <DialogDescription>
                Modifica la información del vehículo
              </DialogDescription>
            </DialogHeader>
            {editingVehicle && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-plate">Placa</Label>
                    <Input
                      id="edit-plate"
                      value={editingVehicle.plate}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, plate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-year">Año</Label>
                    <Input
                      id="edit-year"
                      type="number"
                      value={editingVehicle.year}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, year: e.target.value })}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-brand">Marca</Label>
                    <Input
                      id="edit-brand"
                      value={editingVehicle.brand}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, brand: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-model">Modelo</Label>
                    <Input
                      id="edit-model"
                      value={editingVehicle.model}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, model: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-owner">Cliente</Label>
                    <Input
                      id="edit-owner"
                      value={editingVehicle.owner}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, owner: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-phone">Teléfono</Label>
                    <Input
                      id="edit-phone"
                      value={editingVehicle.phone}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-status">Estado</Label>
                    <Select 
                      value={editingVehicle.status}
                      onValueChange={(value) => setEditingVehicle({ ...editingVehicle, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ingresado">Ingresado</SelectItem>
                        <SelectItem value="En Reparación">En Reparación</SelectItem>
                        <SelectItem value="Listo">Listo</SelectItem>
                        <SelectItem value="Entregado">Entregado</SelectItem>
                        <SelectItem value="Suspendido">Suspendido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-cost">Costo</Label>
                    <Input
                      id="edit-cost"
                      type="number"
                      step="0.01"
                      value={editingVehicle.cost}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, cost: e.target.value })}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-services">Servicios</Label>
                  <CreatableSelect
                    key={editingVehicle._id}
                    value={editingVehicle.services || []}
                    onChange={(services) => setEditingVehicle({ ...editingVehicle, services })}
                    placeholder="Seleccionar o agregar servicios..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Responsables</Label>
                  <ResponsibleSelector
                    key={`responsibles-${editingVehicle._id}`}
                    responsibles={editingVehicle.responsibles?.map((r: any) => ({ 
                      name: r.name, 
                      role: r.role, 
                      userId: r.userId, 
                      isAdmin: r.isAdmin 
                    })) || []}
                    onChange={(responsibles) => setEditingVehicle({ 
                      ...editingVehicle, 
                      responsibles: responsibles.map(r => ({
                        name: r.name,
                        role: r.role,
                        assignedAt: new Date().toISOString(),
                        userId: r.userId,
                        isAdmin: r.isAdmin,
                      }))
                    })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Descripción</Label>
                  <Input
                    id="edit-description"
                    value={editingVehicle.description || ""}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, description: e.target.value })}
                  />
                </div>

                {/* Sección de Repuestos */}
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Repuestos y Partes</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newParts = [...(editingVehicle.parts || []), {
                          id: Date.now().toString(),
                          name: "",
                          price: 0,
                          quantity: 1,
                          source: "purchased",
                          supplier: "",
                          notes: ""
                        }];
                        setEditingVehicle({ ...editingVehicle, parts: newParts });
                      }}
                      className="text-xs"
                    >
                      + Agregar Repuesto
                    </Button>
                  </div>
                  
                  {editingVehicle.parts && editingVehicle.parts.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {editingVehicle.parts.map((part: any, index: number) => (
                        <div key={part.id || index} className="bg-gray-50 rounded-lg p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Repuesto #{index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newParts = editingVehicle.parts.filter((_: any, i: number) => i !== index);
                                setEditingVehicle({ ...editingVehicle, parts: newParts });
                              }}
                              className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                            >
                              ×
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Nombre</Label>
                              <Input
                                value={part.name}
                                onChange={(e) => {
                                  const newParts = [...editingVehicle.parts];
                                  newParts[index] = { ...part, name: e.target.value };
                                  setEditingVehicle({ ...editingVehicle, parts: newParts });
                                }}
                                placeholder="Nombre del repuesto"
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Origen</Label>
                              <Select
                                value={part.source}
                                onValueChange={(value) => {
                                  const newParts = [...editingVehicle.parts];
                                  newParts[index] = { ...part, source: value };
                                  setEditingVehicle({ ...editingVehicle, parts: newParts });
                                }}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="purchased">Comprado</SelectItem>
                                  <SelectItem value="client">Cliente</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Cantidad</Label>
                              <Input
                                type="number"
                                min="1"
                                value={part.quantity}
                                onChange={(e) => {
                                  const newParts = [...editingVehicle.parts];
                                  newParts[index] = { ...part, quantity: parseInt(e.target.value) || 1 };
                                  setEditingVehicle({ ...editingVehicle, parts: newParts });
                                }}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Precio unitario</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={part.price}
                                onChange={(e) => {
                                  const newParts = [...editingVehicle.parts];
                                  newParts[index] = { ...part, price: parseFloat(e.target.value) || 0 };
                                  setEditingVehicle({ ...editingVehicle, parts: newParts });
                                }}
                                placeholder="0.00"
                                className="text-sm"
                              />
                            </div>
                          </div>
                          
                          {part.source === "purchased" && (
                            <div>
                              <Label className="text-xs">Proveedor</Label>
                              <Input
                                value={part.supplier || ""}
                                onChange={(e) => {
                                  const newParts = [...editingVehicle.parts];
                                  newParts[index] = { ...part, supplier: e.target.value };
                                  setEditingVehicle({ ...editingVehicle, parts: newParts });
                                }}
                                placeholder="Nombre del proveedor"
                                className="text-sm"
                              />
                            </div>
                          )}
                          
                          <div>
                            <Label className="text-xs">Notas</Label>
                            <Input
                              value={part.notes || ""}
                              onChange={(e) => {
                                const newParts = [...editingVehicle.parts];
                                newParts[index] = { ...part, notes: e.target.value };
                                setEditingVehicle({ ...editingVehicle, parts: newParts });
                              }}
                              placeholder="Notas adicionales..."
                              className="text-sm"
                            />
                          </div>
                          
                          <div className="bg-white rounded p-2 border">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">Total:</span>
                              <span className="font-semibold text-green-600">
                                ${((part.price || 0) * (part.quantity || 1)).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {editingVehicle.parts.length > 0 && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-900">Total en Repuestos:</span>
                            <span className="text-lg font-bold text-green-600">
                              ${editingVehicle.parts.reduce((sum: number, part: any) => 
                                sum + ((part.price || 0) * (part.quantity || 1)), 0
                              ).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-500">
                      No hay repuestos agregados. Haz clic en "Agregar Repuesto" para comenzar.
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateVehicle}>
                Guardar Cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo de Detalle */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">
                {detailVehicle && `${detailVehicle.brand} ${detailVehicle.model} ${detailVehicle.year} - ${detailVehicle.plate}`}
              </DialogTitle>
              <DialogDescription>
                Información completa del vehículo y seguimiento de trabajo
              </DialogDescription>
            </DialogHeader>
            {detailVehicle && (
              <div className="space-y-6">
                {/* Estado y trabajo actual */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      {getStatusBadge(detailVehicle.status)}
                      <Badge variant={detailVehicle.inTaller ? "default" : "secondary"}>
                        {detailVehicle.inTaller ? "En Taller" : "Fuera del Taller"}
                      </Badge>
                      {detailVehicle.responsibles?.some((r: any) => r.isWorking) && (
                        <Badge className="bg-green-500 text-white animate-pulse">
                          🔧 En Trabajo
                        </Badge>
                      )}
                    </div>
                    
                    {/* Timer si hay trabajo activo para el usuario actual */}
                    {user && detailVehicle.responsibles?.some((r: any) => r.userId === user.id) && (
                      <WorkTimer 
                        userId={user.id} 
                        vehicle={detailVehicle} 
                        isWorking={detailVehicle.responsibles?.find((r: any) => r.userId === user.id)?.isWorking || false}
                        className="text-sm"
                      />
                    )}
                  </div>
                </div>

                {/* Información del vehículo y cliente */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Datos del vehículo */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Información del Vehículo</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Marca</label>
                        <p className="mt-1 text-sm text-gray-900 font-medium">{detailVehicle.brand}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Modelo</label>
                        <p className="mt-1 text-sm text-gray-900 font-medium">{detailVehicle.model}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Año</label>
                        <p className="mt-1 text-sm text-gray-900 font-medium">{detailVehicle.year}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Placa</label>
                        <p className="mt-1 text-sm text-gray-900 font-medium">{detailVehicle.plate}</p>
                      </div>
                    </div>
                  </div>

                  {/* Información del cliente */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Información del Cliente</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Propietario</label>
                        <p className="mt-1 text-sm text-gray-900 font-medium">{detailVehicle.owner}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                        <p className="mt-1 text-sm text-gray-900 font-medium">
                          <a href={`tel:${detailVehicle.phone}`} className="text-blue-600 hover:text-blue-800">
                            {detailVehicle.phone}
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fechas importantes */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fecha de Ingreso</label>
                    <p className="mt-1 text-sm text-gray-900 font-medium">
                      {new Date(detailVehicle.entryDate).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  {detailVehicle.exitDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Fecha de Salida</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">
                        {new Date(detailVehicle.exitDate).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Última Actualización</label>
                    <p className="mt-1 text-sm text-gray-600">
                      {new Date(detailVehicle.lastUpdated || detailVehicle.entryDate).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>

                {/* Servicios solicitados */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-3">Servicios Solicitados</h3>
                  <div className="flex flex-wrap gap-2">
                    {detailVehicle.services?.map((service: string, index: number) => (
                      <Badge 
                        key={index} 
                        variant="outline" 
                        className="text-sm bg-blue-50 text-blue-700 border-blue-200"
                      >
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Descripción del trabajo */}
                {detailVehicle.description && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-3">Descripción del Trabajo</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-900 leading-relaxed">{detailVehicle.description}</p>
                    </div>
                  </div>
                )}

                {/* Mecánicos asignados y tiempo de trabajo */}
                {detailVehicle.responsibles && detailVehicle.responsibles.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-3">Mecánicos Asignados</h3>
                    <div className="space-y-3">
                      {detailVehicle.responsibles.map((responsible: any, index: number) => (
                        <div key={index} className="bg-blue-50 rounded-lg p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-medium text-gray-900">{responsible.name}</p>
                                <p className="text-sm text-gray-600">
                                  {responsible.role || "Mecánico"} • Asignado el {new Date(responsible.assignedAt).toLocaleDateString('es-ES')}
                                </p>
                              </div>
                              {responsible.isAdmin && (
                                <Badge variant="secondary" className="text-xs">Admin</Badge>
                              )}
                              {responsible.isWorking && (
                                <Badge className="bg-green-500 text-white animate-pulse text-xs">
                                  Trabajando
                                </Badge>
                              )}
                            </div>
                            
                            {/* Tiempo trabajado */}
                            <div className="flex items-center gap-2">
                              {user && responsible.userId === user.id && (
                                <WorkTimer 
                                  userId={user.id} 
                                  vehicle={detailVehicle} 
                                  isWorking={responsible.isWorking || false}
                                  className="text-sm"
                                />
                              )}
                              {responsible.totalWorkTime && responsible.totalWorkTime > 0 && (
                                <Badge variant="outline" className="font-mono text-xs">
                                  Total: {formatWorkTime(responsible.totalWorkTime)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Sesiones de trabajo */}
                          {responsible.workSessions && responsible.workSessions.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-blue-200">
                              <p className="text-sm font-medium text-gray-700 mb-2">Sesiones de Trabajo:</p>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {responsible.workSessions.map((session: any, sessionIndex: number) => (
                                  <div key={sessionIndex} className="text-xs text-gray-600 flex justify-between items-center">
                                    <span>
                                      {new Date(session.startTime).toLocaleDateString('es-ES')} - 
                                      {new Date(session.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                      {session.endTime && (
                                        <> hasta {new Date(session.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</>
                                      )}
                                      {!session.endTime && responsible.isWorking && " - Actualmente trabajando"}
                                    </span>
                                    {session.duration && (
                                      <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                                        {formatWorkTime(session.duration)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Información financiera */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Financiera</h3>
                  {detailVehicle.costs ? (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-xl font-bold text-blue-600">
                            ${detailVehicle.costs.laborCost?.toLocaleString() || '0'}
                          </p>
                          <p className="text-sm text-gray-600">Mano de Obra</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-orange-600">
                            ${detailVehicle.costs.partsCost?.toLocaleString() || '0'}
                          </p>
                          <p className="text-sm text-gray-600">Repuestos</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            ${detailVehicle.costs.totalCost?.toLocaleString() || '0'}
                          </p>
                          <p className="text-sm text-gray-600">Total</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        ${detailVehicle.cost?.toLocaleString() || '0'}
                      </p>
                      <p className="text-sm text-gray-600">Costo Total</p>
                    </div>
                  )}
                </div>

                {/* Repuestos y partes */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Repuestos y Partes</h3>
                  {detailVehicle.parts && detailVehicle.parts.length > 0 ? (
                    <div className="grid gap-3">
                      {detailVehicle.parts.map((part: any, index: number) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium text-gray-900">{part.name}</h4>
                                <Badge variant={part.source === "client" ? "secondary" : "default"} className="text-xs">
                                  {part.source === "client" ? "Cliente" : "Comprado"}
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-600 space-y-1">
                                <p>Cantidad: <span className="font-medium">{part.quantity}</span></p>
                                <p>Precio unitario: <span className="font-medium">${part.price.toLocaleString()}</span></p>
                                {part.supplier && (
                                  <p>Proveedor: <span className="font-medium">{part.supplier}</span></p>
                                )}
                                {part.notes && (
                                  <p className="italic text-gray-500">"{part.notes}"</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-600">
                                ${(part.price * part.quantity).toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">Total</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="bg-green-100 rounded-lg p-3 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-900">Total en Repuestos:</span>
                          <span className="text-lg font-bold text-green-600">
                            ${detailVehicle.parts.reduce((sum: number, part: any) => sum + (part.price * part.quantity), 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-6 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                        </div>
                        <h4 className="text-sm font-medium text-gray-900 mb-1">Sin repuestos registrados</h4>
                        <p className="text-sm text-gray-500">
                          No se han registrado repuestos para este vehículo
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                Cerrar
              </Button>
              <Button onClick={() => {
                setIsDetailDialogOpen(false)
                handleEditVehicle(detailVehicle)
              }}>
                Editar Vehículo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo de Confirmación de Entrega */}
        <Dialog open={isDeliverDialogOpen} onOpenChange={setIsDeliverDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Confirmar Entrega</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas marcar este vehículo como entregado?
              </DialogDescription>
            </DialogHeader>
            {vehicleToDeliver && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-blue-900">
                        {vehicleToDeliver.plate} - {vehicleToDeliver.brand} {vehicleToDeliver.model}
                      </h3>
                      <p className="text-sm text-blue-700">
                        Cliente: {vehicleToDeliver.owner}
                      </p>
                      <p className="text-sm text-blue-700">
                        Costo total: ${vehicleToDeliver.cost?.toLocaleString() || '0'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-yellow-800">
                        Importante
                      </h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        Una vez marcado como entregado, el vehículo se moverá al historial y no podrá ser modificado sin cambiar su estado.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsDeliverDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={confirmDeliverVehicle}
                className="bg-green-600 hover:bg-green-700"
              >
                Confirmar Entrega
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de Estadísticas Colapsables - Ocultas en móvil */}
      <div className="hidden md:block">
        <VehicleCards />
      </div>

      {/* Filtro de fechas */}
      <DateRangeFilter
        value={dateFilter}
        onChange={setDateFilter}
        compact
        className="w-full md:w-auto"
      />

          {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por placa, marca, cliente, teléfono..." 
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="Ingresado">Ingresado</SelectItem>
            <SelectItem value="En Reparación">En Reparación</SelectItem>
            <SelectItem value="Listo">Listo</SelectItem>
            <SelectItem value="Entregado">Entregado</SelectItem>
            <SelectItem value="Suspendido">Suspendido</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <User className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por responsable" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="mine">Asignados a mí</SelectItem>
            <SelectItem value="assigned">Con responsable</SelectItem>
            <SelectItem value="unassigned">Sin asignar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla de vehículos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle>Vehículos en Taller</CardTitle>
                {dateFilter.type !== 'thisMonth' && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Periodo: {dateFilter.label}
                  </p>
                )}
              </div>
              {!isAdmin && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 hidden sm:inline-flex">
                  <User className="h-3 w-3 mr-1" />
                  Vista de Miembro
                </Badge>
              )}
              {isAdmin && (
                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200 hidden sm:inline-flex">
                  <Crown className="h-3 w-3 mr-1" />
                  Vista de Admin
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4">
              {/* Contador de resultados */}
              <p className="text-sm text-muted-foreground hidden sm:block">
                {searchTerm || statusFilter !== "all" || responsibleFilter !== "all" ? (
                  <>
                    {vehiclesInTaller.length} de {allVehicles.length} vehículo{allVehicles.length !== 1 ? 's' : ''}
                    {(searchTerm || statusFilter !== "all" || responsibleFilter !== "all") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchTerm("")
                          setStatusFilter("all")
                          setResponsibleFilter("all")
                        }}
                        className="ml-2 h-6 px-2 text-xs"
                      >
                        Limpiar filtros
                      </Button>
                    )}
                  </>
                ) : !isAdmin ? (
                  `Mostrando ${vehiclesInTaller.length} vehículo${vehiclesInTaller.length !== 1 ? 's' : ''} (asignados a ti + sin asignar)`
                ) : (
                  `${vehiclesInTaller.length} vehículo${vehiclesInTaller.length !== 1 ? 's' : ''} en total`
                )}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Vehículo</TableHead>
                  <TableHead className="min-w-[120px]">Cliente</TableHead>
                  <TableHead className="min-w-[100px] hidden sm:table-cell">Servicios</TableHead>
                  <TableHead className="min-w-[100px] hidden sm:table-cell">Responsables</TableHead>
                  <TableHead className="min-w-[80px]">Estado</TableHead>
                  <TableHead className="min-w-[120px]">Trabajo</TableHead>
                  <TableHead className="min-w-[80px] hidden sm:table-cell">Costo</TableHead>
                  <TableHead className="min-w-[80px] hidden sm:table-cell">Ingreso</TableHead>
                  <TableHead className="min-w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehiclesInTaller.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 sm:colSpan-9">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">No se encontraron vehículos</p>
                          <p className="text-xs text-muted-foreground">
                            {searchTerm || statusFilter !== "all" || responsibleFilter !== "all" 
                              ? "Intenta ajustar los filtros" 
                              : !isAdmin 
                                ? "No tienes vehículos asignados ni hay vehículos sin asignar"
                                : "No hay vehículos en el taller"
                            }
                          </p>
                        </div>
                        {(searchTerm || statusFilter !== "all" || responsibleFilter !== "all") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSearchTerm("")
                              setStatusFilter("all")
                              setResponsibleFilter("all")
                            }}
                            className="mt-2"
                          >
                            Limpiar filtros
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  vehiclesInTaller.map((vehicle) => (
                  <TableRow 
                    key={vehicle._id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors group"
                    onClick={() => handleViewDetail(vehicle)}
                    title="Clic para ver detalles del vehículo"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-8 bg-blue-200 rounded-full group-hover:bg-blue-400 transition-colors opacity-30 group-hover:opacity-100"></div>
                        <div>
                          <p className="font-medium">{vehicle.plate}</p>
                          <p className="text-sm text-muted-foreground">
                            {vehicle.brand} {vehicle.model} {vehicle.year}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{vehicle.owner}</p>
                        <p className="text-sm text-muted-foreground">{vehicle.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="max-w-64">
                        <div className="flex flex-wrap gap-1 mb-1">
                          {vehicle.services.length > 0 && (
                            <Badge 
                              variant="secondary" 
                              className="text-xs bg-blue-100 text-blue-800"
                            >
                              {vehicle.services[0]}
                            </Badge>
                          )}
                          {vehicle.services.length > 1 && (
                            <Badge variant="outline" className="text-xs">
                              +{vehicle.services.length - 1} más
                            </Badge>
                          )}
                        </div>
                        {vehicle.description && (
                          <p className="text-xs text-muted-foreground truncate">{vehicle.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="max-w-48">
                        {vehicle.responsibles && vehicle.responsibles.length > 0 ? (
                          <div className="space-y-1">
                            {vehicle.responsibles.slice(0, 2).map((responsible, index) => (
                              <div key={index} className="flex items-center gap-1">
                                <div className="flex items-center gap-1">
                                  {responsible.isAdmin ? (
                                    <Crown className="h-3 w-3 text-yellow-600" />
                                  ) : (
                                    <User className="h-3 w-3 text-blue-600" />
                                  )}
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${
                                      responsible.isAdmin 
                                        ? 'bg-yellow-50 text-yellow-800 border-yellow-200' 
                                        : 'bg-green-50 text-green-800 border-green-200'
                                    }`}
                                  >
                                    {responsible.name}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                            {vehicle.responsibles.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{vehicle.responsibles.length - 2} más
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin asignar</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {isUserWorking(vehicle) ? (
                          <div className="flex flex-col gap-1">
                            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                              🔧 Trabajando
                            </Badge>
                            {user && (
                              <WorkTimer 
                                userId={user.id} 
                                vehicle={vehicle} 
                                isWorking={true}
                                className="justify-start"
                              />
                            )}
                          </div>
                        ) : isUserAssigned(vehicle) ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="text-xs">
                              📋 Asignado
                            </Badge>
                            {user && (
                              <WorkTimer 
                                userId={user.id} 
                                vehicle={vehicle} 
                                isWorking={false}
                                className="justify-start"
                              />
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-500">
                            ⏸️ Disponible
                          </Badge>
                        )}
                        {/* Mostrar otros responsables que están trabajando */}
                        {vehicle.responsibles?.filter((r: any) => r.isWorking && r.userId !== user?.id).map((r: any) => (
                          <span key={r.userId} className="text-xs text-green-600">
                            {r.name} trabajando
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="font-medium">${vehicle.cost.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-sm">{new Date(vehicle.entryDate).toLocaleDateString()}</span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {!isAdmin && !canEditVehicle(vehicle) && (
                          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-300 hidden sm:inline-flex">
                            <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Restringido
                          </Badge>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 w-9 p-0 border border-gray-200 hover:bg-gray-50">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem 
                              onClick={() => handleEditVehicle(vehicle)}
                              disabled={!canEditVehicle(vehicle)}
                              className={!canEditVehicle(vehicle) ? "text-gray-400 cursor-not-allowed" : ""}
                            >
                              <Edit3 className="mr-2 h-4 w-4" />
                              Editar
                              {!canEditVehicle(vehicle) && (
                                <svg className="ml-auto h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => navigate(`/vehiculos/${vehicle._id}/costos`)}
                              disabled={!canEditVehicle(vehicle)}
                              className={!canEditVehicle(vehicle) ? "text-gray-400 cursor-not-allowed" : ""}
                            >
                              <Calculator className="mr-2 h-4 w-4" />
                              Gestionar Costos
                              {!canEditVehicle(vehicle) && (
                                <svg className="ml-auto h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              )}
                            </DropdownMenuItem>
                            
                            {/* Botones de trabajo */}
                            {vehicle.status !== "Entregado" && vehicle.status !== "Suspendido" && (isUserAssigned(vehicle) || (!vehicle.responsibles || vehicle.responsibles.length === 0)) && (
                              <>
                                <DropdownMenuSeparator />
                                {!isUserWorking(vehicle) ? (
                                  <DropdownMenuItem onClick={() => handleStartWork(vehicle)}>
                                    <Play className="mr-2 h-4 w-4 text-green-600" />
                                    <span className="text-green-600">Iniciar Trabajo</span>
                                  </DropdownMenuItem>
                                ) : (
                                  <>
                                    <DropdownMenuItem onClick={() => handlePauseWork(vehicle)}>
                                      <Pause className="mr-2 h-4 w-4 text-yellow-600" />
                                      <span className="text-yellow-600">Pausar Trabajo</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleCompleteWork(vehicle)}>
                                      <Square className="mr-2 h-4 w-4 text-green-600" />
                                      <span className="text-green-600">Completar Trabajo</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            )}
                            
                            {vehicle.status !== "Entregado" && vehicle.status !== "Suspendido" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeliverVehicle(vehicle)}
                                  disabled={!canEditVehicle(vehicle)}
                                  className={
                                    !canEditVehicle(vehicle) 
                                      ? "text-gray-400 cursor-not-allowed" 
                                      : "text-green-600 focus:text-green-600"
                                  }
                                >
                                  <svg 
                                    className="mr-2 h-4 w-4" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path 
                                      strokeLinecap="round" 
                                      strokeLinejoin="round" 
                                      strokeWidth={2} 
                                      d="M5 13l4 4L19 7" 
                                    />
                                  </svg>
                                  Entregar
                                  {!canEditVehicle(vehicle) && (
                                    <svg className="ml-auto h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                  )}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}