/**
 * Catálogo de marcas → modelos comunes en Argentina. Fácilmente ampliable:
 * agregá marcas/modelos acá y los selects dependientes los toman automáticamente.
 * El usuario igualmente puede cargar una marca/modelo libre ("Otra…").
 */
export const VEHICLE_CATALOG: Record<string, string[]> = {
  Volkswagen: ["Gol", "Gol Trend", "Suran", "Voyage", "Polo", "Virtus", "Vento", "Amarok", "Saveiro", "T-Cross", "Nivus", "Taos"],
  Ford: ["Ka", "Fiesta", "Focus", "EcoSport", "Ranger", "Territory", "Kuga", "Mondeo", "F-100"],
  Chevrolet: ["Corsa", "Classic", "Aveo", "Onix", "Prisma", "Cruze", "Tracker", "S10", "Spin", "Cobalt"],
  Fiat: ["Uno", "Palio", "Siena", "Punto", "Cronos", "Argo", "Toro", "Strada", "Mobi", "500"],
  Renault: ["Clio", "Kangoo", "Logan", "Sandero", "Stepway", "Duster", "Captur", "Oroch", "Megane", "Kwid", "Alaskan"],
  Peugeot: ["206", "207", "208", "307", "308", "408", "2008", "3008", "Partner", "Expert"],
  Toyota: ["Corolla", "Etios", "Yaris", "Hilux", "SW4", "Corolla Cross", "RAV4", "Camry"],
  Honda: ["Fit", "City", "Civic", "HR-V", "CR-V", "WR-V"],
  Citroën: ["C3", "C4", "C4 Cactus", "Berlingo", "C-Elysée", "Aircross"],
  Nissan: ["March", "Versa", "Sentra", "Kicks", "Frontier", "X-Trail"],
  "Mercedes-Benz": ["Clase A", "Clase C", "Sprinter", "Vito", "GLA", "GLC"],
  BMW: ["Serie 1", "Serie 3", "Serie 5", "X1", "X3", "X5"],
  Audi: ["A1", "A3", "A4", "Q3", "Q5"],
  Jeep: ["Renegade", "Compass", "Commander"],
  Hyundai: ["i10", "HB20", "Tucson", "Santa Fe", "Creta"],
  Kia: ["Rio", "Cerato", "Sportage", "Sorento"],
};

export const VEHICLE_BRANDS = Object.keys(VEHICLE_CATALOG).sort();

export function modelsForBrand(brand: string): string[] {
  return VEHICLE_CATALOG[brand] ?? [];
}
