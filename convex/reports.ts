import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// 💰 REPORTES FINANCIEROS
// ============================================

export const getFinancialReport = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    customerId: v.optional(v.id("customers")),
    category: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let transactionsQuery = ctx.db.query("transactions");
    let transactions = await transactionsQuery.collect();

    // Filtrar por rango de fechas
    if (args.startDate || args.endDate) {
      transactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        if (args.startDate && tDate < new Date(args.startDate)) return false;
        if (args.endDate && tDate > new Date(args.endDate)) return false;
        return true;
      });
    }

    // Filtrar por categoría
    if (args.category) {
      transactions = transactions.filter(t => t.category === args.category);
    }

    // Filtrar por método de pago
    if (args.paymentMethod) {
      transactions = transactions.filter(t => t.paymentMethod === args.paymentMethod);
    }

    // Filtrar solo transacciones activas
    transactions = transactions.filter(t => t.active !== false);

    const ingresos = transactions
      .filter(t => t.type === "Ingreso")
      .reduce((sum, t) => sum + t.amount, 0);

    const egresos = transactions
      .filter(t => t.type === "Egreso")
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = ingresos - egresos;

    // Agrupar por categoría - Usar Map para evitar problemas con caracteres especiales
    const categoriasMap = new Map<string, { ingresos: number; egresos: number; count: number }>();
    transactions.forEach(t => {
      const existing = categoriasMap.get(t.category) || { ingresos: 0, egresos: 0, count: 0 };
      if (t.type === "Ingreso") {
        existing.ingresos += t.amount;
      } else {
        existing.egresos += t.amount;
      }
      existing.count++;
      categoriasMap.set(t.category, existing);
    });
    const porCategoria = Array.from(categoriasMap.entries()).map(([categoria, data]) => ({
      categoria,
      ...data,
    }));

    // Agrupar por método de pago - Usar Map
    const metodosPagoMap = new Map<string, { total: number; count: number }>();
    transactions.forEach(t => {
      const metodo = t.paymentMethod || "No especificado";
      const existing = metodosPagoMap.get(metodo) || { total: 0, count: 0 };
      existing.total += t.amount;
      existing.count++;
      metodosPagoMap.set(metodo, existing);
    });
    const porMetodoPago = Array.from(metodosPagoMap.entries()).map(([metodo, data]) => ({
      metodo,
      ...data,
    }));

    // Tendencia mensual - Usar Map
    const mesesMap = new Map<string, { ingresos: number; egresos: number; balance: number }>();
    transactions.forEach(t => {
      const mes = t.date.substring(0, 7); // YYYY-MM
      const existing = mesesMap.get(mes) || { ingresos: 0, egresos: 0, balance: 0 };
      if (t.type === "Ingreso") {
        existing.ingresos += t.amount;
      } else {
        existing.egresos += t.amount;
      }
      existing.balance = existing.ingresos - existing.egresos;
      mesesMap.set(mes, existing);
    });

    return {
      resumen: {
        ingresos,
        egresos,
        balance,
        cantidadTransacciones: transactions.length,
        ticketPromedio: transactions.length > 0 ? ingresos / transactions.filter(t => t.type === "Ingreso").length : 0,
      },
      detalle: transactions,
      porCategoria,
      porMetodoPago,
      tendenciaMensual: Array.from(mesesMap.entries())
        .map(([mes, data]) => ({
          mes,
          ...data,
        }))
        .sort((a, b) => a.mes.localeCompare(b.mes)),
    };
  },
});

export const getIncomesBySource = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {
    const vehicles = await ctx.db.query("vehicles").collect();

    // Ingresos por vehículos entregados
    const ingresosVehiculos = vehicles
      .filter(v => v.status === "Entregado" || v.inTaller === false)
      .reduce((sum, v) => sum + v.cost, 0);

    // Ingresos por servicios - Usar Map
    const serviciosMap = new Map<string, { total: number; cantidad: number }>();
    vehicles.forEach(v => {
      if (v.status === "Entregado" || v.inTaller === false) {
        v.services.forEach(servicio => {
          const existing = serviciosMap.get(servicio) || { total: 0, cantidad: 0 };
          existing.total += v.cost / v.services.length;
          existing.cantidad++;
          serviciosMap.set(servicio, existing);
        });
      }
    });

    return {
      ingresosVehiculos,
      ingresosPorServicio: Array.from(serviciosMap.entries())
        .map(([servicio, data]) => ({
          servicio,
          ...data,
        }))
        .sort((a, b) => b.total - a.total),
    };
  },
});

