# Plan 05 — Correcciones de Lógica de Negocio Implementation Plan

> **Para el que ejecuta:** leé primero [el plan maestro](2026-07-02-00-master-plan.md).
> **Depende del plan 02** (transacciones + `TenantDb.transaction`). No empieces sin el 02 en
> verde.

**Goal:** cerrar los bugs de consistencia que quedan tras hacer atómico el ciclo de órdenes:
ingreso ligado a la orden correcta, reversas completas, sincronización de estados y timer.

**Tech Stack:** Drizzle, Postgres, vitest.

---

## Task BL-1: Ligar el ingreso a la orden (`workOrderId`) y arreglar la reversa

**Problema:** el ingreso de la entrega se busca por `vehicleId + type + active` sin ORDER BY;
con dos entregas del mismo vehículo, la reversa desactiva la fila equivocada. Ver BUG 4.

**Files:**
- Modify: `apps/api/src/db/schema.ts` (tabla `transactions`: agregar `workOrderId`)
- Modify: `apps/api/src/domain/orders.ts` (`finalizeOrder` set, `reopenOrder` filtro)
- Test: `apps/api/test/orders.test.ts`

- [ ] **Step 1: Agregar la columna FK.** En `schema.ts`, tabla `transactions`, tras
`vehicleId: uuid(...)`:
```ts
    workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
```
Luego `cd apps/api && npm run db:generate && npm run db:migrate`.
> Ojo con el orden de definición: `workOrders` se define DESPUÉS de `transactions` en el
> archivo. La referencia por callback `() => workOrders.id` funciona igual (lazy). Verificá que
> compile.

- [ ] **Step 2: Setear `workOrderId` al crear el ingreso.** En `finalizeOrder` (ya reescrito
en MT-2), asegurate de que el `insert` de `transactions` incluya `workOrderId: order.id`
(si lo habías borrado en MT-2, agregalo ahora).

- [ ] **Step 3: Test que falla (dos entregas, reversa correcta).**
```ts
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
```

- [ ] **Step 4: Correr y ver que falla.** `cd apps/api && npm test -- orders` → FALLA (hoy
revierte el primero que encuentra).

- [ ] **Step 5: Arreglar el filtro de reversa.** En `reopenOrder` (dentro de la transacción,
paso 2), cambiar la búsqueda del ingreso a filtrar por `workOrderId`:
```ts
    const income = await t.selectOne(
      transactions,
      and(
        eq(transactions.workOrderId, order.id),
        eq(transactions.type, "Ingreso"),
        eq(transactions.active, true),
      ),
    );
```

- [ ] **Step 6: Correr y ver que pasa.** `cd apps/api && npm test -- orders` → PASA.

- [ ] **Step 7: Suite + typecheck + commit.**
```bash
cd apps/api && npm test && npm run typecheck
git add apps/api/src/db/schema.ts apps/api/src/domain/orders.ts apps/api/drizzle apps/api/test/orders.test.ts
git commit -m "fix(finance): ligar ingreso a workOrderId y revertir la orden correcta al reabrir"
```

---

## Task BL-2: Revertir ingreso al borrar un vehículo

**Problema:** `deleteVehicle` (`vehicles.ts:329`) borra órdenes pero no desactiva los ingresos;
quedan huérfanos e inflan los reportes. Ver BUG 8.

**Files:**
- Modify: `apps/api/src/domain/vehicles.ts` (`deleteVehicle`, líneas 329-349)
- Test: `apps/api/test/domain.test.ts` (o `orders.test.ts`)

- [ ] **Step 1: Test que falla.**
```ts
  it("deleting a vehicle deactivates its income transactions", async () => {
    const order = await createOrder(tdb, actor, { plate: "DEL111", laborCost: 10000 });
    await finalizeOrder(tdb, actor, order.id);
    const { deleteVehicle } = await import("../src/domain/vehicles.js");
    await deleteVehicle(tdb, actor, order.vehicleId!);
    const activos = await tdb.select(transactions, eq(transactions.active, true));
    expect(activos.filter((t) => t.type === "Ingreso")).toHaveLength(0);
  });
```

- [ ] **Step 2: Correr y ver que falla.** → FALLA.

