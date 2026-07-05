import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../src/db/client.js";
import { createTenant } from "../src/db/admin.js";
import { forTenant, type TenantDb } from "../src/db/scope.js";
import { products, transactions, vehicles, workOrders } from "../src/db/schema.js";
import { createOrder, finalizeOrder, updateOrder } from "../src/domain/orders.js";
import { registrarPago } from "../src/domain/payments.js";
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

  it("finalize deducts inventory stock, logs movement, marks delivered (no income until paid)", async () => {
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

    // Finalizar NO crea ingreso (el ingreso viene de los pagos).
    expect((await tdb.select(transactions, eq(transactions.type, "Ingreso"))).length).toBe(0);

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
    // finalize no crea ingreso: sin pagos no hay transacciones.
    expect(await tdb.count(transactions)).toBe(0);
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
    // finalize no crea ingreso (el ingreso viene de los pagos).
    expect((await tdb.select(transactions, eq(transactions.type, "Ingreso"))).length).toBe(0);
  });

  it("reopen restores stock and leaves payments untouched", async () => {
    const prod = await tdb.insertOne(products, { name: "Correa", quantity: 10, reorderPoint: 0, price: 5000 });
    const order = await createOrder(tdb, actor, {
      plate: "REO111",
      laborCost: 8000,
      parts: [{ productId: prod.id, name: "Correa", quantity: 2, unitPrice: 6000, fromInventory: true }],
    });
    await finalizeOrder(tdb, actor, order.id);
    expect((await tdb.findById(products, prod.id))?.quantity).toBe(8); // 10 - 2

    // Cobrar la orden crea 1 ingreso (ingreso por pago).
    await registrarPago(tdb, actor, order.id, { amount: order.total });

    const { reopenOrder } = await import("../src/domain/orders.js");
    await reopenOrder(tdb, actor, order.id);
    // Stock repuesto...
    expect((await tdb.findById(products, prod.id))?.quantity).toBe(10);
    // ...pero el ingreso del pago SIGUE activo (los pagos son plata real; no se revierten).
    const ingresosActivos = await tdb.select(
      transactions,
      and(eq(transactions.type, "Ingreso"), eq(transactions.active, true)),
    );
    expect(ingresosActivos.length).toBe(1);
    const reopened = await tdb.findById(workOrders, order.id);
    expect(reopened?.finalizedAt).toBeNull();
  });

  it("each order's payment creates income linked to its own workOrderId", async () => {
    // Dos órdenes para el mismo vehículo, ambas finalizadas y cobradas.
    const o1 = await createOrder(tdb, actor, { plate: "TWO111", laborCost: 10000 });
    await finalizeOrder(tdb, actor, o1.id);
    const o2 = await createOrder(tdb, actor, { plate: "TWO111", laborCost: 20000 });
    await finalizeOrder(tdb, actor, o2.id);

    await registrarPago(tdb, actor, o1.id, { amount: 10000 });
    await registrarPago(tdb, actor, o2.id, { amount: 20000 });

    const ingresos = await tdb.select(transactions, eq(transactions.type, "Ingreso"));
    // Un ingreso por orden, ligado a SU propia orden.
    expect(ingresos).toHaveLength(2);
    const ing1 = ingresos.find((t) => t.workOrderId === o1.id);
    const ing2 = ingresos.find((t) => t.workOrderId === o2.id);
    expect(ing1?.amount).toBe(10000);
    expect(ing2?.amount).toBe(20000);
  });

  it("reopening an order brings its vehicle back into the shop", async () => {
    const order = await createOrder(tdb, actor, { plate: "SYNC111", laborCost: 5000 });
    await finalizeOrder(tdb, actor, order.id);
    let v = await tdb.findById(vehicles, order.vehicleId!);
    expect(v?.status).toBe("Entregado");
    const { reopenOrder } = await import("../src/domain/orders.js");
    await reopenOrder(tdb, actor, order.id);
    v = await tdb.findById(vehicles, order.vehicleId!);
    expect(v?.inTaller).toBe(true);
    expect(v?.status).not.toBe("Entregado");
  });

  it("deleting a vehicle deactivates its income transactions", async () => {
    const order = await createOrder(tdb, actor, { plate: "DEL111", laborCost: 10000 });
    await finalizeOrder(tdb, actor, order.id);
    // El ingreso viene del pago (no de finalizar): cobramos para que exista.
    await registrarPago(tdb, actor, order.id, { amount: 10000 });
    const { deleteVehicle } = await import("../src/domain/vehicles.js");
    await deleteVehicle(tdb, actor, order.vehicleId!);
    const activos = await tdb.select(transactions, eq(transactions.active, true));
    expect(activos.filter((t) => t.type === "Ingreso")).toHaveLength(0);
  });

  it("delivering a vehicle whose order lacks stock throws and does NOT leave it 'Entregado'", async () => {
    const prod = await tdb.insertOne(products, { name: "Pastillas", quantity: 1, reorderPoint: 0, price: 8000 });
    const order = await createOrder(tdb, actor, {
      plate: "NOSTK1",
      parts: [{ productId: prod.id, name: "Pastillas", quantity: 5, unitPrice: 8000, fromInventory: true }],
    });
    const vehicleId = order.vehicleId!;
    const { updateVehicle } = await import("../src/domain/vehicles.js");

    // Entregar debe FALLAR (falta stock) y propagar el error.
    await expect(updateVehicle(tdb, actor, vehicleId, { status: "Entregado" })).rejects.toThrow(
      /insuficiente/i,
    );

    // El vehículo NO quedó "Entregado" a medias.
    const v = await tdb.findById(vehicles, vehicleId);
    expect(v?.status).not.toBe("Entregado");
    // La orden tampoco quedó finalizada, ni se generó ingreso.
    expect((await tdb.findById(workOrders, order.id))?.finalizedAt).toBeFalsy();
    expect(await tdb.count(transactions)).toBe(0);
    // El stock intacto.
    expect((await tdb.findById(products, prod.id))?.quantity).toBe(1);
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