// ============================================
// 👥 REPORTES DE CLIENTES
// ============================================

export const getCustomerReport = query({
  args: {
    customerId: v.optional(v.id("customers")),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let customers = await ctx.db.query("customers")
      .filter(q => q.eq(q.field("active"), true))
      .collect();

    if (args.customerId) {
      customers = customers.filter(c => c._id === args.customerId);
    }

    const customersWithDetails = await Promise.all(
      customers.map(async (customer) => {
        const vehicles = await ctx.db.query("vehicles")
          .withIndex("by_customer", q => q.eq("customerId", customer._id))
          .collect();

        let filteredVehicles = vehicles;
        if (args.startDate || args.endDate) {
          filteredVehicles = vehicles.filter(v => {
            const vDate = new Date(v.entryDate);
            if (args.startDate && vDate < new Date(args.startDate)) return false;
            if (args.endDate && vDate > new Date(args.endDate)) return false;
            return true;
          });
        }

        const totalGastado = filteredVehicles.reduce((sum, v) => sum + v.cost, 0);
        const vehiculosEntregados = filteredVehicles.filter(v => v.status === "Entregado").length;
        
        // Servicios más frecuentes - Usar Map
        const serviciosMap = new Map<string, number>();
        filteredVehicles.forEach(v => {
          v.services.forEach(s => {
            serviciosMap.set(s, (serviciosMap.get(s) || 0) + 1);
          });
        });

        return {
          ...customer,
          totalGastado,
          cantidadVehiculos: filteredVehicles.length,
          vehiculosEntregados,
          vehiculosEnTaller: filteredVehicles.filter(v => v.inTaller).length,
          serviciosMasFrecuentes: Array.from(serviciosMap.entries())
            .map(([servicio, count]) => ({ servicio, count }))
            .sort((a, b) => b.count - a.count),
          vehiculos: filteredVehicles,
        };
      })
    );

    // Ordenar por total gastado
    customersWithDetails.sort((a, b) => b.totalGastado - a.totalGastado);

    return {
      clientes: customersWithDetails,
      resumen: {
        totalClientes: customersWithDetails.length,
        ingresosTotal: customersWithDetails.reduce((sum, c) => sum + c.totalGastado, 0),
        promedioPorCliente: customersWithDetails.length > 0 
          ? customersWithDetails.reduce((sum, c) => sum + c.totalGastado, 0) / customersWithDetails.length 
          : 0,
        clientesActivos: customersWithDetails.filter(c => c.vehiculosEnTaller > 0).length,
      },
    };
  },
});

export const getVehicleReport = query({
  args: {
    vehicleId: v.optional(v.id("vehicles")),
    plate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let vehicle;
    
    if (args.vehicleId) {
      vehicle = await ctx.db.get(args.vehicleId);
    } else if (args.plate) {
      const vehicles = await ctx.db.query("vehicles")
        .withIndex("by_plate", q => q.eq("plate", args.plate!))
        .collect();
      vehicle = vehicles[0];
    }

    if (!vehicle) {
      return null;
    }

    // Obtener historial de movimientos
    const movements = await ctx.db.query("vehicleMovements")
      .filter(q => q.eq(q.field("vehicleId"), vehicle._id))
      .collect();

    // Obtener información del cliente
    let customer = null;
    if (vehicle.customerId) {
      customer = await ctx.db.get(vehicle.customerId);
    }

    // Calcular estadísticas
    const tiempoTotal = vehicle.responsibles?.reduce((total, r) => 
      total + (r.totalWorkTime || 0), 0
    ) || 0;

    const sesionesTotal = vehicle.responsibles?.reduce((total, r) => 
      total + (r.workSessions?.length || 0), 0
    ) || 0;

    return {
      vehiculo: vehicle,
      cliente: customer,
      historial: movements.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
      estadisticas: {
        tiempoTotalTrabajo: tiempoTotal,
        sesionesTotal: sesionesTotal,
        cantidadMecanicos: vehicle.responsibles?.length || 0,
        costosDetallados: vehicle.costs || {
          laborCost: 0,
          partsCost: 0,
          totalCost: vehicle.cost,
        },
        repuestos: vehicle.parts || [],
      },
    };
  },
});

