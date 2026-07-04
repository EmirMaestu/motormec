import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../src/db/client.js";
import { createTenant } from "../src/db/admin.js";
import { forTenant, type TenantDb } from "../src/db/scope.js";
import { products, transactions, vehicles, workOrders } from "../src/db/schema.js";
import { createOrder, finalizeOrder, updateOrder } from "../src/domain/orders.js";
import { resetDb } from "./helpers.js";

let tdb: TenantDb;
const actor = { userId: null, userName: "Test" };

beforeEach(async () => {
  await resetDb();
  const t = await createTenant({ name: "A", slug: "a" });
  tdb = forTenant(t.id);
});
afterAll(async () => {
  await pool.end();
});

describe("work orders", () => {
  it("creates a vehicle once and reuses it across orders (per-tenant numbering)", async () => {
    const o1 = await createOrder(tdb, actor, {
      plate: "AB123CD",
      brand: "Ford",
      model: "Focus",
      customerName: "Juan",
      services: ["Cambio de aceite"],
      laborCost: 10000,
    });
    expect(o1.number).toBe(1);
    expect(o1.vehicleId).toBeTruthy();

    const o2 = await createOrder(tdb, actor, { plate: "ab123cd", services: ["Frenos"], laborCost: 5000 });
    expect(o2.number).toBe(2);
    // Same vehicle reused, not duplicated.
    expect(o2.vehicleId).toBe(o1.vehicleId);
    expect(await tdb.count(vehicles)).toBe(1);
  });

  it("computes totals from labor + parts", async () => {
    const order = await createOrder(tdb, actor, {
      plate: "ZZ999ZZ",
      laborCost: 20000,
      parts: [
        { name: "Aceite", quantity: 2, unitPrice: 3000, fromInventory: false },
        { name: "Filtro", quantity: 1, unitPrice: 4000, fromInventory: false },
      ],
    });
    expect(order.partsCost).toBe(10000);
    expect(order.total).toBe(30000);
  });

  it("finalize deducts inventory stock, logs movement and posts income", async () => {
    const aceite = await tdb.insertOne(products, {
      name: "Aceite 5W30",
      quantity: 10,
      reorderPoint: 3,
      price: 3000,
      unit: "L",
      type: "Lubricante",
    });
    const order = await createOrder(tdb, actor, {
      plate: "AA111BB",
      laborCost: 15000,
      services: ["Cambio de aceite"],
      parts: [
        { productId: aceite.id, name: "Aceite 5W30", quantity: 4, unitPrice: 3500, fromInventory: true },
      ],
    });
    expect(order.total).toBe(15000 + 4 * 3500);

    const result = await finalizeOrder(tdb, actor, order.id);
    expect(result?.order.status).toBe("Entregado");
    expect(result?.order.finalizedAt).toBeTruthy();

    // Stock deducted 10 → 6.
    const prod = await tdb.findById(products, aceite.id);
    expect(prod?.quantity).toBe(6);

    // Income created for the order total.
    const txs = await tdb.select(transactions, eq(transactions.type, "Ingreso"));
    expect(txs).toHaveLength(1);
    expect(txs[0]?.amount).toBe(order.total);

    // Vehicle marked delivered.
    const v = order.vehicleId ? await tdb.findById(vehicles, order.vehicleId) : null;
    expect(v?.status).toBe("Entregado");
    expect(v?.inTaller).toBe(false);
  });

  it("blocks finalize when a stock part exceeds available quantity", async () => {
    const prod = await tdb.insertOne(products, { name: "Pastillas", quantity: 1, reorderPoint: 0, price: 8000 });
    const order = await createOrder(tdb, actor, {
      plate: "CC222DD",
      parts: [{ productId: prod.id, name: "Pastillas", quantity: 5, unitPrice: 8000, fromInventory: true }],
    });
    await expect(finalizeOrder(tdb, actor, order.id)).rejects.toThrow(/insuficiente/i);
    // Nothing deducted, no income.
    expect((await tdb.findById(products, prod.id))?.quantity).toBe(1);
    expect(await tdb.count(transactions)).toBe(0);
  });

  it("finalize is idempotent (no double stock/income)", async () => {
    const prod = await tdb.insertOne(products, { name: "Bujía", quantity: 8, reorderPoint: 2, price: 1500 });
    const order = await createOrder(tdb, actor, {
      plate: "EE333FF",
      laborCost: 5000,
      parts: [{ productId: prod.id, name: "Bujía", quantity: 4, unitPrice: 2000, fromInventory: true }],
    });
    await finalizeOrder(tdb, actor, order.id);
    const second = await finalizeOrder(tdb, actor, order.id);
    expect(second?.warnings.join(" ")).toMatch(/ya estaba finalizada/i);
    expect((await tdb.findById(products, prod.id))?.quantity).toBe(4); // only deducted once
    expect(await tdb.count(transactions)).toBe(1);
  });

  it("finalize is atomic under concurrent calls (no double income / no negative stock)", async () => {
    const prod = await tdb.insertOne(products, { name: "Filtro", quantity: 5, reorderPoint: 0, price: 1000 });
    const order = await createOrder(tdb, actor, {
      plate: "RACE111",
      laborCost: 10000,
      parts: [{ productId: prod.id, name: "Filtro", quantity: 3, unitPrice: 1500, fromInventory: true }],
    });
    // Dos finalizaciones en paralelo sobre la MISMA orden.
    const [a, b] = await Promise.allSettled([
      finalizeOrder(tdb, actor, order.id),
      finalizeOrder(tdb, actor, order.id),
    ]);
    // Ambas resuelven (una finaliza, la otra ve "ya finalizada"); ninguna corrompe.
    expect(a.status).toBe("fulfilled");
    expect(b.status).toBe("fulfilled");
    // Stock descontado UNA sola vez: 5 - 3 = 2.
    expect((await tdb.findById(products, prod.id))?.quantity).toBe(2);
    // UN solo ingreso.
    const txs = await tdb.select(transactions, eq(transactions.type, "Ingreso"));
    expect(txs).toHaveLength(1);
  });

  it("reopen restores stock and reverses income atomically", async () => {
    const prod = await tdb.insertOne(products, { name: "Correa", quantity: 10, reorderPoint: 0, price: 5000 });
    const order = await createOrder(tdb, actor, {
      plate: "REO111",
      laborCost: 8000,
      parts: [{ productId: prod.id, name: "Correa", quantity: 2, unitPrice: 6000, fromInventory: true }],
    });
    await finalizeOrder(tdb, actor, order.id);
    expect((await tdb.findById(products, prod.id))?.quantity).toBe(8); // 10 - 2

    const { reopenOrder } = await import("../src/domain/orders.js");
    await reopenOrder(tdb, actor, order.id);
    // Stock repuesto y el ingreso quedó inactivo.
    expect((await tdb.findById(products, prod.id))?.quantity).toBe(10);
    const activos = await tdb.select(transactions, eq(transactions.active, true));
    expect(activos.filter((x) => x.type === "Ingreso")).toHaveLength(0);
    const reopened = await tdb.findById(workOrders, order.id);
    expect(reopened?.finalizedAt).toBeNull();
  });

  it("reopen reverses the income of THAT order, not another order's income", async () => {
    // Dos órdenes para el mismo vehículo, ambas finalizadas.
    const o1 = await createOrder(tdb, actor, { plate: "TWO111", laborCost: 10000 });
    await finalizeOrder(tdb, actor, o1.id);
    const o2 = await createOrder(tdb, actor, { plate: "TWO111", laborCost: 20000 });
    await finalizeOrder(tdb, actor, o2.id);

    const { reopenOrder } = await import("../src/domain/orders.js");
    await reopenOrder(tdb, actor, o2.id); // reabrir la SEGUNDA

    const activos = await tdb.select(transactions, eq(transactions.active, true));
    const ingresos = activos.filter((t) => t.type === "Ingreso");
    // Debe quedar activo el ingreso de o1 (10000), inactivo el de o2 (20000).
    expect(ingresos).toHaveLength(1);
    expect(ingresos[0]?.amount).toBe(10000);
  });

  it("deleting a vehicle deactivates its income transactions", async () => {
    const order = await createOrder(tdb, actor, { plate: "DEL111", laborCost: 10000 });
    await finalizeOrder(tdb, actor, order.id);
    const { deleteVehicle } = await import("../src/domain/vehicles.js");
    await deleteVehicle(tdb, actor, order.vehicleId!);
    const activos = await tdb.select(transactions, eq(transactions.active, true));
    expect(activos.filter((t) => t.type === "Ingreso")).toHaveLength(0);
  });

  it("status update mirrors onto the vehicle snapshot", async () => {
    const order = await createOrder(tdb, actor, { plate: "GG444HH" });
    await updateOrder(tdb, order.id, { status: "En reparación" });
    const v = order.vehicleId ? await tdb.findById(vehicles, order.vehicleId) : null;
    expect(v?.status).toBe("En Reparación");
  });

  it("refuses to edit parts/labor of a finalized order", async () => {
    const order = await createOrder(tdb, actor, { plate: "FIN111AL", laborCost: 10000 });
    await finalizeOrder(tdb, actor, order.id);
    await expect(
      updateOrder(tdb, order.id, { laborCost: 99999 }),
    ).rejects.toThrow(/finalizada/i);
  });
});
