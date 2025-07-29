import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getProducts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("products").collect();
  },
});

export const createProduct = mutation({
  args: {
    name: v.string(),
    quantity: v.number(),
    unit: v.string(),
    type: v.string(),
    price: v.number(),
    reorderPoint: v.number(),
  },
  handler: async (ctx, args) => {
    const lowStock = args.quantity <= args.reorderPoint;
    const productId = await ctx.db.insert("products", {
      ...args,
      lowStock,
    });
    return productId;
  },
});

export const updateProduct = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    type: v.optional(v.string()),
    price: v.optional(v.number()),
    reorderPoint: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const product = await ctx.db.get(id);
    if (!product) return null;
    
    const newQuantity = updates.quantity ?? product.quantity;
    const newReorderPoint = updates.reorderPoint ?? product.reorderPoint;
    const lowStock = newQuantity <= newReorderPoint;
    
    await ctx.db.patch(id, {
      ...updates,
      lowStock,
    });
    return id;
  },
});

export const deleteProduct = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getLowStockProducts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("lowStock"), true))
      .collect();
  },
});