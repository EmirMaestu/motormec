import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*  jsonb payload types (ported 1:1 from the Convex schema)                    */
/* -------------------------------------------------------------------------- */

export interface WorkSession {
  startTime: string;
  endTime?: string;
  duration?: number; // milliseconds
}

export interface VehicleResponsible {
  name: string;
  assignedAt: string;
  role?: string;
  userId?: string;
  isAdmin?: boolean;
  isWorking?: boolean;
  workStartedAt?: string;
  totalWorkTime?: number; // milliseconds
  workSessions?: WorkSession[];
}

export interface VehicleCosts {
  laborCost: number;
  partsCost: number;
  totalCost: number;
}

export interface VehiclePart {
  id: string;
  name: string;
  price: number;
  quantity: number;
  source: "client" | "purchased";
  supplier?: string;
  notes?: string;
}

export interface VehicleDetailsSnapshot {
  plate: string;
  brand: string;
  model: string;
  customer: string;
}

export interface MovementDetails {
  previousData?: unknown;
  newData?: unknown;
  notes?: string;
  workSession?: WorkSession;
}

export interface TenantSettings {
  companyName?: string;
  companyDescription?: string;
  copyright?: string;
  branding?: Record<string, unknown>;
  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/*  tenants — one workshop. The ONLY table without tenant_id.                  */
/* -------------------------------------------------------------------------- */

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    plan: text("plan").notNull().default("standard"),
    active: boolean("active").notNull().default(true),
    waPhoneNumberId: text("wa_phone_number_id"),
    waAccessToken: text("wa_access_token"), // encrypted at rest
    waDisplayNumber: text("wa_display_number"),
    settings: jsonb("settings").$type<TenantSettings>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tenants_slug_uq").on(t.slug),
    uniqueIndex("tenants_wa_phone_number_id_uq").on(t.waPhoneNumberId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  users — own auth (replaces Clerk). username unique per tenant.            */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "mecanico"] })
      .notNull()
      .default("mecanico"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_tenant_username_uq").on(t.tenantId, t.username),
    index("users_tenant_idx").on(t.tenantId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  sessions — server-side session store (cookie holds the token).            */
/* -------------------------------------------------------------------------- */

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["admin", "mecanico"] }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_uq").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  platform_admins — dueños de la plataforma (super-admin, cross-tenant).    */
/*  NO llevan tenant_id: operan por encima de todos los talleres.             */
/* -------------------------------------------------------------------------- */

export const platformAdmins = pgTable(
  "platform_admins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("platform_admins_username_uq").on(t.username)],
);

export const platformSessions = pgTable(
  "platform_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => platformAdmins.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("platform_sessions_token_hash_uq").on(t.tokenHash)],
);

/* -------------------------------------------------------------------------- */
/*  numeros_autorizados — WhatsApp whitelist, scoped per tenant.              */
/* -------------------------------------------------------------------------- */

export const numerosAutorizados = pgTable(
  "numeros_autorizados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    addedBy: text("added_by"),
  },
  (t) => [
    index("numeros_tenant_phone_idx").on(t.tenantId, t.phone),
  ],
);

