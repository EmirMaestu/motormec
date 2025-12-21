import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { useOrganization } from "@clerk/clerk-react";
import { api } from "../../../convex/_generated/api";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Wrench,
  Gauge,
  User,
  Phone,
  Clock,
  Package,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { formatDateToDDMMYYYY } from "../../lib/dateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface Responsible {
  name: string;
  role?: string;
  userId?: string;
  isAdmin?: boolean;
  totalWorkTime?: number;
}

export default function VehicleRepairHistory() {
  const navigate = useNavigate();
  const { plate } = useParams<{ plate: string }>();
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const { membership } = useOrganization();
  const isAdmin = membership?.role === "org:admin";

  const vehicleHistory = useQuery(
    api.vehicles.getVehicleHistoryByPlate,
    plate ? { plate: decodeURIComponent(plate) } : "skip"
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Entregado":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Entregado
          </Badge>
        );
      case "Suspendido":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Suspendido
          </Badge>
        );
      case "Listo":
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Listo
          </Badge>
        );
      case "En Reparación":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Wrench className="h-3 w-3 mr-1" />
            En Reparación
          </Badge>
        );
      case "Ingresado":
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            Ingresado
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!plate) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Placa no especificada</h1>
          <Button onClick={() => navigate("/vehiculos")}>
            Volver a Vehículos
          </Button>
        </div>
      </div>
    );
  }

  if (vehicleHistory === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Cargando historial...</p>
        </div>
      </div>
    );
  }

  if (vehicleHistory === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            No se encontró historial para la placa: {decodeURIComponent(plate)}
          </h1>
          <Button onClick={() => navigate("/vehiculos")}>
            Volver a Vehículos
          </Button>
        </div>
      </div>
    );
  }

  const { vehicleInfo, visits, statistics } = vehicleHistory;

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <h1 className="text-3xl font-bold tracking-tight">
            Historial de Arreglos
          </h1>
          <p className="text-muted-foreground">
            Historial completo de todas las visitas del vehículo
          </p>
        </div>
      </div>

      {/* Información del Vehículo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Información del Vehículo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">
                  Placa:
                </span>
                <span className="text-lg font-bold">{vehicleHistory.plate}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">
                  Vehículo:
                </span>
                <span className="text-sm">
                  {vehicleInfo.brand} {vehicleInfo.model} {vehicleInfo.year}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-600">
                  Cliente:
                </span>
                <span className="text-sm">{vehicleInfo.owner}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-600">
                  Teléfono:
                </span>
                <span className="text-sm">{vehicleInfo.phone}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <div className={`grid grid-cols-1 gap-4 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total de Visitas
                </p>
                <p className="text-2xl font-bold">{statistics.totalVisits}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Gastado
                  </p>
                  <p className="text-2xl font-bold">
                    ${statistics.totalSpent.toLocaleString()}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        )}
        {isAdmin && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Promedio por Visita
                  </p>
                  <p className="text-2xl font-bold">
                    ${Math.round(statistics.averageCost).toLocaleString()}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Entregados
                </p>
                <p className="text-2xl font-bold">
                  {statistics.deliveredVisits}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historial de Visitas */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Visitas al Taller</CardTitle>
          <p className="text-sm text-muted-foreground">
            {visits.length} visita{visits.length !== 1 ? "s" : ""} registrada
            {visits.length !== 1 ? "s" : ""}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {visits.map((visit, index) => (
              <Card
                key={visit.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  expandedVisit === visit.id ? "border-blue-500" : ""
                }`}
                onClick={() =>
                  setExpandedVisit(
                    expandedVisit === visit.id ? null : visit.id
                  )
                }
              >
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Información Principal */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className="text-sm">
                            Visita #{visits.length - index}
                          </Badge>
                          {getStatusBadge(visit.status)}
                          {visit.inTaller && (
                            <Badge className="bg-blue-100 text-blue-800">
                              En Taller
                            </Badge>
                          )}
                        </div>
                        <div className={`grid gap-4 mt-4 ${isAdmin ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Ingreso
                              </p>
                              <p className="text-sm font-medium">
                                {formatDateToDDMMYYYY(visit.entryDate)}
                              </p>
                            </div>
                          </div>
                          {visit.exitDate && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Salida
                                </p>
                                <p className="text-sm font-medium">
                                  {formatDateToDDMMYYYY(visit.exitDate)}
                                </p>
                              </div>
                            </div>
                          )}
                          {visit.mileage && (
                            <div className="flex items-center gap-2">
                              <Gauge className="h-4 w-4 text-gray-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Kilometraje
                                </p>
                                <p className="text-sm font-medium">
                                  {visit.mileage.toLocaleString()} km
                                </p>
                              </div>
                            </div>
                          )}
                          {visit.duration !== null && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Duración
                                </p>
                                <p className="text-sm font-medium">
                                  {visit.duration} día
                                  {visit.duration !== 1 ? "s" : ""}
                                </p>
                              </div>
                            </div>
                          )}
                          {isAdmin && (
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-gray-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Costo
                                </p>
                                <p className="text-sm font-bold">
                                  ${visit.cost.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Información Expandida */}
                    {expandedVisit === visit.id && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        {/* Servicios */}
                        {visit.services && visit.services.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Wrench className="h-4 w-4 text-gray-500" />
                              <h4 className="text-sm font-semibold">
                                Servicios Realizados
                              </h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {visit.services.map((service, idx) => (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="bg-blue-100 text-blue-800"
                                >
                                  {service}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Kilometraje */}
                        {visit.mileage && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Gauge className="h-4 w-4 text-gray-500" />
                              <h4 className="text-sm font-semibold">
                                Kilometraje
                              </h4>
                            </div>
                            <p className="text-sm">
                              {visit.mileage.toLocaleString()} km
                            </p>
                          </div>
                        )}

                        {/* Costos Detallados */}
                        {isAdmin && visit.costs && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <DollarSign className="h-4 w-4 text-gray-500" />
                              <h4 className="text-sm font-semibold">
                                Desglose de Costos
                              </h4>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-xs text-blue-600 font-medium">
                                  Mano de Obra
                                </p>
                                <p className="text-lg font-bold text-blue-900">
                                  $
                                  {visit.costs.laborCost?.toLocaleString() ||
                                    "0"}
                                </p>
                              </div>
                              <div className="bg-purple-50 p-3 rounded-lg">
                                <p className="text-xs text-purple-600 font-medium">
                                  Repuestos
                                </p>
                                <p className="text-lg font-bold text-purple-900">
                                  $
                                  {visit.costs.partsCost?.toLocaleString() ||
                                    "0"}
                                </p>
                              </div>
                              <div className="bg-green-50 p-3 rounded-lg">
                                <p className="text-xs text-green-600 font-medium">
                                  Total
                                </p>
                                <p className="text-lg font-bold text-green-900">
                                  $
                                  {visit.costs.totalCost?.toLocaleString() ||
                                    "0"}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Repuestos */}
                        {visit.parts && visit.parts.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Package className="h-4 w-4 text-gray-500" />
                              <h4 className="text-sm font-semibold">
                                Repuestos Utilizados
                              </h4>
                            </div>
                            <div className="space-y-2">
                              {visit.parts.map((part, idx) => (
                                <div
                                  key={idx}
                                  className={`flex items-center p-2 bg-gray-50 rounded ${isAdmin ? 'justify-between' : ''}`}
                                >
                                  <div>
                                    <p className="text-sm font-medium">
                                      {part.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Cantidad: {part.quantity} | Origen:{" "}
                                      {part.source === "client"
                                        ? "Cliente"
                                        : "Comprado"}
                                    </p>
                                  </div>
                                  {isAdmin && (
                                    <p className="text-sm font-bold">
                                      $
                                      {(part.price * part.quantity).toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Descripción */}
                        {visit.description && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-4 w-4 text-gray-500" />
                              <h4 className="text-sm font-semibold">
                                Descripción
                              </h4>
                            </div>
                            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                              {visit.description}
                            </p>
                          </div>
                        )}

                        {/* Responsables */}
                        {visit.responsibles &&
                          visit.responsibles.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <User className="h-4 w-4 text-gray-500" />
                                <h4 className="text-sm font-semibold">
                                  Responsables
                                </h4>
                              </div>
                              <div className="space-y-2">
                                {visit.responsibles.map(
                                  (responsible: Responsible, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                                    >
                                      <div>
                                        <p className="text-sm font-medium">
                                          {responsible.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {responsible.role || "Mecánico"}
                                        </p>
                                      </div>
                                      {responsible.totalWorkTime && (
                                        <Badge variant="outline">
                                          {Math.round(
                                            responsible.totalWorkTime /
                                              (1000 * 60 * 60)
                                          )}{" "}
                                          horas
                                        </Badge>
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

