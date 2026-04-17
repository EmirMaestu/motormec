import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
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
  Camera,
  X,
  Edit3,
  Save,
  Plus,
  Trash2,
  Calculator,
  Upload,
  ImagePlus,
} from "lucide-react";
import { useRef } from "react";
import { formatDateToDDMMYYYY } from "../../lib/dateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface Responsible {
  name: string;
  role?: string;
  userId?: string;
  isAdmin?: boolean;
  totalWorkTime?: number;
}

interface Part {
  id: string;
  name: string;
  price: number;
  quantity: number;
  source: "client" | "purchased";
}

export default function VehicleRepairHistory() {
  const navigate = useNavigate();
  const { plate } = useParams<{ plate: string }>();
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [editingVisit, setEditingVisit] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  // Estados para subida de fotos
  const [uploadingVisitId, setUploadingVisitId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para gestión de costos
  const [costVisit, setCostVisit] = useState<any>(null);
  const [laborCost, setLaborCost] = useState(0);
  const [parts, setParts] = useState<Part[]>([]);
  const [newPart, setNewPart] = useState<Partial<Part>>({ name: "", price: 0, quantity: 1, source: "purchased" });
  const [isSavingCosts, setIsSavingCosts] = useState(false);
  const { membership } = useOrganization();
  const isAdmin = membership?.role === "org:admin";

  const vehicleHistory = useQuery(
    api.vehicles.getVehicleHistoryByPlate,
    plate ? { plate: decodeURIComponent(plate) } : "skip"
  );

  const updateVehicle = useMutation(api.vehicles.updateVehicle);
  const generarUrlSubida = useMutation(api.historialTaller.generarUrlSubida);
  const agregarFotos = useMutation(api.historialTaller.agregarFotosPorVehiculo);
  const eliminarFoto = useMutation(api.historialTaller.eliminarFoto);

  const getStatusBadge = (status: string) => {
    const base = "text-[11px] font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1";
    const map: Record<string, { cls: string; icon: React.ReactNode }> = {
      "Entregado":   { cls: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800", icon: <CheckCircle className="h-3 w-3" /> },
      "Listo":       { cls: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800", icon: <CheckCircle className="h-3 w-3" /> },
      "En Reparación": { cls: "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800", icon: <Wrench className="h-3 w-3" /> },
      "Ingresado":   { cls: "bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700", icon: <AlertCircle className="h-3 w-3" /> },
      "Suspendido":  { cls: "bg-red-50 dark:bg-red-950/50 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800", icon: <XCircle className="h-3 w-3" /> },
    };
    const s = map[status] ?? { cls: "bg-gray-50 text-gray-500 border-gray-200", icon: null };
    return <span className={`${base} ${s.cls}`}>{s.icon}{status}</span>;
  };

  const handleSaveEdit = async () => {
    if (!editingVisit) return;
    setIsSaving(true);
    try {
      const services = typeof editForm.services === 'string'
        ? editForm.services.split(',').map((s: string) => s.trim()).filter(Boolean)
        : editForm.services || [];
      await updateVehicle({
        id: editingVisit.id,
        status: editForm.status,
        services,
        mileage: editForm.mileage ? parseInt(String(editForm.mileage).replace(/\D/g, '')) || undefined : undefined,
        description: editForm.description || undefined,
        cost: editForm.cost !== undefined ? parseFloat(String(editForm.cost)) || 0 : 0,
      });
      setEditingVisit(null);
    } catch (err) {
      console.error('Error al guardar:', err);
      alert('Error al guardar los cambios');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Fotos ─────────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !uploadingVisitId) return;

    setIsUploading(true);
    try {
      const storageIds: string[] = [];
      for (const file of files) {
        const uploadUrl = await generarUrlSubida({});
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`Error al subir imagen: ${res.status}`);
        const { storageId } = await res.json();
        storageIds.push(storageId);
      }
      await agregarFotos({
        vehicleId: uploadingVisitId as any,
        storageIds: storageIds as any,
      });
    } catch (err) {
      console.error("Error subiendo fotos:", err);
      alert("Error al subir las fotos. Intentá de nuevo.");
    } finally {
      setIsUploading(false);
      setUploadingVisitId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteFoto = async (visitId: string, storageId: string) => {
    if (!confirm("¿Eliminar esta foto?")) return;
    try {
      await eliminarFoto({ vehicleId: visitId as any, storageId: storageId as any });
    } catch (err) {
      console.error("Error eliminando foto:", err);
    }
  };

  // ── Costos ────────────────────────────────────────────────────────────────
  const openCostDialog = (visit: any) => {
    setCostVisit(visit);
    setLaborCost(visit.costs?.laborCost ?? visit.cost ?? 0);
    setParts(visit.parts?.map((p: any) => ({ ...p })) ?? []);
    setNewPart({ name: "", price: 0, quantity: 1, source: "purchased" });
  };

  const addPart = () => {
    if (!newPart.name || !newPart.price) return;
    setParts([...parts, { id: Date.now().toString(), name: newPart.name!, price: Number(newPart.price), quantity: Number(newPart.quantity) || 1, source: newPart.source as "client" | "purchased" }]);
    setNewPart({ name: "", price: 0, quantity: 1, source: "purchased" });
  };

  const removePart = (id: string) => setParts(parts.filter((p) => p.id !== id));

  const partsCost = parts.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const totalCost = laborCost + partsCost;

  const handleSaveCosts = async () => {
    if (!costVisit) return;
    setIsSavingCosts(true);
    try {
      await updateVehicle({
        id: costVisit.id,
        costs: { laborCost, partsCost, totalCost },
        parts,
        cost: totalCost,
      });
      setCostVisit(null);
    } catch (err) {
      console.error("Error al guardar costos:", err);
      alert("Error al guardar los costos");
    } finally {
      setIsSavingCosts(false);
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
            Detalle del Vehículo
          </h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500">
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
                  {vehicleInfo.brand} {vehicleInfo.model}
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
              <Calendar className="h-8 w-8 text-gray-400 dark:text-zinc-500" />
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
                className={`cursor-pointer transition-all ${
                  expandedVisit === visit.id
                    ? "border-gray-300 dark:border-zinc-600 shadow-sm"
                    : "hover:border-gray-200 dark:hover:border-zinc-700"
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
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <Badge variant="outline" className="text-sm flex-shrink-0">
                          Visita #{visits.length - index}
                        </Badge>
                        {getStatusBadge(visit.status)}
                        {visit.inTaller && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 flex-shrink-0">
                            En Taller
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 h-8 px-2.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCostDialog(visit);
                            }}
                          >
                            <Calculator className="h-3 w-3 mr-1" />
                            Costos
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingVisit(visit);
                            setEditForm({
                              status: visit.status,
                              services: visit.services?.join(', ') || '',
                              mileage: visit.mileage || '',
                              description: visit.description || '',
                              cost: visit.cost || 0,
                            });
                          }}
                        >
                          <Edit3 className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                      </div>
                    </div>
                    <div className={`grid gap-4 mt-2 ${isAdmin ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
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
                                <span
                                  key={idx}
                                  className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700"
                                >
                                  {service}
                                </span>
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
                              <div className="bg-gray-100 dark:bg-zinc-800 p-3 rounded-xl">
                                <p className="text-xs text-gray-600 dark:text-zinc-400 font-medium">Mano de Obra</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                                  ${visit.costs.laborCost?.toLocaleString() || "0"}
                                </p>
                              </div>
                              <div className="bg-violet-50 dark:bg-violet-950/40 p-3 rounded-xl">
                                <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">Repuestos</p>
                                <p className="text-lg font-bold text-violet-700 dark:text-violet-300">
                                  ${visit.costs.partsCost?.toLocaleString() || "0"}
                                </p>
                              </div>
                              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl">
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Total</p>
                                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                  ${visit.costs.totalCost?.toLocaleString() || "0"}
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
                                  className={`flex items-center p-2 bg-gray-50 dark:bg-zinc-800/60 rounded-lg ${isAdmin ? 'justify-between' : ''}`}
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
                            <p className="text-sm text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800/60 p-3 rounded-xl">
                              {visit.description}
                            </p>
                          </div>
                        )}

                        {/* Fotos del ingreso */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Camera className="h-4 w-4 text-gray-500" />
                            <h4 className="text-sm font-semibold">Fotos del Vehículo</h4>
                            {visit.fotoUrls && visit.fotoUrls.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ({visit.fotoUrls.length} foto{visit.fotoUrls.length !== 1 ? "s" : ""})
                              </span>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-auto h-7 text-xs border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                              disabled={isUploading && uploadingVisitId === visit.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setUploadingVisitId(visit.id);
                                fileInputRef.current?.click();
                              }}
                            >
                              {isUploading && uploadingVisitId === visit.id ? (
                                <><Upload className="h-3 w-3 mr-1 animate-bounce" />Subiendo...</>
                              ) : (
                                <><ImagePlus className="h-3 w-3 mr-1" />Agregar fotos</>
                              )}
                            </Button>
                          </div>

                          {visit.fotoUrls && visit.fotoUrls.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {visit.fotoUrls.map((url, idx) => (
                                <div key={idx} className="relative group aspect-square">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLightboxUrl(url);
                                    }}
                                    className="w-full h-full rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-gray-400"
                                  >
                                    <img
                                      src={url}
                                      alt={`Foto ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                  {/* Botón eliminar foto */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const storageId = visit.fotoStorageIds?.[idx];
                                      if (storageId) handleDeleteFoto(visit.id, storageId);
                                    }}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-4 bg-gray-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-gray-200 dark:border-zinc-700">
                              Sin fotos — usá el botón para agregar
                            </p>
                          )}
                        </div>

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
                                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-zinc-800/60 rounded-lg"
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

      {/* Dialog de edición */}
      <Dialog open={!!editingVisit} onOpenChange={(open) => !open && setEditingVisit(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Visita</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({...editForm, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Servicios (separados por coma)</Label>
              <Input value={editForm.services} onChange={(e) => setEditForm({...editForm, services: e.target.value})} placeholder="Ej: cambio de aceite, revisión frenos" />
            </div>
            <div className="grid gap-2">
              <Label>Kilometraje</Label>
              <Input type="number" value={editForm.mileage} onChange={(e) => setEditForm({...editForm, mileage: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} rows={3} />
            </div>
            {isAdmin && (
              <div className="grid gap-2">
                <Label>Costo</Label>
                <Input type="number" value={editForm.cost} onChange={(e) => setEditForm({...editForm, cost: e.target.value})} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVisit(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Costos */}
      <Dialog open={!!costVisit} onOpenChange={(open) => !open && setCostVisit(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-green-600" />
              Costos de la Visita
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Mano de obra */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Mano de Obra</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min={0}
                  value={laborCost}
                  onChange={(e) => setLaborCost(parseFloat(e.target.value) || 0)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Repuestos */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Repuestos</Label>

              {/* Lista de repuestos agregados */}
              {parts.length > 0 && (
                <div className="space-y-2">
                  {parts.map((part) => (
                    <div key={part.id} className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800/60 rounded-lg p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{part.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {part.quantity} × ${part.price.toLocaleString()} = ${(part.quantity * part.price).toLocaleString()}
                          {part.source === "client" && <span className="ml-1 text-gray-500 dark:text-zinc-400">(del cliente)</span>}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0 h-7 w-7 p-0" onClick={() => removePart(part.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulario para nuevo repuesto */}
              <div className="border border-gray-200 dark:border-zinc-700 rounded-xl p-3 space-y-2 bg-gray-50 dark:bg-zinc-800/50">
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Agregar repuesto</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Nombre del repuesto"
                    value={newPart.name}
                    onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                    className="col-span-2"
                  />
                  <Input
                    type="number"
                    placeholder="Precio unitario"
                    min={0}
                    value={newPart.price || ""}
                    onChange={(e) => setNewPart({ ...newPart, price: parseFloat(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                  />
                  <Input
                    type="number"
                    placeholder="Cantidad"
                    min={1}
                    value={newPart.quantity || ""}
                    onChange={(e) => setNewPart({ ...newPart, quantity: parseInt(e.target.value) || 1 })}
                    onFocus={(e) => e.target.select()}
                  />
                  <Select value={newPart.source} onValueChange={(v) => setNewPart({ ...newPart, source: v as "client" | "purchased" })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchased">Comprado por el taller</SelectItem>
                      <SelectItem value="client">Lo trajo el cliente</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={addPart} disabled={!newPart.name || !newPart.price} className="col-start-2 border-green-200 text-green-700 hover:bg-green-50">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Agregar
                  </Button>
                </div>
              </div>
            </div>

            {/* Resumen */}
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-2">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-3">Resumen de Costos</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-zinc-400">Mano de Obra</span>
                <span className="font-medium text-gray-900 dark:text-zinc-100">${laborCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-zinc-400">Repuestos ({parts.length})</span>
                <span className="font-medium text-gray-900 dark:text-zinc-100">${partsCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t border-emerald-200 dark:border-emerald-800/60 pt-2 mt-2">
                <span className="text-emerald-800 dark:text-emerald-300">Total</span>
                <span className="text-emerald-800 dark:text-emerald-300">${totalCost.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCostVisit(null)}>Cancelar</Button>
            <Button onClick={handleSaveCosts} disabled={isSavingCosts} className="bg-green-600 hover:bg-green-700">
              <Save className="h-4 w-4 mr-2" />
              {isSavingCosts ? "Guardando..." : "Guardar Costos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Input oculto para subir fotos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Lightbox de fotos */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-black/40 rounded-full p-2 hover:bg-black/60 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Foto del vehículo"
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

