import { useState } from "react";
// import { useMutation } from "convex/react";
// import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";

export function MigrateServices() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // const migrateServices = useMutation(api.migrateVehicles.migrateServicesToDatabase);

  const handleMigrate = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // const migrationResult = await migrateServices();
      // setResult(migrationResult);
      setError("Esta función no está disponible actualmente");
    } catch (err: any) {
      setError(err.message || "Error al migrar servicios");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Migración de Servicios a Base de Datos</CardTitle>
        <CardDescription>
          Este proceso migrará todos los servicios existentes en los vehículos a la tabla de servicios
          en la base de datos para un mejor seguimiento y reportes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleMigrate} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? "Migrando..." : "Iniciar Migración"}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 space-y-1">
              <div>✓ Servicios predefinidos inicializados: {result.defaultServicesInitialized}</div>
              <div>✓ Vehículos procesados: {result.vehiclesProcessed}</div>
              <div>✓ Servicios únicos encontrados: {result.uniqueServicesFound}</div>
              <div>✓ Nuevos servicios creados: {result.newServicesCreated}</div>
              <div>✓ Servicios actualizados: {result.servicesUpdated}</div>
              <div className="font-semibold pt-2">
                Total de servicios en la base de datos: {result.totalServicesInDatabase}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

