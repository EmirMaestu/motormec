import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Helper function para crear movimiento de inventario
async function createInventoryMovement(
  ctx: any,
  productId: any,
  productName: string,
  productType: string,
  movementType: "created" | "updated" | "deleted" | "stock_increase" | "stock_decrease",
  options: {
    previousQuantity?: number;
    newQuantity?: number;
    quantityChange?: number;
    previousPrice?: number;
    newPrice?: number;
    reason?: string;
    userId?: string;
    userName?: string;
    previousData?: any;
    newData?: any;
    notes?: string;
  } = {}
) {
  return await ctx.db.insert("inventoryMovements", {
    productId: movementType === "deleted" ? undefined : productId,
    productName,
    productType,
    movementType,
    previousQuantity: options.previousQuantity,
    newQuantity: options.newQuantity,
    quantityChange: options.quantityChange,
    previousPrice: options.previousPrice,
    newPrice: options.newPrice,
    reason: options.reason,
    timestamp: new Date().toISOString(),
    userId: options.userId,
    userName: options.userName,
    details: {
      previousData: options.previousData,
      newData: options.newData,
      notes: options.notes,
    },
  });
}

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
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, userName, ...productData } = args;
    const lowStock = args.quantity <= args.reorderPoint;
    const productId = await ctx.db.insert("products", {
      ...productData,
      lowStock,
    });

    // Registrar movimiento en el historial
    await createInventoryMovement(
      ctx,
      productId,
      args.name,
      args.type,
      "created",
      {
        newQuantity: args.quantity,
        newPrice: args.price,
        userId,
        userName,
        newData: { ...productData, lowStock },
        notes: "Producto creado en el inventario",
      }
    );

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
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, userId, userName, reason, ...updates } = args;
    const product = await ctx.db.get(id);
    if (!product) return null;
    
    const newQuantity = updates.quantity ?? product.quantity;
    const newReorderPoint = updates.reorderPoint ?? product.reorderPoint;
    const lowStock = newQuantity <= newReorderPoint;
    
    const updatedData = { ...updates, lowStock };
    
    await ctx.db.patch(id, updatedData);

    // Registrar movimiento en el historial
    let movementType: "updated" | "stock_increase" | "stock_decrease" = "updated";
    let quantityChange: number | undefined;

    if (updates.quantity !== undefined && updates.quantity !== product.quantity) {
      quantityChange = updates.quantity - product.quantity;
      movementType = quantityChange > 0 ? "stock_increase" : "stock_decrease";
    }

    await createInventoryMovement(
      ctx,
      id,
      updates.name ?? product.name,
      updates.type ?? product.type,
      movementType,
      {
        previousQuantity: product.quantity,
        newQuantity: newQuantity,
        quantityChange,
        previousPrice: product.price,
        newPrice: updates.price ?? product.price,
        reason: reason || "Actualización de producto",
        userId,
        userName,
        previousData: product,
        newData: { ...product, ...updatedData },
        notes: reason,
      }
    );

    return id;
  },
});

export const deleteProduct = mutation({
  args: { 
    id: v.id("products"),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id);
    if (!product) return null;

    // Registrar movimiento en el historial antes de eliminar
    await createInventoryMovement(
      ctx,
      args.id,
      product.name,
      product.type,
      "deleted",
      {
        previousQuantity: product.quantity,
        previousPrice: product.price,
        reason: args.reason || "Producto eliminado del inventario",
        userId: args.userId,
        userName: args.userName,
        previousData: product,
        notes: args.reason,
      }
    );

    await ctx.db.delete(args.id);
    return true;
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

// Obtener historial de movimientos de inventario
export const getInventoryMovements = query({
  args: {
    limit: v.optional(v.number()),
    productId: v.optional(v.id("products")),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("inventoryMovements");
    
    if (args.productId) {
      query = query.filter((q) => q.eq(q.field("productId"), args.productId));
    }
    
    const movements = await query
      .order("desc") // Más recientes primero
      .take(args.limit || 100);
    
    return movements;
  },
});

// Obtener movimientos por tipo
export const getMovementsByType = query({
  args: {
    movementType: v.union(
      v.literal("created"),
      v.literal("updated"), 
      v.literal("deleted"),
      v.literal("stock_increase"),
      v.literal("stock_decrease")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const movements = await ctx.db
      .query("inventoryMovements")
      .filter((q) => q.eq(q.field("movementType"), args.movementType))
      .order("desc")
      .take(args.limit || 50);
    
    return movements;
  },
});

// Obtener estadísticas de movimientos
export const getMovementStats = query({
  args: {},
  handler: async (ctx) => {
    const allMovements = await ctx.db.query("inventoryMovements").collect();
    
    const stats = {
      total: allMovements.length,
      created: allMovements.filter(m => m.movementType === "created").length,
      updated: allMovements.filter(m => m.movementType === "updated").length,
      deleted: allMovements.filter(m => m.movementType === "deleted").length,
      stockIncreases: allMovements.filter(m => m.movementType === "stock_increase").length,
      stockDecreases: allMovements.filter(m => m.movementType === "stock_decrease").length,
    };
    
    return stats;
  },
});