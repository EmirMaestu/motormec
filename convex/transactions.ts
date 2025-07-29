import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getTransactions = query({
  args: {},
  handler: async (ctx) => {
    const transactions = await ctx.db.query("transactions").collect();
    return transactions.filter(t => t.active !== false);
  },
});

export const getAllTransactions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("transactions").collect();
  },
});

export const getActiveTransactions = query({
  args: {},
  handler: async (ctx) => {
    const transactions = await ctx.db.query("transactions").collect();
    return transactions.filter(t => t.active !== false);
  },
});

export const getSuspendedTransactions = query({
  args: {},
  handler: async (ctx) => {
    const transactions = await ctx.db.query("transactions").collect();
    return transactions.filter(t => t.active === false);
  },
});

export const getTransactionsByType = query({
  args: { type: v.union(v.literal("Ingreso"), v.literal("Egreso")) },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("type"), args.type))
      .collect();
    return transactions.filter(t => t.active !== false);
  },
});

export const getTransactionsByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("category"), args.category))
      .collect();
    return transactions.filter(t => t.active !== false);
  },
});

export const getTransactionsByDateRange = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => 
        q.and(
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();
    return transactions.filter(t => t.active !== false);
  },
});

export const createTransaction = mutation({
  args: {
    date: v.string(),
    description: v.string(),
    type: v.union(v.literal("Ingreso"), v.literal("Egreso")),
    category: v.string(),
    amount: v.number(),
    vehicleId: v.optional(v.id("vehicles")),
    vehicleDetails: v.optional(v.object({
      plate: v.string(),
      brand: v.string(),
      model: v.string(),
      customer: v.string(),
    })),
    supplier: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Crear el objeto base que está en el esquema actual
    const baseTransaction = {
      date: args.date,
      description: args.description,
      type: args.type,
      category: args.category,
      amount: args.amount,
      active: true,
    };

    // Por ahora, incluir los campos adicionales en la descripción hasta que se actualice el esquema
    let enhancedDescription = args.description;
    if (args.supplier) {
      enhancedDescription += ` (Persona: ${args.supplier})`;
    }
    if (args.paymentMethod && args.paymentMethod !== "Efectivo") {
      enhancedDescription += ` - Pago: ${args.paymentMethod}`;
    }
    if (args.notes) {
      enhancedDescription += ` - Notas: ${args.notes}`;
    }

    const transactionId = await ctx.db.insert("transactions", {
      ...baseTransaction,
      description: enhancedDescription,
    });
    return transactionId;
  },
});

export const updateTransaction = mutation({
  args: {
    id: v.id("transactions"),
    date: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.union(v.literal("Ingreso"), v.literal("Egreso"))),
    category: v.optional(v.string()),
    amount: v.optional(v.number()),
    active: v.optional(v.boolean()),
    vehicleId: v.optional(v.id("vehicles")),
    vehicleDetails: v.optional(v.object({
      plate: v.string(),
      brand: v.string(),
      model: v.string(),
      customer: v.string(),
    })),
    supplier: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, supplier, paymentMethod, notes, description, ...baseUpdates } = args;
    
    // Si hay descripción y campos adicionales, combinarlos
    let enhancedDescription = description;
    if (description && (supplier || paymentMethod || notes)) {
      enhancedDescription = description;
      if (supplier) {
        enhancedDescription += ` (Persona: ${supplier})`;
      }
      if (paymentMethod && paymentMethod !== "Efectivo") {
        enhancedDescription += ` - Pago: ${paymentMethod}`;
      }
      if (notes) {
        enhancedDescription += ` - Notas: ${notes}`;
      }
    }

    const updates = {
      ...baseUpdates,
      ...(enhancedDescription && { description: enhancedDescription }),
    };

    await ctx.db.patch(id, updates);
    return id;
  },
});

export const suspendTransaction = mutation({
  args: { id: v.id("transactions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      active: false,
      suspendedAt: new Date().toISOString(),
    });
  },
});

export const reactivateTransaction = mutation({
  args: { id: v.id("transactions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      active: true,
      suspendedAt: undefined,
    });
  },
});

