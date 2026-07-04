# Plan 02 — Dinero y Transacciones Implementation Plan

> **Para el que ejecuta:** leé primero [el plan maestro](2026-07-02-00-master-plan.md). Este
> plan corrige corrupción de datos financieros. Es BLOQUEANTE de producción. Hacé un backup
> de la DB antes de MT-4 y probá MT-4 en staging antes de prod.

**Goal:** (1) hacer atómicas las operaciones multi-paso de órdenes (finalizar/reabrir) para
que no corrompan stock ni finanzas bajo concurrencia; (2) migrar todo el dinero de
`doublePrecision` (float, con errores de centavos) a enteros en centavos.

**Arquitectura:** agregamos un método `transaction()` a `TenantDb` que abre una transacción
Drizzle manteniendo el aislamiento por tenant. Refactorizamos `finalizeOrder`/`reopenOrder`
para usarlo, con "claim" atómico anti-doble-finalización. Después migramos las columnas de
dinero a `bigint` en centavos y adoptamos la convención "todo el dinero es entero en centavos".

**Tech Stack:** Drizzle (transacciones + `bigint`), Postgres, vitest.

**Orden:** MT-1 → MT-2 → MT-3 → MT-4 → MT-5. MT-4 es el más grande (varios días); no lo
empieces sin MT-1..MT-3 en verde y un backup.

---

## Task MT-1: Método `transaction()` en `TenantDb`

**Files:**
- Modify: `apps/api/src/db/scope.ts` (clase `TenantDb`)
- Test: `apps/api/test/scope-tx.test.ts` (nuevo)

- [ ] **Step 1: Escribir el test que falla.**

Crear `apps/api/test/scope-tx.test.ts`:
```ts
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
```

- [ ] **Step 2: Correr y ver que falla.**

Run: `cd apps/api && npm test -- scope-tx`
Expected: FALLA — `tdb.transaction` no existe.

- [ ] **Step 3: Implementar `transaction()` en `TenantDb`.**

En `apps/api/src/db/scope.ts`, dentro de la clase `TenantDb`, agregar este método (por
ejemplo, después de `count()` y antes del `}` de cierre de la clase):
```ts
  /**
   * Ejecuta `fn` dentro de una transacción Postgres, con un TenantDb scopeado al
   * mismo tenant. Si `fn` lanza, se hace ROLLBACK de todo. Si esta instancia ya
   * está dentro de una transacción, Drizzle usa un SAVEPOINT (transacción anidada).
   */
  async transaction<T>(fn: (tx: TenantDb) => Promise<T>): Promise<T> {
    return this.database.transaction(async (txdb) => {
      const scoped = new TenantDb(txdb as unknown as Database, this.tenantId);
      return fn(scoped);
    });
  }
```
Asegurate de que `Database` esté importado en el archivo (ya lo está:
`import { db, type Database } from "./client.js";`).

- [ ] **Step 4: Correr y ver que pasa.**

Run: `cd apps/api && npm test -- scope-tx`
Expected: PASA los 3 casos.

- [ ] **Step 5: Suite + typecheck + commit.**

Run: `cd apps/api && npm test && npm run typecheck`
```bash
git add apps/api/src/db/scope.ts apps/api/test/scope-tx.test.ts
git commit -m "feat(db): TenantDb.transaction — transacciones con aislamiento por tenant"
```

---

## Task MT-2: `finalizeOrder` atómico y a prueba de concurrencia

**Problema:** hoy `finalizeOrder` (`orders.ts:197`) descuenta stock, crea el ingreso y marca
la orden en pasos separados sin transacción. Dos entregas simultáneas → stock negativo +
ingreso duplicado; un fallo a mitad deja stock descontado sin ingreso. Ver BUG 1.

**Files:**
- Modify: `apps/api/src/domain/orders.ts` (`finalizeOrder`, líneas 197-282)
- Test: `apps/api/test/orders.test.ts` (agregar caso de concurrencia)

- [ ] **Step 1: Escribir el test de concurrencia que falla.**

En `apps/api/test/orders.test.ts`, agregar al `describe`:
```ts
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
```

- [ ] **Step 2: Correr y ver que falla (o es flaky).**

Run: `cd apps/api && npm test -- orders`
Expected: FALLA o intermitente — hoy puede descontar dos veces o crear dos ingresos.

- [ ] **Step 3: Reescribir `finalizeOrder` con transacción + claim atómico.**

En `apps/api/src/domain/orders.ts`:

