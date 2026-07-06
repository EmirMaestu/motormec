# Plan 06 — Cobro y Facturación Implementation Plan

> **Para el que ejecuta:** leé primero [el plan maestro](2026-07-02-00-master-plan.md).
> **Depende del plan 02** (dinero en centavos). **Antes de PAY-4 (AFIP)**, corré una sesión de
> diseño con la skill `superpowers:brainstorming` — la facturación electrónica tiene reglas
> regulatorias y decisiones de negocio (tipos de factura, condición fiscal) que hay que fijar
> con el dueño antes de codear.

**Goal:** que el taller pueda COBRAR y FACTURAR dentro de Momec: pagos (incluidos parciales),
cuenta corriente/deuda, IVA y descuentos, link de pago, y factura AFIP. Es el módulo que falta
para que Momec sea un sistema de gestión y no un cuaderno.

**Tech Stack:** Drizzle, Postgres, zod, Mercado Pago SDK/API, AFIP (SDK de terceros o servicio),
vitest.

> Este plan es más "spec + desglose" que TDD línea por línea, porque hay decisiones de producto.
> Cada tarea tiene: modelo de datos, endpoints, criterios de aceptación y tests a escribir.

---

## Task PAY-1: Modelo de pagos + pagos parciales + cuenta corriente

**Problema:** hoy una orden entregada genera UN ingreso por el total, como si siempre se pagara
todo en efectivo al instante. No existe "pagó la mitad, debe el resto". Ver auditoría (falta
payment tracking).

### Modelo de datos (nueva tabla `payments`)

Agregar a `schema.ts` (tenant-scoped; sumala a `tenantScopedTables`):
```ts
export const paymentKind = ["efectivo", "transferencia", "tarjeta", "mercadopago", "otro"] as const;

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  amount: bigint("amount", { mode: "number" }).notNull(),   // centavos
  method: text("method", { enum: paymentKind }).notNull().default("efectivo"),
  paidAt: text("paid_at").notNull(),                         // YYYY-MM-DD (hora AR)
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("payments_tenant_order_idx").on(t.tenantId, t.workOrderId),
  index("payments_tenant_customer_idx").on(t.tenantId, t.customerId),
]);
```

### Cambios de dominio
- La orden pasa a tener un **saldo**: `total - sum(payments)`. Agregar a `workOrders` un campo
  derivado en las respuestas (calculado, no columna) o una columna `paidAmount` que se
  incrementa con cada pago (más simple para reportes). Recomendado: columna
  `paidAmount: bigint(..., { mode: "number" }).notNull().default(0)` en `work_orders`.
- **Al registrar un pago:** insertar en `payments`, incrementar `workOrders.paidAmount`
  atómicamente (`tdb.transaction`), y crear/actualizar el ingreso en `transactions` por el
  monto pagado (no por el total). Esto **reemplaza** el ingreso automático "por el total" de
  `finalizeOrder`: la entrega ya NO crea el ingreso; el ingreso lo crean los pagos.
- **Deuda del cliente:** `sum(workOrders.total - paidAmount)` de sus órdenes no saldadas.

### Endpoints
- `POST /api/orders/:id/payments` `{ amount, method, note? }` → registra pago, devuelve
  `{ payment, order: { total, paidAmount, saldo } }`.
- `GET /api/orders/:id/payments` → lista de pagos de la orden.
- `GET /api/customers/:id/balance` → deuda total del cliente + órdenes con saldo.

### Decisión de diseño (resolver antes de codear)
- ¿La entrega exige pago total, o se puede entregar con saldo pendiente (fiado)? Recomendado:
  permitir entregar con deuda (es la realidad del taller), y marcar la orden como
  `pagada` / `parcial` / `impaga`.
- Reemplazar el ingreso automático del total por ingresos por pago → **revisar `finalizeOrder`
  (plan 02) para NO crear el ingreso ahí** una vez exista este módulo.

### Criterios de aceptación / tests
- [ ] Registrar un pago parcial deja `saldo = total - pago` y crea un ingreso por el pago.
- [ ] Dos pagos que suman el total dejan `saldo = 0` y la orden `pagada`.
- [ ] La deuda del cliente refleja la suma de saldos.
- [ ] Todo en una transacción (pago + ingreso + paidAmount atómicos).

