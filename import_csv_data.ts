/**
 * Script para importar datos del CSV al sistema
 * 
 * Este script lee el archivo CSV y carga:
 * - Clientes (matcheando los que tienen el mismo nombre)
 * - Servicios/Items (creando items reutilizables en la base de datos)
 * - Vehículos con todos sus datos asociados
 * 
 * IMPORTANTE: 
 * - Ejecutar este script SOLO UNA VEZ para evitar duplicados
 * - Los vehículos se marcarán como "Entregado" ya que son históricos
 */

import { api } from "./convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Configurar el cliente de Convex
const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://charming-peacock-378.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

// Obtener el directorio actual en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  const lines = csvContent.split("\n").filter(line => line.trim());
  if (lines.length === 0) {
    return [];
  }
  
  const headers = lines[0].split(",").map(h => h.trim());
  
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
      } else if (char === ',' && !inQuotes) {
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
    } else {
      console.warn(`Fila ${i + 1} tiene ${values.length} valores pero se esperaban ${headers.length}. Valores:`, values);
    }
  }
  
  return rows;
}

// Función para convertir fecha DD/MM/YY a ISO
function convertirFechaAISO(fechaStr: string): string {
  if (!fechaStr || fechaStr === "N/A" || fechaStr.trim() === "") {
    // Si no hay fecha, usar fecha actual
    return new Date().toISOString();
  }
  
  try {
    const [dia, mes, anio] = fechaStr.split("/");
    // Si el año es de 2 dígitos, asumir 20XX
    const anioCompleto = anio.length === 2 ? `20${anio}` : anio;
    const fecha = new Date(`${anioCompleto}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`);
    return fecha.toISOString();
  } catch (error) {
    console.warn(`Error al convertir fecha "${fechaStr}", usando fecha actual`);
    return new Date().toISOString();
  }
}

// Función para parsear kilometraje
function parseKilometraje(kmStr: string): number | undefined {
  if (!kmStr || kmStr === "N/A" || kmStr.trim() === "") {
    return undefined;
  }
  
  // El formato parece ser: número con punto como separador de miles
  // Ejemplo: "525.55" = 525550 km, "397.296" = 397296 km
  // Remover todos los puntos y convertir a número
  const kmStrClean = kmStr.replace(/\./g, "");
  const km = parseFloat(kmStrClean);
  return isNaN(km) ? undefined : Math.round(km);
}

