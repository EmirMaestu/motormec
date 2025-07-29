import { mutation } from "./_generated/server";

export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    // Obtener todos los items del dashboard
    const dashboardItems = await ctx.db.query("dashboardItems").collect();
    
    // Eliminar todos los items
    for (const item of dashboardItems) {
      await ctx.db.delete(item._id);
    }
    
    return `Eliminados ${dashboardItems.length} items del dashboard`;
  },
});