import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getDashboardItems = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("dashboardItems").collect();
  },
});

export const createDashboardItem = mutation({
  args: {
    header: v.string(),
    type: v.string(),
    status: v.union(v.literal("Done"), v.literal("In Process"), v.literal("Pending")),
    target: v.string(),
    limit: v.string(),
    reviewer: v.string(),
  },
  handler: async (ctx, args) => {
    const dashboardItemId = await ctx.db.insert("dashboardItems", args);
    return dashboardItemId;
  },
});

export const updateDashboardItem = mutation({
  args: {
    id: v.id("dashboardItems"),
    header: v.optional(v.string()),
    type: v.optional(v.string()),
    status: v.optional(v.union(v.literal("Done"), v.literal("In Process"), v.literal("Pending"))),
    target: v.optional(v.string()),
    limit: v.optional(v.string()),
    reviewer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteDashboardItem = mutation({
  args: { id: v.id("dashboardItems") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});