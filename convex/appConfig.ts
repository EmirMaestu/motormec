import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getAppConfig = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("appConfig").first();
  },
});

export const createAppConfig = mutation({
  args: {
    companyName: v.string(),
    companyDescription: v.string(),
    copyright: v.string(),
  },
  handler: async (ctx, args) => {
    const configId = await ctx.db.insert("appConfig", args);
    return configId;
  },
});

export const updateAppConfig = mutation({
  args: {
    id: v.id("appConfig"),
    companyName: v.optional(v.string()),
    companyDescription: v.optional(v.string()),
    copyright: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const getOrCreateAppConfig = mutation({
  args: {
    companyName: v.string(),
    companyDescription: v.string(),
    copyright: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("appConfig").first();
    
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("appConfig", args);
    }
  },
});