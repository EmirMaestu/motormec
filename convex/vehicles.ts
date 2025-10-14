import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getVehicles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("vehicles").collect();
  },
});

export const getVehicleById = query({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createVehicle = mutation({
  args: {
    plate: v.string(),
    brand: v.string(),
    model: v.string(),
    year: v.number(),
    owner: v.string(),
    phone: v.string(),
    customerId: v.optional(v.id("customers")),
    status: v.string(),
    entryDate: v.string(),
    services: v.array(v.string()),
    cost: v.number(),
    description: v.optional(v.string()),
    responsibles: v.optional(v.array(v.object({
      name: v.string(),
      assignedAt: v.string(),
      role: v.optional(v.string()),
      userId: v.optional(v.string()),
      isAdmin: v.optional(v.boolean()),
      isWorking: v.optional(v.boolean()),
      workStartedAt: v.optional(v.string()),
      totalWorkTime: v.optional(v.number()),
      workSessions: v.optional(v.array(v.object({
        startTime: v.string(),
        endTime: v.optional(v.string()),
        duration: v.optional(v.number()),
      }))),
    }))),
  },
  handler: async (ctx, args) => {
    // Si no se proporciona customerId, intentar encontrar o crear cliente basado en teléfono
    let customerId = args.customerId;
    
    if (!customerId && args.phone) {
      // Buscar cliente existente por teléfono
      const existingCustomer = await ctx.db
        .query("customers")
        .withIndex("by_phone", (q) => q.eq("phone", args.phone))
        .filter((q) => q.eq(q.field("active"), true))
        .first();

      if (existingCustomer) {
        customerId = existingCustomer._id;
      } else {
        // Crear nuevo cliente si no existe
        customerId = await ctx.db.insert("customers", {
          name: args.owner,
          phone: args.phone,
          createdAt: new Date().toISOString(),
          active: true,
          totalVehicles: 0,
          totalSpent: 0,
          visitCount: 0,
        });
      }
    }

    const vehicleId = await ctx.db.insert("vehicles", {
      ...args,
      customerId,
      inTaller: true,
      lastUpdated: new Date().toISOString(),
    });

    // Actualizar métricas del cliente si existe
    if (customerId) {
      const vehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_customer", (q) => q.eq("customerId", customerId))
        .collect();

      const totalVehicles = vehicles.length;
      const totalSpent = vehicles.reduce((sum, vehicle) => sum + vehicle.cost, 0);
      
      await ctx.db.patch(customerId, {
        totalVehicles,
        totalSpent,
        lastVisit: args.entryDate,
        visitCount: totalVehicles,
      });
    }

    return vehicleId;
  },
});

export const updateVehicle = mutation({
  args: {
    id: v.id("vehicles"),
    plate: v.optional(v.string()),
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    year: v.optional(v.number()),
    owner: v.optional(v.string()),
    phone: v.optional(v.string()),
    customerId: v.optional(v.id("customers")),
    status: v.optional(v.string()),
    entryDate: v.optional(v.string()),
    exitDate: v.optional(v.string()),
    services: v.optional(v.array(v.string())),
    cost: v.optional(v.number()),
    description: v.optional(v.string()),
    inTaller: v.optional(v.boolean()),
    responsibles: v.optional(v.array(v.object({
      name: v.string(),
      assignedAt: v.string(),
      role: v.optional(v.string()),
      userId: v.optional(v.string()),
      isAdmin: v.optional(v.boolean()),
      isWorking: v.optional(v.boolean()),
      workStartedAt: v.optional(v.string()),
      totalWorkTime: v.optional(v.number()),
      workSessions: v.optional(v.array(v.object({
        startTime: v.string(),
        endTime: v.optional(v.string()),
        duration: v.optional(v.number()),
      }))),
    }))),
    parts: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      price: v.number(),
      quantity: v.number(),
      source: v.union(v.literal("purchased"), v.literal("client")),
      supplier: v.optional(v.string()),
      notes: v.optional(v.string()),
    }))),
    costs: v.optional(v.object({
      laborCost: v.optional(v.number()),
      partsCost: v.optional(v.number()),
      totalCost: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const previousVehicle = await ctx.db.get(id);
    
    if (!previousVehicle) {
      throw new Error("Vehículo no encontrado");
    }

    // Si se está entregando o suspendiendo, marcar como fuera del taller
    const { status } = updates;
    let newData: any = {};
    
    if (status === "Entregado" || status === "Suspendido") {
      const exitDate = new Date().toISOString();
      newData = {
        ...updates,
        status,
        inTaller: false,
        exitDate,
        lastUpdated: exitDate,
      };
      
      await ctx.db.patch(id, newData);
    } else if (status) {
      // Si el estado cambia a cualquier otro estado, marcar como en taller
      newData = {
        ...updates,
        status,
        inTaller: true,
        exitDate: undefined, // Limpiar fecha de salida si regresa al taller
        lastUpdated: new Date().toISOString(),
      };
      
      await ctx.db.patch(id, newData);
    } else {
      // Para otros cambios
      const hasChanges = Object.keys(updates).length > 0;
      
      if (hasChanges) {
        newData = {
          ...updates,
          lastUpdated: new Date().toISOString(),
        };
        
        await ctx.db.patch(id, newData);
      }
    }

    return id;
  },
});

export const deleteVehicle = mutation({
  args: {
    id: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

export const getVehiclesOutOfTaller = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("vehicles")
      .filter((q) => 
        q.and(
          q.eq(q.field("inTaller"), false),
          q.or(
            q.eq(q.field("status"), "Entregado"),
            q.eq(q.field("status"), "Suspendido")
          )
        )
      )
      .order("desc")
      .collect();
  },
});

export const getVehiclesForUser = query({
  args: {
    userId: v.string(),
    isAdmin: v.boolean(),
  },
  handler: async (ctx, args) => {
    const allVehicles = await ctx.db.query("vehicles").collect();
    
    if (args.isAdmin) {
      // Admin puede ver todos los vehículos
      return allVehicles.filter(vehicle => vehicle.inTaller);
    } else {
      // Miembros solo ven vehículos asignados a ellos o sin asignar
      return allVehicles.filter(vehicle => {
        if (!vehicle.inTaller) return false;
        
        // Sin responsables = disponible para cualquier miembro
        if (!vehicle.responsibles || vehicle.responsibles.length === 0) {
          return true;
        }
        
        // Con responsables = solo si el usuario está asignado
        return vehicle.responsibles.some((r: any) => r.userId === args.userId);
      });
    }
  },
});

export const startWorkOnVehicle = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    userId: v.string(),
    userName: v.string(),
    isAdmin: v.boolean(),
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new Error("Vehículo no encontrado");

    const responsibles = vehicle.responsibles || [];
    let userIndex = responsibles.findIndex((r: any) => r.userId === args.userId);

    // Si el usuario no está asignado, agregarlo
    const wasAlreadyAssigned = userIndex >= 0;
    if (!wasAlreadyAssigned) {
      userIndex = responsibles.length;
      responsibles.push({
        name: args.userName,
        userId: args.userId,
        role: args.isAdmin ? "Admin" : "Miembro",
        isAdmin: args.isAdmin,
        assignedAt: new Date().toISOString(),
        isWorking: false,
        totalWorkTime: 0,
        workSessions: [],
      });
    }

    // Iniciar trabajo
    const user = responsibles[userIndex];
    const startTime = new Date().toISOString();
    
    user.isWorking = true;
    user.workStartedAt = startTime;
    
    if (!user.workSessions) user.workSessions = [];
    user.workSessions.push({
      startTime,
    });

    await ctx.db.patch(args.vehicleId, {
      responsibles,
      lastUpdated: new Date().toISOString(),
    });

    return args.vehicleId;
  },
});

