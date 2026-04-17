import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";

// ─── Verificar si un número está autorizado (usado internamente por el bot) ──
export const verificar = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const registro = await ctx.db
      .query("numerosAutorizados")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    return registro !== null && registro.active;
  },
});

// ─── Listar todos los números autorizados (para el panel de administración) ─
export const listar = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("numerosAutorizados").order("desc").collect();
  },
});

// ─── Agregar un número autorizado ─────────────────────────────────────────
export const agregar = mutation({
  args: {
    phone: v.string(),
    name: v.string(),
    addedBy: v.optional(v.string()),
  },
  handler: async (ctx, { phone, name, addedBy }) => {
    // Normalizar: quitar espacios y asegurarse que empiece con código de país
    const phoneNorm = phone.replace(/\s+/g, "").replace(/^\+/, "");

    // Verificar que no exista ya
    const existente = await ctx.db
      .query("numerosAutorizados")
      .withIndex("by_phone", (q) => q.eq("phone", phoneNorm))
      .first();

    if (existente) {
      // Si existe pero está inactivo, reactivarlo
      if (!existente.active) {
        await ctx.db.patch(existente._id, { active: true, name });
        return existente._id;
      }
      throw new Error("Este número ya está autorizado");
    }

    return await ctx.db.insert("numerosAutorizados", {
      phone: phoneNorm,
      name,
      active: true,
      addedAt: new Date().toISOString(),
      addedBy,
    });
  },
});

// ─── Activar / desactivar un número ───────────────────────────────────────
export const toggleActivo = mutation({
  args: { id: v.id("numerosAutorizados"), active: v.boolean() },
  handler: async (ctx, { id, active }) => {
    await ctx.db.patch(id, { active });
  },
});

// ─── Actualizar nombre ─────────────────────────────────────────────────────
export const actualizar = mutation({
  args: { id: v.id("numerosAutorizados"), name: v.string() },
  handler: async (ctx, { id, name }) => {
    await ctx.db.patch(id, { name });
  },
});

// ─── Eliminar un número autorizado ────────────────────────────────────────
export const eliminar = mutation({
  args: { id: v.id("numerosAutorizados") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
