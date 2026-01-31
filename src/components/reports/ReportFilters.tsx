import { Calendar, Filter, X } from "lucide-react";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent } from "../ui/card";

export interface ReportFiltersProps {
  filters: {
    startDate?: string;
    endDate?: string;
    customerId?: string;
    status?: string;
    category?: string;
    paymentMethod?: string;
    userId?: string;
  };
  onFiltersChange: (filters: any) => void;
  availableFilters?: {
    showDateRange?: boolean;
    showCustomer?: boolean;
    showStatus?: boolean;
    showCategory?: boolean;
    showPaymentMethod?: boolean;
    showUser?: boolean;
  };
  customers?: any[];
  categories?: string[];
  statuses?: string[];
  paymentMethods?: string[];
  users?: any[];
}

export function ReportFilters({
  filters,
  onFiltersChange,
  availableFilters = {},
  customers = [],
  categories = [],
  statuses = [],
  paymentMethods = [],
  users = [],
}: ReportFiltersProps) {
  const {
    showDateRange = true,
    showCustomer = false,
    showStatus = false,
    showCategory = false,
    showPaymentMethod = false,
    showUser = false,
  } = availableFilters;

  const updateFilter = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== "");

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Filtros</h3>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Limpiar filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Rango de fechas */}
          {showDateRange && (
            <>
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha inicio</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="startDate"
                    type="date"
                    value={filters.startDate || ""}
                    onChange={(e) => updateFilter("startDate", e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha fin</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="endDate"
                    type="date"
                    value={filters.endDate || ""}
                    onChange={(e) => updateFilter("endDate", e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </>
          )}

          {/* Cliente */}
          {showCustomer && customers.length > 0 && (
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select
                value={filters.customerId || "all"}
                onValueChange={(value) => updateFilter("customerId", value === "all" ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer._id} value={customer._id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Estado */}
          {showStatus && statuses.length > 0 && (
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) => updateFilter("status", value === "all" ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Categoría */}
          {showCategory && categories.length > 0 && (
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={filters.category || "all"}
                onValueChange={(value) => updateFilter("category", value === "all" ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Método de pago */}
          {showPaymentMethod && paymentMethods.length > 0 && (
            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select
                value={filters.paymentMethod || "all"}
                onValueChange={(value) => updateFilter("paymentMethod", value === "all" ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los métodos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los métodos</SelectItem>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Usuario/Mecánico */}
          {showUser && users.length > 0 && (
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Select
                value={filters.userId || "all"}
                onValueChange={(value) => updateFilter("userId", value === "all" ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los usuarios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id || user.userId} value={user.id || user.userId}>
                      {user.name || user.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const hoy = new Date().toISOString().split('T')[0];
              updateFilter("startDate", hoy);
              updateFilter("endDate", hoy);
            }}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const hoy = new Date();
              const hace7dias = new Date(hoy);
              hace7dias.setDate(hace7dias.getDate() - 7);
              updateFilter("startDate", hace7dias.toISOString().split('T')[0]);
              updateFilter("endDate", hoy.toISOString().split('T')[0]);
            }}
          >
            Última semana
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const hoy = new Date();
              const hace30dias = new Date(hoy);
              hace30dias.setDate(hace30dias.getDate() - 30);
              updateFilter("startDate", hace30dias.toISOString().split('T')[0]);
              updateFilter("endDate", hoy.toISOString().split('T')[0]);
            }}
          >
            Último mes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const hoy = new Date();
              const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
              updateFilter("startDate", primerDiaMes.toISOString().split('T')[0]);
              updateFilter("endDate", hoy.toISOString().split('T')[0]);
            }}
          >
            Este mes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const hoy = new Date();
              const primerDiaAno = new Date(hoy.getFullYear(), 0, 1);
              updateFilter("startDate", primerDiaAno.toISOString().split('T')[0]);
              updateFilter("endDate", hoy.toISOString().split('T')[0]);
            }}
          >
            Este año
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}







