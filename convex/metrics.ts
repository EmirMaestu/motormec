import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getMetrics = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("metrics").collect();
  },
});

export const getMetricsByType = query({
  args: { type: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("metrics")
      .filter((q) => q.eq(q.field("type"), args.type))
      .collect();
  },
});

export const createMetric = mutation({
  args: {
    name: v.string(),
    value: v.string(),
    trend: v.string(),
    trendValue: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const metricId = await ctx.db.insert("metrics", args);
    return metricId;
  },
});

export const updateMetric = mutation({
  args: {
    id: v.id("metrics"),
    name: v.optional(v.string()),
    value: v.optional(v.string()),
    trend: v.optional(v.string()),
    trendValue: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const deleteMetric = mutation({
  args: { id: v.id("metrics") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getOrCreateMetric = mutation({
  args: {
    name: v.string(),
    value: v.string(),
    trend: v.string(),
    trendValue: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("metrics")
      .filter((q) => q.and(
        q.eq(q.field("name"), args.name),
        q.eq(q.field("type"), args.type)
      ))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        trend: args.trend,
        trendValue: args.trendValue,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("metrics", args);
    }
  },
});