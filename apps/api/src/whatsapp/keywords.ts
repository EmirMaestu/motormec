/** Affirmative/negative/done keyword detection — ported verbatim from Convex. */

const AFIRMATIVO = ["sí", "si", "s", "yes", "y", "claro", "ok", "dale", "confirmar", "confirmo", "correcto"];
const NEGATIVO = ["no", "n", "nop", "nope", "cancelar", "cancel"];
const LISTO = ["listo", "ya", "fin", "terminar", "terminé", "termine", "guardar", "no mas", "no más", "ya está", "ya esta"];

function match(text: string, words: string[]): boolean {
  const t = text.toLowerCase().trim();
  return words.some((w) => t === w || t.startsWith(w + " "));
}

export const esAfirmativo = (t: string) => match(t, AFIRMATIVO);
export const esNegativo = (t: string) => match(t, NEGATIVO);
export const esListo = (t: string) => match(t, LISTO);

/** Button IDs used in interactive replies. */
export const BTN = {
  SI: "btn_si",
  CONFIRMAR: "btn_confirmar",
  NO: "btn_no",
  CANCELAR: "btn_cancelar",
  SIN_FOTOS: "btn_sin_fotos",
  LISTO: "btn_listo",
} as const;

export const esBotonAfirmativo = (id: string) => id === BTN.SI || id === BTN.CONFIRMAR;
export const esBotonNegativo = (id: string) => id === BTN.NO || id === BTN.CANCELAR;
export const esBotonListo = (id: string) => id === BTN.SIN_FOTOS || id === BTN.LISTO;
