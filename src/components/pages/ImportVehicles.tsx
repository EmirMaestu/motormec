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
} from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";

// Datos del cuaderno
const vehiculosHistoricos = [
  {
    fecha: "21/10/2025",
    marca: "SsangYong",
    modelo: "Adolfo",
    placa: "ENK-631",
    kilometraje: "166240",
    dueno: "Adolfo",
    servicios: "Cambio embrague",
    descripcion: "Cambio bombines embrague originales",
  },
  {
    fecha: "21/10/2025",
    marca: "Chevrolet",
    modelo: "Corsa",
    placa: "ILU-261",
    kilometraje: "365168",
    dueno: "Pablo",
    servicios: "Servicio completo",
    descripcion:
      "Bujías cables, bulbo temperatura, codo agua admisión, luces todas, sonda lambda y alfombras",
  },
  {
    fecha: "22/10/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter 413",
    placa: "KKA-686",
    kilometraje: "111016",
    dueno: "Antonelli",
    servicios: "Cambio embrague",
    descripcion: "Cambio de embrague FAG y disco originales usado y crapodina",
  },
  {
    fecha: "21/10/2025",
    marca: "Ford",
    modelo: "Ka",
    placa: "AC-546-DH",
    kilometraje: "185119",
    dueno: "Nestor",
    servicios: "Servicio completo y distribución",
    descripcion:
      "Cambio correa y tensor de distribución y bomba de agua. Servicio completo: cambio de filtros, aceite, aire y anticongelante. Cambio tapa de depósito de agua",
  },
  {
    fecha: "21/10/2025",
    marca: "Mitsubishi",
    modelo: "L300",
    placa: "S/P",
    kilometraje: "",
    dueno: "Sin datos",
    servicios: "Motor completo",
    descripcion:
      "Cambio 4 biela, metales de biela y bancada. Acta general A2 y rectificación cigüeñal. Cepillado de tapa y cambio de retenes de tapa",
  },
  {
    fecha: "02/11/2025",
    marca: "Volkswagen",
    modelo: "Amarok 2.0 Manual",
    placa: "KDA-221",
    kilometraje: "176083",
    dueno: "Peralta",
    servicios: "Junta tapa válvulas",
    descripcion:
      "Cambio junta tapa válvulas, arandelas de inyectores. Cambio pastiador de intercooler bocina",
  },
  {
    fecha: "21/11/2025",
    marca: "Peugeot",
    modelo: "Partner",
    placa: "AE-046-JW",
    kilometraje: "012917",
    dueno: "Pedro",
    servicios: "Reset service",
    descripcion:
      "Reset service, colocación adaptador de embrague y lubricación",
  },
  {
    fecha: "25/11/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter 313",
    placa: "GAW-STS",
    kilometraje: "369969",
    dueno: "Torresilla",
    servicios: "Cambio inyectores y turbo",
    descripcion:
      "Se reparó motor, cambio de inyectores y turbo. Se destapó radiador",
  },
  {
    fecha: "26/11/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter 26 TYT",
    placa: "S/P",
    kilometraje: "",
    dueno: "Sin datos",
    servicios: "Mantenimiento completo",
    descripcion:
      "Cambio bomba de agua y correo de aire. Cambio pastillas X4, cambio de aceite diferencial y caja, rotación. Limpieza de forzador delantero",
  },
  {
    fecha: "29/11/2025",
    marca: "Renault",
    modelo: "Master",
    placa: "S/P",
    kilometraje: "",
    dueno: "Chapini",
    servicios: "Pata caliper",
    descripcion: "Se le colocó pata caliper usado del taller",
  },
  {
    fecha: "29/11/2025",
    marca: "Ford",
    modelo: "Focus",
    placa: "DLE-141",
    kilometraje: "",
    dueno: "Sin datos",
    servicios: "Suspensión y frenos",
    descripcion:
      "Cambio de amortiguadores delantero y cazoletas. Cambio de pastillas de freno traseros. Cambio de bieletas",
  },
  {
    fecha: "02/12/2025",
    marca: "Ford",
    modelo: "Kuga",
    placa: "DLJ-091",
    kilometraje: "118503",
    dueno: "Pedro",
    servicios: "Cambio bobinas",
    descripcion: "Cambio de bobinas 1,2,4,5",
  },
  {
    fecha: "03/11/2025",
    marca: "Ford",
    modelo: "F100",
    placa: "WTE-699",
    kilometraje: "391897",
    dueno: "Pablo",
    servicios: "Juntas y service completo",
    descripcion:
      "Cambio de juntas admisión y service. Destapar radiador de agua, reparación porta filtro de aire, cambio de junta y aro trasero diferencial, cambio retén calidad diferencial, cambio de aceite diferencial y caja. Service: cambio de aceite y filtros (aire y aceite)",
  },
  {
    fecha: "03/11/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter",
    placa: "S/P",
    kilometraje: "",
    dueno: "Chapini",
    servicios: "Cambio junta y turbo",
    descripcion:
      "Cambio junta tapa de distribución. Cambio de turbo y inyectores",
  },
  {
    fecha: "08/11/2025",
    marca: "Renault",
    modelo: "Master",
    placa: "EVB-958",
    kilometraje: "236692",
    dueno: "Chapini",
    servicios: "Cambio alternador y mangueras",
    descripcion:
      "Cambio buje alternador y polea. Cambio flexible bomba hidráulico y tornillos raccord. Cambio de mangueras de retorno inyectores. Correa de accesorio",
  },
  {
    fecha: "11/11/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter",
    placa: "IHI-825",
    kilometraje: "286796",
    dueno: "Surioni",
    servicios: "Cambio metales y encamisado",
    descripcion:
      "Se le cambió metales de biela y bancada, se encamisó, cambio inyector 173. Cambio sensor de leva",
  },
  {
    fecha: "12/11/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter",
    placa: "AD000-MB",
    kilometraje: "192028",
    dueno: "Adolfo",
    servicios: "Cambio correa y reparaciones",
    descripcion:
      "Cambio correa accesorio y ar aire y un ruedita. Limpieza radiadores, cambio de eje y repara refrigerante, cambio de abrazaderas calefacción",
  },
  {
    fecha: "05/12/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter 515",
    placa: "AD-633RE",
    kilometraje: "525550",
    dueno: "Tysa",
    servicios: "Programación y cardan",
    descripcion: "Programación y cambio de centro de cardan",
  },
  {
    fecha: "05/12/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter 413",
    placa: "LN-191",
    kilometraje: "097396",
    dueno: "Antoniolli",
    servicios: "Cambio enfriador",
    descripcion:
      "Cambio de enfriador de aceite y bomba de agua. Cambio manguera intercooler derecha",
  },
  {
    fecha: "06/12/2025",
    marca: "Chevrolet",
    modelo: "Cherry",
    placa: "LNZ-039",
    kilometraje: "154124",
    dueno: "Sin datos",
    servicios: "Cambio junta tapa válvulas",
    descripcion: "Cambio junta tapa de válvulas",
  },
  {
    fecha: "07/12/2025",
    marca: "Toyota",
    modelo: "Corolla",
    placa: "AF-510-BK",
    kilometraje: "53291",
    dueno: "Beto",
    servicios: "Cambio pastillas",
    descripcion: "Cambio pastillas de freno X4",
  },
  {
    fecha: "13/11/2025",
    marca: "Volkswagen",
    modelo: "Polo",
    placa: "HAC-181",
    kilometraje: "367995",
    dueno: "Sin datos",
    servicios: "Cambio crapodina",
    descripcion:
      "Se le bajó la caja, cambio de crapodina y buje de horquilla. Se controló embrague",
  },
  {
    fecha: "11/11/2025",
    marca: "Ford",
    modelo: "Ranger",
    placa: "AC-049YV",
    kilometraje: "199511",
    dueno: "Beto",
    servicios: "Service completo y reparaciones",
    descripcion:
      "Service completo, cambio de fotos y reparación ramal. En susción: se afineos, balanceo y rotación. Cambio perro buje elástico",
  },
  {
    fecha: "18/11/2025",
    marca: "Renault",
    modelo: "Master",
    placa: "IAB-552",
    kilometraje: "583103",
    dueno: "Rossi",
    servicios: "Cambio bombin emisor",
    descripcion: "Cambio bombin emisor de embrague marca lux",
  },
  {
    fecha: "19/11/2025",
    marca: "Toyota",
    modelo: "Hilux",
    placa: "KHX-452",
    kilometraje: "386682",
    dueno: "Gabriel",
    servicios: "Cambio embrague",
    descripcion:
      "Cambio embrague plato y disco, se mandó a rectificar el volante. Cambio bombinea",
  },
  {
    fecha: "20/11/2025",
    marca: "Toyota",
    modelo: "Etios",
    placa: "AE-311-XV",
    kilometraje: "282312",
    dueno: "Pedro",
    servicios: "Cambio junta",
    descripcion: "Cambio junta",
  },
  {
    fecha: "21/11/2025",
    marca: "Chevrolet",
    modelo: "Tracker",
    placa: "AD-193HT",
    kilometraje: "236539",
    dueno: "Pedro",
    servicios: "Cambio engranaje y distribución",
    descripcion:
      "Cambio engranaje de carcaza y retén. Cambio correa de distribución",
  },
];

