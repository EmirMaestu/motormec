# Plan 08 — Arquitectura y Escala Implementation Plan

> **Para el que ejecuta:** leé primero [el plan maestro](2026-07-02-00-master-plan.md). Este
> plan sube el techo de ~100 talleres a miles. No bloquea funcionalidad; se puede intercalar,
> pero conviene hacerlo cuando el producto ya esté completo (post plan 06).

**Goal:** eliminar los cuellos de botella de escala: pool chico, queries que cargan tablas
enteras a JS, procesamiento del webhook en el event loop, fotos en disco, sesiones sin limpieza,
shutdown que corta requests, estado del bot en memoria.

**Tech Stack:** Fastify, Drizzle, Postgres (réplica), pg-boss/BullMQ, Cloudflare R2/S3.

---

## Task ARCH-1: Pool de conexiones configurable

**Files:** `apps/api/src/db/client.ts`, `apps/api/src/config/env.ts`

- [ ] **Step 1:** En `env.ts`, agregar `DB_POOL_MAX: z.coerce.number().int().positive().default(10)`.
- [ ] **Step 2:** En `client.ts`, usarlo: `new Pool({ connectionString: env.DATABASE_URL, max: env.DB_POOL_MAX })`.
- [ ] **Step 3:** En prod, setear `DB_POOL_MAX=20` (o más, según los `max_connections` de
Postgres; regla: `pool_max × instancias < max_connections − reservas`). Documentar en `DEPLOY.md`.
- [ ] **Step 4: Commit.** `feat(db): tamaño de pool configurable por env (default 10, prod 20+)`

---

## Task ARCH-2: Agregación en SQL + paginación en dashboard y reportes

**Problema:** `dashboard.ts:15,20` y `reports.ts:32,81-86,120-121` cargan tablas enteras a JS y
agregan con `Map`/`filter` (N+1). A 1.000 talleres esto tumba el server. Ver auditoría ARCH-2.

**Files:** `apps/api/src/routes/dashboard.ts`, `apps/api/src/routes/reports.ts`, `apps/api/src/db/scope.ts`

- [ ] **Step 1: Exponer agregaciones scopeadas en `TenantDb`.** Agregar métodos que hagan
`SUM`/`COUNT`/`GROUP BY` en SQL con el predicado de tenant. Ejemplo genérico:
```ts
  async sum<T extends TenantScopedTable>(table: T, column: PgColumn, where?: SQL): Promise<number> {
    const res = await this.database
      .select({ s: sql<number>`coalesce(sum(${column}), 0)::bigint` })
      .from(table as TenantScopedTable)
      .where(this.scope(table, where));
    return Number(res[0]?.s ?? 0);
  }
```
(Para `GROUP BY` por categoría/mes, escribir queries específicas en cada reporte usando
`this.database.select({...}).from(table).where(this.scope(...)).groupBy(...)`.)

- [ ] **Step 2: Reescribir el dashboard** para pedir contadores por estado con `COUNT ... GROUP
BY status` y sumas con `SUM(amount) GROUP BY substring(date,1,7)` en SQL, en vez de traer todas
las filas. Devolver solo lo que la UI muestra.

- [ ] **Step 3: Reescribir los reportes** igual: agregación por categoría/método/mes en SQL. Los
loops N+1 (customers→vehicles, products→movements) se reemplazan por `JOIN` o subconsultas
agregadas.

- [ ] **Step 4: Paginación.** En los listados grandes (vehículos, órdenes, transacciones,
movimientos) aceptar `?limit=&offset=` y aplicar `.limit().offset()` en la query. El frontend
pagina o hace scroll infinito.

- [ ] **Step 5: Test de correctitud.** Antes/después: para un tenant con datos de prueba, los
totales agregados en SQL deben coincidir con los que daba el cálculo en JS. Escribir un test que
compare.

- [ ] **Step 6: Suite + commit.** `perf(reports): agregación en SQL + paginación (elimina N+1 y full-scans)`

---

## Task ARCH-3: Cron de limpieza de sesiones expiradas

**Problema:** la tabla `sessions` crece; hay `purgeExpiredSessions` pero nada la llama. Ver
auditoría ARCH.

**Files:** `apps/api/src/scripts/purge-sessions.ts` (nuevo), `infra/systemd/` (timer)

- [ ] **Step 1:** Crear un script que borre sesiones vencidas:
```ts
import { lt } from "drizzle-orm";
import { db, pool } from "../db/client.js";
import { sessions, platformSessions } from "../db/schema.js";
await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
await db.delete(platformSessions).where(lt(platformSessions.expiresAt, new Date()));
await pool.end();
```
Agregar script npm: `"purge:sessions": "tsx src/scripts/purge-sessions.ts"`.

- [ ] **Step 2:** Crear un systemd timer diario en `infra/systemd/` que corra el script como
usuario `motormec` (modelar sobre el timer de backup).

