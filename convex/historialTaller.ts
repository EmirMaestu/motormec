import { internalMutation, mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ─── Mutation interna: guardar nuevo registro (llamada desde el bot) ───────
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