// ============================================
// 📦 REPORTES DE INVENTARIO
// ============================================

export const getInventoryReport = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    productType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db.query("products").collect();
    const movements = await ctx.db.query("inventoryMovements").collect();

    let filteredMovements = movements;
    if (args.startDate || args.endDate) {
      filteredMovements = movements.filter(m => {
        const mDate = new Date(m.timestamp);
        if (args.startDate && mDate < new Date(args.startDate)) return false;
        if (args.endDate && mDate > new Date(args.endDate)) return false;
        return true;
      });
    }

    if (args.productType) {
      filteredMovements = filteredMovements.filter(m => m.productType === args.productType);
    }

    const valorTotalInventario = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const productosBajoStock = products.filter(p => p.lowStock).length;
    const productosSinStock = products.filter(p => p.quantity === 0).length;

    // Movimientos por tipo - Usar Map
    const tiposMap = new Map<string, { count: number; productos: Set<string> }>();
    filteredMovements.forEach(m => {
      const existing = tiposMap.get(m.movementType) || { count: 0, productos: new Set() };
      existing.count++;
      existing.productos.add(m.productName);
      tiposMap.set(m.movementType, existing);
    });

    // Productos más utilizados - Usar Map
    const productosMap = new Map<string, { cantidad: number; veces: number }>();
    filteredMovements
      .filter(m => m.movementType === "stock_decrease")
      .forEach(m => {
        const existing = productosMap.get(m.productName) || { cantidad: 0, veces: 0 };
        existing.cantidad += Math.abs(m.quantityChange || 0);
        existing.veces++;
        productosMap.set(m.productName, existing);
      });

    return {
      resumen: {
        totalProductos: products.length,
        valorTotalInventario,
        productosBajoStock,
        productosSinStock,
        totalMovimientos: filteredMovements.length,
      },
      productos: products,
      movimientos: filteredMovements.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
      movimientosPorTipo: Array.from(tiposMap.entries()).map(([tipo, data]) => ({
        tipo,
        count: data.count,
        productosUnicos: data.productos.size,
      })),
      productosUtilizados: Array.from(productosMap.entries())
        .map(([nombre, data]) => ({ nombre, ...data }))
        .sort((a, b) => b.cantidad - a.cantidad),
    };
  },
});

// ============================================
// 👨‍🔧 REPORTES DE MECÁNICOS
// ============================================

export const getMechanicsReport = query({
  args: {
    userId: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const vehicles = await ctx.db.query("vehicles").collect();

    // Agrupar por mecánico
    const mecanicosStats: any = {};

    vehicles.forEach(vehicle => {
      vehicle.responsibles?.forEach(responsible => {
        const userId = responsible.userId || responsible.name;
        if (args.userId && userId !== args.userId) return;

        if (!mecanicosStats[userId]) {
          mecanicosStats[userId] = {
            userId,
            nombre: responsible.name,
            vehiculosAtendidos: new Set(),
            tiempoTotal: 0,
            sesionesTotal: 0,
            ingresosGenerados: 0,
          };
        }

        mecanicosStats[userId].vehiculosAtendidos.add(vehicle._id);
        mecanicosStats[userId].tiempoTotal += responsible.totalWorkTime || 0;
        mecanicosStats[userId].sesionesTotal += responsible.workSessions?.length || 0;
        
        if (vehicle.status === "Entregado") {
          // Dividir costo entre todos los mecánicos
          const numMecanicos = vehicle.responsibles?.length || 1;
          mecanicosStats[userId].ingresosGenerados += vehicle.cost / numMecanicos;
        }
      });
    });

    const mecanicos = Object.values(mecanicosStats).map((m: any) => ({
      ...m,
      vehiculosAtendidos: m.vehiculosAtendidos.size,
      tiempoPromedio: m.vehiculosAtendidos.size > 0 
        ? m.tiempoTotal / m.vehiculosAtendidos.size 
        : 0,
    })).sort((a: any, b: any) => b.ingresosGenerados - a.ingresosGenerados);

    return {
      mecanicos,
      resumen: {
        totalMecanicos: mecanicos.length,
        tiempoTotalTrabajado: mecanicos.reduce((sum: number, m: any) => sum + m.tiempoTotal, 0),
        vehiculosTotalAtendidos: vehicles.length,
        ingresosTotales: mecanicos.reduce((sum: number, m: any) => sum + m.ingresosGenerados, 0),
      },
    };
  },
});