/* -------------------------------------------------------------------------- */
/*  customers                                                                  */
/* -------------------------------------------------------------------------- */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone").notNull().default(""),
    address: text("address"),
    documentType: text("document_type"),
    documentNumber: text("document_number"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    // Denormalized metrics (kept for fast reads; recomputed on writes).
    totalVehicles: integer("total_vehicles").default(0),
    totalSpent: doublePrecision("total_spent").default(0),
    lastVisit: text("last_visit"),
    visitCount: integer("visit_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("customers_tenant_phone_idx").on(t.tenantId, t.phone),
    index("customers_tenant_document_idx").on(
      t.tenantId,
      t.documentType,
      t.documentNumber,
    ),
    index("customers_tenant_idx").on(t.tenantId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  vehicles                                                                   */
/* -------------------------------------------------------------------------- */

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    plate: text("plate").notNull(),
    brand: text("brand").notNull().default(""),
    model: text("model").notNull().default(""),
    year: integer("year"),
    owner: text("owner").notNull().default(""),
    phone: text("phone").notNull().default(""),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("Ingresado"),
    entryDate: text("entry_date").notNull(),
    exitDate: text("exit_date"),
    services: text("services").array().notNull().default(sql`'{}'::text[]`),
    cost: doublePrecision("cost").notNull().default(0),
    description: text("description"),
    inTaller: boolean("in_taller").default(true),
    mileage: integer("mileage"),
    responsibles: jsonb("responsibles")
      .$type<VehicleResponsible[]>()
      .notNull()
      .default([]),
    costs: jsonb("costs").$type<VehicleCosts | null>(),
    parts: jsonb("parts").$type<VehiclePart[]>().notNull().default([]),
    lastUpdated: text("last_updated"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("vehicles_tenant_plate_idx").on(t.tenantId, t.plate),
    index("vehicles_tenant_customer_idx").on(t.tenantId, t.customerId),
    index("vehicles_tenant_status_idx").on(t.tenantId, t.status),
  ],
);

/* -------------------------------------------------------------------------- */
/*  vehicle_movements — audit log of vehicle changes                          */
/* -------------------------------------------------------------------------- */

export const vehicleMovementType = [
  "created",
  "status_changed",
  "assigned",
  "unassigned",
  "work_started",
  "work_paused",
  "work_completed",
  "updated",
  "suspended",
  "delivered",
  "deleted",
] as const;

export const vehicleMovements = pgTable(
  "vehicle_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    vehiclePlate: text("vehicle_plate").notNull(),
    vehicleInfo: text("vehicle_info").notNull().default(""),
    owner: text("owner").notNull().default(""),
    movementType: text("movement_type", {
      enum: vehicleMovementType,
    }).notNull(),
    previousStatus: text("previous_status"),
    newStatus: text("new_status"),
    previousCost: doublePrecision("previous_cost"),
    newCost: doublePrecision("new_cost"),
    costChange: doublePrecision("cost_change"),
    assignedUser: text("assigned_user"),
    assignedUserName: text("assigned_user_name"),
    unassignedUser: text("unassigned_user"),
    unassignedUserName: text("unassigned_user_name"),
    workDuration: integer("work_duration"),
    workSessionId: text("work_session_id"),
    previousServices: text("previous_services").array(),
    newServices: text("new_services").array(),
    reason: text("reason"),
    description: text("description"),
    timestamp: text("timestamp").notNull(),
    userId: text("user_id"),
    userName: text("user_name"),
    details: jsonb("details").$type<MovementDetails | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("vehicle_movements_tenant_vehicle_idx").on(t.tenantId, t.vehicleId),
    index("vehicle_movements_tenant_idx").on(t.tenantId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  products / stock                                                          */
/* -------------------------------------------------------------------------- */

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: doublePrecision("quantity").notNull().default(0),
    unit: text("unit").notNull().default("unidad"),
    type: text("type").notNull().default(""),
    price: doublePrecision("price").notNull().default(0),
    reorderPoint: doublePrecision("reorder_point").notNull().default(0),
    lowStock: boolean("low_stock").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("products_tenant_idx").on(t.tenantId)],
);

export const inventoryMovementType = [
  "created",
  "updated",
  "deleted",
  "stock_increase",
  "stock_decrease",
] as const;

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productName: text("product_name").notNull(),
    productType: text("product_type").notNull().default(""),
    movementType: text("movement_type", {
      enum: inventoryMovementType,
    }).notNull(),
    previousQuantity: doublePrecision("previous_quantity"),
    newQuantity: doublePrecision("new_quantity"),
    quantityChange: doublePrecision("quantity_change"),
    previousPrice: doublePrecision("previous_price"),
    newPrice: doublePrecision("new_price"),
    reason: text("reason"),
    timestamp: text("timestamp").notNull(),
    userId: text("user_id"),
    userName: text("user_name"),
    details: jsonb("details").$type<MovementDetails | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("inventory_movements_tenant_product_idx").on(
      t.tenantId,
      t.productId,
    ),
    index("inventory_movements_tenant_idx").on(t.tenantId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  transactions (finanzas)                                                   */
/* -------------------------------------------------------------------------- */

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    description: text("description").notNull().default(""),
    type: text("type", { enum: ["Ingreso", "Egreso"] }).notNull(),
    category: text("category").notNull().default(""),
    amount: doublePrecision("amount").notNull().default(0),
    active: boolean("active").notNull().default(true),
    suspendedAt: text("suspended_at"),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    vehicleDetails: jsonb("vehicle_details").$type<VehicleDetailsSnapshot | null>(),
    supplier: text("supplier"),
    paymentMethod: text("payment_method"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("transactions_tenant_date_idx").on(t.tenantId, t.date),
    index("transactions_tenant_type_idx").on(t.tenantId, t.type),
    index("transactions_tenant_vehicle_idx").on(t.tenantId, t.vehicleId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  partners (socios)                                                         */
/* -------------------------------------------------------------------------- */

export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    investmentPercentage: doublePrecision("investment_percentage")
      .notNull()
      .default(0),
    monthlyContribution: doublePrecision("monthly_contribution")
      .notNull()
      .default(0),
    totalContributed: doublePrecision("total_contributed").notNull().default(0),
    joinDate: text("join_date").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("partners_tenant_idx").on(t.tenantId)],
);

/* -------------------------------------------------------------------------- */
/*  services                                                                   */
/* -------------------------------------------------------------------------- */

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    usageCount: integer("usage_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("services_tenant_name_idx").on(t.tenantId, t.name)],
);

/* -------------------------------------------------------------------------- */
/*  categories                                                                 */
/* -------------------------------------------------------------------------- */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("categories_tenant_type_idx").on(t.tenantId, t.type)],
);

/* -------------------------------------------------------------------------- */
/*  work_orders — órdenes de trabajo (cada ingreso del vehículo al taller)    */
/* -------------------------------------------------------------------------- */

export const orderStatus = [
  "Pendiente",
  "Diagnosticando",
  "Esperando repuestos",
  "En reparación",
  "Listo para entregar",
  "Entregado",
  "Cancelado",
] as const;

export interface OrderPart {
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  fromInventory: boolean;
}

export const workOrders = pgTable(
  "work_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    vehiclePlate: text("vehicle_plate").notNull().default(""),
    vehicleInfo: text("vehicle_info").notNull().default(""),
    customerName: text("customer_name").notNull().default(""),
    status: text("status", { enum: orderStatus }).notNull().default("Pendiente"),
    services: text("services").array().notNull().default(sql`'{}'::text[]`),
    parts: jsonb("parts").$type<OrderPart[]>().notNull().default([]),
    laborCost: doublePrecision("labor_cost").notNull().default(0),
    partsCost: doublePrecision("parts_cost").notNull().default(0),
    total: doublePrecision("total").notNull().default(0),
    mileage: integer("mileage"),
    notes: text("notes"),
    entryDate: text("entry_date").notNull(),
    estimatedDate: text("estimated_date"),
    deliveryDate: text("delivery_date"),
    // Set once the order is finalized to avoid double stock/finance effects.
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("work_orders_tenant_number_uq").on(t.tenantId, t.number),
    index("work_orders_tenant_vehicle_idx").on(t.tenantId, t.vehicleId),
    index("work_orders_tenant_customer_idx").on(t.tenantId, t.customerId),
    index("work_orders_tenant_status_idx").on(t.tenantId, t.status),
  ],
);