- [ ] **Commit:** `feat(cobro): pagos y pagos parciales por orden + cuenta corriente del cliente`

---

## Task PAY-2: IVA y descuentos en presupuestos y ventas

**Problema:** `computeTotals` (quotes.ts:26) hace `total = subtotal` sin IVA ni descuentos.
Ver BUG 9.

### Modelo de datos
- En `presupuestos` y en `work_orders`, agregar (todos centavos / o basis points para tasas):
  - `discountAmount: bigint(..., { mode: "number" }).notNull().default(0)` (descuento en centavos)
  - `taxRate: integer("tax_rate").notNull().default(2100)` (basis points: 2100 = 21%)
  - `taxAmount: bigint(..., { mode: "number" }).notNull().default(0)`
  - `subtotal` ya existe en presupuestos; agregarlo a `work_orders` si no está.
- En `QuoteItem` / `OrderPart` opcionalmente un `discount` por ítem (fase 2).

### Cálculo (centavos, enteros)
```ts
function computeTotals(items, laborCents, discountCents, taxRateBp) {
  const gross = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) + laborCents;
  const base = Math.max(0, gross - discountCents);
  const tax = Math.round(base * taxRateBp / 10000);
  return { subtotal: gross, discountAmount: discountCents, taxAmount: tax, total: base + tax };
}
```

### UI
- En el formulario de presupuesto/orden: campo de descuento (monto o %) y selector de IVA
  (0% / 10.5% / 21%), con desglose visible: Subtotal / Descuento / IVA / **Total**.
- El PDF del presupuesto (`quotePdf.ts`) debe mostrar el desglose.

### Criterios de aceptación / tests
- [ ] Presupuesto de $10.000 con 21% IVA → total $12.100 (en centavos: 1210000).
- [ ] Descuento de $1.000 sobre $10.000 con 21% → base 9.000, IVA 1.890, total 10.890.
- [ ] El PDF muestra Subtotal, Descuento, IVA, Total.

- [ ] **Commit:** `feat(cobro): IVA (0/10.5/21%) y descuentos en presupuestos y órdenes`

---

## Task PAY-3: Link de pago (Mercado Pago) en presupuesto/orden

**Problema:** no hay forma de que el cliente pague online. El link de pago acelera el cobro y
abre el take-rate de transacciones.

### Diseño
- Integrar **Mercado Pago Checkout Pro** (crear una "preference" y devolver el `init_point`).
- Nuevo secreto en `env.ts`: `MP_ACCESS_TOKEN` (por-tenant si se puede; si no, global sandbox
  primero).
- Endpoint `POST /api/orders/:id/payment-link` → crea preference por el saldo de la orden,
  guarda el `preferenceId`, devuelve la URL.
- Webhook `POST /webhooks/mercadopago` → verificar firma, marcar el pago
  aprobado → registrar `payment` (reusar PAY-1) idempotentemente (dedup por payment id de MP en
  `webhook_events` o tabla equivalente).
- El bot puede mandar el link por WhatsApp ("Pagá tu orden acá 👇").

### Decisión de diseño
- ¿La cuenta de MP es de Momec (con split/comisión) o de cada taller (MP Connect / OAuth)?
  Recomendado a futuro: **MP Connect** (cada taller cobra en su cuenta, Momec toma un fee por
  marketplace). Para empezar: cuenta por taller con su `MP_ACCESS_TOKEN` guardado cifrado
  (reusar `crypto/secrets.ts`).

### Criterios de aceptación / tests
- [ ] Crear link devuelve una URL de checkout válida (sandbox).
- [ ] El webhook de MP aprobado registra un `payment` y reduce el saldo, idempotente ante
  reintentos.
- [ ] Firma del webhook verificada (rechazar sin firma válida).

- [ ] **Commit:** `feat(cobro): link de pago Mercado Pago por orden + webhook idempotente`

---

## Task PAY-4: Factura electrónica AFIP