// ============================================
// 🤝 REPORTES DE SOCIOS
// ============================================

export const getPartnersReport = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const partners = await ctx.db.query("partners")
      .filter(q => q.eq(q.field("active"), true))
      .collect();

    const transactions = await ctx.db.query("transactions")
      .filter(q => q.eq(q.field("active"), true))
      .collect();

    let filteredTransactions = transactions;
    if (args.startDate || args.endDate) {
      filteredTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        if (args.startDate && tDate < new Date(args.startDate)) return false;
        if (args.endDate && tDate > new Date(args.endDate)) return false;
        return true;
      });
    }

    const ingresos = filteredTransactions
      .filter(t => t.type === "Ingreso")
      .reduce((sum, t) => sum + t.amount, 0);

    const egresos = filteredTransactions
      .filter(t => t.type === "Egreso")
      .reduce((sum, t) => sum + t.amount, 0);

    const gananciasPeriodo = ingresos - egresos;

    const sociosConDistribucion = partners.map(partner => ({
      ...partner,
      gananciaPeriodo: (gananciasPeriodo * partner.investmentPercentage) / 100,
      porcentajeInversion: partner.investmentPercentage,
    }));

    return {
      socios: sociosConDistribucion,
      resumen: {
        totalSocios: partners.length,
        inversionTotal: partners.reduce((sum, p) => sum + p.totalContributed, 0),
        gananciasPeriodo,
        ingresosPeriodo: ingresos,
        egresosPeriodo: egresos,
      },
    };
  },
});

// ============================================
// 🚗 REPORTES OPERACIONALES
// ============================================

export const getOperationalReport = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let vehicles = await ctx.db.query("vehicles").collect();

    if (args.startDate || args.endDate) {
      vehicles = vehicles.filter(v => {
        const vDate = new Date(v.entryDate);
        if (args.startDate && vDate < new Date(args.startDate)) return false;
        if (args.endDate && vDate > new Date(args.endDate)) return false;
        return true;
      });
    }

    // Vehículos por estado - Retornar como array para evitar problemas con caracteres especiales
    const estadosMap = new Map<string, number>();
    vehicles.forEach(v => {
      estadosMap.set(v.status, (estadosMap.get(v.status) || 0) + 1);
    });
    const porEstado = Array.from(estadosMap.entries()).map(([estado, cantidad]) => ({
      estado,
      cantidad,
    }));

    // Servicios más frecuentes - Retornar como array
    const serviciosMap = new Map<string, { count: number; ingresos: number }>();
    vehicles.forEach(v => {
      v.services.forEach(s => {
        const existing = serviciosMap.get(s) || { count: 0, ingresos: 0 };
        serviciosMap.set(s, {
          count: existing.count + 1,
          ingresos: existing.ingresos + (v.cost / v.services.length),
        });
      });
    });

    // Tiempo promedio por estado - Retornar como array
    const tiemposPorEstadoMap = new Map<string, number[]>();
    vehicles.forEach(v => {
      const entryDate = new Date(v.entryDate);
      const exitDate = v.exitDate ? new Date(v.exitDate) : new Date();
      const diasEnTaller = Math.ceil((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const existing = tiemposPorEstadoMap.get(v.status) || [];
      tiemposPorEstadoMap.set(v.status, [...existing, diasEnTaller]);
    });

    const promediosPorEstado = Array.from(tiemposPorEstadoMap.entries()).map(([estado, dias]) => ({
      estado,
      promedioDias: dias.reduce((a, b) => a + b, 0) / dias.length,
    }));

    return {
      resumen: {
        totalVehiculos: vehicles.length,
        vehiculosEnTaller: vehicles.filter(v => v.inTaller).length,
        vehiculosEntregados: vehicles.filter(v => v.status === "Entregado").length,
        ingresosTotales: vehicles.reduce((sum, v) => sum + v.cost, 0),
      },
      porEstado,
      serviciosMasFrecuentes: Array.from(serviciosMap.entries())
        .map(([servicio, data]) => ({ servicio, count: data.count, ingresos: data.ingresos }))
        .sort((a, b) => b.count - a.count),
      tiemposPromedio: promediosPorEstado,
    };
  },
});

// ============================================
// 📈 REPORTES ESTRATÉGICOS
// ============================================