export const pauseWorkOnVehicle = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new Error("Vehículo no encontrado");

    const responsibles = vehicle.responsibles || [];
    const userIndex = responsibles.findIndex((r: any) => r.userId === args.userId);
    
    if (userIndex === -1) {
      throw new Error("Usuario no asignado a este vehículo");
    }

    const user = responsibles[userIndex];
    
    if (!user.isWorking) {
      throw new Error("El usuario no está trabajando en este vehículo");
    }

    const endTime = new Date().toISOString();
    const startTime = user.workStartedAt;
    
    if (startTime) {
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
      
      // Actualizar la sesión más reciente
      if (user.workSessions && user.workSessions.length > 0) {
        const lastSession = user.workSessions[user.workSessions.length - 1];
        lastSession.endTime = endTime;
        lastSession.duration = duration;
        
        // Actualizar tiempo total
        user.totalWorkTime = (user.totalWorkTime || 0) + duration;
      }
    }

    user.isWorking = false;
    user.workStartedAt = undefined;

    await ctx.db.patch(args.vehicleId, {
      responsibles,
      lastUpdated: new Date().toISOString(),
    });

    return { 
      vehicleId: args.vehicleId, 
      workDuration: user.workSessions?.[user.workSessions.length - 1]?.duration 
    };
  },
});