/* -------------------------------------------------------------------------- */
/*  usage_counters — consumo mensual por tenant (para límites de plan).        */
/*  period = "YYYY-MM". iaMessages = mensajes procesados con IA en el mes.      */
/* -------------------------------------------------------------------------- */

export const usageCounters = pgTable(
  "usage_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    period: text("period").notNull(), // "YYYY-MM"
    iaMessages: integer("ia_messages").notNull().default(0),
    iaInputTokens: integer("ia_input_tokens").notNull().default(0),
    iaOutputTokens: integer("ia_output_tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("usage_tenant_period_uq").on(t.tenantId, t.period)],
);

/* -------------------------------------------------------------------------- */
/*  conversaciones — WhatsApp state machine, per phone, per tenant           */
/* -------------------------------------------------------------------------- */

export const conversaciones = pgTable(
  "conversaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    etapa: text("etapa").notNull(),
    datos: jsonb("datos").$type<Record<string, unknown>>().notNull().default({}),
    candidatoClienteId: uuid("candidato_cliente_id").references(
      () => customers.id,
      { onDelete: "set null" },
    ),
    candidatoClienteNombre: text("candidato_cliente_nombre"),
    historialId: uuid("historial_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("conversaciones_tenant_phone_idx").on(t.tenantId, t.phone)],
);

/* -------------------------------------------------------------------------- */
/*  historial_taller — WhatsApp intake log                                   */
/* -------------------------------------------------------------------------- */

export const historialStatus = [
  "pending",
  "processed",
  "error",
  "linked",
] as const;

export const historialTaller = pgTable(
  "historial_taller",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    waMessageId: text("wa_message_id").notNull(),
    waFrom: text("wa_from").notNull(),
    waTimestamp: text("wa_timestamp").notNull(),
    rawMessage: text("raw_message"),
    marcaModelo: text("marca_modelo"),
    kilometraje: text("kilometraje"),
    patente: text("patente"),
    tarea: text("tarea"),
    cliente: text("cliente"),
    fotoPaths: text("foto_paths").array().notNull().default(sql`'{}'::text[]`),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: historialStatus })
      .notNull()
      .default("pending"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // wa_message_id is globally unique → cross-tenant idempotency for the
    // single shared webhook. (Meta message ids are globally unique.)
    uniqueIndex("historial_wa_message_id_uq").on(t.waMessageId),
    index("historial_tenant_patente_idx").on(t.tenantId, t.patente),
    index("historial_tenant_status_idx").on(t.tenantId, t.status),
    index("historial_tenant_idx").on(t.tenantId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Convenience: the set of tenant-scoped data tables.                        */
/*  tenants / users / sessions are auth/infra and handled explicitly.         */
/* -------------------------------------------------------------------------- */

export const tenantScopedTables = {
  numerosAutorizados,
  customers,
  vehicles,
  vehicleMovements,
  products,
  inventoryMovements,
  transactions,
  partners,
  services,
  categories,
  conversaciones,
  historialTaller,
  workOrders,
  usageCounters,
} as const;

export type TenantScopedTable =
  (typeof tenantScopedTables)[keyof typeof tenantScopedTables];

/* Row type helpers */
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type HistorialTaller = typeof historialTaller.$inferSelect;
export type Conversacion = typeof conversaciones.$inferSelect;
export type WorkOrder = typeof workOrders.$inferSelect;
export type NewWorkOrder = typeof workOrders.$inferInsert;
export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type UsageCounter = typeof usageCounters.$inferSelect;
