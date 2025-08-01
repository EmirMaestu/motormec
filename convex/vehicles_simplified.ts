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