- [ ] **Step 3: Desactivar ingresos en `deleteVehicle`.** Envolver la operación en una
transacción y desactivar los ingresos del vehículo antes de borrar. Reemplazar el cuerpo desde
`await tdb.delete(workOrders, ...)` por:
```ts
  return tdb.transaction(async (t) => {
    // Desactivar los ingresos ligados a este vehículo (no borrarlos: preservar auditoría).
    const ingresos = await t.select(
      transactions,
      and(eq(transactions.vehicleId, id), eq(transactions.type, "Ingreso"), eq(transactions.active, true)),
    );
    for (const inc of ingresos) {
      await t.updateById(transactions, inc.id, { active: false, updatedAt: new Date() });
    }
    await t.delete(workOrders, eq(workOrders.vehicleId, id));
    const removed = await t.deleteById(vehicles, id);
    if (!removed) return null;
    await logVehicleMovement(t, actor, {
      vehicleId: null,
      vehiclePlate: existing.plate,
      vehicleInfo: vehicleInfo(existing),
      owner: existing.owner,
      movementType: "deleted",
    });
    if (existing.customerId) await recalcCustomerMetrics(t, existing.customerId);
    return removed;
  });
```
Asegurate de que `and`, `eq`, `transactions` estén importados en `vehicles.ts` (probablemente
ya lo están; si no, agregalos).

- [ ] **Step 4: Correr y ver que pasa. Suite + typecheck + commit.**
```bash
cd apps/api && npm test && npm run typecheck
git add apps/api/src/domain/vehicles.ts apps/api/test
git commit -m "fix(vehicles): al borrar un vehículo, desactivar sus ingresos (no dejar huérfanos)"
```

---

## Task BL-3: Sincronizar vehículo al reabrir la orden desde el detalle

**Problema:** reabrir desde el detalle de la orden (`routes/orders.ts` → `reopenOrder`)
cambia la orden pero no el vehículo, que queda "Entregado"/fuera del taller. Ver BUG 6.

**Files:**
- Modify: `apps/api/src/domain/orders.ts` (`reopenOrder`, paso 3 dentro de la transacción)
- Test: `apps/api/test/orders.test.ts`

- [ ] **Step 1: Test que falla.**
```ts
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
```

- [ ] **Step 2: Correr y ver que falla.** → FALLA.

- [ ] **Step 3: Sincronizar el vehículo en `reopenOrder`.** Dentro de la transacción, en el
paso 3 (tras reabrir la orden), agregar:
```ts
    if (order.vehicleId) {
      await t.updateById(vehicles, order.vehicleId, {
        status: "En Reparación",
        inTaller: true,
        exitDate: null,
        lastUpdated: nowIso(),
        updatedAt: new Date(),
      });
    }
```

- [ ] **Step 4: Correr, suite, typecheck, commit.**
```bash
cd apps/api && npm test && npm run typecheck
git add apps/api/src/domain/orders.ts apps/api/test/orders.test.ts
git commit -m "fix(orders): al reabrir una orden, devolver el vehículo al taller (sync de estado)"
```

---

## Task BL-4: Guard de sesiones de timer solapadas

**Problema:** `startWork` (`vehicles.ts:358`) agrega una nueva `workSession` aunque el mecánico
ya estuviera trabajando; queda una sesión abierta sin `endTime` y el tiempo total se infla.
Ver BUG 7.

**Files:**
- Modify: `apps/api/src/domain/vehicles.ts` (`startWork`, líneas 380-383)
- Test: `apps/api/test/domain.test.ts`

- [ ] **Step 1: Test que falla.**
```ts
  it("startWork twice does not open a second overlapping session", async () => {
    const { startWork } = await import("../src/domain/vehicles.js");
    const v0 = await tdb.insertOne(vehicles, { plate: "TIM111", entryDate: "2026-07-01", status: "Ingresado" });
    const timer = { userId: "u1", userName: "Pepe" };
    await startWork(tdb, timer, v0.id, false);
    const v = await startWork(tdb, timer, v0.id, false);
    const resp = v?.responsibles.find((r) => r.userId === "u1");
    const abiertas = (resp?.workSessions ?? []).filter((s) => !s.endTime);
    expect(abiertas.length).toBe(1); // no dos abiertas
  });
```
(`vehicles` ya está importado en `domain.test.ts`; si no, agregalo.)

- [ ] **Step 2: Correr y ver que falla.** → FALLA (hoy quedan 2 abiertas).