> **Corré `superpowers:brainstorming` antes.** Decisiones a fijar con el dueño: tipo de
> facturación (Factura A/B/C), condición fiscal del taller (Responsable Inscripto /
> Monotributo), punto de venta, si se usa un servicio intermediario (ej. AFIP SDK de terceros,
> o un proveedor tipo TusFacturas/Facturante) o WSFE directo con certificados.

### Diseño (alto nivel)
- Servicio `domain/billing/afip.ts` que, dada una venta (orden pagada), solicita el CAE a AFIP
  (WSFEv1) o al proveedor elegido, y guarda el resultado.
- Nueva tabla `facturas` (tenant-scoped): tipo, punto de venta, número, CAE, vencimiento CAE,
  neto, IVA, total, `workOrderId`, PDF path.
- Manejo de certificados AFIP por taller (cifrados) o delegado al proveedor.
- Generar el PDF de la factura con el CAE + QR de AFIP.

### Decisión de diseño (bloqueante)
- **Certificados AFIP por taller:** cada CUIT necesita su certificado. ¿Los sube el taller?
  ¿Los gestiona Momec como agente? Esto define todo el flujo. Resolver primero.
- Empezar en **homologación (testing de AFIP)** antes de producción.

### Criterios de aceptación (homologación)
- [ ] Emitir una Factura C de prueba y obtener un CAE válido en homologación.
- [ ] Guardar la factura + generar PDF con CAE y QR.
- [ ] Numeración correlativa por punto de venta.

- [ ] **Commit(s):** `feat(afip): emisión de factura electrónica (homologación) + PDF con CAE/QR`

---

## Task PAY-5: Conversión presupuesto → orden

**Problema:** no hay flujo de "presupuesto aprobado → crear orden"; hoy se re-tipea. Ver
auditoría (quote→order missing).

### Diseño
- Endpoint `POST /api/quotes/:id/convert` → crea una `workOrder` copiando los ítems del
  presupuesto (mapeando `QuoteItem` → `OrderPart` y/o servicios + mano de obra), vincula
  cliente/vehículo si existen, y marca el presupuesto como `aceptado` con referencia a la orden.
- Botón "Convertir en orden" en el detalle del presupuesto.
- Aprobación por WhatsApp (link firmado de "Aceptar presupuesto") puede disparar la conversión
  (integra con el bot; ver plan 09).

### Criterios de aceptación / tests
- [ ] Convertir un presupuesto crea una orden con los mismos ítems y total.
- [ ] El presupuesto queda `aceptado` con `workOrderId`.
- [ ] No se puede convertir dos veces (idempotente / guard).

- [ ] **Commit:** `feat(quotes): convertir presupuesto aprobado en orden de trabajo`

---

## Task PAY-6: Payouts de socios + balance

**Problema:** el módulo de socios calcula reparto pero no liquida nada. Ver BUG 22.

### Modelo de datos
- Nueva tabla `partner_payouts` (tenant-scoped): `partnerId`, `amount` (centavos), `paidAt`,
  `note`.
- El "balance" del socio = `(ganancia acumulada × %) - sum(payouts)`.

### Endpoints
- `POST /api/partners/:id/payouts` `{ amount, note? }` → registra un retiro/pago al socio.
- `GET /api/partners/:id/balance` → ganancia calculada, pagado, saldo.

### Decisión de diseño
- ¿La "ganancia" base para el reparto es el balance financiero del período (ingresos − egresos)?
  Fijar la definición con el dueño. Guardar el `investmentPercentage` con historial (no
  sobreescribir) para que cambios retroactivos no distorsionen liquidaciones pasadas.

### Criterios de aceptación / tests
- [ ] Registrar un payout reduce el saldo del socio.
- [ ] El balance refleja ganancia × % − payouts.

- [ ] **Commit:** `feat(socios): payouts y balance por socio`

---

## Cierre del plan 06

Con cobro + IVA + link de pago + factura, Momec deja de ser "cuaderno lindo" y pasa a ser el
sistema donde el taller opera de verdad. Seguí con el
[plan 07 — UX](2026-07-02-07-ux-frontend.md) (se puede hacer en paralelo) y luego el
[plan 08 — Arquitectura](2026-07-02-08-architecture-scale.md).
