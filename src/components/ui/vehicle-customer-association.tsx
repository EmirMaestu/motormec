import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { useOrganization } from "@clerk/clerk-react"
import { api } from "../../../convex/_generated/api"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog"
import { Button } from "./button"
import { Input } from "./input"
import { Badge } from "./badge"
import { Card, CardContent } from "./card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"
import { 
  Car, 
  Search, 
  User, 
  Phone, 
  Calendar,
  DollarSign,
  ArrowRight,
  UserPlus,
  Check,
  X,
  Unlink
} from "lucide-react"

interface VehicleCustomerAssociationProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedCustomer?: {
    _id: string
    name: string
    phone: string
  } | null
}

export default function VehicleCustomerAssociation({ 
  isOpen, 
  onOpenChange, 
  selectedCustomer 
}: VehicleCustomerAssociationProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])
  const { membership } = useOrganization()
  const isAdmin = membership?.role === "org:admin"

  // Queries
  const vehiclesWithoutCustomer = useQuery(api.vehicles.getVehiclesWithoutCustomer) || []
  const allVehiclesWithCustomerInfo = useQuery(api.vehicles.getAllVehiclesWithCustomerInfo) || []

  // Mutations
  const assignVehicleToCustomer = useMutation(api.vehicles.assignVehicleToCustomer)
  const removeCustomerFromVehicle = useMutation(api.vehicles.removeCustomerFromVehicle)

  // Filtrar vehículos por término de búsqueda
  const filteredVehiclesWithoutCustomer = vehiclesWithoutCustomer.filter(vehicle => 
    vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.owner.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredAllVehicles = allVehiclesWithCustomerInfo.filter(vehicle => 
    vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.owner.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleVehicleToggle = (vehicleId: string) => {
    setSelectedVehicles(prev => 
      prev.includes(vehicleId) 
        ? prev.filter(id => id !== vehicleId)
        : [...prev, vehicleId]
    )
  }

  const handleAssignVehicles = async () => {
    if (!selectedCustomer || selectedVehicles.length === 0) return

    try {
      for (const vehicleId of selectedVehicles) {
        await assignVehicleToCustomer({
          vehicleId: vehicleId as any,
          customerId: selectedCustomer._id as any
        })
      }
      
      setSelectedVehicles([])
      setSearchTerm("")
      onOpenChange(false)
    } catch (error) {
      console.error("Error assigning vehicles:", error)
    }
  }

  const handleRemoveCustomer = async (vehicleId: string) => {
    try {
      await removeCustomerFromVehicle({
        vehicleId: vehicleId as any
      })
    } catch (error) {
      console.error("Error removing customer from vehicle:", error)
    }
  }

  // Filtrar vehículos del cliente actual
  const customerVehicles = allVehiclesWithCustomerInfo.filter(
    v => v.hasCustomer && v.customer?._id === selectedCustomer?._id
  )

  const vehiclesWithoutCustomerCount = vehiclesWithoutCustomer.length
  const vehiclesWithCustomerCount = allVehiclesWithCustomerInfo.filter(v => v.hasCustomer).length

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            Asociar Vehículos a Cliente
            {selectedCustomer && (
              <Badge className="ml-2 bg-blue-100 text-blue-800">
                {selectedCustomer.name}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Estadísticas rápidas */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Car className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium">{vehiclesWithoutCustomerCount}</p>
                    <p className="text-xs text-muted-foreground">Sin cliente</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">{vehiclesWithCustomerCount}</p>
                    <p className="text-xs text-muted-foreground">Con cliente</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">{selectedVehicles.length}</p>
                    <p className="text-xs text-muted-foreground">Seleccionados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por patente, marca, modelo o propietario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabs para diferentes vistas */}
          <Tabs defaultValue="customer-vehicles" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="customer-vehicles">
                Vehículos del Cliente ({customerVehicles.length})
              </TabsTrigger>
              <TabsTrigger value="without-customer">
                Sin Cliente ({vehiclesWithoutCustomerCount})
              </TabsTrigger>
              <TabsTrigger value="all-vehicles">
                Todos ({allVehiclesWithCustomerInfo.length})
              </TabsTrigger>
            </TabsList>

            {/* Tab: Vehículos del cliente actual */}
            <TabsContent value="customer-vehicles" className="space-y-3 max-h-[400px] overflow-y-auto">
              {customerVehicles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Este cliente no tiene vehículos asociados</p>
                </div>
              ) : (
                customerVehicles.map((vehicle) => (
                  <Card key={vehicle._id} className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono bg-white">
                              {vehicle.plate}
                            </Badge>
                            <span className="font-medium">
                              {vehicle.brand} {vehicle.model} {vehicle.year}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{vehicle.owner}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <span>{vehicle.phone}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(vehicle.entryDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={
                              vehicle.status === "Entregado" ? "bg-green-100 text-green-800" :
                              vehicle.status === "Listo" ? "bg-blue-100 text-blue-800" :
                              vehicle.status === "En Reparación" ? "bg-yellow-100 text-yellow-800" :
                              "bg-gray-100 text-gray-800"
                            }>
                              {vehicle.status}
                            </Badge>
                            {isAdmin && (
                              <div className="flex items-center gap-1 text-sm text-green-600">
                                <DollarSign className="h-3 w-3" />
                                <span>${vehicle.cost.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemoveCustomer(vehicle._id)}
                        >
                          <Unlink className="h-4 w-4 mr-2" />
                          Desvincular
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="without-customer" className="space-y-3 max-h-[400px] overflow-y-auto">
              {filteredVehiclesWithoutCustomer.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchTerm ? "No se encontraron vehículos" : "Todos los vehículos tienen cliente asignado"}
                  </p>
                </div>
              ) : (
                filteredVehiclesWithoutCustomer.map((vehicle) => (
                  <Card 
                    key={vehicle._id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedVehicles.includes(vehicle._id) 
                        ? 'ring-2 ring-blue-500 bg-blue-50' 
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => handleVehicleToggle(vehicle._id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {vehicle.plate}
                            </Badge>
                            <span className="font-medium">
                              {vehicle.brand} {vehicle.model} {vehicle.year}
                            </span>
                            {selectedVehicles.includes(vehicle._id) && (
                              <Check className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{vehicle.owner}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <span>{vehicle.phone}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(vehicle.entryDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={
                              vehicle.status === "Entregado" ? "bg-green-100 text-green-800" :
                              vehicle.status === "Listo" ? "bg-blue-100 text-blue-800" :
                              vehicle.status === "En Reparación" ? "bg-yellow-100 text-yellow-800" :
                              "bg-gray-100 text-gray-800"
                            }>
                              {vehicle.status}
                            </Badge>
                            {isAdmin && (
                              <div className="flex items-center gap-1 text-sm text-green-600">
                                <DollarSign className="h-3 w-3" />
                                <span>${vehicle.cost.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="all-vehicles" className="space-y-3 max-h-[400px] overflow-y-auto">
              {filteredAllVehicles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No se encontraron vehículos</p>
                </div>
              ) : (
                filteredAllVehicles.map((vehicle) => {
                  const isOwnedByCurrentCustomer = vehicle.hasCustomer && vehicle.customer?._id === selectedCustomer?._id;
                  const isOwnedByOtherCustomer = vehicle.hasCustomer && vehicle.customer?._id !== selectedCustomer?._id;
                  
                  return (
                    <Card 
                      key={vehicle._id} 
                      className={`transition-all ${
                        isOwnedByCurrentCustomer
                          ? 'bg-blue-50 border-blue-200'
                          : isOwnedByOtherCustomer 
                            ? 'bg-gray-50 border-gray-200' 
                            : selectedVehicles.includes(vehicle._id)
                              ? 'ring-2 ring-blue-500 bg-blue-50 cursor-pointer' 
                              : 'hover:border-gray-300 cursor-pointer hover:shadow-md'
                      }`}
                      onClick={() => !vehicle.hasCustomer && handleVehicleToggle(vehicle._id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono">
                                {vehicle.plate}
                              </Badge>
                              <span className="font-medium">
                                {vehicle.brand} {vehicle.model} {vehicle.year}
                              </span>
                              {vehicle.hasCustomer ? (
                                <Badge className={isOwnedByCurrentCustomer ? "bg-blue-100 text-blue-800 text-xs" : "bg-green-100 text-green-800 text-xs"}>
                                  <User className="h-3 w-3 mr-1" />
                                  {vehicle.customer?.name}
                                </Badge>
                              ) : selectedVehicles.includes(vehicle._id) ? (
                                <Check className="h-4 w-4 text-blue-600" />
                              ) : null}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{vehicle.owner}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                <span>{vehicle.phone}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{new Date(vehicle.entryDate).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={
                                vehicle.status === "Entregado" ? "bg-green-100 text-green-800" :
                                vehicle.status === "Listo" ? "bg-blue-100 text-blue-800" :
                                vehicle.status === "En Reparación" ? "bg-yellow-100 text-yellow-800" :
                                "bg-gray-100 text-gray-800"
                              }>
                                {vehicle.status}
                              </Badge>
                              {isAdmin && (
                                <div className="flex items-center gap-1 text-sm text-green-600">
                                  <DollarSign className="h-3 w-3" />
                                  <span>${vehicle.cost.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {isOwnedByCurrentCustomer && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveCustomer(vehicle._id)
                              }}
                            >
                              <Unlink className="h-4 w-4 mr-2" />
                              Desvincular
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </TabsContent>
          </Tabs>

          {/* Acciones */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-600">
              {selectedVehicles.length > 0 && (
                <span>{selectedVehicles.length} vehículo(s) seleccionado(s)</span>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button 
                onClick={handleAssignVehicles}
                disabled={!selectedCustomer || selectedVehicles.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Asociar {selectedVehicles.length > 0 && `(${selectedVehicles.length})`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}