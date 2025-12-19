/**
 * Script para importar datos del cuaderno del taller
 * 
 * Este script lee el archivo CSV con los datos históricos del cuaderno
 * y los carga en el sistema de gestión de vehículos.
 * 
 * IMPORTANTE: 
 * - Ejecutar este script SOLO UNA VEZ para evitar duplicados
 * - Los vehículos se marcarán como "Entregado" ya que son históricos
 * - Se asignará un teléfono genérico si no está disponible
 */

import { api } from "./convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

// Configurar el cliente de Convex
const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://charming-peacock-378.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

// Datos del CSV
const vehiculosHistoricos = [
  {
    fecha: "21/10/2025",
    marca: "SsangYong",
    modelo: "Adolfo",
    placa: "ENK-631",
    kilometraje: "166240",
    dueno: "Adolfo",
    telefono: "",
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
    telefono: "",
    servicios: "Servicio completo",
    descripcion: "Bujías cables, bulbo temperatura, codo agua admisión, luces todas, sonda lambda y alfombras",
  },
  {
    fecha: "22/10/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter 413",
    placa: "KKA-686",
    kilometraje: "111016",
    dueno: "Antonelli",
    telefono: "",
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
    telefono: "",
    servicios: "Servicio completo y distribución",
    descripcion: "Cambio correa y tensor de distribución y bomba de agua. Servicio completo: cambio de filtros, aceite, aire y anticongelante. Cambio tapa de depósito de agua",
  },
  {
    fecha: "21/10/2025",
    marca: "Mitsubishi",
    modelo: "L300",
    placa: "S/P",
    kilometraje: "",
    dueno: "Sin datos",
    telefono: "",
    servicios: "Motor completo",
    descripcion: "Cambio 4 biela, metales de biela y bancada. Acta general A2 y rectificación cigüeñal. Cepillado de tapa y cambio de retenes de tapa",
  },
  {
    fecha: "02/11/2025",
    marca: "Volkswagen",
    modelo: "Amarok 2.0 Manual",
    placa: "KDA-221",
    kilometraje: "176083",
    dueno: "Peralta",
    telefono: "",
    servicios: "Junta tapa válvulas",
    descripcion: "Cambio junta tapa válvulas, arandelas de inyectores. Cambio pastiador de intercooler bocina",
  },
  {
    fecha: "21/11/2025",
    marca: "Peugeot",
    modelo: "Partner",
    placa: "AE-046-JW",
    kilometraje: "012917",
    dueno: "Pedro",
    telefono: "",
    servicios: "Reset service",
    descripcion: "Reset service, colocación adaptador de embrague y lubricación",
  },
  {
    fecha: "25/11/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter 313",
    placa: "GAW-STS",
    kilometraje: "369969",
    dueno: "Torresilla",
    telefono: "",
    servicios: "Cambio inyectores y turbo",
    descripcion: "Se reparó motor, cambio de inyectores y turbo. Se destapó radiador",
  },
  {
    fecha: "26/11/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter 26 TYT",
    placa: "S/P",
    kilometraje: "",
    dueno: "Sin datos",
    telefono: "",
    servicios: "Mantenimiento completo",
    descripcion: "Cambio bomba de agua y correo de aire. Cambio pastillas X4, cambio de aceite diferencial y caja, rotación. Limpieza de forzador delantero",
  },
  {
    fecha: "29/11/2025",
    marca: "Renault",
    modelo: "Master",
    placa: "S/P",
    kilometraje: "",
    dueno: "Chapini",
    telefono: "",
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
    telefono: "",
    servicios: "Suspensión y frenos",
    descripcion: "Cambio de amortiguadores delantero y cazoletas. Cambio de pastillas de freno traseros. Cambio de bieletas",
  },
  {
    fecha: "02/12/2025",
    marca: "Ford",
    modelo: "Kuga",
    placa: "DLJ-091",
    kilometraje: "118503",
    dueno: "Pedro",
    telefono: "",
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
    telefono: "",
    servicios: "Juntas y service completo",
    descripcion: "Cambio de juntas admisión y service. Destapar radiador de agua, reparación porta filtro de aire, cambio de junta y aro trasero diferencial, cambio retén calidad diferencial, cambio de aceite diferencial y caja. Service: cambio de aceite y filtros (aire y aceite)",
  },
  {
    fecha: "03/11/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter",
    placa: "S/P",
    kilometraje: "",
    dueno: "Chapini",
    telefono: "",
    servicios: "Cambio junta y turbo",
    descripcion: "Cambio junta tapa de distribución. Cambio de turbo y inyectores",
  },
  {
    fecha: "08/11/2025",
    marca: "Renault",
    modelo: "Master",
    placa: "EVB-958",
    kilometraje: "236692",
    dueno: "Chapini",
    telefono: "",
    servicios: "Cambio alternador y mangueras",
    descripcion: "Cambio buje alternador y polea. Cambio flexible bomba hidráulico y tornillos raccord. Cambio de mangueras de retorno inyectores. Correa de accesorio",
  },
  {
    fecha: "11/11/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter",
    placa: "IHI-825",
    kilometraje: "286796",
    dueno: "Surioni",
    telefono: "",
    servicios: "Cambio metales y encamisado",
    descripcion: "Se le cambió metales de biela y bancada, se encamisó, cambio inyector 173. Cambio sensor de leva",
  },
  {
    fecha: "12/11/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter",
    placa: "AD000-MB",
    kilometraje: "192028",
    dueno: "Adolfo",
    telefono: "",
    servicios: "Cambio correa y reparaciones",
    descripcion: "Cambio correa accesorio y ar aire y un ruedita. Limpieza radiadores, cambio de eje y repara refrigerante, cambio de abrazaderas calefacción",
  },
  {
    fecha: "05/12/2025",
    marca: "Mercedes-Benz",
    modelo: "Sprinter 515",
    placa: "AD-633RE",
    kilometraje: "525550",
    dueno: "Tysa",
    telefono: "",
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
    telefono: "",
    servicios: "Cambio enfriador",
    descripcion: "Cambio de enfriador de aceite y bomba de agua. Cambio manguera intercooler derecha",
  },
  {
    fecha: "06/12/2025",
    marca: "Chevrolet",
    modelo: "Cherry",
    placa: "LNZ-039",
    kilometraje: "154124",
    dueno: "Sin datos",
    telefono: "",
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
    telefono: "",
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
    telefono: "",
    servicios: "Cambio crapodina",
    descripcion: "Se le bajó la caja, cambio de crapodina y buje de horquilla. Se controló embrague",
  },
  {
    fecha: "11/11/2025",
    marca: "Ford",
    modelo: "Ranger",
    placa: "AC-049YV",
    kilometraje: "199511",
    dueno: "Beto",
    telefono: "",
    servicios: "Service completo y reparaciones",
    descripcion: "Service completo, cambio de fotos y reparación ramal. En susción: se afineos, balanceo y rotación. Cambio perro buje elástico",
  },
  {
    fecha: "18/11/2025",
    marca: "Renault",
    modelo: "Master",
    placa: "IAB-552",
    kilometraje: "583103",
    dueno: "Rossi",
    telefono: "",
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
    telefono: "",
    servicios: "Cambio embrague",
    descripcion: "Cambio embrague plato y disco, se mandó a rectificar el volante. Cambio bombinea",
  },
  {
    fecha: "20/11/2025",
    marca: "Toyota",
    modelo: "Etios",
    placa: "AE-311-XV",
    kilometraje: "282312",
    dueno: "Pedro",
    telefono: "",
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
    telefono: "",
    servicios: "Cambio engranaje y distribución",
    descripcion: "Cambio engranaje de carcaza y retén. Cambio correa de distribución",
  },
];

