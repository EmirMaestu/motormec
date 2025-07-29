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
    const vehicleId = await ctx.db.insert("vehicles", {
      ...args,
      inTaller: true,
      lastUpdated: new Date().toISOString(),
    });
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
    // Nuevos campos para costos detallados
    costs: v.optional(v.object({
      laborCost: v.number(),
      partsCost: v.number(),
      totalCost: v.number(),
    })),
    parts: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      price: v.number(),
      quantity: v.number(),
      source: v.union(v.literal("client"), v.literal("purchased")),
      supplier: v.optional(v.string()),
      notes: v.optional(v.string()),
    }))),
  },
  handler: async (ctx, args) => {
    const { id, status, ...updates } = args;
    
    // Si el estado cambia a "Entregado" o "Suspendido", marcar como fuera del taller y agregar fecha de salida
    if (status === "Entregado" || status === "Suspendido") {
      await ctx.db.patch(id, {
        ...updates,
        status,
        inTaller: false,
        exitDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
    } else if (status) {
      // Si el estado cambia a cualquier otro estado, marcar como en taller
      await ctx.db.patch(id, {
        ...updates,
        status,
        inTaller: true,
        exitDate: undefined, // Limpiar fecha de salida si regresa al taller
        lastUpdated: new Date().toISOString(),
      });
    } else {
      await ctx.db.patch(id, {
        ...updates,
        lastUpdated: new Date().toISOString(),
      });
    }
    
    return id;
  },
});

export const suspendVehicle = mutation({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "Suspendido",
      inTaller: false,
      exitDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    });
  },
});

export const getVehiclesByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vehicles")
      .filter((q) => q.eq(q.field("status"), args.status))
      .collect();
  },
});

export const getVehiclesByOwner = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vehicles")
      .filter((q) => q.eq(q.field("owner"), args.owner))
      .collect();
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

// Obtener vehículos filtrados por usuario (para miembros no-admin)
export const getVehiclesForUser = query({
  args: { 
    userId: v.string(),
    isAdmin: v.boolean() 
  },
  handler: async (ctx, args) => {
    const vehicles = await ctx.db.query("vehicles").collect();
    
    // Filtrar vehículos que están en el taller
    const vehiclesInTaller = vehicles.filter(v => 
      v.inTaller === true || 
      (v.inTaller === undefined && v.status !== "Entregado" && v.status !== "Suspendido")
    );
    
    // Si es admin, devolver todos
    if (args.isAdmin) {
      return vehiclesInTaller.sort((a, b) => 
        new Date(b.lastUpdated || b.entryDate).getTime() - 
        new Date(a.lastUpdated || a.entryDate).getTime()
      );
    }
    
    // Si es miembro, filtrar solo los asignados al usuario o sin asignar
    const filteredVehicles = vehiclesInTaller.filter(vehicle => {
      // Sin responsables asignados - mostrar (está libre)
      if (!vehicle.responsibles || vehicle.responsibles.length === 0) {
        return true;
      }
      // Si el usuario está entre los responsables asignados - mostrar
      return vehicle.responsibles.some(r => r.userId === args.userId);
    });
    
    return filteredVehicles.sort((a, b) => 
      new Date(b.lastUpdated || b.entryDate).getTime() - 
      new Date(a.lastUpdated || a.entryDate).getTime()
    );
  },
});

// Obtener vehículos en el taller con paginación
export const getVehiclesInTallerPaginated = query({
  args: { 
    page: v.number(),
    pageSize: v.number(),
  },
  handler: async (ctx, args) => {
    const vehicles = await ctx.db.query("vehicles").collect();
    const filtered = vehicles.filter(v => 
      v.inTaller === true || 
      (v.inTaller === undefined && v.status !== "Entregado" && v.status !== "Suspendido")
    ).sort((a, b) => 
      new Date(b.lastUpdated || b.entryDate).getTime() - 
      new Date(a.lastUpdated || a.entryDate).getTime()
    );
    
    const startIndex = (args.page - 1) * args.pageSize;
    const endIndex = startIndex + args.pageSize;
    
    return {
      vehicles: filtered.slice(startIndex, endIndex),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / args.pageSize),
      currentPage: args.page,
    };
  },
});

// Obtener vehículos que ya salieron del taller
export const getVehiclesOutOfTaller = query({
  args: {},
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("vehicles").collect();
    return vehicles.filter(v => 
      v.inTaller === false || 
      (v.inTaller === undefined && (v.status === "Entregado" || v.status === "Suspendido"))
    ).sort((a, b) => 
      new Date(b.lastUpdated || b.entryDate).getTime() - 
      new Date(a.lastUpdated || a.entryDate).getTime()
    );
  },
});

