import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

export default function FixCustomerMetrics() {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const recalculateMetrics = useMutation(api.customers.recalculateAllCustomerMetrics);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    setError(null);
    setResult(null);

    try {
      const res = await recalculateMetrics();
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Error al recalcular métricas");
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6" />
            Recalcular Métricas de Clientes
          </CardTitle>
          <CardDescription>
            Esta herramienta recalcula todas las métricas de clientes (cantidad de vehículos, total gastado, etc.) 
            basándose en los vehículos actuales en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>¿Cuándo usar esto?</strong>
            </p>
            <ul className="text-sm text-blue-800 mt-2 space-y-1 ml-4 list-disc">
              <li>Cuando ves inconsistencias en la cantidad de vehículos</li>
              <li>Cuando el total gastado no coincide</li>
              <li>Después de importar o migrar datos</li>
              <li>Para corregir métricas desactualizadas</li>
            </ul>
          </div>

          <Button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="w-full"
            size="lg"
          >
            {isRecalculating ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Recalculando...
              </>
            ) : (
              <>
                <RefreshCw className="h-5 w-5 mr-2" />
                Recalcular Todas las Métricas
              </>
            )}
          </Button>

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">
                  ¡Recalculación completada!
                </p>
                <p className="text-sm text-green-800 mt-1">
                  {result.message}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">
                  Error al recalcular
                </p>
                <p className="text-sm text-red-800 mt-1">
                  {error}
                </p>
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              <strong>Nota:</strong> Este proceso puede tardar unos segundos dependiendo 
              de la cantidad de clientes en el sistema. Es seguro ejecutarlo múltiples veces.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}







