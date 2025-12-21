import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Obtener todos los clientes activos
export const getActiveCustomers = query({
  handler: async (ctx) => {
    const customers = await ctx.db
      .query("customers")
      .filter((q) => q.eq(q.field("active"), true))
      .order("desc")
      .collect();

    return customers;
  },
});

// Obtener cliente por ID
export const getCustomerById = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.customerId);
  },
});

// Buscar cliente por teléfono
export const getCustomerByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .filter((q) => q.eq(q.field("active"), true))
      .first();
  },
});

// Buscar clientes por email
export const getCustomerByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("active"), true))
      .first();
  },
});

// Crear nuevo cliente
export const createCustomer = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    documentType: v.optional(v.string()),
    documentNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verificar si ya existe un cliente con el mismo teléfono
    const existingCustomer = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .filter((q) => q.eq(q.field("active"), true))
      .first();

    if (existingCustomer) {
      throw new Error("Ya existe un cliente con este teléfono");
    }

    const customerId = await ctx.db.insert("customers", {
      ...args,
      createdAt: new Date().toISOString(),
      active: true,
      totalVehicles: 0,
      totalSpent: 0,
      visitCount: 0,
    });

    return customerId;
  },
});

// Crear o devolver cliente existente (útil para formularios de vehículos)
export const createOrGetCustomer = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verificar si ya existe un cliente con el mismo teléfono
    const existingCustomer = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .filter((q) => q.eq(q.field("active"), true))
      .first();

    // Si existe, devolver su ID
    if (existingCustomer) {
      return existingCustomer._id;
    }

    // Si no existe, crear uno nuevo
    const customerId = await ctx.db.insert("customers", {
      ...args,
      createdAt: new Date().toISOString(),
      active: true,
      totalVehicles: 0,
      totalSpent: 0,
      visitCount: 0,
    });

    return customerId;
  },
});

// Actualizar cliente
export const updateCustomer = mutation({
  args: {
    customerId: v.id("customers"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    documentType: v.optional(v.string()),
    documentNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { customerId, ...updates } = args;

    // Si se está actualizando el teléfono, verificar que no exista otro cliente con el mismo
    if (updates.phone) {
      const existingCustomer = await ctx.db
        .query("customers")
        .withIndex("by_phone", (q) => q.eq("phone", updates.phone!))
        .filter((q) => q.eq(q.field("active"), true))
        .first();

      if (existingCustomer && existingCustomer._id !== customerId) {
        throw new Error("Ya existe un cliente con este teléfono");
      }
    }

    await ctx.db.patch(customerId, updates);
    return customerId;
  },
});

// Desactivar cliente (soft delete)
export const deactivateCustomer = mutation({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    // Verificar que no tenga vehículos activos
    const activeVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .filter((q) => q.neq(q.field("status"), "Entregado"))
      .collect();

    if (activeVehicles.length > 0) {
      throw new Error("No se puede desactivar un cliente con vehículos activos");
    }

    await ctx.db.patch(args.customerId, { active: false });
    return args.customerId;
  },
});

// Obtener vehículos de un cliente
export const getCustomerVehicles = query({
  args: { customerId: v.optional(v.id("customers")) },
  handler: async (ctx, args) => {
    // Si no hay customerId, devolver array vacío
    if (!args.customerId) {
      return [];
    }
    
    return await ctx.db
      .query("vehicles")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .collect();
  },
});

// Obtener métricas de un cliente
export const getCustomerMetrics = query({
  args: { customerId: v.optional(v.id("customers")) },
  handler: async (ctx, args) => {
    // Si no hay customerId, devolver null
    if (!args.customerId) {
      return null;
    }
    
    const customer = await ctx.db.get(args.customerId);
    if (!customer) return null;

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();

    const totalVehicles = vehicles.length;
    const totalSpent = vehicles.reduce((sum, vehicle) => sum + vehicle.cost, 0);
    const completedVehicles = vehicles.filter(v => v.status === "Entregado").length;
    const activeVehicles = vehicles.filter(v => v.status !== "Entregado").length;

    // Obtener fecha de la última visita
    const lastVisit = vehicles.length > 0 
      ? vehicles.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())[0].entryDate
      : null;

    return {
      ...customer,
      totalVehicles,
      totalSpent,
      completedVehicles,
      activeVehicles,
      lastVisit,
      visitCount: totalVehicles,
    };
  },
});

// Actualizar métricas del cliente
export const updateCustomerMetrics = mutation({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();

    const totalVehicles = vehicles.length;
    const totalSpent = vehicles.reduce((sum, vehicle) => sum + vehicle.cost, 0);
    
    const lastVisit = vehicles.length > 0 
      ? vehicles.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())[0].entryDate
      : undefined;

    await ctx.db.patch(args.customerId, {
      totalVehicles,
      totalSpent,
      lastVisit,
      visitCount: totalVehicles,
    });

    return args.customerId;
  },
});

// Recalcular métricas de TODOS los clientes
export const recalculateAllCustomerMetrics = mutation({
  handler: async (ctx) => {
    const customers = await ctx.db
      .query("customers")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();

    let updated = 0;

    for (const customer of customers) {
      const vehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_customer", (q) => q.eq("customerId", customer._id))
        .collect();

      const totalVehicles = vehicles.length;
      const totalSpent = vehicles.reduce((sum, vehicle) => sum + vehicle.cost, 0);
      
      const lastVisit = vehicles.length > 0 
        ? vehicles.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())[0].entryDate
        : undefined;

      await ctx.db.patch(customer._id, {
        totalVehicles,
        totalSpent,
        lastVisit,
        visitCount: totalVehicles,
      });

      updated++;
    }

    return { updated, message: `Se actualizaron ${updated} clientes` };
  },
});

// Crear o devolver cliente existente por nombre (útil para importaciones CSV)
export const createOrGetCustomerByName = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.name || args.name.trim() === "" || args.name === "N/A") {
      args.name = "Sin datos";
    }
    
    // Buscar cliente existente por nombre (case insensitive)
    const allCustomers = await ctx.db
      .query("customers")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
    
    const existingCustomer = allCustomers.find(
      (c) => c.name.toLowerCase().trim() === args.name.toLowerCase().trim()
    );

    // Si existe, devolver su ID
    if (existingCustomer) {
      return existingCustomer._id;
    }

    // Si no existe, crear uno nuevo
    const customerId = await ctx.db.insert("customers", {
      name: args.name.trim(),
      phone: args.phone || "Sin teléfono",
      createdAt: new Date().toISOString(),
      active: true,
      totalVehicles: 0,
      totalSpent: 0,
      visitCount: 0,
    });

    return customerId;
  },
});

// Obtener estadísticas generales de clientes
export const getCustomersStats = query({
  handler: async (ctx) => {
    const customers = await ctx.db
      .query("customers")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();

    const totalCustomers = customers.length;
    const totalSpent = customers.reduce((sum, customer) => sum + (customer.totalSpent || 0), 0);
    const totalVehicles = customers.reduce((sum, customer) => sum + (customer.totalVehicles || 0), 0);

    // Top 5 clientes por gasto
    const topCustomers = customers
      .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
      .slice(0, 5)
      .map(customer => ({
        id: customer._id,
        name: customer.name,
        totalSpent: customer.totalSpent || 0,
        totalVehicles: customer.totalVehicles || 0,
      }));

    return {
      totalCustomers,
      totalSpent,
      totalVehicles,
      averageSpentPerCustomer: totalCustomers > 0 ? totalSpent / totalCustomers : 0,
      topCustomers,
    };
  },
});