// Búsqueda general por cualquier campo
export const searchVehicles = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const allVehicles = await ctx.db.query("vehicles").collect();
    const searchTerm = args.searchTerm.toLowerCase();
    
    return allVehicles.filter((vehicle) => {
      return (
        vehicle.plate.toLowerCase().includes(searchTerm) ||
        vehicle.brand.toLowerCase().includes(searchTerm) ||
        vehicle.model.toLowerCase().includes(searchTerm) ||
        vehicle.owner.toLowerCase().includes(searchTerm) ||
        vehicle.phone.toLowerCase().includes(searchTerm) ||
        vehicle.status.toLowerCase().includes(searchTerm) ||
        vehicle.year.toString().includes(searchTerm) ||
        (vehicle.description && vehicle.description.toLowerCase().includes(searchTerm)) ||
        vehicle.services.some(service => service.toLowerCase().includes(searchTerm))
      );
    });
  },
});

// Búsqueda paginada
export const searchVehiclesPaginated = query({
  args: { 
    searchTerm: v.string(),
    page: v.number(),
    pageSize: v.number(),
  },
  handler: async (ctx, args) => {
    const allVehicles = await ctx.db.query("vehicles").collect();
    const searchTerm = args.searchTerm.toLowerCase();
    
    const filtered = allVehicles.filter((vehicle) => {
      return (
        vehicle.plate.toLowerCase().includes(searchTerm) ||
        vehicle.brand.toLowerCase().includes(searchTerm) ||
        vehicle.model.toLowerCase().includes(searchTerm) ||
        vehicle.owner.toLowerCase().includes(searchTerm) ||
        vehicle.phone.toLowerCase().includes(searchTerm) ||
        vehicle.status.toLowerCase().includes(searchTerm) ||
        vehicle.year.toString().includes(searchTerm) ||
        (vehicle.description && vehicle.description.toLowerCase().includes(searchTerm)) ||
        vehicle.services.some(service => service.toLowerCase().includes(searchTerm))
      );
    }).sort((a, b) => 
      new Date(b.lastUpdated || b.entryDate).getTime() - 
      new Date(a.lastUpdated || a.entryDate).getTime()
    );
    
    const startIndex = (args.page - 1) * args.pageSize;
    const endIndex = startIndex + args.pageSize;
    
    return {
      vehicles: filtered.slice(startIndex, endIndex),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / args.pageSize),
      currentPage: args.page,
    };
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

// Obtener historial por rango de fechas
export const getVehiclesByDateRange = query({
  args: { 
    startDate: v.string(), 
    endDate: v.string(),
    includeInTaller: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const vehicles = await ctx.db.query("vehicles").collect();
    
    return vehicles.filter((vehicle) => {
      const entryDate = new Date(vehicle.entryDate);
      const start = new Date(args.startDate);
      const end = new Date(args.endDate);
      
      const isInDateRange = entryDate >= start && entryDate <= end;
      
      if (args.includeInTaller !== undefined) {
        return isInDateRange && vehicle.inTaller === args.includeInTaller;
      }
      
      return isInDateRange;
    });
  },
});

// Obtener vehículos con datos inconsistentes para depuración
export const getInconsistentVehicles = query({
  args: {},
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("vehicles").collect();
    
    return vehicles.filter((vehicle) => {
      // Vehículos que deberían estar en taller pero no están
      const shouldBeInTaller = vehicle.status !== "Entregado" && vehicle.status !== "Suspendido";
      const isInTaller = vehicle.inTaller === true || (vehicle.inTaller === undefined && shouldBeInTaller);
      
      // Retorna vehículos inconsistentes
      return shouldBeInTaller !== isInTaller;
    });
  },
});

// Función para corregir datos inconsistentes
export const fixInconsistentVehicles = mutation({
  args: {},
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("vehicles").collect();
    let fixedCount = 0;
    
    for (const vehicle of vehicles) {
      const shouldBeInTaller = vehicle.status !== "Entregado" && vehicle.status !== "Suspendido";
      const isInTaller = vehicle.inTaller === true || (vehicle.inTaller === undefined && shouldBeInTaller);
      
      if (shouldBeInTaller !== isInTaller) {
        await ctx.db.patch(vehicle._id, {
          inTaller: shouldBeInTaller,
          lastUpdated: new Date().toISOString(),
          // Si regresa al taller, limpiar exitDate
          ...(shouldBeInTaller && { exitDate: undefined }),
          // Si sale del taller y no tiene exitDate, agregarlo
          ...(!shouldBeInTaller && !vehicle.exitDate && { exitDate: new Date().toISOString() }),
        });
        fixedCount++;
      }
    }
    
    return { fixedCount };
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

// Iniciar trabajo en un vehículo
export const startWorkOnVehicle = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    userId: v.string(),
    userName: v.string(),
    isAdmin: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new Error("Vehículo no encontrado");

    const responsibles = vehicle.responsibles || [];
    const now = new Date().toISOString();
    
    // Buscar si el usuario ya está en los responsables
    const userIndex = responsibles.findIndex(r => r.userId === args.userId);
    
    if (userIndex >= 0) {
      const user = responsibles[userIndex];
      const workSessions = user.workSessions || [];
      
      // Agregar nueva sesión de trabajo
      workSessions.push({
        startTime: now,
      });
      
      responsibles[userIndex] = {
        ...user,
        isWorking: true,
        workStartedAt: now,
        workSessions: workSessions
      };
    } else {
      // Agregar usuario como responsable y marcarlo como trabajando
      responsibles.push({
        name: args.userName,
        assignedAt: now,
        role: "Mecánico",
        userId: args.userId,
        isAdmin: args.isAdmin || false,
        isWorking: true,
        workStartedAt: now,
        totalWorkTime: 0,
        workSessions: [{
          startTime: now,
        }]
      });
    }

    await ctx.db.patch(args.vehicleId, {
      responsibles,
      status: "En Reparación",
      lastUpdated: now
    });

    return { success: true };
  },
});

