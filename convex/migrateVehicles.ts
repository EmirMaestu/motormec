import { mutation } from "./_generated/server";

export const migrateVehiclesToNewSchema = mutation({
  args: {},
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("vehicles").collect();
    
    let updated = 0;
    
    for (const vehicle of vehicles) {
      // Solo actualizar si faltan los nuevos campos
      if (vehicle.inTaller === undefined || vehicle.lastUpdated === undefined) {
        const updates: any = {};
        
        if (vehicle.inTaller === undefined) {
          // Determinar si está en el taller basado en el estado
          updates.inTaller = vehicle.status !== "Entregado";
        }
        
        if (vehicle.lastUpdated === undefined) {
          updates.lastUpdated = new Date().toISOString();
        }
        
        // Si el vehículo está entregado pero no tiene fecha de salida
        if (vehicle.status === "Entregado" && !vehicle.exitDate) {
          updates.exitDate = new Date().toISOString();
        }
        
        await ctx.db.patch(vehicle._id, updates);
        updated++;
      }
    }
    
    return { message: `Migrated ${updated} vehicles to new schema` };
  },
});