Primero, agregar `isNull` al import de `drizzle-orm` (línea 1):
```ts
import { and, desc, eq, isNull, sql } from "drizzle-orm";
```
Reemplazar TODO el cuerpo de `finalizeOrder` (líneas 197-282) por:
```ts
export async function finalizeOrder(
  tdb: TenantDb,
  actor: Actor,
  id: string,
): Promise<FinalizeResult | null> {
  const order = await tdb.findById(workOrders, id);
  if (!order) return null;
  if (order.finalizedAt) {
    return { order, warnings: ["La orden ya estaba finalizada"] };
  }

  return tdb.transaction(async (t) => {
    // Claim atómico: sólo un llamado gana el "finalized_at IS NULL".
    const claimed = await t.update(
      workOrders,
      {
        status: "Entregado",
        deliveryDate: todayDate(),
        finalizedAt: new Date(),
        updatedAt: new Date(),
      },
      and(eq(workOrders.id, id), isNull(workOrders.finalizedAt)),
    );
    if (claimed.length === 0) {
      const current = await t.findById(workOrders, id);
      return { order: current ?? order, warnings: ["La orden ya estaba finalizada"] };
    }
    const finalized = claimed[0] as WorkOrder;
    const warnings: string[] = [];

    // 1. Descontar stock de repuestos de inventario (rollback si falta stock).
    for (const part of order.parts) {
      if (!part.fromInventory || !part.productId) continue;
      const product = await t.findById(products, part.productId);
      if (!product) {
        warnings.push(`Producto no encontrado: ${part.name}`);
        continue;
      }
      if (product.quantity < part.quantity) {
        throw new Error(
          `Stock insuficiente de "${product.name}" (hay ${product.quantity}, se necesitan ${part.quantity})`,
        );
      }
      const newQty = product.quantity - part.quantity;
      await t.updateById(products, product.id, {
        quantity: newQty,
        lowStock: newQty <= product.reorderPoint,
        updatedAt: new Date(),
      });
      await logInventoryMovement(t, actor, {
        productId: product.id,
        productName: product.name,
        productType: product.type,
        movementType: "stock_decrease",
        previousQuantity: product.quantity,
        newQuantity: newQty,
        quantityChange: -part.quantity,
        reason: `Orden #${order.number}`,
      });
    }

    // 2. Ingreso automático (mano de obra + servicios + venta de repuestos).
    if (order.total > 0) {
      await t.insert(transactions, {
        date: todayDate(),
        description: `Orden #${order.number} - ${order.vehiclePlate} (${order.customerName})`,
        type: "Ingreso",
        category: categorizeService(order.services),
        amount: order.total,
        active: true,
        vehicleId: order.vehicleId,
        workOrderId: order.id, // ← link al pedido (ver plan 05 BL-1)
        vehicleDetails: {
          plate: order.vehiclePlate,
          brand: order.vehicleInfo,
          model: "",
          customer: order.customerName,
        },
        paymentMethod: "Efectivo",
      });
    }

    // 3. Actualizar vehículo + métricas del cliente.
    if (order.vehicleId) {
      await t.updateById(vehicles, order.vehicleId, {
        status: "Entregado",
        inTaller: false,
        exitDate: todayDate(),
        cost: order.total,
        lastUpdated: nowIso(),
        updatedAt: new Date(),
      });
      if (order.customerId) await recalcCustomerMetrics(t, order.customerId);
    }

    return { order: finalized, warnings };
  });
}
```
Nota: el campo `workOrderId` en `transactions` todavía NO existe; se agrega en el plan 05
(BL-1). Si querés que MT-2 compile YA sin ese plan, **borrá la línea `workOrderId: order.id,`**
por ahora y agregala cuando hagas BL-1. (El resto es correcto sin esa línea.)

- [ ] **Step 4: Correr y ver que pasa.**

Run: `cd apps/api && npm test -- orders`
Expected: PASAN todos, incluido el nuevo de concurrencia y los existentes
(idempotencia, "bloquea finalize por stock insuficiente" — ahora además no descuenta parcial).

- [ ] **Step 5: Suite completa + typecheck + commit.**

Run: `cd apps/api && npm test && npm run typecheck`
```bash
git add apps/api/src/domain/orders.ts apps/api/test/orders.test.ts
git commit -m "fix(orders): finalizar orden en transacción con claim atómico (anti doble-ingreso/stock)"
```

---

## Task MT-3: `reopenOrder` atómico

**Problema:** `reopenOrder` (`orders.ts:326`) repone stock y revierte ingreso en pasos
sueltos; si falla a mitad, queda inconsistente.

**Files:**
- Modify: `apps/api/src/domain/orders.ts` (`reopenOrder`, líneas 326-384)
- Test: `apps/api/test/orders.test.ts`

- [ ] **Step 1: Test que falla.**

Agregar en `orders.test.ts`:
```ts
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
```

- [ ] **Step 2: Correr y ver que falla o pasa parcialmente.**

Run: `cd apps/api && npm test -- orders`
Expected: puede pasar el happy-path pero no garantiza atomicidad. Seguimos igual para blindarlo.

- [ ] **Step 3: Envolver `reopenOrder` en `tdb.transaction`.**

En `apps/api/src/domain/orders.ts`, reemplazar el cuerpo de `reopenOrder` (desde
`const order = await tdb.findById(workOrders, id);` hasta el `return reopened ?? order;`) por:
```ts
  const order = await tdb.findById(workOrders, id);
  if (!order) return null;

  return tdb.transaction(async (t) => {
    // 1. Reponer stock descontado en la entrega.
    if (order.finalizedAt) {
      for (const part of order.parts) {
        if (!part.fromInventory || !part.productId) continue;
        const product = await t.findById(products, part.productId);
        if (!product) continue;
        const newQty = product.quantity + part.quantity;
        await t.updateById(products, product.id, {
          quantity: newQty,
          lowStock: newQty <= product.reorderPoint,
          updatedAt: new Date(),
        });
        await logInventoryMovement(t, actor, {
          productId: product.id,
          productName: product.name,
          productType: product.type,
          movementType: "stock_increase",
          previousQuantity: product.quantity,
          newQuantity: newQty,
          quantityChange: part.quantity,
          reason: `Reapertura orden #${order.number}`,
        });
      }
    }

    // 2. Revertir el ingreso de la entrega.
    //    (Cuando esté hecho el plan 05 BL-1, filtrar por workOrderId en vez de vehicleId.)
    if (order.vehicleId) {
      const income = await t.selectOne(
        transactions,
        and(
          eq(transactions.vehicleId, order.vehicleId),
          eq(transactions.type, "Ingreso"),
          eq(transactions.active, true),
        ),
      );
      if (income) {
        await t.updateById(transactions, income.id, { active: false, updatedAt: new Date() });
      }
    }

    // 3. Reabrir la orden.
    const reopened = await t.updateById(workOrders, id, {
      status: targetStatus,
      finalizedAt: null,
      deliveryDate: null,
      updatedAt: new Date(),
    });
    if (order.customerId) await recalcCustomerMetrics(t, order.customerId);
    return reopened ?? order;
  });