// Función para convertir fecha DD/MM/YYYY a ISO
function convertirFechaAISO(fechaStr: string): string {
  const [dia, mes, anio] = fechaStr.split("/");
  return new Date(`${anio}-${mes}-${dia}`).toISOString();
}

// Función para estimar año del vehículo basado en kilometraje
function estimarAnioVehiculo(kilometraje: string): number {
  const km = parseInt(kilometraje) || 0;
  
  if (km === 0) return 2015; // Por defecto
  if (km < 50000) return 2020;
  if (km < 100000) return 2018;
  if (km < 150000) return 2016;
  if (km < 200000) return 2014;
  if (km < 300000) return 2012;
  if (km < 400000) return 2010;
  return 2008;
}

// Función para importar un vehículo
async function importarVehiculo(vehiculo: typeof vehiculosHistoricos[0]) {
  try {
    const entryDate = convertirFechaAISO(vehiculo.fecha);
    const year = estimarAnioVehiculo(vehiculo.kilometraje);
    const phone = vehiculo.telefono || "Sin teléfono";
    const owner = vehiculo.dueno || "Sin datos";
    
    // Crear array de servicios
    const services = vehiculo.servicios ? [vehiculo.servicios] : ["Servicio general"];
    
    const vehicleData = {
      plate: vehiculo.placa || "S/P",
      brand: vehiculo.marca,
      model: vehiculo.modelo,
      year: year,
      owner: owner,
      phone: phone,
      status: "Entregado", // Todos son históricos
      entryDate: entryDate,
      services: services,
      cost: 0, // Se puede actualizar manualmente después
      description: vehiculo.descripcion || "",
    };

    console.log(`Importando: ${vehiculo.marca} ${vehiculo.modelo} - ${vehiculo.placa}`);
    
    const vehicleId = await client.mutation(api.vehicles.createVehicle, vehicleData);
    
    console.log(`✓ Importado exitosamente: ${vehicleId}`);
    return vehicleId;
  } catch (error) {
    console.error(`✗ Error al importar ${vehiculo.marca} ${vehiculo.modelo}:`, error);
    return null;
  }
}

// Función principal
async function importarTodos() {
  console.log("=".repeat(60));
  console.log("IMPORTACIÓN DE DATOS DEL CUADERNO DEL TALLER");
  console.log("=".repeat(60));
  console.log(`\nTotal de vehículos a importar: ${vehiculosHistoricos.length}\n`);
  
  let exitosos = 0;
  let fallidos = 0;
  
  for (const vehiculo of vehiculosHistoricos) {
    const resultado = await importarVehiculo(vehiculo);
    if (resultado) {
      exitosos++;
    } else {
      fallidos++;
    }
    
    // Pequeña pausa para no saturar la API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("RESUMEN DE IMPORTACIÓN");
  console.log("=".repeat(60));
  console.log(`✓ Exitosos: ${exitosos}`);
  console.log(`✗ Fallidos: ${fallidos}`);
  console.log(`Total: ${exitosos + fallidos}`);
  console.log("=".repeat(60));
}

// Ejecutar importación
importarTodos().catch(console.error);





