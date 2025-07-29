import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Plus, Search, Filter, AlertTriangle } from "lucide-react";

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
import { ProductCards } from "./components/module-cards";

export default function StockManagement() {
  // Convex hooks
  const products = useQuery(api.products.getProducts) ?? [];
  const lowStockProductsQuery =
    useQuery(api.products.getLowStockProducts) ?? [];
  const createProduct = useMutation(api.products.createProduct);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [newProduct, setNewProduct] = useState({
    name: "",
    type: "",
    quantity: "",
    price: "",
    unit: "unidad",
    reorderPoint: "5",
  });


  const lowStockProducts =
    lowStockProductsQuery.length > 0
      ? lowStockProductsQuery
      : products.filter((product) => product.lowStock);

  const handleAddProduct = async () => {
    if (
      newProduct.name &&
      newProduct.type &&
      newProduct.quantity &&
      newProduct.price
    ) {
      const quantity = Number.parseInt(newProduct.quantity);
      const price = Number.parseFloat(newProduct.price);
      const reorderPoint = Number.parseInt(newProduct.reorderPoint);

      try {
        await createProduct({
          name: newProduct.name,
          type: newProduct.type,
          quantity: quantity,
          price: price,
          unit: newProduct.unit,
          reorderPoint: reorderPoint,
        });

        setNewProduct({
          name: "",
          type: "",
          quantity: "",
          price: "",
          unit: "unidad",
          reorderPoint: "5",
        });
        setIsDialogOpen(false);
      } catch (error) {
        console.error("Error al crear producto:", error);
      }
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
                <Select
                  onValueChange={(value) =>
                    setNewProduct({ ...newProduct, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repuesto">Repuesto</SelectItem>
                    <SelectItem value="herramienta">Herramienta</SelectItem>
                    <SelectItem value="lubricante">Lubricante</SelectItem>
                    <SelectItem value="accesorio">Accesorio</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label htmlFor="reorderPoint">Punto de Reorden</Label>
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
                <SelectItem value="repuesto">Repuestos</SelectItem>
                <SelectItem value="herramienta">Herramientas</SelectItem>
                <SelectItem value="lubricante">Lubricantes</SelectItem>
                <SelectItem value="accesorio">Accesorios</SelectItem>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