```

- [ ] **Step 4: Correr y ver que pasa.**

Run: `cd apps/api && npm test -- orders`
Expected: PASA.

- [ ] **Step 5: Suite + typecheck + commit.**

Run: `cd apps/api && npm test && npm run typecheck`
```bash
git add apps/api/src/domain/orders.ts apps/api/test/orders.test.ts
git commit -m "fix(orders): reabrir orden en transacción (repone stock + revierte ingreso atómico)"
```

---

## Task MT-3b: Envolver los call-sites que hacen varias escrituras

`domain/vehicles.ts` (`syncOrderAndFinance`, ~línea 38-113) llama a `finalizeOrder` dentro de
un `try/catch` y, si falla, deja el vehículo "Entregado". Como ahora `finalizeOrder` es
atómico, el fallo revierte sus propios efectos, pero el vehículo puede quedar entregado sin
orden finalizada. Ese caso se resuelve en el **plan 05 (BL-5)**. Por ahora, MT-3 no lo toca:
dejá el `try/catch` como está. Solo verificá que la suite `domain`/`whatsapp` siga verde tras
MT-2/MT-3:

- [ ] Run: `cd apps/api && npm test` → verde. Si algo del bot/vehículos rompió, es por el
  cambio de firma interna (no cambió la firma pública de `finalizeOrder`/`reopenOrder`, así
  que no debería). Si rompe, revisá que no hayas dejado imports sin usar.

---

## Task MT-4: Migrar el dinero a enteros en centavos

> ⚠️ **La tarea más grande del plan.** Estimación: 2-4 días. Requiere backup + staging.
> Convención destino: **TODO el dinero se guarda como entero de centavos** (`bigint`,
> `mode: "number"`). Ej: $1.234,56 → `123456`. Se formatea dividiendo por 100 solo en la UI.
> Motivo: los float (`doublePrecision`) acumulan errores de centavos en sumas (BUG 15).

### Inventario de columnas de dinero a migrar (todas hoy `doublePrecision`)

| Tabla | Columnas |
|---|---|
| `customers` | `total_spent` |
| `vehicles` | `cost` |
| `vehicle_movements` | `previous_cost`, `new_cost`, `cost_change` |
| `products` | `price` (¡`quantity` y `reorder_point` NO son dinero — dejarlas!) |
| `inventory_movements` | `previous_price`, `new_price` |
| `transactions` | `amount` |
| `partners` | `monthly_contribution`, `total_contributed` (`investment_percentage` NO) |
| `work_orders` | `labor_cost`, `parts_cost`, `total` |
| `presupuestos` | `subtotal`, `total` |
| `billing_customers` | `wallet_balance` |
| `subscriptions` | `amount` |
| `charges` | `gross_amount`, `discount_amount`, `net_amount` |
| `wallet_ledger` | `amount`, `balance_after` |

Además, dinero dentro de columnas **jsonb** (interpretar como centavos tras la migración):
- `work_orders.parts[]` → `unitPrice` (OrderPart)
- `presupuestos.items[]` → `unitPrice` (QuoteItem)
- `vehicles.parts[]` → `price` (VehiclePart), `vehicles.costs` → `laborCost/partsCost/totalCost`
- `transactions.vehicle_details` no tiene dinero.

- [ ] **Step 1: Backup completo antes de tocar nada.**

Run (en el server o local con la DB de prod apuntada):
```bash
pg_dump "$DATABASE_URL" | gzip > backup-pre-money-migration-$(date +%F).sql.gz
```
Guardar ese backup OFF del server (bajarlo). NO continuar sin backup verificado.

- [ ] **Step 2: Escribir la migración SQL de datos (multiplica ×100 y castea a bigint).**

Crear a mano `apps/api/drizzle/9999_money_to_cents.sql` (el número debe ser mayor que la
última migración existente; mirá `apps/api/drizzle/` y usá el siguiente índice). Contenido —
una sentencia por columna, patrón `ROUND(col*100)` y cambio de tipo a `bigint`:
```sql
-- Convierte columnas de dinero de doublePrecision a bigint (centavos).
-- Patrón por columna: multiplicar por 100, redondear, castear a bigint.