- [ ] **Step 3: Guard en `startWork`.** Reemplazar las líneas 380-383 por:
```ts
  const startedAt = nowIso();
  // Cerrar cualquier sesión abierta previa de este responsable (evita solapadas).
  resp.workSessions = (resp.workSessions ?? []).map((s) =>
    s.endTime ? s : { ...s, endTime: startedAt, duration: Date.parse(startedAt) - Date.parse(s.startTime) },
  );
  resp.isWorking = true;
  resp.workStartedAt = startedAt;
  resp.workSessions = [...resp.workSessions, { startTime: startedAt }];
```

- [ ] **Step 4: Correr, suite, typecheck, commit.**
```bash
cd apps/api && npm test && npm run typecheck
git add apps/api/src/domain/vehicles.ts apps/api/test/domain.test.ts
git commit -m "fix(timer): cerrar sesión abierta previa antes de iniciar otra (no solapar)"
```

---

## Task BL-5: No dejar el vehículo "Entregado" si falla la finalización

**Problema:** en `syncOrderAndFinance` (`vehicles.ts:59-72`), si `finalizeOrder` lanza (p.ej.
falta stock), se marca la orden "Entregado" sin `finalizedAt` (estado ambiguo, sin ingreso).
Ver BUG 5. Con MT-2 la finalización es atómica; ahora hay que propagar el error en vez de
tragarlo.

**Files:**
- Modify: `apps/api/src/domain/vehicles.ts` (`syncOrderAndFinance`, líneas 59-72)

- [ ] **Step 1: Dejar que el error suba.** Reemplazar el `try/catch` (líneas 60-71) por una
llamada directa que propague el error, para que la ruta lo muestre al usuario y NO marque el
vehículo entregado a medias:
```ts
    if (latest && !latest.finalizedAt) {
      // Si falta stock, finalizeOrder lanza y la operación se revierte entera.
      // El estado del vehículo NO se cambia (lo maneja el caller/route).
      await finalizeOrder(tdb, actor, latest.id);
      return;
    }
```

- [ ] **Step 2: En la ruta que cambia el estado del vehículo** (`routes/vehicles.ts`, el PATCH
de estado a "Entregado"), capturar el error de stock y devolver 409 con el mensaje, sin haber
cambiado el vehículo:
```ts
    try {
      // ... cambio de estado + syncOrderAndFinance ...
    } catch (err) {
      return reply.code(409).send({ error: "stock_insuficiente", message: (err as Error).message });
    }
```
> Excepción a "no filtrar el error" (SEC-6): el mensaje de stock es controlado por nosotros y
> útil para el mecánico; está bien mostrarlo.

- [ ] **Step 3: Test.** En `orders.test.ts` o `domain.test.ts`: entregar un vehículo cuya
última orden tiene un repuesto sin stock suficiente → la operación lanza y el vehículo NO queda
"Entregado".

- [ ] **Step 4: Suite + typecheck + commit.**
```bash
cd apps/api && npm test && npm run typecheck
git add apps/api/src/domain/vehicles.ts apps/api/src/routes/vehicles.ts apps/api/test
git commit -m "fix(vehicles): no marcar 'Entregado' si falla la finalización (propagar error de stock)"
```

---

## Task BL-6: Fechas en horario de Argentina en el dominio de órdenes

**Problema:** `orders.ts` usa `todayDate()`/`nowIso()` en UTC (líneas 17-22); a la noche
argentina la fecha de entrega/ingreso cae en el día equivocado. Ver BUG 19 (parte dominio).
Depende de QW-6 (helper `argYmd` creado).

**Files:**
- Modify: `apps/api/src/domain/orders.ts` (líneas 17-22)
- Modify: `apps/api/src/domain/vehicles.ts` (líneas 115-120, mismas funciones)

- [ ] **Step 1: Reemplazar `todayDate` por el helper AR.** En `orders.ts`, importar
`import { argYmd } from "../lib/time.js";` y cambiar:
```ts
function todayDate(): string {
  return argYmd();
}
```
Dejar `nowIso()` como está (timestamp UTC real está bien para `lastUpdated`).

- [ ] **Step 2: Igual en `vehicles.ts`** (tiene su propio `todayDate` en línea 118).

- [ ] **Step 3: Ajustar tests si comparan fechas.** Correr `npm test`; si algún test compara
la fecha con `new Date().toISOString()`, actualizarlo para usar `argYmd()`.

