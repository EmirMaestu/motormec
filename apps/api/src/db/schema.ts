import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
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
  laborCost: number; // centavos
  partsCost: number; // centavos
  totalCost: number; // centavos
}

export interface VehiclePart {
  id: string;
  name: string;
  price: number; // centavos
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
  /** Logo propio del taller (ruta de media) para presupuestos con su marca. */
  logoPath?: string;
  /** Datos de contacto que aparecen en el presupuesto. */
  quoteHeader?: { phone?: string; address?: string; email?: string };
  [key: string]: unknown;
}

/** Ítem de un presupuesto. */
export interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number; // centavos
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
    // Per-user brute-force protection: count consecutive failed logins and
    // temporarily lock the account after too many (rate limit is per-IP only).
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockoutUntil: timestamp("lockout_until", { withTimezone: true }),
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
    totalSpent: bigint("total_spent", { mode: "number" }).default(0),
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
    cost: bigint("cost", { mode: "number" }).notNull().default(0),
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
    previousCost: bigint("previous_cost", { mode: "number" }),
    newCost: bigint("new_cost", { mode: "number" }),
    costChange: bigint("cost_change", { mode: "number" }),
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
    price: bigint("price", { mode: "number" }).notNull().default(0),
    reorderPoint: doublePrecision("reorder_point").notNull().default(0),
    lowStock: boolean("low_stock").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("products_tenant_idx").on(t.tenantId),
    check("products_quantity_non_negative", sql`${t.quantity} >= 0`),
  ],
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
    previousPrice: bigint("previous_price", { mode: "number" }),
    newPrice: bigint("new_price", { mode: "number" }),
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
    amount: bigint("amount", { mode: "number" }).notNull().default(0),
    active: boolean("active").notNull().default(true),
    suspendedAt: text("suspended_at"),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    workOrderId: uuid("work_order_id").references(() => workOrders.id, {
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
    monthlyContribution: bigint("monthly_contribution", { mode: "number" })
      .notNull()
      .default(0),
    totalContributed: bigint("total_contributed", { mode: "number" })
      .notNull()
      .default(0),
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
  unitPrice: number; // centavos
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
    laborCost: bigint("labor_cost", { mode: "number" }).notNull().default(0),
    partsCost: bigint("parts_cost", { mode: "number" }).notNull().default(0),
    total: bigint("total", { mode: "number" }).notNull().default(0),
    mileage: integer("mileage"),
    notes: text("notes"),
    entryDate: text("entry_date").notNull(),
    estimatedDate: text("estimated_date"),
    deliveryDate: text("delivery_date"),
    // Set once the order is finalized to avoid double stock/finance effects.
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    // Monto cobrado hasta ahora (centavos). Saldo = total - paidAmount.
    paidAmount: bigint("paid_amount", { mode: "number" }).notNull().default(0),
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
/*  payments — pagos (incluidos parciales) contra una orden / cliente.        */
/* -------------------------------------------------------------------------- */

export const paymentKind = [
  "efectivo",
  "transferencia",
  "tarjeta",
  "mercadopago",
  "otro",
] as const;

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    workOrderId: uuid("work_order_id").references(() => workOrders.id, {
      onDelete: "set null",
    }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    amount: bigint("amount", { mode: "number" }).notNull(), // centavos
    method: text("method", { enum: paymentKind }).notNull().default("efectivo"),
    paidAt: text("paid_at").notNull(), // YYYY-MM-DD (hora AR)
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("payments_tenant_order_idx").on(t.tenantId, t.workOrderId),
    index("payments_tenant_customer_idx").on(t.tenantId, t.customerId),
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
    // Orden de trabajo a la que pertenecen estas fotos (el "momento" del ingreso).
    workOrderId: uuid("work_order_id").references(() => workOrders.id, {
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
/*  presupuestos — cotizaciones para un cliente, con la marca del taller.      */
/* -------------------------------------------------------------------------- */

export const presupuestos = pgTable(
  "presupuestos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull().default(""),
    customerPhone: text("customer_phone"),
    vehiclePlate: text("vehicle_plate"),
    vehicleInfo: text("vehicle_info"),
    items: jsonb("items").$type<QuoteItem[]>().notNull().default([]),
    notes: text("notes"),
    subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
    total: bigint("total", { mode: "number" }).notNull().default(0),
    validUntil: text("valid_until"),
    status: text("status").notNull().default("borrador"),
    createdByName: text("created_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("presupuestos_tenant_idx").on(t.tenantId),
    uniqueIndex("presupuestos_tenant_number_uq").on(t.tenantId, t.number),
  ],
);

/* -------------------------------------------------------------------------- */
/*  BILLING — suscripciones recurrentes con 2 proveedores ruteados por país.  */
/*  El "suscriptor" es el TENANT (el taller que le paga a Momec). Estas tablas */
/*  son de plataforma (no tenant-scoped): las maneja el BillingService, no los */
/*  usuarios del taller.                                                       */
/* -------------------------------------------------------------------------- */

export const billingCountry = ["AR", "CL"] as const;
export type BillingCountry = (typeof billingCountry)[number];
export const billingProviderName = ["mobbex", "rebill"] as const;
export type BillingProviderName = (typeof billingProviderName)[number];
export const billingCurrency = ["ARS", "CLP", "USD"] as const;
export const paymentMethodType = ["debin", "transferencia", "tarjeta"] as const;
export type PaymentMethodType = (typeof paymentMethodType)[number];
export const subscriptionStatus = [
  "pending",
  "active",
  "past_due",
  "paused",
  "cancelled",
] as const;
export const chargeStatus = [
  "pending",
  "approved",
  "rejected",
  "expired",
  "refunded",
] as const;
export const billingCycle = ["monthly", "annual"] as const;

/** El suscriptor (1:1 con tenant): país, identificación fiscal, moneda, wallet. */
export const billingCustomers = pgTable(
  "billing_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    country: text("country", { enum: billingCountry }).notNull(),
    currency: text("currency", { enum: billingCurrency }).notNull(),
    // CUIT/CUIL (AR, requerido para DEBIN) o RUT (CL).
    taxId: text("tax_id"),
    provider: text("provider", { enum: billingProviderName }).notNull(),
    // Id del suscriptor en el proveedor (Mobbex Wallet / Rebill customer).
    providerCustomerId: text("provider_customer_id"),
    email: text("email"),
    name: text("name"),
    // Referidos: código propio + quién lo trajo. Wallet en su moneda.
    referralCode: text("referral_code").notNull(),
    referredByTenantId: uuid("referred_by_tenant_id").references(() => tenants.id, {
      onDelete: "set null",
    }),
    walletBalance: bigint("wallet_balance", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("billing_customers_tenant_uq").on(t.tenantId),
    uniqueIndex("billing_customers_referral_code_uq").on(t.referralCode),
  ],
);

/** Método de pago tokenizado. `hasDiscount` marca los que aplican descuento. */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: text("type", { enum: paymentMethodType }).notNull(),
    // Solo el token del proveedor — nunca datos de tarjeta en crudo (PCI).
    providerToken: text("provider_token"),
    hasDiscount: boolean("has_discount").notNull().default(false),
    brand: text("brand"),
    last4: text("last4"),
    isDefault: boolean("is_default").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payment_methods_tenant_idx").on(t.tenantId)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: billingProviderName }).notNull(),
    externalId: text("external_id"),
    plan: text("plan").notNull(),
    status: text("status", { enum: subscriptionStatus }).notNull().default("pending"),
    cycle: text("cycle", { enum: billingCycle }).notNull().default("monthly"),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency", { enum: billingCurrency }).notNull(),
    paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id, {
      onDelete: "set null",
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("subscriptions_tenant_idx").on(t.tenantId),
    index("subscriptions_status_idx").on(t.status),
  ],
);

/** Un cobro por ciclo. Guarda bruto, descuento, neto y moneda de liquidación. */
export const charges = pgTable(
  "charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    provider: text("provider", { enum: billingProviderName }).notNull(),
    externalId: text("external_id"),
    period: text("period"), // ej. "2026-07"
    status: text("status", { enum: chargeStatus }).notNull().default("pending"),
    grossAmount: bigint("gross_amount", { mode: "number" }).notNull(),
    discountAmount: bigint("discount_amount", { mode: "number" }).notNull().default(0),
    netAmount: bigint("net_amount", { mode: "number" }).notNull(),
    currency: text("currency", { enum: billingCurrency }).notNull(),
    settlementCurrency: text("settlement_currency", { enum: billingCurrency }),
    attempt: integer("attempt").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("charges_tenant_idx").on(t.tenantId),
    index("charges_subscription_idx").on(t.subscriptionId),
    index("charges_status_idx").on(t.status),
  ],
);

/** Idempotencia de webhooks: dedup por (provider, event_id). */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider", { enum: billingProviderName }).notNull(),
    eventId: text("event_id").notNull(),
    type: text("type"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("webhook_events_provider_event_uq").on(t.provider, t.eventId)],
);

export const referralStatus = ["pending", "rewarded"] as const;

/** Referido: quién trajo a quién. Se premia cuando el referido paga. */
export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerTenantId: uuid("referrer_tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    referredTenantId: uuid("referred_tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    status: text("status", { enum: referralStatus }).notNull().default("pending"),
    rewardChargeId: uuid("reward_charge_id").references(() => charges.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("referrals_referred_uq").on(t.referredTenantId)],
);

/** Libro de wallet (append-only): créditos por referido, débitos por descuento. */
export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "number" }).notNull(), // + crédito / − consumo
    currency: text("currency", { enum: billingCurrency }).notNull(),
    reason: text("reason").notNull(),
    referralId: uuid("referral_id").references(() => referrals.id, { onDelete: "set null" }),
    chargeId: uuid("charge_id").references(() => charges.id, { onDelete: "set null" }),
    balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wallet_ledger_tenant_idx").on(t.tenantId)],
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
  payments,
  presupuestos,
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
export type Payment = typeof payments.$inferSelect;
export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type UsageCounter = typeof usageCounters.$inferSelect;
export type BillingCustomer = typeof billingCustomers.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type Charge = typeof charges.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type WalletEntry = typeof walletLedger.$inferSelect;
export type Presupuesto = typeof presupuestos.$inferSelect;
