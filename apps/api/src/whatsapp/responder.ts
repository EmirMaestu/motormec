import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";

/**
 * Redactor de respuestas naturales. La app arma un mensaje base con los datos
 * REALES (patente, montos, estado, nombres) y Claude lo REESCRIBE para que suene
 * humano y cálido — sin inventar ni cambiar datos. Si algo falla, se devuelve el
 * mensaje base intacto (nunca rompe la conversación).
 */

const SYSTEM_PROMPT = `Sos el asistente de WhatsApp de un taller mecánico argentino. Te paso un mensaje y lo reescribís para que suene natural, cálido y breve, en español rioplatense (voseo).

Reglas estrictas:
- NO inventes ni agregues información que no esté en el mensaje.
- Mantené EXACTOS todos los datos: patentes, montos, nombres, kilometrajes, estados y números de orden.
- Máximo 2 o 3 líneas. Podés usar 1 o 2 emojis.
- No uses markdown de encabezados ni listas con viñetas raras.
- Devolvé SOLO el mensaje reescrito, sin comillas ni explicaciones.`;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export interface RedaccionResultado {
  texto: string;
  inputTokens: number;
  outputTokens: number;
}

/** Reescribe `base` en tono natural. Ante cualquier fallo devuelve `base`. */
export async function redactarNatural(base: string): Promise<RedaccionResultado> {
  const c = getClient();
  if (!c || !base.trim()) return { texto: base, inputTokens: 0, outputTokens: 0 };
  try {
    const res = await c.messages.create(
      {
        model: env.CLAUDE_MODEL_PARSER,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: base }],
      },
      { timeout: 20_000 },
    );
    const texto = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return {
      texto: texto || base,
      inputTokens: res.usage?.input_tokens ?? 0,
      outputTokens: res.usage?.output_tokens ?? 0,
    };
  } catch {
    return { texto: base, inputTokens: 0, outputTokens: 0 };
  }
}
