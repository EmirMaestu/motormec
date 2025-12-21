import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Query para obtener todos los servicios activos
export const getServices = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db
      .query("services")
      .filter((q) => q.eq(q.field("active"), true))
      .order("desc")
      .collect();
    
    // Ordenar por usageCount (más usados primero) y luego alfabéticamente
    return services.sort((a, b) => {
      const countA = a.usageCount || 0;
      const countB = b.usageCount || 0;
      if (countB !== countA) {
        return countB - countA; // Orden descendente por uso
      }
      return a.name.localeCompare(b.name); // Alfabético
    });
  },
});

// Query para obtener todos los servicios (incluidos inactivos) - para admin
export const getAllServices = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("services").collect();
  },
});

// Query para buscar un servicio por nombre
export const getServiceByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("services")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

// Mutation para crear un servicio
export const createService = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Verificar si ya existe un servicio con ese nombre
    const existing = await ctx.db
      .query("services")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    
    if (existing) {
      // Si existe, incrementar el contador de uso
      await ctx.db.patch(existing._id, {
        usageCount: (existing.usageCount || 0) + 1,
        active: true, // Reactivar si estaba inactivo
      });
      return existing._id;
    }
    
    // Si no existe, crear uno nuevo
    const serviceId = await ctx.db.insert("services", {
      name: args.name,
      active: true,
      createdAt: new Date().toISOString(),
      usageCount: 1,
    });
    
    return serviceId;
  },
});

// Mutation para incrementar el contador de uso de un servicio
export const incrementServiceUsage = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const service = await ctx.db
      .query("services")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    
    if (service) {
      await ctx.db.patch(service._id, {
        usageCount: (service.usageCount || 0) + 1,
      });
    }
  },
});

// Mutation para actualizar un servicio
export const updateService = mutation({
  args: {
    id: v.id("services"),
    name: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

// Mutation para desactivar un servicio (en lugar de eliminarlo)
export const deleteService = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      active: false,
    });
  },
});

// Mutation para activar/desactivar un servicio
export const toggleServiceStatus = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.id);
    if (!service) return null;
    
    await ctx.db.patch(args.id, {
      active: !service.active,
    });
    return args.id;
  },
});

// Mutation para inicializar servicios predefinidos (se ejecuta una sola vez)
export const initializeDefaultServices = mutation({
  args: {},
  handler: async (ctx) => {
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

    for (const serviceName of defaultServices) {
      if (!existingNames.has(serviceName)) {
        await ctx.db.insert("services", {
          name: serviceName,
          active: true,
          createdAt: new Date().toISOString(),
          usageCount: 0,
        });
      }
    }

    return { initialized: defaultServices.length };
  },
});


