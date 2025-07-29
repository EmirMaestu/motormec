import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getPartners = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("partners").collect();
  },
});

export const getActivePartners = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("partners")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
  },
});

export const createPartner = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    investmentPercentage: v.number(),
    monthlyContribution: v.number(),
    totalContributed: v.number(),
    joinDate: v.string(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const partnerId = await ctx.db.insert("partners", args);
    return partnerId;
  },
});

export const updatePartner = mutation({
  args: {
    id: v.id("partners"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    investmentPercentage: v.optional(v.number()),
    monthlyContribution: v.optional(v.number()),
    totalContributed: v.optional(v.number()),
    joinDate: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const deletePartner = mutation({
  args: { id: v.id("partners") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const updatePartnerContribution = mutation({
  args: {
    id: v.id("partners"),
    contributionAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const partner = await ctx.db.get(args.id);
    if (!partner) return null;
    
    await ctx.db.patch(args.id, {
      totalContributed: partner.totalContributed + args.contributionAmount,
    });
    return args.id;
  },
});