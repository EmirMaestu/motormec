import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../src/db/client.js";
import { createTenant } from "../src/db/admin.js";
import { forTenant, type TenantDb } from "../src/db/scope.js";
import {
  categories,
  conversaciones,
  customers,
  historialTaller,
  inventoryMovements,
  numerosAutorizados,
  partners,
  products,
  services,
  transactions,
  vehicleMovements,
  vehicles,
} from "../src/db/schema.js";
import { resetDb } from "./helpers.js";

let tenantA: string;
let tenantB: string;
let a: TenantDb;
let b: TenantDb;

beforeEach(async () => {
  await resetDb();
  const ta = await createTenant({ name: "Taller A", slug: "taller-a" });
  const tb = await createTenant({ name: "Taller B", slug: "taller-b" });
  tenantA = ta.id;
  tenantB = tb.id;
  a = forTenant(tenantA);
  b = forTenant(tenantB);
});

afterAll(async () => {
  await pool.end();
});

describe("tenant isolation — every resource", () => {
  it("customers: A never sees, fetches, edits, or deletes B's rows", async () => {
    const aCustomer = await a.insertOne(customers, { name: "Cliente A", phone: "111" });
    const bCustomer = await b.insertOne(customers, { name: "Cliente B", phone: "222" });

    // List is scoped.
    expect((await a.select(customers)).map((c) => c.id)).toEqual([aCustomer.id]);
    expect((await b.select(customers)).map((c) => c.id)).toEqual([bCustomer.id]);

    // findById across tenants returns null.
    expect(await a.findById(customers, bCustomer.id)).toBeNull();
    expect(await b.findById(customers, aCustomer.id)).toBeNull();

    // Update across tenants is a no-op.
    const updated = await a.updateById(customers, bCustomer.id, { name: "HACKED" });
    expect(updated).toBeNull();

    // Delete across tenants is a no-op; B's row survives.
    const deleted = await a.deleteById(customers, bCustomer.id);
    expect(deleted).toBeNull();
    expect(await b.findById(customers, bCustomer.id)).not.toBeNull();
  });

  it("vehicles: scoped reads/writes", async () => {
    const av = await a.insertOne(vehicles, {
      plate: "AAA111",
      entryDate: "2026-01-01",
    });
    const bv = await b.insertOne(vehicles, {
      plate: "BBB222",
      entryDate: "2026-01-01",
    });

    expect((await a.select(vehicles)).map((v) => v.id)).toEqual([av.id]);
    expect(await a.findById(vehicles, bv.id)).toBeNull();
    expect(await a.updateById(vehicles, bv.id, { status: "HACKED" })).toBeNull();
    expect(await a.deleteById(vehicles, bv.id)).toBeNull();
    expect(await b.findById(vehicles, bv.id)).not.toBeNull();
  });

  it("transactions: scoped", async () => {
    const at = await a.insertOne(transactions, {
      date: "2026-01-01",
      type: "Ingreso",
      amount: 100,
    });
    const bt = await b.insertOne(transactions, {
      date: "2026-01-01",
      type: "Egreso",
      amount: 50,
    });
    expect((await a.select(transactions)).map((t) => t.id)).toEqual([at.id]);
    expect(await a.findById(transactions, bt.id)).toBeNull();
    expect(await b.count(transactions)).toBe(1);
  });

  it("products + inventory_movements: scoped", async () => {
    const ap = await a.insertOne(products, { name: "Filtro A" });
    const bp = await b.insertOne(products, { name: "Filtro B" });
    expect(await a.findById(products, bp.id)).toBeNull();
    expect(await a.count(products)).toBe(1);

    await a.insertOne(inventoryMovements, {
      productName: "Filtro A",
      movementType: "created",
      timestamp: "2026-01-01",
    });
    await b.insertOne(inventoryMovements, {
      productName: "Filtro B",
      movementType: "created",
      timestamp: "2026-01-01",
    });
    expect(await a.count(inventoryMovements)).toBe(1);
    expect(await b.count(inventoryMovements)).toBe(1);
    void ap;
  });

  it("partners: scoped", async () => {
    const ap = await a.insertOne(partners, { name: "Socio A", joinDate: "2026-01-01" });
    const bp = await b.insertOne(partners, { name: "Socio B", joinDate: "2026-01-01" });
    expect(await a.findById(partners, bp.id)).toBeNull();
    expect((await b.select(partners)).map((p) => p.id)).toEqual([bp.id]);
    void ap;
  });

  it("services + categories: scoped", async () => {
    await a.insertOne(services, { name: "Cambio de aceite" });
    await b.insertOne(services, { name: "Alineación" });
    expect(await a.count(services)).toBe(1);

    await a.insertOne(categories, { name: "Repuestos", type: "product" });
    await b.insertOne(categories, { name: "Sueldos", type: "transaction" });
    expect(await a.count(categories)).toBe(1);
  });

  it("numeros_autorizados: scoped (whitelist per tenant)", async () => {
    await a.insertOne(numerosAutorizados, { phone: "5491111", name: "Juan A" });
    await b.insertOne(numerosAutorizados, { phone: "5492222", name: "Juan B" });
    const aNumbers = await a.select(numerosAutorizados);
    expect(aNumbers).toHaveLength(1);
    expect(aNumbers[0]?.phone).toBe("5491111");
  });

  it("conversaciones + historial_taller + vehicle_movements: scoped", async () => {
    await a.insertOne(conversaciones, { phone: "5491111", etapa: "confirmando" });
    await b.insertOne(conversaciones, { phone: "5492222", etapa: "confirmando" });
    expect(await a.count(conversaciones)).toBe(1);

    await a.insertOne(historialTaller, {
      waMessageId: "wamid.A1",
      waFrom: "5491111",
      waTimestamp: "1700000000",
    });
    await b.insertOne(historialTaller, {
      waMessageId: "wamid.B1",
      waFrom: "5492222",
      waTimestamp: "1700000000",
    });
    expect(await a.count(historialTaller)).toBe(1);
    expect(await b.count(historialTaller)).toBe(1);

    await a.insertOne(vehicleMovements, {
      vehiclePlate: "AAA111",
      movementType: "created",
      timestamp: "2026-01-01",
    });
    expect(await a.count(vehicleMovements)).toBe(1);
    expect(await b.count(vehicleMovements)).toBe(0);
  });

  it("insert always forces the caller's tenant_id (cannot be spoofed)", async () => {
    // Even if a caller smuggles a tenantId past the types, the scope layer
    // overrides it at runtime with the caller's tenant.
    const created = await a.insert(customers, {
      name: "Spoof",
      phone: "000",
      tenantId: tenantB,
    });
    expect(created[0]?.tenantId).toBe(tenantA);
    // And it is NOT visible to B.
    expect(await b.count(customers)).toBe(0);
  });

  it("bulk delete on A cannot touch B's rows", async () => {
    await a.insertOne(customers, { name: "A1", phone: "1" });
    await a.insertOne(customers, { name: "A2", phone: "2" });
    await b.insertOne(customers, { name: "B1", phone: "3" });

    // Unfiltered delete via the scope helper still only deletes this tenant's rows.
    const deleted = await a.delete(customers);
    expect(deleted).toHaveLength(2);
    expect(await b.count(customers)).toBe(1);
  });

  it("raw cross-tenant write is invisible through the scoped reader", async () => {
    // Sanity: confirm the predicate is on tenant_id specifically.
    const aCustomer = await a.insertOne(customers, { name: "A", phone: "1" });
    const directRows = await forTenant(tenantA).select(
      customers,
      eq(customers.id, aCustomer.id),
    );
    expect(directRows).toHaveLength(1);
    expect(await forTenant(tenantB).select(customers, eq(customers.id, aCustomer.id))).toHaveLength(0);
  });
});
