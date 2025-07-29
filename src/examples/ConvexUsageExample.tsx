import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

// Ejemplo de uso de queries y mutations de Convex en React
export const ConvexUsageExample: React.FC = () => {
  const [newVehicle, setNewVehicle] = useState({
    plate: '',
    brand: '',
    model: '',
    year: 2024,
    owner: '',
    phone: '',
    status: 'Ingresado',
    services: [''],
    cost: 0,
    description: ''
  });

  // QUERIES - Obtener datos
  const vehicles = useQuery(api.vehicles.getVehicles);
  const vehiclesInTaller = useQuery(api.vehicles.getVehiclesInTaller);
  const products = useQuery(api.products.getProducts);
  const partners = useQuery(api.partners.getActivePartners);
  const transactions = useQuery(api.transactions.getActiveTransactions);
  const financialSummary = useQuery(api.transactions.getFinancialSummary);

  // MUTATIONS - Modificar datos
  const createVehicle = useMutation(api.vehicles.createVehicle);
  const updateVehicle = useMutation(api.vehicles.updateVehicle);
  const createProduct = useMutation(api.products.createProduct);
  const createTransaction = useMutation(api.transactions.createTransaction);

  // Ejemplo de crear un vehículo
  const handleCreateVehicle = async () => {
    try {
      const vehicleId = await createVehicle({
        plate: newVehicle.plate,
        brand: newVehicle.brand,
        model: newVehicle.model,
        year: newVehicle.year,
        owner: newVehicle.owner,
        phone: newVehicle.phone,
        status: newVehicle.status,
        entryDate: new Date().toISOString(),
        services: newVehicle.services.filter(s => s.trim() !== ''),
        cost: newVehicle.cost,
        description: newVehicle.description || undefined,
      });
      
      console.log('Vehículo creado con ID:', vehicleId);
      
      // Limpiar formulario
      setNewVehicle({
        plate: '',
        brand: '',
        model: '',
        year: 2024,
        owner: '',
        phone: '',
        status: 'Ingresado',
        services: [''],
        cost: 0,
        description: ''
      });
    } catch (error) {
      console.error('Error al crear vehículo:', error);
    }
  };

  // Ejemplo de actualizar un vehículo
  const handleUpdateVehicleStatus = async (vehicleId: Id<"vehicles">, newStatus: string) => {
    try {
      await updateVehicle({
        id: vehicleId,
        status: newStatus
      });
      console.log('Estado del vehículo actualizado');
    } catch (error) {
      console.error('Error al actualizar vehículo:', error);
    }
  };

  // Ejemplo de crear un producto
  const handleCreateProduct = async () => {
    try {
      const productId = await createProduct({
        name: 'Filtro de aceite',
        quantity: 50,
        unit: 'unidades',
        type: 'repuesto',
        price: 25.00,
        reorderPoint: 10
      });
      console.log('Producto creado con ID:', productId);
    } catch (error) {
      console.error('Error al crear producto:', error);
    }
  };

  // Ejemplo de crear una transacción
  const handleCreateTransaction = async () => {
    try {
      const transactionId = await createTransaction({
        date: new Date().toISOString().split('T')[0],
        description: 'Venta de servicio de reparación',
        type: 'Ingreso',
        category: 'servicios',
        amount: 150.00
      });
      console.log('Transacción creada con ID:', transactionId);
    } catch (error) {
      console.error('Error al crear transacción:', error);
    }
  };

  if (!vehicles || !products || !partners || !transactions) {
    return <div className="flex items-center justify-center h-64">Cargando datos...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ejemplo de uso de Convex</h1>
        <p className="text-gray-600 mt-2">Demostración de queries y mutations en tiempo real</p>
      </div>
      
      {/* Resumen Financiero */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Financiero</CardTitle>
        </CardHeader>
        <CardContent>
          {financialSummary && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Ingresos</p>
                <p className="text-xl font-bold text-green-600">${financialSummary.totalIngresos}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Egresos</p>
                <p className="text-xl font-bold text-red-600">${financialSummary.totalEgresos}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Balance</p>
                <p className={`text-xl font-bold ${financialSummary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${financialSummary.balance}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estadísticas Rápidas */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Vehículos Totales</p>
            <p className="text-2xl font-bold">{vehicles.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">En Taller</p>
            <p className="text-2xl font-bold">{vehiclesInTaller?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Productos</p>
            <p className="text-2xl font-bold">{products.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Socios Activos</p>
            <p className="text-2xl font-bold">{partners.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Formulario para crear vehículo */}
      <Card>
        <CardHeader>
          <CardTitle>Crear Nuevo Vehículo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="Placa"
              value={newVehicle.plate}
              onChange={(e) => setNewVehicle({...newVehicle, plate: e.target.value})}
            />
            <Input
              placeholder="Marca"
              value={newVehicle.brand}
              onChange={(e) => setNewVehicle({...newVehicle, brand: e.target.value})}
            />
            <Input
              placeholder="Modelo"
              value={newVehicle.model}
              onChange={(e) => setNewVehicle({...newVehicle, model: e.target.value})}
            />
            <Input
              type="number"
              placeholder="Año"
              value={newVehicle.year}
              onChange={(e) => setNewVehicle({...newVehicle, year: parseInt(e.target.value)})}
              onFocus={(e) => e.target.select()}
            />
            <Input
              placeholder="Propietario"
              value={newVehicle.owner}
              onChange={(e) => setNewVehicle({...newVehicle, owner: e.target.value})}
            />
            <Input
              placeholder="Teléfono"
              value={newVehicle.phone}
              onChange={(e) => setNewVehicle({...newVehicle, phone: e.target.value})}
            />
          </div>
          <Button
            onClick={handleCreateVehicle}
            disabled={!newVehicle.plate || !newVehicle.brand || !newVehicle.owner}
            className="mt-4"
          >
            Crear Vehículo
          </Button>
        </CardContent>
      </Card>

      {/* Lista de vehículos en taller */}
      <Card>
        <CardHeader>
          <CardTitle>Vehículos en Taller</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {vehiclesInTaller?.map((vehicle) => (
              <div key={vehicle._id} className="flex justify-between items-center p-3 border rounded">
                <div>
                  <span className="font-semibold">{vehicle.plate}</span> - 
                  <span className="ml-2">{vehicle.brand} {vehicle.model}</span> - 
                  <span className="ml-2 text-sm text-gray-600">{vehicle.owner}</span>
                </div>
                <div className="flex gap-2">
                  <Badge variant={
                    vehicle.status === 'Ingresado' ? 'secondary' :
                    vehicle.status === 'En Reparación' ? 'default' :
                    'outline'
                  }>
                    {vehicle.status}
                  </Badge>
                  <Button
                    onClick={() => handleUpdateVehicleStatus(vehicle._id, 'Entregado')}
                    size="sm"
                    variant="outline"
                  >
                    Entregar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Botones de ejemplo para otras operaciones */}
      <div className="flex gap-4">
        <Button onClick={handleCreateProduct} variant="outline">
          Crear Producto de Ejemplo
        </Button>
        <Button onClick={handleCreateTransaction} variant="outline">
          Crear Transacción de Ejemplo
        </Button>
      </div>
    </div>
  );
};

export default ConvexUsageExample;