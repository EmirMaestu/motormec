import { mutation } from "./_generated/server";

// Función de migración para inicializar el módulo de clientes
export const initializeCustomersModule = mutation({
  handler: async (ctx) => {
    // 1. Verificar si ya existe el ítem de navegación de clientes
    const existingNavItem = await ctx.db
      .query("navigationItems")
      .filter((q) => q.eq(q.field("url"), "/clientes"))
      .first();

    if (!existingNavItem) {
      // Obtener el orden más alto actual
      const allItems = await ctx.db.query("navigationItems").collect();
      const maxOrder = Math.max(...allItems.map(item => item.order), 0);

      // Crear el ítem de navegación para clientes
      await ctx.db.insert("navigationItems", {
        title: "Clientes",
        url: "/clientes",
        icon: "Users",
        color: "text-purple-600",
        order: maxOrder + 1,
        active: true,
      });
    }

    // 2. Migrar vehículos existentes a clientes
    const vehiclesWithoutCustomer = await ctx.db
      .query("vehicles")
      .filter((q) => q.eq(q.field("customerId"), undefined))
      .collect();

    let createdCustomers = 0;
    let updatedVehicles = 0;

    for (const vehicle of vehiclesWithoutCustomer) {
      if (vehicle.phone) {
        // Buscar si ya existe un cliente con este teléfono
        let customer = await ctx.db
          .query("customers")
          .withIndex("by_phone", (q) => q.eq("phone", vehicle.phone))
          .filter((q) => q.eq(q.field("active"), true))
          .first();

        // Si no existe, crear nuevo cliente
        if (!customer) {
          const customerId = await ctx.db.insert("customers", {
            name: vehicle.owner,
            phone: vehicle.phone,
            createdAt: vehicle.entryDate, // Usar fecha de entrada del primer vehículo
            active: true,
            totalVehicles: 0,
            totalSpent: 0,
            visitCount: 0,
          });
          
          customer = await ctx.db.get(customerId);
          createdCustomers++;
        }

        if (customer) {
          // Asignar vehículo al cliente
          await ctx.db.patch(vehicle._id, {
            customerId: customer._id,
          });
          updatedVehicles++;
        }
      }
    }

    // 3. Actualizar métricas de todos los clientes
    const allCustomers = await ctx.db
      .query("customers")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();

    let updatedCustomers = 0;

    for (const customer of allCustomers) {
      const customerVehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_customer", (q) => q.eq("customerId", customer._id))
        .collect();

      const totalVehicles = customerVehicles.length;
      const totalSpent = customerVehicles.reduce((sum, vehicle) => sum + vehicle.cost, 0);
      
      const lastVisit = customerVehicles.length > 0 
        ? customerVehicles.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())[0].entryDate
        : undefined;

      await ctx.db.patch(customer._id, {
        totalVehicles,
        totalSpent,
        lastVisit,
        visitCount: totalVehicles,
      });
      updatedCustomers++;
    }

    return {
      success: true,
      message: "Módulo de clientes inicializado correctamente",
      stats: {
        createdCustomers,
        updatedVehicles,
        updatedCustomers,
        totalCustomers: allCustomers.length
      }
    };
  },
});