ALTER TABLE customers            ALTER COLUMN total_spent          TYPE bigint USING ROUND(total_spent * 100);
ALTER TABLE vehicles             ALTER COLUMN cost                 TYPE bigint USING ROUND(cost * 100);
ALTER TABLE vehicle_movements    ALTER COLUMN previous_cost        TYPE bigint USING ROUND(previous_cost * 100);
ALTER TABLE vehicle_movements    ALTER COLUMN new_cost             TYPE bigint USING ROUND(new_cost * 100);
ALTER TABLE vehicle_movements    ALTER COLUMN cost_change          TYPE bigint USING ROUND(cost_change * 100);
ALTER TABLE products             ALTER COLUMN price                TYPE bigint USING ROUND(price * 100);
ALTER TABLE inventory_movements  ALTER COLUMN previous_price       TYPE bigint USING ROUND(previous_price * 100);
ALTER TABLE inventory_movements  ALTER COLUMN new_price            TYPE bigint USING ROUND(new_price * 100);
ALTER TABLE transactions         ALTER COLUMN amount               TYPE bigint USING ROUND(amount * 100);
ALTER TABLE partners             ALTER COLUMN monthly_contribution TYPE bigint USING ROUND(monthly_contribution * 100);
ALTER TABLE partners             ALTER COLUMN total_contributed    TYPE bigint USING ROUND(total_contributed * 100);
ALTER TABLE work_orders          ALTER COLUMN labor_cost           TYPE bigint USING ROUND(labor_cost * 100);
ALTER TABLE work_orders          ALTER COLUMN parts_cost           TYPE bigint USING ROUND(parts_cost * 100);
ALTER TABLE work_orders          ALTER COLUMN total                TYPE bigint USING ROUND(total * 100);
ALTER TABLE presupuestos         ALTER COLUMN subtotal             TYPE bigint USING ROUND(subtotal * 100);
ALTER TABLE presupuestos         ALTER COLUMN total                TYPE bigint USING ROUND(total * 100);
ALTER TABLE billing_customers    ALTER COLUMN wallet_balance       TYPE bigint USING ROUND(wallet_balance * 100);
ALTER TABLE subscriptions        ALTER COLUMN amount               TYPE bigint USING ROUND(amount * 100);
ALTER TABLE charges              ALTER COLUMN gross_amount         TYPE bigint USING ROUND(gross_amount * 100);
ALTER TABLE charges              ALTER COLUMN discount_amount      TYPE bigint USING ROUND(discount_amount * 100);
ALTER TABLE charges              ALTER COLUMN net_amount           TYPE bigint USING ROUND(net_amount * 100);
ALTER TABLE wallet_ledger        ALTER COLUMN amount               TYPE bigint USING ROUND(amount * 100);
ALTER TABLE wallet_ledger        ALTER COLUMN balance_after        TYPE bigint USING ROUND(balance_after * 100);