// Pausar trabajo en un vehículo (sin completarlo)
export const pauseWorkOnVehicle = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    userId: v.string()
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new Error("Vehículo no encontrado");

    const responsibles = vehicle.responsibles || [];
    const userIndex = responsibles.findIndex(r => r.userId === args.userId);
    const now = new Date().toISOString();
    
    if (userIndex >= 0) {
      const user = responsibles[userIndex];
      
      // Solo pausar si el usuario está trabajando
      if (user.isWorking && user.workStartedAt) {
        const workSessions = [...(user.workSessions || [])];
        
        // Calcular duración de la sesión actual
        const startTime = new Date(user.workStartedAt).getTime();
        const endTime = new Date(now).getTime();
        const sessionDuration = endTime - startTime;
        
        // Encontrar la sesión activa y cerrarla
        const activeSessionIndex = workSessions.findIndex(session => !session.endTime);
        
        if (activeSessionIndex >= 0) {
          workSessions[activeSessionIndex] = {
            ...workSessions[activeSessionIndex],
            endTime: now,
            duration: sessionDuration
          };
        } else {
          // Si no hay sesión activa, crear una con la duración actual
          workSessions.push({
            startTime: user.workStartedAt,
            endTime: now,
            duration: sessionDuration
          });
        }
        
        // Actualizar tiempo total
        const totalWorkTime = (user.totalWorkTime || 0) + sessionDuration;
        
        responsibles[userIndex] = {
          ...user,
          isWorking: false,
          workStartedAt: undefined,
          totalWorkTime: totalWorkTime,
          workSessions: workSessions
        };

        console.log(`Pausando trabajo: usuario ${args.userId}, duración sesión: ${sessionDuration}ms, tiempo total: ${totalWorkTime}ms`);

        await ctx.db.patch(args.vehicleId, {
          responsibles,
          lastUpdated: now
        });
      }
    }

    return { success: true };
  },
});

// Completar trabajo en un vehículo
export const completeWorkOnVehicle = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    userId: v.string()
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new Error("Vehículo no encontrado");

    const responsibles = vehicle.responsibles || [];
    const userIndex = responsibles.findIndex(r => r.userId === args.userId);
    const now = new Date().toISOString();
    
    if (userIndex >= 0) {
      const user = responsibles[userIndex];
      let totalWorkTime = user.totalWorkTime || 0;
      
      // Si el usuario está trabajando actualmente, cerrar la sesión
      if (user.isWorking && user.workStartedAt) {
        const workSessions = [...(user.workSessions || [])];
        
        // Calcular duración de la sesión actual
        const startTime = new Date(user.workStartedAt).getTime();
        const endTime = new Date(now).getTime();
        const sessionDuration = endTime - startTime;
        
        // Encontrar la sesión activa y cerrarla
        const activeSessionIndex = workSessions.findIndex(session => !session.endTime);
        
        if (activeSessionIndex >= 0) {
          workSessions[activeSessionIndex] = {
            ...workSessions[activeSessionIndex],
            endTime: now,
            duration: sessionDuration
          };
        } else {
          // Si no hay sesión activa, crear una con la duración actual
          workSessions.push({
            startTime: user.workStartedAt,
            endTime: now,
            duration: sessionDuration
          });
        }
        
        // Actualizar tiempo total
        totalWorkTime += sessionDuration;
        
        responsibles[userIndex] = {
          ...user,
          isWorking: false,
          workStartedAt: undefined,
          totalWorkTime: totalWorkTime,
          workSessions: workSessions
        };

        console.log(`Completando trabajo: usuario ${args.userId}, duración sesión: ${sessionDuration}ms, tiempo total: ${totalWorkTime}ms`);
      } else {
        // Solo marcar como no trabajando si no hay sesión activa
        responsibles[userIndex] = {
          ...user,
          isWorking: false,
          workStartedAt: undefined
        };
      }
    }

    await ctx.db.patch(args.vehicleId, {
      responsibles,
      status: "Listo",
      lastUpdated: now
    });

    return { 
      success: true,
      totalWorkTime: responsibles[userIndex]?.totalWorkTime || 0
    };  
  },
});