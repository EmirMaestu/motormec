import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { env } from "../config/env.js";

export type Intencion = "ingreso" | "saludo" | "consulta" | "otro";

export interface DatosVehiculo {
  /** Qué quiere hacer el usuario con este mensaje. */
  intencion?: Intencion;
  marca_modelo: string;
  kilometraje: string;
  patente: string;
  tarea: string;
  cliente: string;
}

const EMPTY: DatosVehiculo = {
  intencion: "saludo",
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
const SYSTEM_PROMPT = `Sos el asistente de WhatsApp de un taller mecánico argentino. Recibís mensajes informales de empleados del taller.

Primero clasificá la INTENCIÓN del mensaje:
- "ingreso": trae datos de un vehículo que ENTRA al taller (marca/modelo, patente, tarea a realizar). Ej: "Entró un Gol patente ABC123, cambio de aceite, cliente Juan".
- "consulta": pregunta por el ESTADO o info de un vehículo, cliente u orden ya existente. Ej: "¿Cómo va la patente ABC123?", "qué autos tiene Juan", "estado del Corolla".
- "saludo": saludo o mensaje sin datos accionables. Ej: "hola", "buenas", "gracias", "ok".
- "otro": cualquier otra cosa que no encaje.

Luego extraé estos campos (para "ingreso"; para "consulta" poné en patente/cliente lo que se pregunta):
- marca_modelo: marca y modelo completos (ej: "Chevrolet Aveo", "Ford Focus").
- kilometraje: solo el número, sin texto (ej: "185444").
- patente: patente/matrícula en MAYÚSCULAS (ej: "LWE366", "AB123CD").
- tarea: descripción COMPLETA y LITERAL del trabajo, copiando las palabras del mensaje. NUNCA abrevies.
- cliente: nombre propio del cliente, sin la palabra "cliente". Buscalo tras "cliente", "de", "para".

Si un campo no aparece, devolvé cadena vacía "". NUNCA inventes datos. Si el mensaje es sólo un saludo, intencion="saludo" y todos los campos vacíos.`;

const DatosSchema = z.object({
  intencion: z.enum(["ingreso", "saludo", "consulta", "otro"]),
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

export interface ExtraccionResultado {
  datos: DatosVehiculo;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Extrae datos estructurados de un mensaje libre usando la API de Claude
 * (Anthropic) y devuelve además el consumo de tokens de esa llamada. Ante
 * cualquier fallo (sin API key, timeout, error de red) devuelve datos vacíos y
 * cero tokens: nunca inventa datos.
 */
export async function extraerDatosVehiculo(texto: string): Promise<ExtraccionResultado> {
  const c = getClient();
  if (!c) return { datos: { ...EMPTY }, inputTokens: 0, outputTokens: 0 };
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
    const inputTokens = res.usage?.input_tokens ?? 0;
    const outputTokens = res.usage?.output_tokens ?? 0;
    const parsed = res.parsed_output;
    if (!parsed) return { datos: { ...EMPTY }, inputTokens, outputTokens };
    return {
      datos: {
        intencion: parsed.intencion ?? "otro",
        marca_modelo: parsed.marca_modelo ?? "",
        kilometraje: parsed.kilometraje ?? "",
        patente: parsed.patente ?? "",
        tarea: parsed.tarea ?? "",
        cliente: parsed.cliente ?? "",
      },
      inputTokens,
      outputTokens,
    };
  } catch {
    return { datos: { ...EMPTY }, inputTokens: 0, outputTokens: 0 };
  }
}