-- jsonb: multiplicar los precios embebidos por 100 (redondeados a entero).
UPDATE work_orders SET parts = (
  SELECT COALESCE(jsonb_agg(jsonb_set(p, '{unitPrice}', to_jsonb(ROUND((p->>'unitPrice')::numeric * 100)))), '[]'::jsonb)
  FROM jsonb_array_elements(parts) p
) WHERE jsonb_typeof(parts) = 'array' AND jsonb_array_length(parts) > 0;

UPDATE presupuestos SET items = (
  SELECT COALESCE(jsonb_agg(jsonb_set(i, '{unitPrice}', to_jsonb(ROUND((i->>'unitPrice')::numeric * 100)))), '[]'::jsonb)
  FROM jsonb_array_elements(items) i
) WHERE jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0;

UPDATE vehicles SET parts = (
  SELECT COALESCE(jsonb_agg(jsonb_set(p, '{price}', to_jsonb(ROUND((p->>'price')::numeric * 100)))), '[]'::jsonb)
  FROM jsonb_array_elements(parts) p
) WHERE jsonb_typeof(parts) = 'array' AND jsonb_array_length(parts) > 0;

UPDATE vehicles SET costs = jsonb_build_object(
  'laborCost', ROUND((costs->>'laborCost')::numeric * 100),
  'partsCost', ROUND((costs->>'partsCost')::numeric * 100),
  'totalCost', ROUND((costs->>'totalCost')::numeric * 100)
) WHERE costs IS NOT NULL;
```
> ⚠️ Esta migración **no es reversible** automáticamente. El rollback es restaurar el backup
> del Step 1. Por eso el backup es obligatorio.

- [ ] **Step 3: Actualizar el schema Drizzle a `bigint`.**

En `apps/api/src/db/schema.ts`, importar `bigint`:
```ts
import { bigint, boolean, check, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
```
Y cambiar cada columna de dinero de `doublePrecision("x")` a `bigint("x", { mode: "number" })`,
manteniendo `.notNull()`/`.default(0)` igual. Ejemplos:
```ts
// customers
totalSpent: bigint("total_spent", { mode: "number" }).default(0),
// vehicles
cost: bigint("cost", { mode: "number" }).notNull().default(0),
// products (SOLO price; quantity y reorderPoint quedan doublePrecision)
price: bigint("price", { mode: "number" }).notNull().default(0),
// transactions
amount: bigint("amount", { mode: "number" }).notNull().default(0),
// work_orders
laborCost: bigint("labor_cost", { mode: "number" }).notNull().default(0),
partsCost: bigint("parts_cost", { mode: "number" }).notNull().default(0),
total: bigint("total", { mode: "number" }).notNull().default(0),
// … y así con todas las columnas del inventario de arriba.
```
Recorré la tabla del inventario y cambialas TODAS. No toques `quantity`, `reorder_point`,
`investment_percentage`.

- [ ] **Step 4: Actualizar los tipos jsonb (comentario de convención).**

En `schema.ts`, en las interfaces `OrderPart`, `QuoteItem`, `VehiclePart`, `VehicleCosts`,
agregar un comentario `// centavos` en los campos de dinero (`unitPrice`, `price`, `laborCost`,
`partsCost`, `totalCost`) para que quede la convención documentada. Los tipos siguen siendo
`number`; lo que cambia es la unidad (ahora centavos).

- [ ] **Step 5: Adaptar los tests (los importes ahora son centavos).**

