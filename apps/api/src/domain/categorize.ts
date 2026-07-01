/**
 * Categorize a set of vehicle services into a financial category.
 * Ported 1:1 from the Convex `categorizeService` helper (transactions.ts).
 */
const RULES: Array<{ category: string; keywords: string[] }> = [
  { category: "Mantenimiento", keywords: ["mantenimiento", "cambio de aceite", "filtros", "revision"] },
  { category: "Frenos", keywords: ["frenos", "pastillas", "discos", "liquido de frenos"] },
  { category: "Motor", keywords: ["motor", "bujias", "correa", "refrigerante", "radiador"] },
  { category: "Transmisión", keywords: ["transmision", "embrague", "caja", "diferencial"] },
  { category: "Suspensión", keywords: ["suspension", "amortiguadores", "resortes", "rotulas"] },
  { category: "Electricidad", keywords: ["electrico", "bateria", "alternador", "arranque", "luces"] },
  { category: "Llantas", keywords: ["llantas", "neumaticos", "alineacion", "balanceo"] },
  { category: "Carrocería", keywords: ["carroceria", "pintura", "abolladuras", "chapa"] },
  { category: "Aire Acondicionado", keywords: ["aire", "climatizacion", "refrigeracion"] },
  { category: "Diagnóstico", keywords: ["diagnostico", "escaner", "revision", "inspeccion"] },
];

export function categorizeService(services: string[]): string {
  if (!services || services.length === 0) return "Servicio General";
  const joined = services.join(" ").toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => joined.includes(k))) {
      return rule.category;
    }
  }
  return "Servicio General";
}