// Función para parsear servicios (separados por comas)
function parseServicios(serviciosStr: string): string[] {
  if (!serviciosStr || serviciosStr.trim() === "") {
    return [];
  }
  
  // Dividir por comas y limpiar espacios
  return serviciosStr
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// Función para estimar año del vehículo basado en kilometraje
function estimarAnioVehiculo(kilometraje?: number): number {
  if (!kilometraje) return 2015; // Por defecto
  
  if (kilometraje < 50000) return 2020;
  if (kilometraje < 100000) return 2018;
  if (kilometraje < 150000) return 2016;
  if (kilometraje < 200000) return 2014;
  if (kilometraje < 300000) return 2012;
  if (kilometraje < 400000) return 2010;
  return 2008;
}

// Función para buscar o crear cliente por nombre
async function buscarOCrearCliente(nombre: string): Promise<string> {
  if (!nombre || nombre === "N/A" || nombre.trim() === "") {
    nombre = "Sin datos";
  }
  
  try {
    // Buscar todos los clientes activos
    const clientes = await client.query(api.customers.getActiveCustomers);
    
    // Buscar cliente con el mismo nombre (case insensitive)
    const clienteExistente = clientes.find(
      c => c.name.toLowerCase().trim() === nombre.toLowerCase().trim()
    );
    
    if (clienteExistente) {
      return clienteExistente._id;
    }
    
    // Si no existe, crear uno nuevo
    const clienteId = await client.mutation(api.customers.createCustomer, {
      name: nombre.trim(),
      phone: "Sin teléfono", // Se puede actualizar después
    });
    
    return clienteId;
  } catch (error) {
    console.error(`Error al buscar/crear cliente "${nombre}":`, error);
    throw error;
  }
}

// Función para crear o obtener servicio
async function crearObtenerServicio(nombreServicio: string): Promise<string> {
  if (!nombreServicio || nombreServicio.trim() === "") {
    return "";
  }
  
  try {
    // La función createService ya maneja la creación o actualización
    const serviceId = await client.mutation(api.services.createService, {
      name: nombreServicio.trim(),
    });
    
    return serviceId;
  } catch (error) {
    console.error(`Error al crear servicio "${nombreServicio}":`, error);
    return "";
  }
}

// Función para importar un vehículo
async function importarVehiculo(row: CSVRow, customerId: string) {
  try {
    const entryDate = convertirFechaAISO(row.Fecha);
    const kilometraje = parseKilometraje(row.KILOMETRAJE);
    const year = estimarAnioVehiculo(kilometraje);
    
    // Parsear servicios
    const serviciosNombres = parseServicios(row["SERVICIOS (Items)"]);
    
    // Crear servicios en la base de datos
    const serviciosIds: string[] = [];
    for (const servicioNombre of serviciosNombres) {
      const serviceId = await crearObtenerServicio(servicioNombre);
      if (serviceId) {
        serviciosIds.push(serviceId);
      }
    }
    
    // Obtener nombres de servicios para el array del vehículo
    const serviciosNombresArray = serviciosNombres.length > 0 
      ? serviciosNombres 
      : ["Servicio general"];
    
    const vehicleData = {
      plate: row.PLACA && row.PLACA !== "N/A" ? row.PLACA : "S/P",
      brand: row.MARCA || "Sin marca",
      model: row.MODELO && row.MODELO !== "N/A" ? row.MODELO : "Sin modelo",
      year: year,
      owner: row.CLIENTE || "Sin datos",
      phone: "Sin teléfono", // Se puede actualizar después
      customerId: customerId as any,
      status: "Entregado", // Todos son históricos
      entryDate: entryDate,
      services: serviciosNombresArray,
      cost: 0, // Se puede actualizar manualmente después
      description: row["DESCRIPCIÓN COMPLETA"] || "",
      mileage: kilometraje,
    };

    console.log(`Importando: ${row.MARCA} ${row.MODELO} - ${row.PLACA}`);
    
    const vehicleId = await client.mutation(api.vehicles.createVehicle, vehicleData);
    
    console.log(`✓ Importado exitosamente: ${vehicleId}`);
    return vehicleId;
  } catch (error) {
    console.error(`✗ Error al importar ${row.MARCA} ${row.MODELO}:`, error);
    return null;
  }
}

// Función principal
async function importarTodos() {
  console.log("=".repeat(60));
  console.log("IMPORTACIÓN DE DATOS DEL CSV");
  console.log("=".repeat(60));
  
  // Leer el archivo CSV
  // Intentar diferentes rutas posibles
  const nombreArchivo = "crea un excel con los datos de estas fotos, que r... - crea un excel con los datos de estas fotos, que r....csv";
  const posiblesRutas = [
    join(__dirname, "../", nombreArchivo),
    join(process.cwd(), nombreArchivo),
    join(process.cwd(), "../", nombreArchivo),
    join(process.env.HOME || process.env.USERPROFILE || "", "Desktop", nombreArchivo),
    join("/Users", process.env.USER || "", "Desktop", nombreArchivo),
  ];
  
  let csvContent: string | null = null;
  let csvPath: string | null = null;
  
  for (const ruta of posiblesRutas) {
    try {
      csvContent = readFileSync(ruta, "utf-8");
      csvPath = ruta;
      console.log(`Archivo CSV encontrado en: ${ruta}`);
      break;
    } catch (error) {
      // Continuar con la siguiente ruta
    }
  }
  
  if (!csvContent) {
    console.error("Error: No se pudo encontrar el archivo CSV.");
    console.log("\nRutas intentadas:");
    posiblesRutas.forEach(ruta => console.log(`  - ${ruta}`));
    console.log("\nPor favor, asegúrate de que el archivo CSV esté en una de estas ubicaciones.");
    return;
  }
  
  const rows = parseCSV(csvContent);
  console.log(`\nTotal de registros a importar: ${rows.length}\n`);
  
  let exitosos = 0;
  let fallidos = 0;
  const clientesCreados = new Map<string, string>(); // Cache de clientes
  
  for (const row of rows) {
    try {
      // Buscar o crear cliente
      const clienteNombre = row.CLIENTE || "Sin datos";
      let customerId: string;
      
      if (clientesCreados.has(clienteNombre)) {
        customerId = clientesCreados.get(clienteNombre)!;
      } else {
        customerId = await buscarOCrearCliente(clienteNombre);
        clientesCreados.set(clienteNombre, customerId);
      }
      
      // Importar vehículo
      const resultado = await importarVehiculo(row, customerId);
      if (resultado) {
        exitosos++;
      } else {
        fallidos++;
      }
      
      // Pequeña pausa para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error al procesar fila:`, error);
      fallidos++;
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("RESUMEN DE IMPORTACIÓN");
  console.log("=".repeat(60));
  console.log(`✓ Exitosos: ${exitosos}`);
  console.log(`✗ Fallidos: ${fallidos}`);
  console.log(`Total procesados: ${exitosos + fallidos}`);
  console.log(`Clientes únicos: ${clientesCreados.size}`);
  console.log("=".repeat(60));
}

// Ejecutar importación
importarTodos().catch(console.error);