- [ ] **Step 4: Suite + typecheck + commit.**
```bash
cd apps/api && npm test && npm run typecheck
git add apps/api/src/domain/orders.ts apps/api/src/domain/vehicles.ts apps/api/test
git commit -m "fix(orders): fechas de ingreso/entrega en horario de Argentina (UTC-3)"
```

---

## Task BL-7: Ajuste manual de stock atómico

**Problema:** el PATCH de producto setea `quantity` absoluta con last-write-wins (dos edits
concurrentes → uno se pierde). QW-1 ya impide negativos con constraint; acá reducimos el
lost-update para ajustes relativos. Ver BUG 12.

**Files:**
- Modify: `apps/api/src/routes/products.ts` (PATCH) — decidir semántica

- [ ] **Step 1: Decisión de diseño (documentar).** Hay dos semánticas posibles para el stepper
+/–: (a) enviar la cantidad ABSOLUTA (actual, con riesgo de lost-update), o (b) enviar un
DELTA (`+1`/`-1`) y que el servidor haga `quantity = quantity + delta` atómico en SQL. La (b)
es correcta para el stepper. Elegí (b) para el stepper y dejá (a) solo para la edición del
formulario completo.

- [ ] **Step 2: Endpoint de ajuste relativo.** Agregar `POST /api/products/:id/adjust` que
reciba `{ delta: number, reason?: string }` y aplique un update atómico:
```ts
  app.post("/api/products/:id/adjust", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const { id } = request.params as { id: string };
    const parsed = z.object({ delta: z.number().int(), reason: z.string().max(500).optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const existing = await tenantDb.findById(products, id);
    if (!existing) return reply.code(404).send({ error: "not_found" });
    // Update atómico: quantity = quantity + delta (la constraint impide negativo).
    const updated = await tenantDb.update(
      products,
      { quantity: sql`${products.quantity} + ${parsed.data.delta}`, updatedAt: new Date() },
      eq(products.id, id),
    );
    // ... logInventoryMovement con quantityChange = delta ...
    return reply.send({ product: updated[0] });
  });
```
Importar `sql` de `drizzle-orm`. Si el delta deja negativo, la constraint QW-1 lanza → devolver
400 "stock insuficiente".

- [ ] **Step 3: Frontend.** Cambiar el stepper (+/–) del inventario para llamar a
`/adjust` con `delta` en vez de PATCH con cantidad absoluta.

- [ ] **Step 4: Test + suite + typecheck + commit.**
```bash
cd apps/api && npm test && npm run typecheck
git add apps/api/src/routes/products.ts apps/web/src/pages/Inventory.tsx apps/api/test
git commit -m "feat(inventory): ajuste de stock atómico por delta (evita lost-update del stepper)"
```

---

## Task BL-8: Renombrar "predicción" y redefinir retención (claridad de métricas)

**Problema:** el reporte estratégico llama "predicción" a un promedio ÷3, y la retención
cuenta all-time. Ver BUG 18/20. No es un bug de datos, es honestidad de las métricas.

**Files:**
- Modify: `apps/api/src/routes/reports.ts` (claves de respuesta), `apps/web/src/pages/Reports.tsx` (labels)

- [ ] **Step 1:** Renombrar la clave `prediccionIngresosMensual` a `promedioIngresosMensual`
en `reports.ts` y en el frontend, o dejar el cálculo pero cambiar el label visible a
"Promedio mensual (últimos 3 meses)". No prometer lo que no es.

- [ ] **Step 2 (opcional, mayor):** Redefinir retención con ventana temporal (clientes con
visita en el mes N que también visitaron N+1). Si no hay tiempo, al menos documentar en el
tooltip que es "clientes con más de 1 visita (histórico)".

- [ ] **Step 3: Commit.**
```bash
git add apps/api/src/routes/reports.ts apps/web/src/pages/Reports.tsx
git commit -m "fix(reports): renombrar 'predicción' a promedio y aclarar la métrica de retención"
```

---

## Cierre del plan 05

El ciclo de negocio queda consistente: ingresos ligados a su orden, reversas correctas,
estados sincronizados, timer sin solapes, fechas en hora local. Seguí con el
[plan 06 — Cobro y facturación](2026-07-02-06-cobro-facturacion.md).