export const completeWorkOnVehicle = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new Error("Vehículo no encontrado");

    const responsibles = vehicle.responsibles || [];
    const userIndex = responsibles.findIndex((r: any) => r.userId === args.userId);
    
    if (userIndex === -1) {
      throw new Error("Usuario no asignado a este vehículo");
    }

    const user = responsibles[userIndex];
    let workDuration = 0;

    if (user.isWorking) {
      const endTime = new Date().toISOString();
      const startTime = user.workStartedAt;
      
      if (startTime) {
        workDuration = new Date(endTime).getTime() - new Date(startTime).getTime();
        
        // Actualizar la sesión más reciente
        if (user.workSessions && user.workSessions.length > 0) {
          const lastSession = user.workSessions[user.workSessions.length - 1];
          lastSession.endTime = endTime;
          lastSession.duration = workDuration;
          
          // Actualizar tiempo total
          user.totalWorkTime = (user.totalWorkTime || 0) + workDuration;
        }
      }

      user.isWorking = false;
      user.workStartedAt = undefined;

      await ctx.db.patch(args.vehicleId, {
        responsibles,
        lastUpdated: new Date().toISOString(),
      });
    }

    return { vehicleId: args.vehicleId, workDuration };
  },
});

// Obtener vehículos en el taller
export const getVehiclesInTaller = query({
  args: {},
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("vehicles").collect();
    return vehicles.filter(v => 
      v.inTaller === true || 
      (v.inTaller === undefined && v.status !== "Entregado" && v.status !== "Suspendido")
    ).sort((a, b) => 
      new Date(b.lastUpdated || b.entryDate).getTime() - 
      new Date(a.lastUpdated || a.entryDate).getTime()
    );
  },
});

// Obtener estadísticas del historial
export const getVehicleStats = query({
  args: {},
  handler: async (ctx) => {
    const allVehicles = await ctx.db.query("vehicles").collect();
    
    return {
      total: allVehicles.length,
      inTaller: allVehicles.filter(v => 
        v.inTaller === true || 
        (v.inTaller === undefined && v.status !== "Entregado" && v.status !== "Suspendido")
      ).length,
      outOfTaller: allVehicles.filter(v => 
        v.inTaller === false || 
        (v.inTaller === undefined && (v.status === "Entregado" || v.status === "Suspendido"))
      ).length,
      byStatus: {
        ingresados: allVehicles.filter(v => v.status === "Ingresado").length,
        enReparacion: allVehicles.filter(v => v.status === "En Reparación").length,
        listos: allVehicles.filter(v => v.status === "Listo").length,
        entregados: allVehicles.filter(v => v.status === "Entregado").length,
        suspendidos: allVehicles.filter(v => v.status === "Suspendido").length,
      },
      totalEarnings: allVehicles
        .filter(v => v.status === "Entregado")
        .reduce((sum, v) => sum + v.cost, 0),
    };
  },
});

