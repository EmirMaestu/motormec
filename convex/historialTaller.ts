import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Mutation interna: guardar nuevo registro (idempotente por whatsappMessageId) ─
export const guardar = internalMutation({
  args: {
    whatsappMessageId: v.string(),
    whatsappFrom: v.string(),
    whatsappTimestamp: v.string(),
    rawMessage: v.optional(v.string()),
    marca_modelo: v.optional(v.string()),
    kilometraje: v.optional(v.string()),
    patente: v.optional(v.string()),
    tarea: v.optional(v.string()),
    cliente: v.optional(v.string()),
    fotoIds: v.array(v.id("_storage")),
    status: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("error"),
      v.literal("linked")
    ),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    // Deduplicar: si ya existe un registro con este messageId, retornar el existente
    const existente = await ctx.db
      .query("historial_taller")
      .withIndex("by_message_id", (q) => q.eq("whatsappMessageId", args.whatsappMessageId))
      .first();
    if (existente) {
      console.log(`[historialTaller] Mensaje duplicado ignorado: ${args.whatsappMessageId}`);
      return null; // señal de "ya procesado"
    }
    return await ctx.db.insert("historial_taller", args);
  },
});

// ─── Mutation interna: actualizar registro con datos de IA ────────────────
export const actualizar = internalMutation({
  args: {
    id: v.id("historial_taller"),
    marca_modelo: v.optional(v.string()),
    kilometraje: v.optional(v.string()),
    patente: v.optional(v.string()),
    tarea: v.optional(v.string()),
    cliente: v.optional(v.string()),
    fotoIds: v.array(v.id("_storage")),
    status: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("error"),
      v.literal("linked")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

// ─── Mutation interna: vincular registro a vehículo/cliente existente ────
export const vincular = internalMutation({
  args: {
    id: v.id("historial_taller"),
    vehicleId: v.optional(v.id("vehicles")),
    customerId: v.optional(v.id("customers")),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, { ...fields, status: "linked" });
  },
});

// ─── Query: listar historial con filtro opcional por status ───────────────
export const listar = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processed"),
        v.literal("error"),
        v.literal("linked")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let registros;

    if (args.status) {
      registros = await ctx.db
        .query("historial_taller")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(args.limit ?? 50);
    } else {
      registros = await ctx.db
        .query("historial_taller")
        .order("desc")
        .take(args.limit ?? 50);
    }

    return registros;
  },
});

// ─── Query: obtener un registro con URLs firmadas de las fotos ────────────
export const obtenerConFotos = query({
  args: { id: v.id("historial_taller") },
  handler: async (ctx, args) => {
    const registro = await ctx.db.get(args.id);
    if (!registro) return null;

    const urlsFotos = await Promise.all(
      registro.fotoIds.map((storageId) => ctx.storage.getUrl(storageId))
    );

    return { ...registro, urlsFotos };
  },
});

// ─── Mutation pública: generar URL firmada para subir foto ───────────────
export const generarUrlSubida = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// ─── Mutation pública: agregar fotos a un registro por vehicleId ─────────
// Si no existe registro para ese vehículo, crea uno nuevo de tipo "manual"
export const agregarFotosPorVehiculo = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    storageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    // Buscar registro existente para este vehículo
    const existente = await ctx.db
      .query("historial_taller")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .first();

    if (existente) {
      // Agregar las nuevas fotos a las existentes
      const fotoIds = [...existente.fotoIds, ...args.storageIds];
      await ctx.db.patch(existente._id, { fotoIds });
      return existente._id;
    } else {
      // Crear nuevo registro manual para este vehículo
      const now = new Date().toISOString();
      return await ctx.db.insert("historial_taller", {
        whatsappMessageId: `manual_${args.vehicleId}_${Date.now()}`,
        whatsappFrom: "manual",
        whatsappTimestamp: now,
        vehicleId: args.vehicleId,
        fotoIds: args.storageIds,
        status: "linked",
        createdAt: now,
      });
    }
  },
});

// ─── Mutation pública: eliminar una foto de un registro ──────────────────
export const eliminarFoto = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const registro = await ctx.db
      .query("historial_taller")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .first();

    if (!registro) return;

    const fotoIds = registro.fotoIds.filter((id) => id !== args.storageId);
    await ctx.db.patch(registro._id, { fotoIds });
    // También eliminar el archivo del storage
    await ctx.storage.delete(args.storageId);
  },
});

// ─── Query: buscar por patente ────────────────────────────────────────────
export const buscarPorPatente = query({
  args: { patente: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("historial_taller")
      .withIndex("by_patente", (q) =>
        q.eq("patente", args.patente.toUpperCase())
      )
      .order("desc")
      .collect();
  },
});