export const getStrategicReport = query({
  args: {},
  handler: async (ctx) => {
    const customers = await ctx.db.query("customers")
      .filter(q => q.eq(q.field("active"), true))
      .collect();
    const vehicles = await ctx.db.query("vehicles").collect();
    const transactions = await ctx.db.query("transactions")
      .filter(q => q.eq(q.field("active"), true))
      .collect();

    // Clientes más rentables
    const clientesRentables = customers
      .map(c => ({
        ...c,
        totalGastado: c.totalSpent || 0,
        cantidadVehiculos: c.totalVehicles || 0,
      }))
      .sort((a, b) => b.totalGastado - a.totalGastado)
      .slice(0, 10);

    // Clientes en riesgo (no han regresado en 90+ días)
    const hoy = new Date();
    const clientesEnRiesgo = customers.filter(c => {
      if (!c.lastVisit) return false;
      const ultimaVisita = new Date(c.lastVisit);
      const diasSinVisita = Math.ceil((hoy.getTime() - ultimaVisita.getTime()) / (1000 * 60 * 60 * 24));
      return diasSinVisita > 90 && c.visitCount && c.visitCount > 1;
    });

    // Servicios con mayor margen - Usar Map
    const serviciosMap = new Map<string, { total: number; count: number }>();
    vehicles.forEach(v => {
      if (v.status === "Entregado") {
        v.services.forEach(s => {
          const existing = serviciosMap.get(s) || { total: 0, count: 0 };
          existing.total += v.cost / v.services.length;
          existing.count++;
          serviciosMap.set(s, existing);
        });
      }
    });

    const serviciosRentables = Array.from(serviciosMap.entries())
      .map(([servicio, data]) => ({
        servicio,
        ingresoTotal: data.total,
        cantidad: data.count,
        promedio: data.total / data.count,
      }))
      .sort((a, b) => b.ingresoTotal - a.ingresoTotal);

    // Tasa de retención
    const clientesConMultiplesVisitas = customers.filter(c => (c.visitCount || 0) > 1).length;
    const tasaRetencion = customers.length > 0 
      ? (clientesConMultiplesVisitas / customers.length) * 100 
      : 0;

    // Predicción de ingresos (basado en tendencia de últimos 3 meses)
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
    
    const ingresosRecientes = transactions
      .filter(t => t.type === "Ingreso" && new Date(t.date) >= tresMesesAtras)
      .reduce((sum, t) => sum + t.amount, 0);

    const promedioMensual = ingresosRecientes / 3;

    return {
      clientesRentables,
      clientesEnRiesgo: clientesEnRiesgo.length,
      serviciosRentables,
      kpis: {
        tasaRetencion: tasaRetencion.toFixed(2),
        ticketPromedio: vehicles.length > 0 
          ? vehicles.reduce((sum, v) => sum + v.cost, 0) / vehicles.length 
          : 0,
        clientesNuevos: customers.filter(c => {
          const createdDate = new Date(c.createdAt);
          return createdDate >= tresMesesAtras;
        }).length,
        prediccionIngresosMensual: promedioMensual,
      },
    };
  },
});

// ============================================
// 📋 REPORTES BÁSICOS (Mantener compatibilidad)
// ============================================

export const getReports = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("reports").collect();
  },
});

export const getReportsByType = query({
  args: { type: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reports")
      .filter((q) => q.eq(q.field("type"), args.type))
      .collect();
  },
});

export const createReport = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    type: v.string(),
    lastGenerated: v.string(),
    status: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const reportId = await ctx.db.insert("reports", args);
    return reportId;
  },
});

