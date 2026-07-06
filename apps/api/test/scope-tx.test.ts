import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../src/db/client.js";
import { createTenant } from "../src/db/admin.js";
import { forTenant, type TenantDb } from "../src/db/scope.js";
import { products } from "../src/db/schema.js";
import { resetDb } from "./helpers.js";

let tdb: TenantDb;
beforeEach(async () => {
  await resetDb();
  const t = await createTenant({ name: "A", slug: "a" });
  tdb = forTenant(t.id);
});
afterAll(async () => { await pool.end(); });

describe("TenantDb.transaction", () => {
  it("commits when the callback resolves", async () => {
    const p = await tdb.transaction(async (t) => {
      return t.insertOne(products, { name: "X", quantity: 5, reorderPoint: 0, price: 100 });
    });
    expect(await tdb.findById(products, p.id)).toBeTruthy();
  });

  it("rolls back everything when the callback throws", async () => {
    const p = await tdb.insertOne(products, { name: "Y", quantity: 5, reorderPoint: 0, price: 100 });
    await expect(
      tdb.transaction(async (t) => {
        await t.updateById(products, p.id, { quantity: 1 });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    // El update quedó revertido: sigue en 5.
    expect((await tdb.findById(products, p.id))?.quantity).toBe(5);
  });

  it("keeps tenant scoping inside the transaction", async () => {
    const other = await createTenant({ name: "B", slug: "b" });
    const otherDb = forTenant(other.id);
    const mine = await tdb.insertOne(products, { name: "mine", quantity: 1, reorderPoint: 0, price: 1 });
    // Desde la transacción de OTRO tenant no se ve mi producto.
    const seen = await otherDb.transaction(async (t) => t.findById(products, mine.id));
    expect(seen).toBeNull();
  });
});
