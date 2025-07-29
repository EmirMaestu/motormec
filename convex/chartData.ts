import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getChartData = query({
  args: { chartType: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chartData")
      .filter((q) => q.eq(q.field("chartType"), args.chartType))
      .collect();
  },
});

export const createChartData = mutation({
  args: {
    chartType: v.string(),
    month: v.string(),
    desktop: v.optional(v.number()),
    mobile: v.optional(v.number()),
    ingresos: v.optional(v.number()),
    egresos: v.optional(v.number()),
    balance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const chartDataId = await ctx.db.insert("chartData", args);
    return chartDataId;
  },
});

export const updateChartData = mutation({
  args: {
    id: v.id("chartData"),
    chartType: v.optional(v.string()),
    month: v.optional(v.string()),
    desktop: v.optional(v.number()),
    mobile: v.optional(v.number()),
    ingresos: v.optional(v.number()),
    egresos: v.optional(v.number()),
    balance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const deleteChartData = mutation({
  args: { id: v.id("chartData") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getOrCreateChartData = mutation({
  args: {
    chartType: v.string(),
    month: v.string(),
    desktop: v.optional(v.number()),
    mobile: v.optional(v.number()),
    ingresos: v.optional(v.number()),
    egresos: v.optional(v.number()),
    balance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chartData")
      .filter((q) => q.and(
        q.eq(q.field("chartType"), args.chartType),
        q.eq(q.field("month"), args.month)
      ))
      .first();
    
    if (existing) {
      const { chartType, month, ...updates } = args;
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    } else {
      return await ctx.db.insert("chartData", args);
    }
  },
});