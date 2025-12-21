import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Button } from "../ui/button";
import {
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  FileUp,
} from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";

// Interfaz para los datos del CSV
interface CSVRow {
  Fecha: string;
  PLACA: string;
  MARCA: string;
  MODELO: string;
  CLIENTE: string;
  "SERVICIOS (Items)": string;
  KILOMETRAJE: string;
  "DESCRIPCIÓN COMPLETA": string;
}

// Función para parsear CSV
function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.split("\n").filter((line) => line.trim());
  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0].split(",").map((h) => h.trim());

  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Manejar valores entre comillas que pueden contener comas
    const values: string[] = [];
    let currentValue = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = j < line.length - 1 ? line[j + 1] : null;

      // Manejar comillas dobles escapadas ("")
      if (char === '"' && nextChar === '"') {
        currentValue += '"';
        j++; // Saltar el siguiente carácter
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = "";
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim()); // Último valor

    // Si el número de valores no coincide con los headers, intentar ajustar
    if (values.length === headers.length) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push(row as CSVRow);
    }
  }

  return rows;
}

// Función para convertir fecha DD/MM/YY a ISO
function convertirFechaAISO(fechaStr: string): string {
  if (!fechaStr || fechaStr === "N/A" || fechaStr.trim() === "") {
    return new Date().toISOString();
  }

  try {
    const [dia, mes, anio] = fechaStr.split("/");
    const anioCompleto = anio.length === 2 ? `20${anio}` : anio;
    const fecha = new Date(
      `${anioCompleto}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`
    );
    return fecha.toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

// Función para parsear kilometraje
function parseKilometraje(kmStr: string): number | undefined {
  if (!kmStr || kmStr === "N/A" || kmStr.trim() === "") {
    return undefined;
  }

  const kmStrClean = kmStr.replace(/\./g, "");
  const km = parseFloat(kmStrClean);
  return isNaN(km) ? undefined : Math.round(km);
}

// Función para parsear servicios (separados por comas)
function parseServicios(serviciosStr: string): string[] {
  if (!serviciosStr || serviciosStr.trim() === "") {
    return [];
  }

  return serviciosStr
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Función para estimar año del vehículo basado en kilometraje
function estimarAnioVehiculo(kilometraje?: number): number {
  if (!kilometraje) return 2015;

  if (kilometraje < 50000) return 2020;
  if (kilometraje < 100000) return 2018;
  if (kilometraje < 150000) return 2016;
  if (kilometraje < 200000) return 2014;
  if (kilometraje < 300000) return 2012;
  if (kilometraje < 400000) return 2010;
  return 2008;
}

export default function ImportVehicles() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    exitosos: number;
    fallidos: number;
    mensajes: string[];
    clientesCreados: number;
    serviciosCreados: number;
  } | null>(null);

  const createVehicle = useMutation(api.vehicles.createVehicle);
  const createOrGetCustomerByName = useMutation(
    api.customers.createOrGetCustomerByName
  );
  const createService = useMutation(api.services.createService);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
      setCsvData([]);
      setResults(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const parsed = parseCSV(content);
        setCsvData(parsed);
      };
      reader.readAsText(file);
    } else {
      alert("Por favor, selecciona un archivo CSV válido");
    }
  };

  const importarVehiculo = async (row: CSVRow, customerId: string) => {
    try {
      const entryDate = convertirFechaAISO(row.Fecha);
      const kilometraje = parseKilometraje(row.KILOMETRAJE);
      const year = estimarAnioVehiculo(kilometraje);

      // Parsear servicios
      const serviciosNombres = parseServicios(row["SERVICIOS (Items)"]);

      // Crear servicios en la base de datos
      for (const servicioNombre of serviciosNombres) {
        await createService({ name: servicioNombre });
      }

      // Obtener nombres de servicios para el array del vehículo
      const serviciosNombresArray =
        serviciosNombres.length > 0 ? serviciosNombres : ["Servicio general"];

      const vehicleData = {
        plate: row.PLACA && row.PLACA !== "N/A" ? row.PLACA : "S/P",
        brand: row.MARCA || "Sin marca",
        model: row.MODELO && row.MODELO !== "N/A" ? row.MODELO : "Sin modelo",
        year: year,
        owner: row.CLIENTE || "Sin datos",
        phone: "Sin teléfono",
        customerId: customerId as any,
        status: "Entregado",
        entryDate: entryDate,
        services: serviciosNombresArray,
        cost: 0,
        description: row["DESCRIPCIÓN COMPLETA"] || "",
        mileage: kilometraje,
      };

      await createVehicle(vehicleData);
      return {
        exitoso: true,
        mensaje: `✓ ${row.MARCA} ${row.MODELO} - ${row.PLACA}`,
      };
    } catch (error) {
      return {
        exitoso: false,
        mensaje: `✗ ${row.MARCA} ${row.MODELO} - Error: ${error}`,
      };
    }
  };

  const iniciarImportacion = async () => {
    if (csvData.length === 0) {
      alert("Por favor, primero carga un archivo CSV");
      return;
    }

    setImporting(true);
    setProgress(0);
    setResults(null);

    let exitosos = 0;
    let fallidos = 0;
    const mensajes: string[] = [];
    const clientesCreados = new Set<string>();
    const serviciosCreados = new Set<string>();

    // Cache de IDs de clientes por nombre
    const clientesCache = new Map<string, string>();

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];

      try {
        // Buscar o crear cliente
        const clienteNombre = row.CLIENTE || "Sin datos";
        let customerId: string;

        if (clientesCache.has(clienteNombre)) {
          customerId = clientesCache.get(clienteNombre)!;
        } else {
          customerId = await createOrGetCustomerByName({
            name: clienteNombre,
          });
          clientesCache.set(clienteNombre, customerId);
          clientesCreados.add(clienteNombre);
        }

        // Parsear servicios y contarlos
        const serviciosNombres = parseServicios(row["SERVICIOS (Items)"]);
        serviciosNombres.forEach((s) => serviciosCreados.add(s));

        // Importar vehículo
        const resultado = await importarVehiculo(row, customerId);

        if (resultado.exitoso) {
          exitosos++;
        } else {
          fallidos++;
        }

        mensajes.push(resultado.mensaje);
        setProgress(((i + 1) / csvData.length) * 100);

        // Pequeña pausa para no saturar la API
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        fallidos++;
        mensajes.push(`✗ Error al procesar fila ${i + 1}: ${error}`);
      }
    }

    setResults({
      exitosos,
      fallidos,
      mensajes,
      clientesCreados: clientesCreados.size,
      serviciosCreados: serviciosCreados.size,
    });
    setImporting(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Importar Datos desde CSV
        </h1>
        <p className="text-gray-600">
          Importa datos de vehículos desde un archivo CSV. Se crearán
          automáticamente clientes y servicios/items reutilizables.
        </p>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Importante:</strong> Esta importación solo debe ejecutarse UNA
          VEZ. Ejecutarla múltiples veces creará registros duplicados. Los
          vehículos se marcarán como "Entregado" y tendrán costo $0 (puedes
          actualizarlo después).
        </AlertDescription>
      </Alert>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-blue-600" />
            Cargar Archivo CSV
          </CardTitle>
          <CardDescription>
            Selecciona el archivo CSV con los datos a importar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          {csvFile && (
            <div className="mt-4 p-3 bg-green-50 rounded-md">
              <p className="text-sm text-green-800">
                <FileText className="inline h-4 w-4 mr-2" />
                Archivo cargado: {csvFile.name}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {csvData.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Total de Registros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">
                  {csvData.length}
                </p>
                <p className="text-sm text-gray-600 mt-1">Vehículos a importar</p>
              </CardContent>
            </Card>

            {results && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      Exitosos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-600">
                      {results.exitosos}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Importados correctamente
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      Fallidos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-red-600">
                      {results.fallidos}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Con errores</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-purple-600" />
                      Clientes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-purple-600">
                      {results.clientesCreados}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Clientes únicos</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Vista Previa de Datos</CardTitle>
              <CardDescription>
                Primeros 5 registros del archivo CSV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Fecha
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Marca
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Modelo
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Placa
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Cliente
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Servicios
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {csvData.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {row.Fecha}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {row.MARCA}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {row.MODELO}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {row.PLACA}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {row.CLIENTE}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {row["SERVICIOS (Items)"].substring(0, 50)}
                          {row["SERVICIOS (Items)"].length > 50 ? "..." : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvData.length > 5 && (
                <p className="text-sm text-gray-500 mt-2 text-center">
                  ... y {csvData.length - 5} registros más
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Iniciar Importación</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={iniciarImportacion}
                disabled={importing || results !== null}
                className="w-full"
                size="lg"
              >
                <Upload className="mr-2 h-5 w-5" />
                {importing
                  ? "Importando..."
                  : results
                    ? "Importación Completada"
                    : "Importar Todos los Registros"}
              </Button>

              {importing && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progreso</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {results && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-2">
                    Resultados de la Importación
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    {results.mensajes.map((mensaje, idx) => (
                      <div
                        key={idx}
                        className={`text-sm py-1 ${
                          mensaje.startsWith("✓")
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {mensaje}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