// Función para cerrar el día de trabajo de un mecánico
export const closeWorkDay = mutation({
  args: { 
    userId: v.string(),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const vehicles = await ctx.db.query("vehicles").collect();
    let updatedCount = 0;
    
    // Buscar todos los vehículos asignados al usuario que están "En Reparación"
    for (const vehicle of vehicles) {
      if (vehicle.responsibles?.some(r => r.userId === args.userId) && 
          vehicle.status === "En Reparación") {
        
        // Marcar como "Listo" los vehículos que estaban en reparación
        await ctx.db.patch(vehicle._id, {
          status: "Listo",
          lastUpdated: new Date().toISOString(),
        });
        updatedCount++;
      }
    }
    
    return { 
      updatedCount,
      message: `Se actualizaron ${updatedCount} vehículos a estado "Listo"`
    };
  },
});

// Obtener resumen del día de trabajo para un mecánico
export const getWorkDaySummary = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const vehicles = await ctx.db.query("vehicles").collect();
    
    const userVehicles = vehicles.filter(vehicle => 
      vehicle.responsibles?.some(r => r.userId === args.userId)
    );
    
    return {
      totalAssigned: userVehicles.length,
      inProgress: userVehicles.filter(v => 
        v.responsibles?.some(r => r.userId === args.userId && r.isWorking)
      ).length,
      completed: userVehicles.filter(v => v.status === "Listo").length,
      vehicles: userVehicles.map(v => ({
        id: v._id,
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        status: v.status,
        services: v.services,
        owner: v.owner,
        isUserWorking: v.responsibles?.find(r => r.userId === args.userId)?.isWorking || false
      }))
    };
  },
});

// Obtener vehículos con información de cliente
export const getVehiclesWithCustomers = query({
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("vehicles").collect();
    
    const vehiclesWithCustomers = await Promise.all(
      vehicles.map(async (vehicle) => {
        const customer = vehicle.customerId 
          ? await ctx.db.get(vehicle.customerId)
          : null;
        
        return {
          ...vehicle,
          customer,
        };
      })
    );

    return vehiclesWithCustomers;
  },
});

// Obtener vehículo con información de cliente
export const getVehicleWithCustomer = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) return null;

    const customer = vehicle.customerId 
      ? await ctx.db.get(vehicle.customerId)
      : null;

    return {
      ...vehicle,
      customer,
    };
  },
});

// Asignar vehículo a cliente existente
export const assignVehicleToCustomer = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);
    const customer = await ctx.db.get(args.customerId);

    if (!vehicle) throw new Error("Vehículo no encontrado");
    if (!customer) throw new Error("Cliente no encontrado");

    // Actualizar vehículo con nuevo cliente
    await ctx.db.patch(args.vehicleId, {
      customerId: args.customerId,
      owner: customer.name,
      phone: customer.phone,
    });

    // Actualizar métricas del cliente anterior (si existe)
    if (vehicle.customerId && vehicle.customerId !== args.customerId) {
      const oldCustomerVehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_customer", (q) => q.eq("customerId", vehicle.customerId))
        .collect();

      const oldTotalVehicles = oldCustomerVehicles.filter(v => v._id !== args.vehicleId).length;
      const oldTotalSpent = oldCustomerVehicles
        .filter(v => v._id !== args.vehicleId)
        .reduce((sum, v) => sum + v.cost, 0);

      await ctx.db.patch(vehicle.customerId, {
        totalVehicles: oldTotalVehicles,
        totalSpent: oldTotalSpent,
        visitCount: oldTotalVehicles,
      });
    }

    // Actualizar métricas del nuevo cliente
    const newCustomerVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();

    const newTotalVehicles = newCustomerVehicles.length;
    const newTotalSpent = newCustomerVehicles.reduce((sum, v) => sum + v.cost, 0);
    const lastVisit = newCustomerVehicles
      .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())[0]?.entryDate;

    await ctx.db.patch(args.customerId, {
      totalVehicles: newTotalVehicles,
      totalSpent: newTotalSpent,
      lastVisit,
      visitCount: newTotalVehicles,
    });

    return args.vehicleId;
  },
});

