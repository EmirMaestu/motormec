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
| 1a | Schema: tabla `payments` + `work_orders.paid_amount` + migración | pendiente | — |
| 1b | Dominio: `registrarPago` (ingreso por pago) + quitar ingreso de finalize/reopen/sync + tests | pendiente | — |
| 1c | Rutas: POST/GET `/api/orders/:id/payments` + GET `/api/customers/:id/balance` | pendiente | — |
| 1d | Frontend: registrar pago + mostrar saldo/deuda (verificar en navegador) | pendiente | — |

## Próximas decisiones (cuando lleguemos)
- PAY-2 IVA/descuentos, PAY-5 presupuesto→orden, PAY-6 payouts socios.
- Diferidas: PAY-3 Mercado Pago, PAY-4 AFIP (requieren credenciales + decisiones regulatorias).
