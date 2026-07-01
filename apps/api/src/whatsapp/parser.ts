import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { env } from "../config/env.js";

export interface DatosVehiculo {
  marca_modelo: string;
  kilometraje: string;
  patente: string;
  tarea: string;
  cliente: string;
}

const EMPTY: DatosVehiculo = {
  marca_modelo: "",
  kilometraje: "",
  patente: "",
  tarea: "",
  cliente: "",
};

/**
 * Sistema: mismas reglas de extracción que el bot ya usaba. Con structured
 * outputs no hace falta pedir "solo JSON" — el esquema garantiza la forma.
 */
const SYSTEM_PROMPT = `Sos un extractor de datos para un taller mecánico argentino.
El usuario te envía un mensaje informal con la información de un vehículo que ingresa al taller.
Extraé estos campos:
- marca_modelo: marca y modelo completos del vehículo (ej: "Chevrolet Aveo", "Ford Focus").
- kilometraje: solo el número del kilometraje, sin texto (ej: "185444").
- patente: patente/matrícula en MAYÚSCULAS (ej: "LWE366", "AB123CD").
- tarea: descripción COMPLETA y LITERAL del trabajo a realizar, copiando todas las palabras del mensaje original. NUNCA abrevies ni resumas.
- cliente: nombre propio del cliente (ej: "Pedro", "Juan García"), sin la palabra "cliente". Buscalo después de palabras como "cliente", "de", "para".

Si un campo no aparece en el mensaje, devolvé cadena vacía "". NO inventes datos.`;

const DatosSchema = z.object({
  marca_modelo: z.string(),
  kilometraje: z.string(),
  patente: z.string(),
  tarea: z.string(),
  cliente: z.string(),
});

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Extrae datos estructurados de un mensaje libre usando la API de Claude
 * (Anthropic). Ante cualquier fallo (sin API key, timeout, error de red),
 * devuelve cadenas vacías: nunca inventa datos.
 */
export async function extraerDatosVehiculo(texto: string): Promise<DatosVehiculo> {
  const c = getClient();
  if (!c) return { ...EMPTY };
  try {
    const res = await c.beta.messages.parse(
      {
        model: env.CLAUDE_MODEL_PARSER,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: texto }],
        output_format: betaZodOutputFormat(DatosSchema),
      },
      { timeout: 30_000 },
    );
    const parsed = res.parsed_output;
    if (!parsed) return { ...EMPTY };
    return {
      marca_modelo: parsed.marca_modelo ?? "",
      kilometraje: parsed.kilometraje ?? "",
      patente: parsed.patente ?? "",
      tarea: parsed.tarea ?? "",
      cliente: parsed.cliente ?? "",
    };
  } catch {
    return { ...EMPTY };
  }
}
