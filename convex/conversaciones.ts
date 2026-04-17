import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ─── Query: obtener conversación activa por teléfono ─────────────────────────
export const obtenerPorTelefono = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversaciones")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
  },
});

// ─── Mutation: guardar nueva conversación ─────────────────────────────────────
export const guardar = internalMutation({
  args: {
    phone: v.string(),
    etapa: v.string(),
    datos: v.any(),
    candidatoClienteId: v.optional(v.id("customers")),
    candidatoClienteNombre: v.optional(v.string()),
    historialId: v.optional(v.id("historial_taller")),
  },
  handler: async (ctx, args) => {
    // Si ya existe una conversación para este teléfono, la eliminamos primero
    const existente = await ctx.db
      .query("conversaciones")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (existente) {
      await ctx.db.delete(existente._id);
    }

    const now = new Date().toISOString();
    return await ctx.db.insert("conversaciones", {
      ...args,
      updatedAt: now,
      createdAt: now,
    });
  },
});

// ─── Mutation: actualizar etapa y/o datos de conversación existente ───────────
export const actualizar = internalMutation({
  args: {
    phone: v.string(),
    etapa: v.optional(v.string()),
    datos: v.optional(v.any()),
    candidatoClienteId: v.optional(v.id("customers")),
    candidatoClienteNombre: v.optional(v.string()),
    historialId: v.optional(v.id("historial_taller")),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db
      .query("conversaciones")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (!conv) return null;

    const { phone, ...campos } = args;
    const actualizaciones: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (campos.etapa !== undefined) actualizaciones.etapa = campos.etapa;
    if (campos.datos !== undefined) actualizaciones.datos = campos.datos;
    if (campos.candidatoClienteId !== undefined) actualizaciones.candidatoClienteId = campos.candidatoClienteId;
    if (campos.candidatoClienteNombre !== undefined) actualizaciones.candidatoClienteNombre = campos.candidatoClienteNombre;
    if (campos.historialId !== undefined) actualizaciones.historialId = campos.historialId;

    await ctx.db.patch(conv._id, actualizaciones);
    return conv._id;
  },
});

// ─── Mutation: eliminar conversación (al completarse o cancelarse) ────────────
export const eliminar = internalMutation({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const conv = await ctx.db
      .query("conversaciones")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (conv) {
      await ctx.db.delete(conv._id);
    }
  },
});

// ─── Query interna: buscar clientes por nombre (búsqueda parcial) ─────────────
export const buscarClientePorNombre = internalQuery({
  args: { nombre: v.string() },
  handler: async (ctx, args) => {
    if (!args.nombre || args.nombre.trim().length < 3) return null;

    // Buscar en TODOS los clientes (sin filtrar por active) para no perder datos
    const todos = await ctx.db.query("customers").collect();

    const nombreLower = args.nombre.toLowerCase().trim();

    // Prioridad 1: activos
    const activos = todos.filter((c) => c.active);
    // Prioridad 2: todos (incluye inactivos como fallback)
    const candidatos = activos.length > 0 ? activos : todos;

    return candidatos.find((c) => {
      const clienteLower = c.name.toLowerCase();
      return (
        clienteLower.includes(nombreLower) ||
        nombreLower.includes(clienteLower) ||
        clienteLower.startsWith(nombreLower.substring(0, 4))
      );
    }) ?? null;
  },
});

// ─── Query interna: buscar cliente por teléfono ───────────────────────────────
export const buscarClientePorTelefono = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    // WhatsApp envía el número con prefijo país sin +, ej: "5491155556666"
    // La base puede tener formatos distintos, intentamos normalizar
    const phoneClean = args.phone.replace(/\D/g, "");

    const todos = await ctx.db.query("customers").collect();

    return todos.find((c) => {
      const clientePhone = c.phone.replace(/\D/g, "");
      // Requerir mínimo 7 dígitos para evitar falsos positivos con teléfonos cortos/placeholder
      const minLen = 7;
      return (
        clientePhone === phoneClean ||
        (clientePhone.length >= minLen && phoneClean.endsWith(clientePhone)) ||
        (phoneClean.length >= minLen && clientePhone.endsWith(phoneClean))
      );
    }) ?? null;
  },
});