// Mantener deleteTransaction para casos excepcionales
export const deleteTransaction = mutation({
  args: { id: v.id("transactions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Función para categorizar servicios automotrices
const categorizeService = (services: string[]): string => {
  if (services.length === 0) return "Servicio General";
  
  const serviceKeywords = {
    "Mantenimiento": ["mantenimiento", "cambio de aceite", "filtros", "revision"],
    "Frenos": ["frenos", "pastillas", "discos", "liquido de frenos"],
    "Motor": ["motor", "bujias", "correa", "refrigerante", "radiador"],
    "Transmisión": ["transmision", "embrague", "caja", "diferencial"],
    "Suspensión": ["suspension", "amortiguadores", "resortes", "rotulas"],
    "Electricidad": ["electrico", "bateria", "alternador", "arranque", "luces"],
    "Llantas": ["llantas", "neumaticos", "alineacion", "balanceo"],
    "Carrocería": ["carroceria", "pintura", "abolladuras", "chapa"],
    "Aire Acondicionado": ["aire", "climatizacion", "refrigeracion"],
    "Diagnóstico": ["diagnostico", "escaner", "revision", "inspeccion"]
  };
  
  const allServices = services.join(" ").toLowerCase();
  
  for (const [category, keywords] of Object.entries(serviceKeywords)) {
    if (keywords.some(keyword => allServices.includes(keyword))) {
      return category;
    }
  }
  
  return "Servicio General";
};

// Crear transacción automática cuando se entrega un vehículo
export const createVehicleTransaction = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    vehiclePlate: v.string(),
    vehicleBrand: v.string(),
    vehicleModel: v.string(),
    customerName: v.string(),
    services: v.array(v.string()),
    amount: v.number(),
    deliveryDate: v.string(),
  },
  handler: async (ctx, args) => {
    const servicesText = args.services.length > 0 ? args.services.join(", ") : "Servicio general";
    const description = `${args.vehiclePlate} - ${args.vehicleBrand} ${args.vehicleModel} (${args.customerName}) - ${servicesText}`;
    const category = categorizeService(args.services);
    
    // Incluir detalles del vehículo en la descripción por ahora
    const enhancedDescription = `${description} - Cliente: ${args.customerName} - Pago: Efectivo - Servicios: ${servicesText}`;

    const transactionId = await ctx.db.insert("transactions", {
      date: args.deliveryDate,
      description: enhancedDescription,
      type: "Ingreso" as const,
      category,
      amount: args.amount,
      active: true,
    });
    
    return transactionId;
  },
});

export const getFinancialSummary = query({
  args: {},
  handler: async (ctx) => {
    const allTransactions = await ctx.db.query("transactions").collect();
    const activeTransactions = allTransactions.filter(t => t.active !== false);
    
    const totalIngresos = activeTransactions
      .filter(t => t.type === "Ingreso")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalEgresos = activeTransactions
      .filter(t => t.type === "Egreso")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const balance = totalIngresos - totalEgresos;
    
    return {
      totalIngresos,
      totalEgresos,
      balance,
      totalActive: activeTransactions.length,
      totalSuspended: allTransactions.filter(t => t.active === false).length,
    };
  },
});

// Obtener estadísticas de servicios más rentables
export const getServiceStats = query({
  args: {},
  handler: async (ctx) => {
    const allTransactions = await ctx.db.query("transactions").collect();
    const vehicleTransactions = allTransactions.filter(t => 
      t.active !== false && 
      t.type === "Ingreso" && 
      t.vehicleId
    );
    
    // Agrupar por categoría
    const categoryStats = vehicleTransactions.reduce((acc, transaction) => {
      const category = transaction.category || "Servicio General";
      if (!acc[category]) {
        acc[category] = { total: 0, count: 0 };
      }
      acc[category].total += transaction.amount;
      acc[category].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);
    
    // Convertir a array y ordenar por total
    const sortedServices = Object.entries(categoryStats)
      .map(([service, stats]) => ({
        service,
        total: stats.total,
        count: stats.count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4); // Top 4 servicios
    
    return sortedServices;
  },
});

// Obtener categorías predefinidas
export const getCategories = query({
  args: {},
  handler: async () => {
    return {
      income: [
        "Mantenimiento",
        "Frenos", 
        "Motor",
        "Transmisión",
        "Suspensión",
        "Electricidad",
        "Llantas",
        "Carrocería",
        "Aire Acondicionado",
        "Diagnóstico",
        "Servicio General"
      ],
      expense: [
        "Repuestos",
        "Herramientas",
        "Servicios Públicos",
        "Alquiler",
        "Sueldos",
        "Combustible",
        "Mantenimiento Taller",
        "Seguros",
        "Impuestos",
        "Marketing",
        "Otros Gastos"
      ]
    };
  },
});