Los tests de `orders.test.ts` y `domain.test.ts` usan importes como `laborCost: 10000`
esperando `total: 30000`. Como todo pasa a centavos, la aritmética sigue siendo consistente
entre entrada y salida (si entrás centavos, salís centavos). **No hace falta cambiar los
tests** salvo los que crucen dinero con formato de UI. Pero SÍ hay que aplicar la migración a
la DB de test: como los tests corren `resetDb()` y crean datos frescos, y el schema ya está en
`bigint`, `db:migrate` en la DB de test aplicará el nuevo tipo. Correr:
```bash
cd apps/api && npm run db:migrate   # aplica a la DB apuntada por DATABASE_URL
npm test
```
Expected: verde. Si un test fallara por comparar un float con decimales, ese test estaba
dependiendo de fracciones de centavo — corregilo usando enteros.

- [ ] **Step 6: Aplicar en staging, verificar totales, luego prod.**

1. Restaurar el backup de prod en una DB de staging.
2. Apuntar `DATABASE_URL` a staging, correr `npm run db:migrate`.
3. Verificar con SQL que los totales cuadran (×100):
   ```sql
   SELECT id, total FROM work_orders ORDER BY updated_at DESC LIMIT 5;
   ```
   Comparar contra el backup (mismo id, `total` viejo × 100 ≈ nuevo).
4. Solo si cuadra, correr en prod (con backup fresco tomado minutos antes).

- [ ] **Step 7: Commit.**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/9999_money_to_cents.sql
git commit -m "feat(money): migrar todo el dinero a enteros en centavos (bigint) — evita errores de float"
```

---

## Task MT-5: Formateo de dinero en centavos (frontend + helper backend)

**Files:**
- Modify: `apps/web/src/lib/utils.ts` (`formatCurrency`)
- Modify: los formularios que ingresan dinero (`MoneyInput`) para convertir a centavos
- Create: `apps/api/src/lib/money.ts` (helpers de servidor)

- [ ] **Step 1: Helper de servidor.**

Crear `apps/api/src/lib/money.ts`:
```ts
/** Convención: el dinero se guarda y se opera SIEMPRE en centavos (enteros). */
export const toCents = (pesos: number): number => Math.round(pesos * 100);
export const fromCents = (cents: number): number => cents / 100;
export function formatArs(cents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(cents / 100);
}
```
Usalo en `quotePdf.ts` y en cualquier lugar del backend que renderice montos (PDF del
presupuesto): reemplazar el formateo actual por `formatArs(cents)`.

- [ ] **Step 2: Frontend — `formatCurrency` divide por 100.**

En `apps/web/src/lib/utils.ts`, `formatCurrency` hoy formatea `n` directo. Cambiarlo para
interpretar centavos:
```ts
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format((cents ?? 0) / 100);
}
```

- [ ] **Step 3: Frontend — los inputs de dinero convierten a centavos al enviar.**

Localizar `MoneyInput` (`apps/web/src/components/form.tsx`) y todos los formularios que mandan
montos al backend (Orders, Quotes, Finance). El usuario tipea pesos; hay que enviar centavos.
Estrategia mínima y segura: en cada `onSubmit` que arma el body, envolver los montos con
`Math.round(pesos * 100)` antes de mandarlos, y al PRECARGAR un monto en un input para editar,
dividir por 100. Buscá los usos con:
```bash
grep -rn "laborCost\|unitPrice\|amount\|MoneyInput" apps/web/src
```
Aplicá la conversión en cada punto de entrada/salida. Agregá un helper en `utils.ts`:
```ts
export const pesosToCents = (p: number) => Math.round((p || 0) * 100);
export const centsToPesos = (c: number) => (c || 0) / 100;
```

- [ ] **Step 4: Verificar en el navegador.**

Con preview: crear una orden con mano de obra $10.000 y un repuesto $1.500 ×2, confirmar que
el total muestra **$13.000** (no $1.300 ni $1.300.000). Revisar el PDF de un presupuesto.

- [ ] **Step 5: Suite + build + commit.**

Run: `cd apps/api && npm test && cd ../web && npm run build`
```bash
git add apps/api/src/lib/money.ts apps/web/src/lib/utils.ts apps/web/src/components/form.tsx apps/web/src/pages
git commit -m "feat(money): formatear e ingresar dinero en centavos (web + PDF)"
```

---

## Cierre del plan 02

Al terminar: finalizar/reabrir son atómicos y a prueba de concurrencia, y el dinero es exacto
(enteros). Recién ahora tiene sentido construir cobro/factura (plan 06). Seguí con el
[plan 03 — Seguridad](2026-07-02-03-security-hardening.md) y el
[plan 04 — Bot/IA](2026-07-02-04-bot-ia-hardening.md) (paralelos), y después el
[plan 05 — Lógica de negocio](2026-07-02-05-business-logic-fixes.md).
