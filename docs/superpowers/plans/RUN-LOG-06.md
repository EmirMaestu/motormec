# RUN-LOG 06 — Cobro y Facturación

**Rama:** `overnight/plan-execution`. Modo colaborativo (decisiones con el dueño).
**Contexto:** dinero ya migrado a centavos (bigint). Trabajo TDD, un commit por sub-tarea.

## Decisiones tomadas

### PAY-1 (pagos + cuenta corriente)
- **Política de entrega: PERMITIR FIADO.** Se puede entregar con saldo pendiente; la orden
  expone estado de pago derivado: `impaga` (0 pagado), `parcial` (0 < pagado < total),
  `pagada` (pagado ≥ total). Habilita cuenta corriente del cliente (deuda = Σ saldos).
- **Modelo de ingreso: POR PAGO RECIBIDO.** `finalizeOrder` deja de crear el ingreso por el
  total. Cada pago crea su transacción `Ingreso` (ligada a `workOrderId`) por el monto cobrado.
  Se elimina también el fallback de ingreso-por-`vehicle.cost` en `syncOrderAndFinance`.

**Impacto en tests existentes (cambian a reflejar el nuevo comportamiento, NO se debilitan):**
- `orders.test.ts`: "finalize ... posts income", "finalize is idempotent", "finalize atomic
  concurrent" → finalize ya NO crea ingreso (esperar 0 ingresos tras finalize).
- `orders.test.ts`: reopen "reverses income" (MT-3) y "reverses THAT order's income" (BL-1) →
  reopen ya NO revierte ingresos (los pagos son plata real; quedan). Verificar stock restaurado.
- `domain.test.ts`: "delivering a vehicle ... posts income" y "reverting ... reverses income" →
  entregar ya NO crea ingreso; el ingreso viene de pagos.

## Sub-tareas PAY-1

| # | Sub-tarea | Estado | Commit |
|---|---|---|---|
| 1a | Schema: tabla `payments` + `work_orders.paid_amount` + migración | ✅ hecho | 47ce3a4 |
| 1b | Dominio: `registrarPago` (ingreso por pago) + quitar ingreso de finalize/reopen/sync + tests | ✅ hecho | 2b40029 |
| 1c | Rutas: POST/GET `/api/orders/:id/payments` + GET `/api/customers/:id/balance` | ✅ hecho | 6633395 |
| 1d | Frontend: registrar pago + mostrar saldo/deuda (verificar en navegador) | ✅ hecho | e869f7e |

**PAY-1 COMPLETO** — verificado end-to-end en el navegador: pago $20.000 sobre orden #6 → saldo
$42.000, estado "parcial", ingreso de $20.000 creado, deuda del cliente $42.000. Backend 138
tests verdes, frontend build verde, montos en pantalla correctos (centavos→pesos).

### PAY-2 (IVA + descuentos) — decisiones
- **Alícuotas habilitadas: 21% (general) y 0% (exento/Monotributo).**
- **Precios NETOS + IVA aparte:** el precio cargado es sin IVA; el IVA se calcula sobre el neto
  y se muestra desglosado (Subtotal / Descuento / IVA / Total).
- **Descuento GLOBAL** sobre el total (monto o %).
- Implementación: `taxRate` en basis points (2100 = 21%, 0 = exento). **Default DB/dominio = 0**
  (backward-compat con los tests existentes); el **frontend** propone 21% por defecto en docs nuevos.
  Cálculo: `base = subtotal - descuento`; `iva = round(base * taxRate/10000)`; `total = base + iva`.

### Revisión PAY-2 (pedido del dueño: clientes en Chile + informalidad)
- **Multi-moneda POR TALLER** (config en Configuración): ARS / CLP / USD. Todos los documentos y
  finanzas del taller usan esa moneda. Almacenamiento uniforme en unidades menores (×100) para
  todas; CLP se muestra sin decimales (Intl). Backend `formatArs`/PDF y frontend `formatCurrency`
  pasan a ser currency-aware (la moneda sale de `tenant.settings.currency`, default ARS).
- **IVA default "Sin IVA"** + selector opcional con presets 21% (AR), 19% (CL), 10.5%, y "otra %"
  a mano. `taxRate` en basis points (0 = sin IVA). El caso informal/en-negro = taxRate 0 (sin
  líneas fiscales en el PDF, ya soportado). El backend ya acepta cualquier tasa; es UI + default.

Sub-tareas nuevas:
| # | Sub-tarea | Estado | Commit |
|---|---|---|---|
| C1 | Backend: `currency` en TenantSettings + settings route + `formatArs`/PDF currency-aware + test | ✅ hecho | 7571798 |
| C2 | Frontend: `formatCurrency` currency-aware (desde auth) + selector de moneda en Configuración | pendiente | — |
| 2d | Frontend: selector IVA flexible (Sin IVA default + 21/19/10.5/otra) + descuento + desglose | pendiente (rehacer) | — |

Sub-tareas PAY-2 (originales):
| # | Sub-tarea | Estado | Commit |
|---|---|---|---|
| 2a | Schema: `discount_amount`/`tax_rate`/`tax_amount` (+`subtotal` en work_orders) + migración | ✅ hecho | 03a4535 |
| 2b | Dominio: computeTotals con descuento+IVA (quotes y orders) + tests | ✅ hecho | 00afb40 |
| 2c | Rutas: aceptar discount/taxRate + desglose en quotePdf | ✅ hecho | 1ca8cf9 |
| 2d | Frontend: selector IVA (21/0) + descuento global + desglose | pendiente | — |

## Próximas decisiones (cuando lleguemos)
- PAY-5 presupuesto→orden, PAY-6 payouts socios.
- Diferidas: PAY-3 Mercado Pago, PAY-4 AFIP (requieren credenciales + decisiones regulatorias).
