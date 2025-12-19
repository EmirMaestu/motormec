import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Save,
  Play,
  Trash2,
  Clock,
  Calendar,
  Plus,
} from "lucide-react";

export function ReportTemplates() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    type: "",
    frequency: "manual",
  });

  const templates = useQuery(api.reports.getReportTemplates);
  const savedTemplates = useQuery(api.reports.getSavedTemplates);
  const saveTemplate = useMutation(api.reports.saveReportTemplate);
  const deleteTemplate = useMutation(api.reports.deleteTemplate);
  const scheduleReport = useMutation(api.reports.scheduleReport);

  const handleSaveTemplate = async () => {
    if (!newTemplate.name || !newTemplate.type) {
      alert("Por favor completa todos los campos requeridos");
      return;
    }

    try {
      await saveTemplate({
        name: newTemplate.name,
        description: newTemplate.description,
        type: newTemplate.type,
        filters: {},
        frequency: newTemplate.frequency,
      });

      setNewTemplate({
        name: "",
        description: "",
        type: "",
        frequency: "manual",
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Error al guardar plantilla:", error);
      alert("Error al guardar la plantilla");
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta plantilla?")) return;

    try {
      await deleteTemplate({ templateId: templateId as any });
    } catch (error) {
      console.error("Error al eliminar plantilla:", error);
    }
  };

  const handleScheduleReport = async (templateId: string, frequency: string) => {
    try {
      await scheduleReport({
        templateId: templateId as any,
        frequency,
        enabled: true,
      });
    } catch (error) {
      console.error("Error al programar reporte:", error);
    }
  };

  const getFrequencyBadge = (frequency: string) => {
    const colors: Record<string, string> = {
      daily: "bg-blue-100 text-blue-800",
      weekly: "bg-green-100 text-green-800",
      monthly: "bg-purple-100 text-purple-800",
      quarterly: "bg-orange-100 text-orange-800",
      manual: "bg-gray-100 text-gray-800",
    };

    const labels: Record<string, string> = {
      daily: "Diario",
      weekly: "Semanal",
      monthly: "Mensual",
      quarterly: "Trimestral",
      manual: "Manual",
    };

    return (
      <Badge className={colors[frequency] || colors.manual}>
        {labels[frequency] || frequency}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "financial":
        return "💰";
      case "customers":
        return "👥";
      case "inventory":
        return "📦";
      case "mechanics":
        return "👨‍🔧";
      case "operational":
        return "🚗";
      case "strategic":
        return "📈";
      default:
        return "📊";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">Plantillas de Reportes</h3>
          <p className="text-muted-foreground">
            Crea y gestiona plantillas reutilizables
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nueva Plantilla
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Plantilla de Reporte</DialogTitle>
              <DialogDescription>
                Define una plantilla reutilizable para generar reportes
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  placeholder="Ej: Reporte Mensual de Ventas"
                  value={newTemplate.name}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Describe qué incluye este reporte..."
                  value={newTemplate.description}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, description: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Reporte *</Label>
                <Select
                  value={newTemplate.type}
                  onValueChange={(value) =>
                    setNewTemplate({ ...newTemplate, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="financial">💰 Financiero</SelectItem>
                    <SelectItem value="customers">👥 Clientes</SelectItem>
                    <SelectItem value="inventory">📦 Inventario</SelectItem>
                    <SelectItem value="mechanics">👨‍🔧 Mecánicos</SelectItem>
                    <SelectItem value="operational">🚗 Operacional</SelectItem>
                    <SelectItem value="strategic">📈 Estratégico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Frecuencia</Label>
                <Select
                  value={newTemplate.frequency}
                  onValueChange={(value) =>
                    setNewTemplate({ ...newTemplate, frequency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="daily">Diario</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveTemplate}>
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Plantillas predefinidas */}
      <div>
        <h4 className="text-lg font-semibold mb-3">Plantillas Predefinidas</h4>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates?.map((template: any) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getTypeIcon(template.type)}</span>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                  </div>
                  {getFrequencyBadge(template.frequency)}
                </div>
                <CardDescription className="text-sm">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      // Generar reporte (implementar lógica)
                      alert(`Generando reporte: ${template.name}`);
                    }}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Generar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Programar reporte
                      const frequency = prompt(
                        "Frecuencia (daily, weekly, monthly, quarterly):"
                      );
                      if (frequency) {
                        alert(`Reporte programado: ${frequency}`);
                      }
                    }}
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Plantillas guardadas */}
      {savedTemplates && savedTemplates.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold mb-3">Mis Plantillas</h4>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedTemplates.map((template: any) => (
              <Card key={template._id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {getTypeIcon(template.type.replace("template-", ""))}
                      </span>
                      <CardTitle className="text-base">{template.title}</CardTitle>
                    </div>
                    {template.data?.frequency &&
                      getFrequencyBadge(template.data.frequency)}
                  </div>
                  <CardDescription className="text-sm">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        alert(`Generando reporte: ${template.title}`);
                      }}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Generar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const frequency = prompt(
                          "Frecuencia (daily, weekly, monthly, quarterly):"
                        );
                        if (frequency) {
                          handleScheduleReport(template._id, frequency);
                        }
                      }}
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template._id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Información sobre reportes programados */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reportes Programados
          </CardTitle>
          <CardDescription>
            Los reportes programados se generarán automáticamente según la
            frecuencia configurada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-blue-900">
            <p>
              • <strong>Diario:</strong> Se genera cada día a las 00:00
            </p>
            <p>
              • <strong>Semanal:</strong> Se genera cada lunes a las 00:00
            </p>
            <p>
              • <strong>Mensual:</strong> Se genera el día 1 de cada mes
            </p>
            <p>
              • <strong>Trimestral:</strong> Se genera cada 3 meses
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



