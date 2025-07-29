import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getReports = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("reports").collect();
  },
});

export const getReportsByType = query({
  args: { type: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reports")
      .filter((q) => q.eq(q.field("type"), args.type))
      .collect();
  },
});

export const createReport = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    type: v.string(),
    lastGenerated: v.string(),
    status: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const reportId = await ctx.db.insert("reports", args);
    return reportId;
  },
});

export const updateReport = mutation({
  args: {
    id: v.id("reports"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.string()),
    lastGenerated: v.optional(v.string()),
    status: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const deleteReport = mutation({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const generateReport = mutation({
  args: {
    reportId: v.id("reports"),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const currentDate = new Date().toISOString().split('T')[0];
    
    await ctx.db.patch(args.reportId, {
      lastGenerated: currentDate,
      status: "available",
      data: args.data,
    });
    
    return args.reportId;
  },
});