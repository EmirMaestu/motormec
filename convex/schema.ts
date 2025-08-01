import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Configuración general de la aplicación
  appConfig: defineTable({
    companyName: v.string(),
    companyDescription: v.string(),
    copyright: v.string(),
  }),

  // Menú de navegación
  navigationItems: defineTable({
    title: v.string(),
    url: v.string(),
    icon: v.string(),
    color: v.string(),
    order: v.number(),
    active: v.boolean(),
  }),

  // Productos/Stock
  products: defineTable({
    name: v.string(),
    quantity: v.number(),
    unit: v.string(),
    type: v.string(),
    price: v.number(),
    reorderPoint: v.number(),
    lowStock: v.boolean(),
  }),

  // Historial de movimientos de inventario
  inventoryMovements: defineTable({
    productId: v.optional(v.id("products")), // null si el producto fue eliminado
    productName: v.string(),
    productType: v.string(),
    movementType: v.union(
      v.literal("created"),
      v.literal("updated"), 
      v.literal("deleted"),
      v.literal("stock_increase"),
      v.literal("stock_decrease")
    ),
    previousQuantity: v.optional(v.number()),
    newQuantity: v.optional(v.number()),
    quantityChange: v.optional(v.number()),
    previousPrice: v.optional(v.number()),
    newPrice: v.optional(v.number()),
    reason: v.optional(v.string()),
    timestamp: v.string(),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    details: v.optional(v.object({
      previousData: v.optional(v.any()),
      newData: v.optional(v.any()),
      notes: v.optional(v.string()),
    })),
  }),

  // Vehículos
  vehicles: defineTable({
    plate: v.string(),
    brand: v.string(),
    model: v.string(),
    year: v.number(),
    owner: v.string(),
    phone: v.string(),
    status: v.string(),
    entryDate: v.string(),
    exitDate: v.optional(v.string()),
    services: v.array(v.string()),
    cost: v.number(),
    description: v.optional(v.string()),
    inTaller: v.optional(v.boolean()),
    lastUpdated: v.optional(v.string()),
    // Campo para responsibles del vehículo
    responsibles: v.optional(v.array(v.object({
      name: v.string(),
      assignedAt: v.string(),
      role: v.optional(v.string()), // "Mecánico", "Supervisor", "Auxiliar", etc.
      userId: v.optional(v.string()), // ID del usuario de Clerk
      isAdmin: v.optional(v.boolean()), // Si es admin de la organización
      isWorking: v.optional(v.boolean()), // Si está trabajando activamente en este momento
      workStartedAt: v.optional(v.string()), // Cuándo empezó a trabajar
      totalWorkTime: v.optional(v.number()), // Tiempo total trabajado en milisegundos
      workSessions: v.optional(v.array(v.object({
        startTime: v.string(),
        endTime: v.optional(v.string()),
        duration: v.optional(v.number()), // en milisegundos
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
  }),

  // Historial de movimientos de vehículos
  vehicleMovements: defineTable({
    vehicleId: v.optional(v.id("vehicles")), // null si el vehículo fue eliminado
    vehiclePlate: v.string(),
    vehicleInfo: v.string(), // "Marca Modelo Año"
    owner: v.string(),
    movementType: v.union(
      v.literal("created"),           // Vehículo ingresado
      v.literal("status_changed"),    // Cambio de estado (Ingresado -> En Reparación -> Listo -> Entregado)
      v.literal("assigned"),          // Mecánico asignado
      v.literal("unassigned"),        // Mecánico desasignado
      v.literal("work_started"),      // Inicio de trabajo
      v.literal("work_paused"),       // Trabajo pausado
      v.literal("work_completed"),    // Trabajo completado
      v.literal("updated"),           // Actualización general (costo, servicios, etc.)
      v.literal("suspended"),         // Vehículo suspendido
      v.literal("delivered"),         // Vehículo entregado
      v.literal("deleted")            // Vehículo eliminado
    ),
    // Estados
    previousStatus: v.optional(v.string()),
    newStatus: v.optional(v.string()),
    // Costos
    previousCost: v.optional(v.number()),
    newCost: v.optional(v.number()),
    costChange: v.optional(v.number()),
    // Responsables
    assignedUser: v.optional(v.string()), // userId
    assignedUserName: v.optional(v.string()),
    unassignedUser: v.optional(v.string()), // userId
    unassignedUserName: v.optional(v.string()),
    // Trabajo
    workDuration: v.optional(v.number()), // en milisegundos
    workSessionId: v.optional(v.string()),
    // Servicios
    previousServices: v.optional(v.array(v.string())),
    newServices: v.optional(v.array(v.string())),
    // Información general
    reason: v.optional(v.string()),
    description: v.optional(v.string()),
    timestamp: v.string(),
    userId: v.optional(v.string()), // Usuario que hizo el cambio
    userName: v.optional(v.string()),
    // Datos detallados
    details: v.optional(v.object({
      previousData: v.optional(v.any()),
      newData: v.optional(v.any()),
      notes: v.optional(v.string()),
      workSession: v.optional(v.object({
        startTime: v.string(),
        endTime: v.optional(v.string()),
        duration: v.optional(v.number()),
      })),
    })),
  }),

  // Socios
  partners: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    investmentPercentage: v.number(),
    monthlyContribution: v.number(),
    totalContributed: v.number(),
    joinDate: v.string(),
    active: v.boolean(),
  }),

  // Transacciones financieras
  transactions: defineTable({
    date: v.string(),
    description: v.string(),
    type: v.union(v.literal("Ingreso"), v.literal("Egreso")),
    category: v.string(),
    amount: v.number(),
    active: v.optional(v.boolean()),
    suspendedAt: v.optional(v.string()),
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
  }),

  // Reportes
  reports: defineTable({
    title: v.string(),
    description: v.string(),
    type: v.string(),
    lastGenerated: v.string(),
    status: v.string(),
    data: v.optional(v.any()),
  }),

  // Métricas del dashboard
  metrics: defineTable({
    name: v.string(),
    value: v.string(),
    trend: v.string(),
    trendValue: v.string(),
    type: v.string(),
  }),

  // Datos de gráficos
  chartData: defineTable({
    chartType: v.string(),
    month: v.string(),
    desktop: v.optional(v.number()),
    mobile: v.optional(v.number()),
    ingresos: v.optional(v.number()),
    egresos: v.optional(v.number()),
    balance: v.optional(v.number()),
  }),

  // Categorías configurables
  categories: defineTable({
    name: v.string(),
    type: v.string(), // "product", "transaction", "vehicle_status", etc.
    active: v.boolean(),
  }),

  // Items del dashboard original
  dashboardItems: defineTable({
    header: v.string(),
    type: v.string(),
    status: v.union(v.literal("Done"), v.literal("In Process"), v.literal("Pending")),
    target: v.string(),
    limit: v.string(),
    reviewer: v.string(),
  }),
});