import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Plus, Trash2, ArrowLeft, Save, Calculator } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Badge } from "../ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Textarea } from "../ui/textarea"
import type { Id } from "../../../convex/_generated/dataModel"

interface Part {
  id: string
  name: string
  price: number
  quantity: number
  source: "client" | "purchased"
  supplier?: string
  notes?: string
}


export default function VehicleCostManagement() {
  const navigate = useNavigate()
  const { vehicleId } = useParams<{ vehicleId: string }>()
  
  // Convex hooks
  const vehicle = useQuery(api.vehicles.getVehicleById, { id: vehicleId as Id<"vehicles"> })
  const updateVehicle = useMutation(api.vehicles.updateVehicle)
  
  // Estado local
  const [laborCost, setLaborCost] = useState(0)
  const [parts, setParts] = useState<Part[]>([])
  const [newPart, setNewPart] = useState<Partial<Part>>({
    name: "",
    price: 0,
    quantity: 1,
    source: "purchased",
    supplier: "",
    notes: ""
  })

  // Cargar datos del vehículo
  useEffect(() => {
    if (vehicle) {
      // Si ya se gestionaron costos, usar laborCost guardado; si no, usar el costo inicial del vehículo
      setLaborCost(vehicle.costs !== undefined ? (vehicle.costs.laborCost ?? 0) : (vehicle.cost ?? 0))
      setParts(vehicle.parts || [])
    }
  }, [vehicle])

  // Cálculos
  const partsCost = parts.reduce((total, part) => total + (part.price * part.quantity), 0)
  const totalCost = laborCost + partsCost

  const addPart = () => {
    if (newPart.name && newPart.price) {
      const part: Part = {
        id: Date.now().toString(),
        name: newPart.name!,
        price: newPart.price!,
        quantity: newPart.quantity || 1,
        source: newPart.source || "purchased",
        supplier: newPart.supplier || "",
        notes: newPart.notes || ""
      }
      
      setParts([...parts, part])
      setNewPart({
        name: "",
        price: 0,
        quantity: 1,
        source: "purchased",
        supplier: "",
        notes: ""
      })
    }
  }

  const removePart = (partId: string) => {
    setParts(parts.filter(part => part.id !== partId))
  }

  const updatePart = (partId: string, field: keyof Part, value: any) => {
    setParts(parts.map(part => 
      part.id === partId ? { ...part, [field]: value } : part
    ))
  }

  const saveCosts = async () => {
    if (!vehicle || !vehicleId) return

    try {
      await updateVehicle({
        id: vehicleId as Id<"vehicles">,
        costs: {
          laborCost,
          partsCost,
          totalCost
        },
        parts,
        cost: totalCost // Actualizar el costo total del vehículo
      })
      
      navigate("/vehiculos")
    } catch (error) {
      console.error("Error al guardar costos:", error)
    }
  }

  if (!vehicle) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando información del vehículo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Botones */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/vehiculos")}
          className="w-fit"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        
        <Button onClick={saveCosts} className="bg-green-600 hover:bg-green-700">
          <Save className="h-4 w-4 mr-2" />
          Guardar Costos
        </Button>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Gestión de Costos</h1>
        <p className="text-gray-600">
          {vehicle.plate} - {vehicle.brand} {vehicle.model} ({vehicle.owner})
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mano de Obra */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calculator className="h-5 w-5 mr-2" />
              Mano de Obra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="laborCost">Costo de Mano de Obra</Label>
                <Input
                  id="laborCost"
                  type="number"
                  step="0.01"
                  value={laborCost}
                  onChange={(e) => setLaborCost(parseFloat(e.target.value) || 0)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00"
                />
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Total Mano de Obra:</span>
                  <span className="text-lg font-bold ml-2">${laborCost.toLocaleString()}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Repuestos */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Repuestos y Materiales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Agregar nuevo repuesto */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-medium mb-3">Agregar Repuesto</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <Label htmlFor="partName">Nombre</Label>
                    <Input
                      id="partName"
                      value={newPart.name || ""}
                      onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                      placeholder="Ej: Filtro de aceite"
                    />
                  </div>
                  <div>
                    <Label htmlFor="partPrice">Precio</Label>
                    <Input
                      id="partPrice"
                      type="number"
                      step="0.01"
                      value={newPart.price || ""}
                      onChange={(e) => setNewPart({ ...newPart, price: parseFloat(e.target.value) || 0 })}
                      onFocus={(e) => e.target.select()}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="partQuantity">Cantidad</Label>
                    <Input
                      id="partQuantity"
                      type="number"
                      value={newPart.quantity || 1}
                      onChange={(e) => setNewPart({ ...newPart, quantity: parseInt(e.target.value) || 1 })}
                      onFocus={(e) => e.target.select()}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="partSource">Origen</Label>
                    <Select 
                      value={newPart.source || "purchased"} 
                      onValueChange={(value) => setNewPart({ ...newPart, source: value as "client" | "purchased" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="purchased">Comprado</SelectItem>
                        <SelectItem value="client">Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {newPart.source === "purchased" && (
                  <div className="mt-3">
                    <Label htmlFor="partSupplier">Proveedor</Label>
                    <Input
                      id="partSupplier"
                      value={newPart.supplier || ""}
                      onChange={(e) => setNewPart({ ...newPart, supplier: e.target.value })}
                      placeholder="Nombre del proveedor"
                    />
                  </div>
                )}
                
                <div className="mt-3">
                  <Label htmlFor="partNotes">Notas (opcional)</Label>
                  <Textarea
                    id="partNotes"
                    value={newPart.notes || ""}
                    onChange={(e) => setNewPart({ ...newPart, notes: e.target.value })}
                    placeholder="Notas adicionales sobre el repuesto"
                    rows={2}
                  />
                </div>
                
                <Button onClick={addPart} className="mt-3" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Repuesto
                </Button>
              </div>

              {/* Lista de repuestos */}
              <div className="space-y-2">
                {parts.map((part) => (
                  <div key={part.id} className="border rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-3">
                        <div>
                          <Input
                            value={part.name}
                            onChange={(e) => updatePart(part.id, "name", e.target.value)}
                            placeholder="Nombre del repuesto"
                          />
                        </div>
                        <div>
                          <Input
                            type="number"
                            step="0.01"
                            value={part.price}
                            onChange={(e) => updatePart(part.id, "price", parseFloat(e.target.value) || 0)}
                            onFocus={(e) => e.target.select()}
                            placeholder="Precio"
                          />
                        </div>
                        <div>
                          <Input
                            type="number"
                            value={part.quantity}
                            onChange={(e) => updatePart(part.id, "quantity", parseInt(e.target.value) || 1)}
                            onFocus={(e) => e.target.select()}
                            placeholder="Cantidad"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={part.source === "client" ? "default" : "secondary"}>
                            {part.source === "client" ? "Cliente" : "Comprado"}
                          </Badge>
                          <span className="text-sm font-medium">
                            ${(part.price * part.quantity).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removePart(part.id)}
                        className="ml-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {(part.supplier || part.notes) && (
                      <div className="mt-2 text-sm text-gray-600">
                        {part.supplier && <p><strong>Proveedor:</strong> {part.supplier}</p>}
                        {part.notes && <p><strong>Notas:</strong> {part.notes}</p>}
                      </div>
                    )}
                  </div>
                ))}
                
                {parts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay repuestos agregados</p>
                    <p className="text-sm">Usa el formulario de arriba para agregar repuestos</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen de Costos */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Costos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Mano de Obra</p>
              <p className="text-2xl font-bold text-blue-900">${laborCost.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Repuestos</p>
              <p className="text-2xl font-bold text-green-900">${partsCost.toLocaleString()}</p>
              <p className="text-xs text-green-700">{parts.length} repuesto(s)</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Total</p>
              <p className="text-3xl font-bold text-purple-900">${totalCost.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 font-medium">Distribución</p>
              <div className="space-y-1 text-xs">
                <p>Mano de obra: {totalCost > 0 ? Math.round((laborCost / totalCost) * 100) : 0}%</p>
                <p>Repuestos: {totalCost > 0 ? Math.round((partsCost / totalCost) * 100) : 0}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}