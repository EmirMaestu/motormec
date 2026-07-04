# RUN-LOG — Ejecución nocturna de planes

**Rama:** `overnight/plan-execution`
**Inicio:** 2026-07-02 ~03:33
**Alcance:** backend only. Planes 01 (QW-1..8 salvo QW-2), 02 (MT-1/2/3), 05 (BL-1..6, BL-8,
BL-7 endpoint), 04 (BOT-1..6), 03 (SEC-1/2/4/5/6). NO: MT-4/MT-5, frontend, planes 06/07/08/09.

## Preparación
- [x] Rama `overnight/plan-execution` creada.
- [x] Planes commiteados (`8da20f1`).
- [x] Postgres arriba (`npm run db:up`).
- [x] Línea base VERDE: **76 tests / 8 archivos** pasan.

## Bitácora de tareas

| # | Tarea | Resultado | Commit | Notas |
|---|---|---|---|---|
| 1 | QW-1 stock >= 0 | pendiente | — | |
| 2 | QW-3 sanitizar prompt | pendiente | — | |
| 3 | QW-4 cap input + borrar endpoint | pendiente | — | |
| 4 | QW-5 guard orden finalizada | pendiente | — | |
| 5 | QW-6 timezone UTC-3 | pendiente | — | |
| 6 | QW-7 rate limit global | pendiente | — | |
| 7 | QW-8 CSV injection | pendiente | — | |
| 8 | MT-1 TenantDb.transaction | pendiente | — | fundacional |
| 9 | MT-2 finalizeOrder atómico | pendiente | — | dep MT-1 |
| 10 | MT-3 reopenOrder atómico | pendiente | — | dep MT-1 |
| 11 | BL-1 workOrderId + reversa | pendiente | — | fundacional; luego completa MT-2 |
| 12 | MT-2b agregar workOrderId a finalize | pendiente | — | dep BL-1 |
| 13 | BL-2 revertir ingreso al borrar vehículo | pendiente | — | |
| 14 | BL-3 sync vehículo al reabrir | pendiente | — | |
| 15 | BL-4 timer sin solapes | pendiente | — | |
| 16 | BL-5 no dejar Entregado si falla | pendiente | — | |
| 17 | BL-6 fechas AR en dominio | pendiente | — | dep QW-6 |
| 18 | BL-7 endpoint ajuste stock atómico | pendiente | — | solo backend |
| 19 | BL-8 renombrar métricas | pendiente | — | |
| 20 | BOT-1 sanitizar tool results | pendiente | — | dep QW-3 |
| 21 | BOT-2 rate limit por número | pendiente | — | |
| 22 | BOT-3 confirmación antes de escribir | pendiente | — | |
| 23 | BOT-4 validar patente | pendiente | — | |
| 24 | BOT-5 cuota por tokens | pendiente | — | |
| 25 | BOT-6 anti-replay + fallback modelo | pendiente | — | |
| 26 | SEC-1 rate limit por ruta | pendiente | — | |
| 27 | SEC-2 password policy + lockout | pendiente | — | |
| 28 | SEC-4 tests aislamiento billing | pendiente | — | |
| 29 | SEC-5 magic bytes uploads | pendiente | — | |
| 30 | SEC-6 errores genéricos | pendiente | — | |

## Resumen final
_(se completa al terminar)_