export const updateReport = mutation({
  args: {
    id: v.id("reports"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.string()),
    lastGenerated: v.optional(v.string()),
    status: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const deleteReport = mutation({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const generateReport = mutation({
  args: {
    reportId: v.id("reports"),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const currentDate = new Date().toISOString().split('T')[0];
    
    await ctx.db.patch(args.reportId, {
      lastGenerated: currentDate,
      status: "available",
      data: args.data,
    });
    
    return args.reportId;
  },
});

// ============================================
// 📋 PLANTILLAS DE REPORTES
// ============================================

export const getReportTemplates = query({
  args: {},
  handler: async (_ctx) => {
    // Por ahora devolvemos plantillas predefinidas
    // En el futuro se podrían guardar en la base de datos
    return [
      {
        id: "financial-monthly",
        name: "Reporte Financiero Mensual",
        description: "Ingresos, egresos y balance del mes actual",
        type: "financial",
        frequency: "monthly",
        filters: {
          // Se calcularán dinámicamente
        },
      },
      {
        id: "customers-top10",
        name: "Top 10 Clientes",
        description: "Clientes con mayor gasto en el último trimestre",
        type: "customers",
        frequency: "quarterly",
        filters: {},
      },
      {
        id: "inventory-lowstock",
        name: "Productos Bajo Stock",
        description: "Productos que necesitan reposición",
        type: "inventory",
        frequency: "weekly",
        filters: {},
      },
      {
        id: "mechanics-performance",
        name: "Rendimiento de Mecánicos",
        description: "Estadísticas mensuales de cada mecánico",
        type: "mechanics",
        frequency: "monthly",
        filters: {},
      },
      {
        id: "operational-summary",
        name: "Resumen Operacional",
        description: "Estado general del taller",
        type: "operational",
        frequency: "weekly",
        filters: {},
      },
      {
        id: "strategic-kpis",
        name: "KPIs Estratégicos",
        description: "Indicadores clave de rendimiento",
        type: "strategic",
        frequency: "monthly",
        filters: {},
      },
    ];
  },
});

export const saveReportTemplate = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    type: v.string(),
    filters: v.any(),
    frequency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.insert("reports", {
      title: args.name,
      description: args.description,
      type: `template-${args.type}`,
      status: "template",
      lastGenerated: new Date().toISOString().split('T')[0],
      data: {
        filters: args.filters,
        frequency: args.frequency || "manual",
      },
    });
    return template;
  },
});

export const getSavedTemplates = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("reports")
      .filter(q => q.eq(q.field("status"), "template"))
      .collect();
  },
});

export const deleteTemplate = mutation({
  args: {
    templateId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.templateId);
  },
});

// ============================================
// 🔄 REPORTES PROGRAMADOS
// ============================================

export const getScheduledReports = query({
  args: {},
  handler: async (ctx) => {
    // Devolver reportes con frecuencia programada
    return await ctx.db
      .query("reports")
      .filter(q => q.eq(q.field("status"), "template"))
      .collect();
  },
});

export const scheduleReport = mutation({
  args: {
    templateId: v.id("reports"),
    frequency: v.string(), // 'daily', 'weekly', 'monthly', 'quarterly'
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.templateId, {
      data: {
        frequency: args.frequency,
        enabled: args.enabled,
        lastScheduled: new Date().toISOString(),
      },
    });
    return args.templateId;
  },
});

// ============================================
// 📊 COMPARACIÓN DE PERÍODOS
// ============================================

export const compareFinancialPeriods = query({
  args: {
    period1Start: v.string(),
    period1End: v.string(),
    period2Start: v.string(),
    period2End: v.string(),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db.query("transactions")
      .filter(q => q.eq(q.field("active"), true))
      .collect();

    const getPeriodData = (start: string, end: string) => {
      const periodTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= new Date(start) && tDate <= new Date(end);
      });

      const ingresos = periodTransactions
        .filter(t => t.type === "Ingreso")
        .reduce((sum, t) => sum + t.amount, 0);

      const egresos = periodTransactions
        .filter(t => t.type === "Egreso")
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        ingresos,
        egresos,
        balance: ingresos - egresos,
        transacciones: periodTransactions.length,
      };
    };

    const period1 = getPeriodData(args.period1Start, args.period1End);
    const period2 = getPeriodData(args.period2Start, args.period2End);

    const comparison = {
      ingresos: {
        period1: period1.ingresos,
        period2: period2.ingresos,
        diferencia: period1.ingresos - period2.ingresos,
        porcentaje: period2.ingresos > 0 
          ? ((period1.ingresos - period2.ingresos) / period2.ingresos) * 100 
          : 0,
      },
      egresos: {
        period1: period1.egresos,
        period2: period2.egresos,
        diferencia: period1.egresos - period2.egresos,
        porcentaje: period2.egresos > 0 
          ? ((period1.egresos - period2.egresos) / period2.egresos) * 100 
          : 0,
      },
      balance: {
        period1: period1.balance,
        period2: period2.balance,
        diferencia: period1.balance - period2.balance,
        porcentaje: period2.balance !== 0 
          ? ((period1.balance - period2.balance) / Math.abs(period2.balance)) * 100 
          : 0,
      },
    };

    return {
      period1,
      period2,
      comparison,
    };
  },
});