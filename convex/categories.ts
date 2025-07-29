import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("categories").collect();
  },
});

export const getCategoriesByType = query({
  args: { type: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("categories")
      .filter((q) => q.and(
        q.eq(q.field("type"), args.type),
        q.eq(q.field("active"), true)
      ))
      .collect();
  },
});

export const createCategory = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const categoryId = await ctx.db.insert("categories", args);
    return categoryId;
  },
});

export const updateCategory = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const toggleCategoryStatus = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.id);
    if (!category) return null;
    
    await ctx.db.patch(args.id, {
      active: !category.active,
    });
    return args.id;
  },
});