// Obtener vehículos sin cliente asignado
export const getVehiclesWithoutCustomer = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("vehicles")
      .filter((q) => q.eq(q.field("customerId"), undefined))
      .order("desc")
      .collect();
  },
});

// Obtener todos los vehículos con información de cliente (incluye los sin cliente)
export const getAllVehiclesWithCustomerInfo = query({
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("vehicles").order("desc").collect();
    
    const vehiclesWithCustomers = await Promise.all(
      vehicles.map(async (vehicle) => {
        const customer = vehicle.customerId 
          ? await ctx.db.get(vehicle.customerId)
          : null;
        
        return {
          ...vehicle,
          customer,
          hasCustomer: !!vehicle.customerId
        };
      })
    );

    return vehiclesWithCustomers;
  },
});

// Obtener vehículos filtrados por rango de fechas (fecha de ingreso)
export const getVehiclesByDateRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    userId: v.optional(v.string()),
    isAdmin: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    let vehicles = await ctx.db.query("vehicles").collect();
    
    // Filtrar por rango de fechas (fecha de ingreso)
    vehicles = vehicles.filter(vehicle => {
      const entryDate = vehicle.entryDate;
      return entryDate >= args.startDate && entryDate <= args.endDate;
    });

    // Si no es admin, filtrar solo vehículos asignados al usuario o sin asignar
    if (args.userId && !args.isAdmin) {
      vehicles = vehicles.filter(vehicle => {
        // Sin responsables asignados (está libre para tomar)
        if (!vehicle.responsibles || vehicle.responsibles.length === 0) {
          return true;
        }
        
        // Si el usuario está entre los responsables asignados
        return vehicle.responsibles.some((r: any) => r.userId === args.userId);
      });
    }

    return vehicles.sort((a, b) => 
      new Date(b.lastUpdated || b.entryDate).getTime() - 
      new Date(a.lastUpdated || a.entryDate).getTime()
    );
  },
});

// Obtener estadísticas de vehículos filtradas por fechas
export const getVehicleStatsByDateRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string()
  },
  handler: async (ctx, args) => {
    const allVehicles = await ctx.db.query("vehicles").collect();
    
    // Filtrar por rango de fechas (fecha de ingreso)
    const vehicles = allVehicles.filter(vehicle => {
      const entryDate = vehicle.entryDate;
      return entryDate >= args.startDate && entryDate <= args.endDate;
    });
    
    return {
      total: vehicles.length,
      inTaller: vehicles.filter(v => 
        v.inTaller === true || 
        (v.inTaller === undefined && v.status !== "Entregado" && v.status !== "Suspendido")
      ).length,
      outOfTaller: vehicles.filter(v => 
        v.inTaller === false || 
        (v.inTaller === undefined && (v.status === "Entregado" || v.status === "Suspendido"))
      ).length,
      byStatus: {
        ingresados: vehicles.filter(v => v.status === "Ingresado").length,
        enReparacion: vehicles.filter(v => v.status === "En Reparación").length,
        listos: vehicles.filter(v => v.status === "Listo").length,
        entregados: vehicles.filter(v => v.status === "Entregado").length,
        suspendidos: vehicles.filter(v => v.status === "Suspendido").length,
      },
      totalEarnings: vehicles
        .filter(v => v.status === "Entregado")
        .reduce((sum, v) => sum + v.cost, 0),
      averageCost: vehicles.length > 0 
        ? vehicles.reduce((sum, v) => sum + v.cost, 0) / vehicles.length 
        : 0,
      dateRange: {
        startDate: args.startDate,
        endDate: args.endDate
      }
    };
  },
});