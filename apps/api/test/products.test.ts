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
afterAll(async () => {
  await pool.end();
});

describe("products stock guard", () => {
  it("rejects a manual update that would set stock below zero", async () => {
    const p = await tdb.insertOne(products, {
      name: "Aceite", quantity: 5, reorderPoint: 1, price: 3000, unit: "L", type: "Lubricante",
    });
    await expect(
      tdb.updateById(products, p.id, { quantity: -3 }),
    ).rejects.toThrow();
    const still = await tdb.findById(products, p.id);
    expect(still?.quantity).toBe(5);
  });
});
