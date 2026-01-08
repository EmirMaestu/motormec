import { mutation } from "./_generated/server";

// Mutation para migrar servicios existentes de vehículos a la tabla de servicios
export const migrateServicesToDatabase = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Inicializar servicios predefinidos
    const defaultServices = [
      "Cambio de aceite",
      "Cambio de filtros",
      "Revisión de frenos",
      "Alineación",
      "Balanceado",
      "Cambio de llantas",
      "Revisión de motor",
      "Cambio de bujías",
      "Revisión eléctrica",
      "Cambio de batería",
      "Revisión de suspensión",
      "Cambio de amortiguadores",
      "Mantenimiento general",
      "Diagnóstico",
      "Reparación de transmisión",
      "Cambio de embrague",
      "Reparación de aire acondicionado",
      "Cambio de correa de distribución",
      "Revisión de escape",
      "Cambio de pastillas de freno",
    ];

    const existingServices = await ctx.db.query("services").collect();
    const existingNames = new Set(existingServices.map((s) => s.name));

    // Insertar servicios predefinidos si no existen
    for (const serviceName of defaultServices) {
      if (!existingNames.has(serviceName)) {
        await ctx.db.insert("services", {
          name: serviceName,
          active: true,
          createdAt: new Date().toISOString(),
          usageCount: 0,
        });
        existingNames.add(serviceName);
      }
    }

    // 2. Obtener todos los vehículos
    const vehicles = await ctx.db.query("vehicles").collect();

    // 3. Recopilar todos los servicios únicos de los vehículos
    const serviceUsageMap = new Map<string, number>();

    for (const vehicle of vehicles) {
      if (vehicle.services && Array.isArray(vehicle.services)) {
        for (const serviceName of vehicle.services) {
          if (serviceName && serviceName.trim()) {
            const trimmedName = serviceName.trim();
            serviceUsageMap.set(
              trimmedName,
              (serviceUsageMap.get(trimmedName) || 0) + 1
            );
          }
        }
      }
    }

    // 4. Insertar o actualizar servicios en la tabla
    let newServicesCreated = 0;
    let servicesUpdated = 0;

    for (const [serviceName, usageCount] of serviceUsageMap) {
      if (!existingNames.has(serviceName)) {
        // Crear nuevo servicio
        await ctx.db.insert("services", {
          name: serviceName,
          active: true,
          createdAt: new Date().toISOString(),
          usageCount: usageCount,
        });
        newServicesCreated++;
        existingNames.add(serviceName);
      } else {
        // Actualizar contador de uso si el servicio ya existe
        const service = existingServices.find((s) => s.name === serviceName);
        if (service) {
          await ctx.db.patch(service._id, {
            usageCount: (service.usageCount || 0) + usageCount,
          });
          servicesUpdated++;
        }
      }
    }

    return {
      success: true,
      defaultServicesInitialized: defaultServices.length,
      vehiclesProcessed: vehicles.length,
      uniqueServicesFound: serviceUsageMap.size,
      newServicesCreated,
      servicesUpdated,
      totalServicesInDatabase: existingNames.size,
    };
  },
});




