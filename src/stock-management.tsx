import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useUser } from "@clerk/clerk-react";
import { Plus, Search, Filter, AlertTriangle, HelpCircle, Trash2, History, Clock, TrendingUp, TrendingDown, Package, Edit3 } from "lucide-react";

import { Alert, AlertDescription } from "./components/ui/alert";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { CreatableSelect } from "./components/ui/creatable-select";
import { ProductCards } from "./components/module-cards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";

export default function StockManagement() {
  // User info
  const { user } = useUser();
  
  // Convex hooks
  const products = useQuery(api.products.getProducts) ?? [];
  const lowStockProductsQuery =
    useQuery(api.products.getLowStockProducts) ?? [];
  const createProduct = useMutation(api.products.createProduct);
  const deleteProduct = useMutation(api.products.deleteProduct);
  const createTransaction = useMutation(api.transactions.createTransaction);
  // Comentado temporalmente hasta que se ejecute convex dev
  // const inventoryMovements = useQuery(api.products.getInventoryMovements, { limit: 50 });
  // const movementStats = useQuery(api.products.getMovementStats);
  const inventoryMovements = useQuery(api.products.getInventoryMovements, { limit: 50 });
  const movementStats = useQuery(api.products.getMovementStats);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [newProduct, setNewProduct] = useState({
    name: "",
    type: "",
    quantity: "",
    price: "",
    unit: "unidad",
    reorderPoint: "5",
    isPaidPurchase: false,
    paymentMethod: "Efectivo",
    supplier: "",
  });

  // Tipos predeterminados con posibilidad de agregar nuevos
  const defaultProductTypes = [
    "Repuesto",
    "Herramienta", 
    "Lubricante",
    "Accesorio",
    "Filtro",
    "Pieza",
    "Consumible",
    "Químico"
  ];

  // Obtener tipos únicos de productos existentes
  const existingTypes = Array.from(new Set(products.map(p => p.type).filter(Boolean)));
  
  // Combinar tipos predeterminados con existentes
  const allAvailableTypes = Array.from(new Set([...defaultProductTypes, ...existingTypes]));

  // Helper functions para el historial
  const getMovementIcon = (type: string) => {
    switch (type) {
      case "created": return <Package className="h-4 w-4 text-green-600" />;
      case "updated": return <Edit3 className="h-4 w-4 text-blue-600" />;
      case "deleted": return <Trash2 className="h-4 w-4 text-red-600" />;
      case "stock_increase": return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "stock_decrease": return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getMovementText = (type: string) => {
    switch (type) {
      case "created": return "Creado";
      case "updated": return "Actualizado";
      case "deleted": return "Eliminado";
      case "stock_increase": return "Stock Aumentado";
      case "stock_decrease": return "Stock Disminuido";
      default: return "Modificado";
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case "created": return "bg-green-100 text-green-800";
      case "updated": return "bg-blue-100 text-blue-800";
      case "deleted": return "bg-red-100 text-red-800";
      case "stock_increase": return "bg-green-100 text-green-800";
      case "stock_decrease": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const lowStockProducts =
    lowStockProductsQuery.length > 0
      ? lowStockProductsQuery
      : products.filter((product) => product.lowStock);

  const handleAddProduct = async () => {
    // Validación mejorada
    if (
      !newProduct.name?.trim() ||
      !newProduct.type?.trim() ||
      !newProduct.quantity?.trim() ||
      !newProduct.price?.trim()
    ) {
      alert("Por favor completa todos los campos requeridos");
      return;
    }

    const quantity = Number.parseInt(newProduct.quantity);
    const price = Number.parseFloat(newProduct.price);
    const reorderPoint = Number.parseInt(newProduct.reorderPoint);

    // Validar números
    if (isNaN(quantity) || quantity < 0) {
      alert("La cantidad debe ser un número válido mayor o igual a 0");
      return;
    }

    if (isNaN(price) || price < 0) {
      alert("El precio debe ser un número válido mayor o igual a 0");
      return;
    }

    if (isNaN(reorderPoint) || reorderPoint < 0) {
      alert("El punto de reorden debe ser un número válido mayor o igual a 0");
      return;
    }

    try {
      await createProduct({
        name: newProduct.name.trim(),
        type: newProduct.type.trim(),
        quantity: quantity,
        price: price,
        unit: newProduct.unit,
        reorderPoint: reorderPoint,
        userId: user?.id,
        userName: user?.fullName || user?.firstName || "Usuario",
      });

      // Si es una compra pagada, crear transacción de egreso
      if (newProduct.isPaidPurchase) {
        const totalPurchaseAmount = price * quantity;
        if (totalPurchaseAmount > 0) {
          try {
            await createTransaction({
              date: new Date().toISOString().split('T')[0],
              description: `Compra de inventario: ${newProduct.name.trim()}`,
              type: "Egreso",
              category: "Compra de Repuestos para Taller",
              amount: totalPurchaseAmount,
              supplier: newProduct.supplier.trim() || undefined,
              paymentMethod: newProduct.paymentMethod,
              notes: `Producto agregado al inventario: ${quantity} ${newProduct.unit}(s) a $${price} c/u`,
            });
          } catch (transactionError) {
            console.error("Error al crear transacción de compra:", transactionError);
            // No fallar la creación del producto por error en transacción
          }
        }
      }

      setNewProduct({
        name: "",
        type: "",
        quantity: "",
        price: "",
        unit: "unidad",
        reorderPoint: "5",
        isPaidPurchase: false,
        paymentMethod: "Efectivo",
        supplier: "",
      });
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error al crear producto:", error);
      alert(`Error al crear producto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar "${productName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    const reason = window.prompt("Motivo de eliminación (opcional):");

    try {
      await deleteProduct({
        id: productId as any,
        userId: user?.id,
        userName: user?.fullName || user?.firstName || "Usuario",
        reason: reason || undefined,
      });
      
      alert("Producto eliminado exitosamente");
    } catch (error) {
      console.error("Error al eliminar producto:", error);
      alert(`Error al eliminar producto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Gestión de Inventario
          </h1>
          <p className="text-muted-foreground">
            Administra tu stock y productos
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Agregar Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Producto</DialogTitle>
              <DialogDescription>
                Completa la información del producto para agregarlo al
                inventario.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Producto</Label>
                <Input
                  id="name"
                  value={newProduct.name}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, name: e.target.value })
                  }
                  placeholder="Nombre del producto"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Tipo</Label>
                <CreatableSelect
                  value={newProduct.type ? [newProduct.type] : []}
                  onChange={(values) => {
                    // Solo mantener el último valor seleccionado para simular single-select
                    const newType = values[values.length - 1] || "";
                    setNewProduct(prev => ({ ...prev, type: newType }));
                  }}
                  options={allAvailableTypes}
                  placeholder="Selecciona o crea un tipo de producto..."
                />
                <p className="text-xs text-muted-foreground">
                  Puedes seleccionar un tipo existente o escribir uno nuevo
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity">Cantidad</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={newProduct.quantity}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, quantity: e.target.value })
                  }
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unidad</Label>
                <Select
                  value={newProduct.unit}
                  onValueChange={(value) =>
                    setNewProduct({ ...newProduct, unit: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidad">Unidad</SelectItem>
                    <SelectItem value="litro">Litro</SelectItem>
                    <SelectItem value="kilogramo">Kilogramo</SelectItem>
                    <SelectItem value="metro">Metro</SelectItem>
                    <SelectItem value="caja">Caja</SelectItem>
                    <SelectItem value="paquete">Paquete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">Precio</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, price: e.target.value })
                  }
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="reorderPoint">Punto de Reorden</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2">
                          <p className="font-semibold">¿Qué es el Punto de Reorden?</p>
                          <p className="text-sm">
                            Es la cantidad mínima de stock que debe haber antes de realizar un nuevo pedido. 
                            Cuando la cantidad en inventario llega a este nivel, se activa una alerta 
                            para reordenar el producto.
                          </p>
                          <p className="text-sm font-medium">
                            Ejemplo: Si pones 5, cuando queden 5 unidades o menos, 
                            verás una alerta de "Bajo Stock".
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="reorderPoint"
                  type="number"
                  value={newProduct.reorderPoint}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      reorderPoint: e.target.value,
                    })
                  }
                  onFocus={(e) => e.target.select()}
                  placeholder="5"
                />
              </div>

              {/* Sección de compra pagada */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isPaidPurchase"
                    checked={newProduct.isPaidPurchase}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, isPaidPurchase: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <Label htmlFor="isPaidPurchase" className="text-sm font-medium">
                    ¿Fue una compra pagada?
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Marcar si este producto se compró y debe registrarse como egreso
                </p>

                {newProduct.isPaidPurchase && (
                  <div className="grid gap-4 pl-6 border-l-2 border-blue-200 bg-blue-50 p-3 rounded">
                    <div className="grid gap-2">
                      <Label htmlFor="paymentMethod">Método de Pago</Label>
                      <Select
                        value={newProduct.paymentMethod}
                        onValueChange={(value) =>
                          setNewProduct({ ...newProduct, paymentMethod: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Efectivo">Efectivo</SelectItem>
                          <SelectItem value="Transferencia">Transferencia</SelectItem>
                          <SelectItem value="Tarjeta de Débito">Tarjeta de Débito</SelectItem>
                          <SelectItem value="Tarjeta de Crédito">Tarjeta de Crédito</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="supplier">Proveedor (opcional)</Label>
                      <Input
                        id="supplier"
                        value={newProduct.supplier}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, supplier: e.target.value })
                        }
                        placeholder="Nombre del proveedor o tienda"
                      />
                    </div>
                    <div className="bg-blue-100 border border-blue-300 rounded p-2">
                      <p className="text-xs text-blue-800">
                        💡 <strong>Monto del egreso:</strong> Se usará el precio unitario ($
                        {newProduct.price || "0"}) × cantidad ({newProduct.quantity || "0"}) = $
                        {((parseFloat(newProduct.price) || 0) * (parseInt(newProduct.quantity) || 0)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddProduct}>
                Agregar Producto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alertas de Bajo Stock */}
      {lowStockProducts.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Alerta de Stock:</strong> {lowStockProducts.length}{" "}
            producto(s) con bajo stock o agotados:{" "}
            {lowStockProducts.map((product) => product.name).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de Estadísticas Colapsables */}
      <ProductCards />

      {/* Pestañas para Inventario e Historial */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inventory">Inventario</TabsTrigger>
          <TabsTrigger value="history">Historial de Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          {/* Barra de Búsqueda y Filtros */}
      <div className="min-h-[40px]">
        <div className="flex flex-col sm:flex-row gap-4 transition-all duration-300 ease-in-out">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-colors duration-200" />
            <Input
              placeholder="Buscar productos..."
              className="pl-8 transition-all duration-200 hover:border-gray-400 focus:border-blue-500"
            />
          </div>
          <div className="flex-shrink-0 w-full sm:w-[180px]">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {existingTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabla de Inventario */}
      <Card>
        <CardHeader>
          <CardTitle>Inventario Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Cantidad</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-center">Punto Reorden</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product._id}
                  className={product.lowStock ? "bg-orange-50" : ""}
                >
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.type}</TableCell>
                  <TableCell className="text-center">
                    <span
                      className={
                        product.quantity <= product.reorderPoint
                          ? "text-orange-600 font-semibold"
                          : ""
                      }
                    >
                      {product.quantity}
                    </span>
                  </TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell className="text-right">
                    ${product.price.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    {product.lowStock ? (
                      <Badge variant="destructive">Bajo Stock</Badge>
                    ) : product.quantity === 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-red-100 text-red-800"
                      >
                        Agotado
                      </Badge>
                    ) : (
                      <Badge
                        variant="default"
                        className="bg-green-100 text-green-800"
                      >
                        Disponible
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {product.reorderPoint}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ${(product.quantity * product.price).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProduct(product._id, product.name)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {/* Estadísticas de movimientos */}
          {movementStats && (
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Movimientos</CardTitle>
                  <History className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{movementStats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Creados</CardTitle>
                  <Package className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{movementStats.created}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Actualizados</CardTitle>
                  <Edit3 className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{movementStats.updated}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Eliminados</CardTitle>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{movementStats.deleted}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cambios Stock</CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {movementStats.stockIncreases + movementStats.stockDecreases}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Lista de movimientos */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Movimientos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {inventoryMovements && inventoryMovements.length > 0 ? (
                  inventoryMovements.map((movement: any) => (
                    <div
                      key={movement._id}
                      className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getMovementIcon(movement.movementType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-gray-900">
                              {movement.productName}
                            </p>
                            <Badge
                              className={`text-xs ${getMovementColor(movement.movementType)}`}
                            >
                              {getMovementText(movement.movementType)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {movement.productType}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">
                              {new Date(movement.timestamp).toLocaleDateString("es-ES")}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(movement.timestamp).toLocaleTimeString("es-ES", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mt-2 space-y-1">
                          {movement.quantityChange !== undefined && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Cantidad:</span> {movement.previousQuantity} → {movement.newQuantity} 
                              <span className={`ml-2 font-medium ${movement.quantityChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ({movement.quantityChange > 0 ? '+' : ''}{movement.quantityChange})
                              </span>
                            </p>
                          )}
                          
                          {movement.newPrice !== movement.previousPrice && movement.previousPrice !== undefined && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Precio:</span> ${movement.previousPrice} → ${movement.newPrice}
                            </p>
                          )}
                          
                          {movement.reason && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Motivo:</span> {movement.reason}
                            </p>
                          )}
                          
                          {movement.userName && (
                            <p className="text-xs text-gray-500">
                              Por: {movement.userName}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay movimientos registrados</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
