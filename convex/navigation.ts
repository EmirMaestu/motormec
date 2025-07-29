import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getNavigationItems = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("navigationItems")
      .filter((q) => q.eq(q.field("active"), true))
      .order("asc")
      .collect();
  },
});

export const createNavigationItem = mutation({
  args: {
    title: v.string(),
    url: v.string(),
    icon: v.string(),
    color: v.string(),
    order: v.number(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const navigationId = await ctx.db.insert("navigationItems", args);
    return navigationId;
  },
});

export const updateNavigationItem = mutation({
  args: {
    id: v.id("navigationItems"),
    title: v.optional(v.string()),
    url: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    order: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const deleteNavigationItem = mutation({
  args: { id: v.id("navigationItems") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const toggleNavigationItem = mutation({
  args: { id: v.id("navigationItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) return null;
    
    await ctx.db.patch(args.id, {
      active: !item.active,
    });
    return args.id;
  },
});

export const reorderNavigationItems = mutation({
  args: {
    items: v.array(v.object({
      id: v.id("navigationItems"),
      order: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await ctx.db.patch(item.id, { order: item.order });
    }
  },
});