function convertirFechaAISO(fechaStr: string): string {
  const [dia, mes, anio] = fechaStr.split("/");
  return new Date(`${anio}-${mes}-${dia}`).toISOString();
}

function estimarAnioVehiculo(kilometraje: string): number {
  const km = parseInt(kilometraje) || 0;

  if (km === 0) return 2015;
  if (km < 50000) return 2020;
  if (km < 100000) return 2018;
  if (km < 150000) return 2016;
  if (km < 200000) return 2014;
  if (km < 300000) return 2012;
  if (km < 400000) return 2010;
  return 2008;
}

export default function ImportVehicles() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    exitosos: number;
    fallidos: number;
    mensajes: string[];
  } | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<string | null>(null);

  const createVehicle = useMutation(api.vehicles.createVehicle);
  const fixDeliveredVehicles = useMutation(api.vehicles.fixDeliveredVehicles);

  const importarVehiculo = async (
    vehiculo: (typeof vehiculosHistoricos)[0]
  ) => {
    try {
      const entryDate = convertirFechaAISO(vehiculo.fecha);
      const year = estimarAnioVehiculo(vehiculo.kilometraje);
      const phone = "Sin teléfono";
      const owner = vehiculo.dueno || "Sin datos";

      const services = vehiculo.servicios
        ? [vehiculo.servicios]
        : ["Servicio general"];

      const vehicleData = {
        plate: vehiculo.placa || "S/P",
        brand: vehiculo.marca,
        model: vehiculo.modelo,
        year: year,
        owner: owner,
        phone: phone,
        status: "Entregado",
        entryDate: entryDate,
        services: services,
        cost: 0,
        description: vehiculo.descripcion || "",
      };

      await createVehicle(vehicleData);
      return {
        exitoso: true,
        mensaje: `✓ ${vehiculo.marca} ${vehiculo.modelo} - ${vehiculo.placa}`,
      };
    } catch (error) {
      return {
        exitoso: false,
        mensaje: `✗ ${vehiculo.marca} ${vehiculo.modelo} - Error: ${error}`,
      };
    }
  };

  const iniciarImportacion = async () => {
    setImporting(true);
    setProgress(0);
    setResults(null);

    let exitosos = 0;
    let fallidos = 0;
    const mensajes: string[] = [];

    for (let i = 0; i < vehiculosHistoricos.length; i++) {
      const resultado = await importarVehiculo(vehiculosHistoricos[i]);

      if (resultado.exitoso) {
        exitosos++;
      } else {
        fallidos++;
      }

      mensajes.push(resultado.mensaje);
      setProgress(((i + 1) / vehiculosHistoricos.length) * 100);

      // Pequeña pausa para no saturar la API
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    setResults({ exitosos, fallidos, mensajes });
    setImporting(false);
  };

  const ejecutarCorreccion = async () => {
    setFixing(true);
    setFixResult(null);

    try {
      const result = await fixDeliveredVehicles();
      setFixResult(result.message);
    } catch (error) {
      setFixResult(`Error: ${error}`);
    }

    setFixing(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Importar Datos del Cuaderno
        </h1>
        <p className="text-gray-600">
          Importa {vehiculosHistoricos.length} registros históricos del cuaderno
          físico al sistema digital
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Total de Registros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {vehiculosHistoricos.length}
            </p>
            <p className="text-sm text-gray-600 mt-1">Vehículos históricos</p>
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
          </>
        )}
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

      {/* Botón de corrección para vehículos ya importados */}
      <Card className="mb-6 border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertCircle className="h-5 w-5" />
            ¿Ya importaste los vehículos pero no aparecen en "Entregados"?
          </CardTitle>
          <CardDescription className="text-orange-700">
            Si ya ejecutaste la importación antes de esta actualización, usa
            este botón para corregir el estado de los vehículos entregados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={ejecutarCorreccion}
            disabled={fixing}
            variant="outline"
            className="w-full border-orange-300 hover:bg-orange-100"
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            {fixing ? "Corrigiendo..." : "Corregir Vehículos Entregados"}
          </Button>

          {fixResult && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {fixResult}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Datos a Importar</CardTitle>
          <CardDescription>
            Vista previa de los primeros 5 registros
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
                    Dueño
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    Servicios
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vehiculosHistoricos.slice(0, 5).map((v, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {v.fecha}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {v.marca}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {v.modelo}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {v.placa}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {v.dueno}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {v.servicios}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {vehiculosHistoricos.length > 5 && (
            <p className="text-sm text-gray-500 mt-2 text-center">
              ... y {vehiculosHistoricos.length - 5} registros más
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
    </div>
  );
}
