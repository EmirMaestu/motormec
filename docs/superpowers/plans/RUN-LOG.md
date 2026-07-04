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
| 1 | QW-1 stock >= 0 | ✅ hecho | 7499e87 | suite 77 passed |
| 2 | QW-3 sanitizar prompt | ✅ hecho | bd10dc2 | suite 80 passed |
| 3 | QW-4 cap input + borrar endpoint | ✅ hecho | 7005f61 | suite 80 passed |
| 4 | QW-5 guard orden finalizada | ✅ hecho | ccd1f1f | suite 81 passed |
| 5 | QW-6 timezone UTC-3 | ✅ hecho | 9c5c2c7 | suite 83 passed |
| 6 | QW-7 rate limit global | ✅ hecho | 0ff10c7 | suite 84 passed |
| 7 | QW-8 CSV injection | ⚠️ parcial | b5ec30e | helper backend csv.ts hecho+testeado (88 passed). PERO el CSV real se genera en el FRONTEND (apps/web/src/lib/export.ts, escapeCsv no neutraliza `= + - @`) → fix real PENDIENTE HUMANO (frontend, fuera de alcance) |
| 8 | MT-1 TenantDb.transaction | ✅ hecho | 290b7fc | fundacional; suite 91 passed; rollback verificado |
| 9 | MT-2 finalizeOrder atómico | ✅ hecho | 6822968 | suite 92; workOrderId omitido (se agrega en BL-1/MT-2b) |
| 10 | MT-3 reopenOrder atómico | ✅ hecho | e554c92 | suite 93 passed |
| 11 | BL-1 workOrderId + reversa | ✅ hecho | ba4c41c | fundacional; suite 94 passed; migración 0009 |
| 12 | MT-2b agregar workOrderId a finalize | ✅ hecho | ba4c41c | incluido en BL-1 |
| 13 | BL-2 revertir ingreso al borrar vehículo | ✅ hecho | 9573a1f | suite 95 passed |
| 14 | BL-3 sync vehículo al reabrir | ✅ hecho | 0180f27 | suite 96 passed |
| 15 | BL-4 timer sin solapes | ✅ hecho | eade60f | suite 97 passed |
| 16 | BL-5 no dejar Entregado si falla | ✅ hecho | 6bac068 | suite 98; updateVehicle envuelto en tx |
| 17 | BL-6 fechas AR en dominio | ✅ hecho | 5521f3f | suite 98 passed |
| 18 | BL-7 endpoint ajuste stock atómico | ✅ hecho | 55839ec | suite 100 passed; solo backend (paso frontend pendiente humano) |
| 19 | BL-8 renombrar métricas | ⏭️ omitido | — | PENDIENTE HUMANO: renombrar la key `prediccionIngresosMensual` rompería el frontend (Reports.tsx lee esa key); es cambio coordinado back+front, y el front está fuera de alcance. Redefinir retención = decisión de producto. |
| 20 | BOT-1 sanitizar tool results | ✅ hecho | 9be1ee5 | suite 101 passed |
| 21 | BOT-2 rate limit por número | ✅ hecho | 2c4f3ea | suite 102 passed |
| 22 | BOT-3 confirmación antes de escribir | ✅ hecho | 1c33f80 | suite 105; +3 tests; sin debilitar existentes |
| 23 | BOT-4 validar patente | ✅ hecho | 931a3f8 | suite 109; adaptó 1 test BOT-3 (patente válida) con justificación |
| 24 | BOT-5 cuota por tokens | ✅ hecho | 117f835 | suite 114 passed |
| 25 | BOT-6 anti-replay + fallback modelo | ✅ hecho | 5f5d15f | suite 118; Plan 04 completo |
| 26 | SEC-1 rate limit por ruta | pendiente | — | |
| 27 | SEC-2 password policy + lockout | ✅ hecho | 1b587d5 | suite 123; migración 0010 |
| 28 | SEC-4 tests aislamiento billing | ✅ hecho | 47b3398 | suite 126; sin fugas (red de seguridad) |
| 29 | SEC-5 magic bytes uploads | ✅ hecho | 3250b9e | suite 129 passed |
| 30 | SEC-6 errores genéricos | ✅ hecho | 04545bc | suite 129; solo billing 502 genericado |

## Resumen final
_(se completa al terminar)_
