import { query, mutation, internalMutation } from "./_generated/server";
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
    mileage: v.optional(v.number()),
    responsibles: v.optional(
      v.array(
        v.object({
          name: v.string(),
          assignedAt: v.string(),
          role: v.optional(v.string()),
          userId: v.optional(v.string()),
          isAdmin: v.optional(v.boolean()),
          isWorking: v.optional(v.boolean()),
          workStartedAt: v.optional(v.string()),
          totalWorkTime: v.optional(v.number()),
          workSessions: v.optional(
            v.array(
              v.object({
                startTime: v.string(),
                endTime: v.optional(v.string()),
                duration: v.optional(v.number()),
              })
            )
          ),
        })
      )
    ),
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

    // Determinar si el vehículo está en el taller según su estado
    const isInTaller =
      args.status !== "Entregado" && args.status !== "Suspendido";

    const vehicleId = await ctx.db.insert("vehicles", {
      ...args,
      customerId,
      inTaller: isInTaller,
      exitDate: !isInTaller ? new Date().toISOString() : undefined,
      lastUpdated: new Date().toISOString(),
    });

    // Actualizar métricas del cliente si existe
    if (customerId) {
      const vehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_customer", (q) => q.eq("customerId", customerId))
        .collect();

      const totalVehicles = vehicles.length;
      const totalSpent = vehicles.reduce(
        (sum, vehicle) => sum + vehicle.cost,
        0
      );

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

// ─── Mutation interna: crear vehículo desde el bot de WhatsApp ────────────
export const crearVehiculo = internalMutation({
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
    mileage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let customerId = args.customerId;

    // Si no hay customerId, buscar o crear cliente por teléfono
    if (!customerId && args.phone) {
      const existingCustomer = await ctx.db
        .query("customers")
        .withIndex("by_phone", (q) => q.eq("phone", args.phone))
        .filter((q) => q.eq(q.field("active"), true))
        .first();

      if (existingCustomer) {
        customerId = existingCustomer._id;
      } else {
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

    const isInTaller = args.status !== "Entregado" && args.status !== "Suspendido";

    const vehicleId = await ctx.db.insert("vehicles", {
      ...args,
      customerId,
      inTaller: isInTaller,
      exitDate: !isInTaller ? new Date().toISOString() : undefined,
      lastUpdated: new Date().toISOString(),
    });

    // Actualizar métricas del cliente
    if (customerId) {
      const vehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_customer", (q) => q.eq("customerId", customerId))
        .collect();
      await ctx.db.patch(customerId, {
        totalVehicles: vehicles.length,
        totalSpent: vehicles.reduce((s, v) => s + v.cost, 0),
        lastVisit: args.entryDate,
        visitCount: vehicles.length,
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
    mileage: v.optional(v.number()),
    inTaller: v.optional(v.boolean()),
    responsibles: v.optional(
      v.array(
        v.object({
          name: v.string(),
          assignedAt: v.string(),
          role: v.optional(v.string()),
          userId: v.optional(v.string()),
          isAdmin: v.optional(v.boolean()),
          isWorking: v.optional(v.boolean()),
          workStartedAt: v.optional(v.string()),
          totalWorkTime: v.optional(v.number()),
          workSessions: v.optional(
            v.array(
              v.object({
                startTime: v.string(),
                endTime: v.optional(v.string()),
                duration: v.optional(v.number()),
              })
            )
          ),
        })
      )
    ),
    parts: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          price: v.number(),
          quantity: v.number(),
          source: v.union(v.literal("purchased"), v.literal("client")),
          supplier: v.optional(v.string()),
          notes: v.optional(v.string()),
        })
      )
    ),
    costs: v.optional(
      v.object({
        laborCost: v.optional(v.number()),
        partsCost: v.optional(v.number()),
        totalCost: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const previousVehicle = await ctx.db.get(id);

    if (!previousVehicle) {
      throw new Error("Vehículo no encontrado");
    }

    // Si se está entregando o suspendiendo, marcar como fuera del taller
    const { status, customerId } = updates;
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

    // Actualizar métricas del cliente anterior si cambió el customerId
    if (customerId !== undefined && previousVehicle.customerId && previousVehicle.customerId !== customerId) {
      const oldCustomerVehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_customer", (q) => q.eq("customerId", previousVehicle.customerId))
        .collect();

      await ctx.db.patch(previousVehicle.customerId, {
        totalVehicles: oldCustomerVehicles.length,
        totalSpent: oldCustomerVehicles.reduce((sum, v) => sum + v.cost, 0),
        visitCount: oldCustomerVehicles.length,
      });
    }

    // Actualizar métricas del cliente actual
    const finalCustomerId = customerId !== undefined ? customerId : previousVehicle.customerId;
    
    if (finalCustomerId) {
      const customerVehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_customer", (q) => q.eq("customerId", finalCustomerId))
        .collect();

      const totalVehicles = customerVehicles.length;
      const totalSpent = customerVehicles.reduce((sum, v) => sum + v.cost, 0);

      // Encontrar la fecha más reciente
      const sortedVehicles = customerVehicles.sort((a, b) => 
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
      );

      await ctx.db.patch(finalCustomerId, {
        totalVehicles,
        totalSpent,
        lastVisit: sortedVehicles[0]?.entryDate,
        visitCount: totalVehicles,
      });
    }

    return id;
  },
});

export const deleteVehicle = mutation({
  args: {
    id: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.id);
    
    if (!vehicle) {
      throw new Error("Vehículo no encontrado");
    }

    // Si el vehículo tiene un cliente asociado, actualizar sus métricas
    if (vehicle.customerId) {
      const customerVehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_customer", (q) => q.eq("customerId", vehicle.customerId))
        .collect();

      // Filtrar el vehículo que se va a eliminar
      const remainingVehicles = customerVehicles.filter(
        (v) => v._id !== args.id
      );

      const totalVehicles = remainingVehicles.length;
      const totalSpent = remainingVehicles.reduce((sum, v) => sum + v.cost, 0);

      // Encontrar la fecha más reciente de los vehículos restantes
      const lastVisit =
        totalVehicles > 0
          ? remainingVehicles.sort(
              (a, b) =>
                new Date(b.entryDate).getTime() -
                new Date(a.entryDate).getTime()
            )[0].entryDate
          : undefined;

      await ctx.db.patch(vehicle.customerId, {
        totalVehicles,
        totalSpent,
        lastVisit,
        visitCount: totalVehicles,
      });
    }

    // Eliminar el vehículo
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
      return allVehicles.filter((vehicle) => vehicle.inTaller);
    } else {
      // Miembros solo ven vehículos asignados a ellos o sin asignar
      return allVehicles.filter((vehicle) => {
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
    let userIndex = responsibles.findIndex(
      (r: any) => r.userId === args.userId
    );

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

    // Cambiar el estado del vehículo a "En Reparación" cuando se inicia el trabajo
    const updateData: any = {
      responsibles,
      lastUpdated: new Date().toISOString(),
    };

    // Solo cambiar el estado si no está ya en "En Reparación"
    if (vehicle.status !== "En Reparación") {
      updateData.status = "En Reparación";
    }

    await ctx.db.patch(args.vehicleId, updateData);

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
    const userIndex = responsibles.findIndex(
      (r: any) => r.userId === args.userId
    );

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
      const duration =
        new Date(endTime).getTime() - new Date(startTime).getTime();

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
      workDuration: user.workSessions?.[user.workSessions.length - 1]?.duration,
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
    const userIndex = responsibles.findIndex(
      (r: any) => r.userId === args.userId
    );

    if (userIndex === -1) {
      throw new Error("Usuario no asignado a este vehículo");
    }

    const user = responsibles[userIndex];
    let workDuration = 0;

    if (user.isWorking) {
      const endTime = new Date().toISOString();
      const startTime = user.workStartedAt;

      if (startTime) {
        workDuration =
          new Date(endTime).getTime() - new Date(startTime).getTime();

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
    return vehicles
      .filter(
        (v) =>
          v.inTaller === true ||
          (v.inTaller === undefined &&
            v.status !== "Entregado" &&
            v.status !== "Suspendido")
      )
      .sort(
        (a, b) =>
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
      inTaller: allVehicles.filter(
        (v) =>
          v.inTaller === true ||
          (v.inTaller === undefined &&
            v.status !== "Entregado" &&
            v.status !== "Suspendido")
      ).length,
      outOfTaller: allVehicles.filter(
        (v) =>
          v.inTaller === false ||
          (v.inTaller === undefined &&
            (v.status === "Entregado" || v.status === "Suspendido"))
      ).length,
      byStatus: {
        ingresados: allVehicles.filter((v) => v.status === "Ingresado").length,
        enReparacion: allVehicles.filter((v) => v.status === "En Reparación")
          .length,
        listos: allVehicles.filter((v) => v.status === "Listo").length,
        entregados: allVehicles.filter((v) => v.status === "Entregado").length,
        suspendidos: allVehicles.filter((v) => v.status === "Suspendido")
          .length,
      },
      totalEarnings: allVehicles
        .filter((v) => v.status === "Entregado")
        .reduce((sum, v) => sum + v.cost, 0),
    };
  },
});

// Función para cerrar el día de trabajo de un mecánico
export const closeWorkDay = mutation({
  args: {
    userId: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const vehicles = await ctx.db.query("vehicles").collect();
    let updatedCount = 0;

    // Buscar todos los vehículos asignados al usuario que están "En Reparación"
    for (const vehicle of vehicles) {
      if (
        vehicle.responsibles?.some((r) => r.userId === args.userId) &&
        vehicle.status === "En Reparación"
      ) {
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
      message: `Se actualizaron ${updatedCount} vehículos a estado "Listo"`,
    };
  },
});

// Obtener resumen del día de trabajo para un mecánico
export const getWorkDaySummary = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const vehicles = await ctx.db.query("vehicles").collect();

    const userVehicles = vehicles.filter((vehicle) =>
      vehicle.responsibles?.some((r) => r.userId === args.userId)
    );

    return {
      totalAssigned: userVehicles.length,
      inProgress: userVehicles.filter((v) =>
        v.responsibles?.some((r) => r.userId === args.userId && r.isWorking)
      ).length,
      completed: userVehicles.filter((v) => v.status === "Listo").length,
      vehicles: userVehicles.map((v) => ({
        id: v._id,
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        status: v.status,
        services: v.services,
        owner: v.owner,
        isUserWorking:
          v.responsibles?.find((r) => r.userId === args.userId)?.isWorking ||
          false,
      })),
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

      const oldTotalVehicles = oldCustomerVehicles.filter(
        (v) => v._id !== args.vehicleId
      ).length;
      const oldTotalSpent = oldCustomerVehicles
        .filter((v) => v._id !== args.vehicleId)
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
    const newTotalSpent = newCustomerVehicles.reduce(
      (sum, v) => sum + v.cost,
      0
    );
    const lastVisit = newCustomerVehicles.sort(
      (a, b) =>
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
    )[0]?.entryDate;

    await ctx.db.patch(args.customerId, {
      totalVehicles: newTotalVehicles,
      totalSpent: newTotalSpent,
      lastVisit,
      visitCount: newTotalVehicles,
    });

    return args.vehicleId;
  },
});

// Desvincular vehículo de cliente
export const removeCustomerFromVehicle = mutation({
  args: {
    vehicleId: v.id("vehicles"),
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);

    if (!vehicle) throw new Error("Vehículo no encontrado");
    if (!vehicle.customerId) throw new Error("El vehículo no tiene cliente asociado");

    const oldCustomerId = vehicle.customerId;

    // Remover customerId del vehículo
    await ctx.db.patch(args.vehicleId, {
      customerId: undefined,
    });

    // Actualizar métricas del cliente anterior
    const oldCustomerVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_customer", (q) => q.eq("customerId", oldCustomerId))
      .collect();

    const oldTotalVehicles = oldCustomerVehicles.filter(
      (v) => v._id !== args.vehicleId
    ).length;
    const oldTotalSpent = oldCustomerVehicles
      .filter((v) => v._id !== args.vehicleId)
      .reduce((sum, v) => sum + v.cost, 0);

    const lastVisit =
      oldTotalVehicles > 0
        ? oldCustomerVehicles
            .filter((v) => v._id !== args.vehicleId)
            .sort(
              (a, b) =>
                new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
            )[0].entryDate
        : undefined;

    await ctx.db.patch(oldCustomerId, {
      totalVehicles: oldTotalVehicles,
      totalSpent: oldTotalSpent,
      lastVisit,
      visitCount: oldTotalVehicles,
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
          hasCustomer: !!vehicle.customerId,
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
    isAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let vehicles = await ctx.db.query("vehicles").collect();

    // Normalizar las fechas para comparación correcta
    const startDateNormalized = args.startDate.split('T')[0]; // Asegurar formato YYYY-MM-DD
    const endDateNormalized = args.endDate.split('T')[0]; // Asegurar formato YYYY-MM-DD

    // Filtrar por rango de fechas (fecha de ingreso)
    vehicles = vehicles.filter((vehicle) => {
      if (!vehicle.entryDate) return false;
      
      try {
        // Normalizar entryDate: puede venir como ISO string completo o solo fecha
        let entryDateStr: string;
        if (typeof vehicle.entryDate === 'string') {
          // Si es string, extraer solo la parte de la fecha (YYYY-MM-DD)
          entryDateStr = vehicle.entryDate.split('T')[0];
        } else {
          // Si es otro tipo, intentar convertir a string primero
          entryDateStr = new Date(vehicle.entryDate).toISOString().split('T')[0];
        }
        
        // Validar que la fecha tenga el formato correcto (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDateStr)) {
          return false;
        }
        
        // Comparar fechas normalizadas: la fecha debe estar entre startDate y endDate (inclusive)
        return entryDateStr >= startDateNormalized && entryDateStr <= endDateNormalized;
      } catch (error) {
        // Si hay error al procesar la fecha, excluir el vehículo
        return false;
      }
    });

    // Si no es admin, filtrar solo vehículos asignados al usuario o sin asignar
    // Si isAdmin es true o undefined, mostrar todos los vehículos del rango de fechas
    if (args.userId && args.isAdmin === false) {
      vehicles = vehicles.filter((vehicle) => {
        // Sin responsables asignados (está libre para tomar)
        if (!vehicle.responsibles || vehicle.responsibles.length === 0) {
          return true;
        }

        // Si el usuario está entre los responsables asignados
        return vehicle.responsibles.some((r: any) => r.userId === args.userId);
      });
    }

    return vehicles.sort(
      (a, b) =>
        new Date(b.lastUpdated || b.entryDate).getTime() -
        new Date(a.lastUpdated || a.entryDate).getTime()
    );
  },
});

// Obtener estadísticas de vehículos filtradas por fechas
export const getVehicleStatsByDateRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const allVehicles = await ctx.db.query("vehicles").collect();

    // Filtrar por rango de fechas (fecha de ingreso)
    // Normalizar las fechas para comparación correcta
    const startDateNormalized = args.startDate.split('T')[0]; // Asegurar formato YYYY-MM-DD
    const endDateNormalized = args.endDate.split('T')[0]; // Asegurar formato YYYY-MM-DD

    const vehicles = allVehicles.filter((vehicle) => {
      if (!vehicle.entryDate) return false;
      
      // Extraer solo la fecha (YYYY-MM-DD) del entryDate (puede ser ISO completo o solo fecha)
      const entryDateStr = vehicle.entryDate.split('T')[0];
      
      // Comparar fechas normalizadas: la fecha debe estar entre startDate y endDate (inclusive)
      return entryDateStr >= startDateNormalized && entryDateStr <= endDateNormalized;
    });

    return {
      total: vehicles.length,
      inTaller: vehicles.filter(
        (v) =>
          v.inTaller === true ||
          (v.inTaller === undefined &&
            v.status !== "Entregado" &&
            v.status !== "Suspendido")
      ).length,
      outOfTaller: vehicles.filter(
        (v) =>
          v.inTaller === false ||
          (v.inTaller === undefined &&
            (v.status === "Entregado" || v.status === "Suspendido"))
      ).length,
      byStatus: {
        ingresados: vehicles.filter((v) => v.status === "Ingresado").length,
        enReparacion: vehicles.filter((v) => v.status === "En Reparación")
          .length,
        listos: vehicles.filter((v) => v.status === "Listo").length,
        entregados: vehicles.filter((v) => v.status === "Entregado").length,
        suspendidos: vehicles.filter((v) => v.status === "Suspendido").length,
      },
      totalEarnings: vehicles
        .filter((v) => v.status === "Entregado")
        .reduce((sum, v) => sum + v.cost, 0),
      averageCost:
        vehicles.length > 0
          ? vehicles.reduce((sum, v) => sum + v.cost, 0) / vehicles.length
          : 0,
      dateRange: {
        startDate: args.startDate,
        endDate: args.endDate,
      },
    };
  },
});

// Función de migración para corregir vehículos entregados
export const fixDeliveredVehicles = mutation({
  args: {},
  handler: async (ctx) => {
    const allVehicles = await ctx.db.query("vehicles").collect();
    let updated = 0;

    for (const vehicle of allVehicles) {
      // Si el vehículo está "Entregado" o "Suspendido" pero inTaller es true, corregirlo
      if (
        (vehicle.status === "Entregado" || vehicle.status === "Suspendido") &&
        vehicle.inTaller !== false
      ) {
        await ctx.db.patch(vehicle._id, {
          inTaller: false,
          exitDate: vehicle.exitDate || new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        });
        updated++;
      }
    }

    return {
      updated,
      message: `Se actualizaron ${updated} vehículos entregados/suspendidos`,
    };
  },
});

// Obtener historial completo de un vehículo por placa
// Esto incluye todas las veces que el vehículo ha ingresado al taller
export const getVehicleHistoryByPlate = query({
  args: {
    plate: v.string(),
  },
  handler: async (ctx, args) => {
    // Buscar todos los vehículos con la misma placa
    const allVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_plate", (q) => q.eq("plate", args.plate))
      .collect();

    if (allVehicles.length === 0) {
      return null;
    }

    // Ordenar por fecha de ingreso (más reciente primero)
    const sortedVehicles = allVehicles.sort(
      (a, b) =>
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
    );

    // Obtener información del cliente si existe
    const firstVehicle = sortedVehicles[0];
    const customer = firstVehicle.customerId
      ? await ctx.db.get(firstVehicle.customerId)
      : null;

    // Calcular estadísticas del historial
    const totalVisits = sortedVehicles.length;
    const totalSpent = sortedVehicles.reduce((sum, v) => sum + v.cost, 0);
    const deliveredVisits = sortedVehicles.filter(
      (v) => v.status === "Entregado"
    ).length;

    return {
      plate: args.plate,
      vehicleInfo: {
        brand: firstVehicle.brand,
        model: firstVehicle.model,
        year: firstVehicle.year,
        owner: firstVehicle.owner,
        phone: firstVehicle.phone,
        customer,
      },
      visits: await Promise.all(sortedVehicles.map(async (vehicle) => {
        // Buscar fotos del historial de WhatsApp para esta visita
        const historialEntry = await ctx.db
          .query("historial_taller")
          .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicle._id))
          .first();

        const fotoUrls: string[] = [];
        const fotoStorageIds: string[] = [];
        if (historialEntry && historialEntry.fotoIds.length > 0) {
          const urls = await Promise.all(
            historialEntry.fotoIds.map((id) => ctx.storage.getUrl(id))
          );
          for (let i = 0; i < urls.length; i++) {
            if (urls[i]) {
              fotoUrls.push(urls[i]!);
              fotoStorageIds.push(historialEntry.fotoIds[i]);
            }
          }
        }

        return {
          id: vehicle._id,
          entryDate: vehicle.entryDate,
          exitDate: vehicle.exitDate,
          status: vehicle.status,
          services: vehicle.services,
          cost: vehicle.cost,
          mileage: vehicle.mileage,
          description: vehicle.description,
          inTaller: vehicle.inTaller,
          lastUpdated: vehicle.lastUpdated,
          costs: vehicle.costs,
          parts: vehicle.parts,
          responsibles: vehicle.responsibles,
          fotoUrls,
          fotoStorageIds,
          duration: vehicle.exitDate
            ? Math.ceil(
                (new Date(vehicle.exitDate).getTime() -
                  new Date(vehicle.entryDate).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
        };
      })),
      statistics: {
        totalVisits,
        totalSpent,
        deliveredVisits,
        averageCost: totalVisits > 0 ? totalSpent / totalVisits : 0,
        firstVisit: sortedVehicles[sortedVehicles.length - 1]?.entryDate,
        lastVisit: sortedVehicles[0]?.entryDate,
      },
    };
  },
});

// Obtener todas las placas únicas con sus vehículos
export const getAllVehiclePlates = query({
  args: {},
  handler: async (ctx) => {
    const allVehicles = await ctx.db.query("vehicles").collect();
    
    // Agrupar por placa
    const platesMap = new Map<string, any[]>();
    
    for (const vehicle of allVehicles) {
      if (!platesMap.has(vehicle.plate)) {
        platesMap.set(vehicle.plate, []);
      }
      platesMap.get(vehicle.plate)!.push(vehicle);
    }

    // Convertir a array y calcular estadísticas
    const plates = Array.from(platesMap.entries()).map(([plate, vehicles]) => {
      const sortedVehicles = vehicles.sort(
        (a, b) =>
          new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
      );
      const latestVehicle = sortedVehicles[0];
      
      return {
        plate,
        vehicleInfo: {
          brand: latestVehicle.brand,
          model: latestVehicle.model,
          year: latestVehicle.year,
          owner: latestVehicle.owner,
        },
        visitCount: vehicles.length,
        totalSpent: vehicles.reduce((sum, v) => sum + v.cost, 0),
        lastVisit: latestVehicle.entryDate,
        isInTaller: latestVehicle.inTaller || false,
      };
    });

    return plates.sort(
      (a, b) =>
        new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
    );
  },
});

// Crear una nueva entrada para un vehículo existente
// Busca el vehículo más reciente con esa placa y crea un nuevo registro
export const createNewEntryForExistingVehicle = mutation({
  args: {
    plate: v.string(),
    services: v.array(v.string()),
    cost: v.number(),
    description: v.optional(v.string()),
    mileage: v.optional(v.number()),
    entryDate: v.optional(v.string()),
    responsibles: v.optional(
      v.array(
        v.object({
          name: v.string(),
          assignedAt: v.string(),
          role: v.optional(v.string()),
          userId: v.optional(v.string()),
          isAdmin: v.optional(v.boolean()),
          isWorking: v.optional(v.boolean()),
          workStartedAt: v.optional(v.string()),
          totalWorkTime: v.optional(v.number()),
          workSessions: v.optional(
            v.array(
              v.object({
                startTime: v.string(),
                endTime: v.optional(v.string()),
                duration: v.optional(v.number()),
              })
            )
          ),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    // Buscar el vehículo más reciente con esa placa
    const existingVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_plate", (q) => q.eq("plate", args.plate))
      .collect();

    if (existingVehicles.length === 0) {
      throw new Error(`No se encontró ningún vehículo con la placa ${args.plate}`);
    }

    // Ordenar por fecha de ingreso (más reciente primero)
    const sortedVehicles = existingVehicles.sort(
      (a, b) =>
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
    );

    const latestVehicle = sortedVehicles[0];

    // Crear nuevo registro con los mismos datos básicos pero nueva fecha de ingreso
    const entryDate = args.entryDate || new Date().toISOString();
    const isInTaller = true; // Siempre está en taller cuando se crea nueva entrada

    const vehicleId = await ctx.db.insert("vehicles", {
      plate: latestVehicle.plate,
      brand: latestVehicle.brand,
      model: latestVehicle.model,
      year: latestVehicle.year,
      owner: latestVehicle.owner,
      phone: latestVehicle.phone,
      customerId: latestVehicle.customerId,
      status: "Ingresado",
      entryDate,
      services: args.services,
      cost: args.cost,
      description: args.description,
      mileage: args.mileage,
      inTaller: isInTaller,
      exitDate: undefined,
      lastUpdated: entryDate,
      responsibles: args.responsibles,
    });

    // Actualizar métricas del cliente si existe
    if (latestVehicle.customerId) {
      const customerVehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_customer", (q) => q.eq("customerId", latestVehicle.customerId))
        .collect();

      const totalVehicles = customerVehicles.length;
      const totalSpent = customerVehicles.reduce(
        (sum, vehicle) => sum + vehicle.cost,
        0
      );

      await ctx.db.patch(latestVehicle.customerId, {
        totalVehicles,
        totalSpent,
        lastVisit: entryDate,
        visitCount: totalVehicles,
      });
    }

    return vehicleId;
  },
});

// Buscar vehículo por placa (para autocompletar)
export const searchVehicleByPlate = query({
  args: {
    plate: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.plate || args.plate.length < 2) {
      return null;
    }

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_plate", (q) => q.eq("plate", args.plate))
      .collect();

    if (vehicles.length === 0) {
      return null;
    }

    // Retornar el vehículo más reciente con esa placa
    const sortedVehicles = vehicles.sort(
      (a, b) =>
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
    );

    const latestVehicle = sortedVehicles[0];
    const customer = latestVehicle.customerId
      ? await ctx.db.get(latestVehicle.customerId)
      : null;

    return {
      plate: latestVehicle.plate,
      brand: latestVehicle.brand,
      model: latestVehicle.model,
      year: latestVehicle.year,
      owner: latestVehicle.owner,
      phone: latestVehicle.phone,
      customerId: latestVehicle.customerId,
      customer,
      visitCount: vehicles.length,
    };
  },
});