- [ ] **Step 3: Commit.** `feat(ops): purga diaria de sesiones expiradas (cron)`

---

## Task ARCH-4: Fotos en storage de objetos (R2/S3)

**Problema:** las fotos viven en disco del VPS; a escala se llena. Ya existe `StorageProvider`
como abstracción. Ver auditoría ARCH.

**Files:** `apps/api/src/storage/provider.ts` (nueva impl S3/R2), `env.ts`

- [ ] **Step 1:** Implementar `S3StorageProvider` detrás de la interfaz `StorageProvider`
existente (usar el SDK de S3, compatible con R2). Configurar por env (`STORAGE_DRIVER=s3|disk`,
bucket, credenciales).
- [ ] **Step 2:** Servir las fotos con URLs firmadas (presigned) de vencimiento corto, o seguir
proxeando por `/api/media` (que ya valida auth + tenant + path). Mantener el prefijo por tenant.
- [ ] **Step 3:** Script de migración de las fotos existentes del disco al bucket.
- [ ] **Step 4: Test** del provider (subir/leer/borrar contra un bucket de prueba o un mock).
- [ ] **Step 5: Commit.** `feat(storage): driver S3/R2 detrás de StorageProvider + migración de media`

---

## Task ARCH-5: Cola de jobs para webhooks / notificaciones / PDF

**Problema:** el webhook procesa en `setImmediate` en el event loop (`webhook.ts:62`); un taller
lento bloquea a los demás; sin reintentos. Ver auditoría ARCH.

**Files:** nuevo `apps/api/src/queue/` (worker + productor), `webhook.ts`

- [ ] **Step 1: Elegir la cola.** `pg-boss` (usa el mismo Postgres, cero infra nueva) es la
opción de menor fricción; `BullMQ` (Redis) si ya vas a meter Redis para sesiones/estado. Decisión
de diseño — recomendado empezar con **pg-boss**.
- [ ] **Step 2:** El webhook, tras verificar firma + ACK 200, encola el payload (`publish`) en
vez de procesarlo inline. Un worker consume, procesa (parser + agente + notificaciones), con
reintentos y dead-letter.
- [ ] **Step 3:** Mover el envío de notificaciones al cliente y la generación de PDF a jobs.
- [ ] **Step 4:** Correr el worker como un proceso/servicio systemd separado.
- [ ] **Step 5: Test** del productor/worker (encolar y procesar un mensaje de prueba).
- [ ] **Step 6: Commit.** `feat(queue): procesar webhooks/notificaciones/PDF en cola con reintentos`

---

## Task ARCH-6: Estado del bot fuera de memoria + escalado horizontal

**Problema:** el rate limiter por número (BOT-2) y cualquier estado en memoria rompen con
múltiples instancias. Ver auditoría ARCH (single process).

- [ ] **Step 1:** El estado de conversación ya está en Postgres (`conversaciones`), bien. Mover
el `PhoneRateLimiter` (in-memory, plan 04) a Postgres o Redis para que sea compartido.
- [ ] **Step 2:** Verificar que no quede ningún otro estado en memoria del proceso (revisar
`stateMachine`, caches). Todo lo compartible va a la DB/Redis.
- [ ] **Step 3:** Con estado externalizado, correr N instancias de Fastify detrás de Caddy
(upstream con varias `to`). Documentar en `DEPLOY.md`.
- [ ] **Step 4: Commit.** `feat(scale): externalizar estado del bot para permitir múltiples instancias`

---

## Task ARCH-7: Graceful shutdown que drene requests

**Problema:** `server.ts:8-14` cierra el pool y la app sin drenar requests en vuelo; deploy corta
conexiones. Ver auditoría RELIABILITY.

**Files:** `apps/api/src/server.ts`

- [ ] **Step 1:** En el handler de SIGTERM/SIGINT, primero dejar de aceptar nuevas conexiones y
esperar a que terminen las en vuelo (Fastify `app.close()` ya espera las requests activas), con
un timeout de gracia (ej. 25s) antes de forzar. Cerrar la cola y el pool al final.
```ts
async function shutdown() {
  try {
    await app.close();          // deja de aceptar y drena las activas
    // await queue.stop();      // si hay cola
    await pool.end();
  } finally {
    process.exit(0);
  }
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```
- [ ] **Step 2:** En el systemd unit, subir `TimeoutStopSec` a 30s para dar margen al drain.
- [ ] **Step 3: Commit.** `fix(ops): graceful shutdown que drena requests en vuelo`

---

## Cierre del plan 08

Con esto Momec pasa el techo de ~100 a varios miles de talleres. La escala a 10k-100k
(sharding, multi-región, réplicas de lectura dedicadas) se planifica aparte cuando el volumen lo
justifique. Seguí con el [plan 09 — Nuevas features](2026-07-02-09-new-features.md).
