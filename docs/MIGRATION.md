# Migración de datos a Momec (sin pérdida)

Cómo pasar **todo lo que hoy funciona en el sistema viejo (Convex + Clerk + Vercel)**
a Momec (Fastify + Postgres) sin perder datos. La lógica de transformación ya está
escrita en [`apps/api/src/scripts/migrate-from-convex.ts`](../apps/api/src/scripts/migrate-from-convex.ts);
acá está el runbook para ejecutarla con seguridad.

## Principios

1. **Nunca sobre producción primero.** Se corre en **staging** (copia), se valida,
   y recién ahí en prod.
2. **Conteos validados.** El script compara filas por tabla (export vs Postgres) y
   sale con error si algo no coincide.
3. **Idempotente por tablas vacías.** Si algo falla a mitad, se borra el tenant
   creado (`DELETE FROM tenants WHERE slug=...` cascada) y se reintenta limpio.
4. **Un tenant para el taller actual.** Todo lo migrado queda aislado bajo ese taller.

## Qué se migra

customers, vehicles, transactions, products, partners, services, categories,
conversaciones, historial_taller, vehicle_movements, inventory_movements, y las
**fotos** de Convex Storage → disco (`MEDIA_ROOT/<tenant>/<historial>/...`). Las
referencias (customer_id, vehicle_id, historial_id, product_id) se preservan
mapeando los ids de Convex a uuids nuevos.

> Tablas que **no** se migran a propósito (mejora del rediseño): `metrics`,
> `chartData`, `dashboardItems`, `navigationItems`, `appConfig` — se calculan al
> vuelo o viven en `tenants.settings`.

## Paso a paso

### 1. Exportar de Convex

Desde el proyecto viejo:

```bash
npx convex export --path dev-export.zip
```

Esto genera un `.zip` con un `documents.jsonl` por tabla (y `_storage/` con las
fotos, si hay). Ya hay un export de ejemplo en la raíz (`dev-export.zip`).

### 2. Preparar Postgres (staging)

```bash
# Postgres local (Docker) o el de tu VPS de staging
npm run db:up                      # desde la raíz (Docker en :5433)
cd apps/api
cp .env.example .env               # ajustar DATABASE_URL + SECRETS_KEY + MEDIA_ROOT
npm run db:migrate                 # crea el esquema
```

### 3. Correr la migración

```bash
cd apps/api
npm run migrate:convex -- /ruta/dev-export.zip <slug> "Nombre del Taller"
# ej: npm run migrate:convex -- ../../dev-export.zip taller-central "Taller Central"
```

Salida esperada (sale con error si algún conteo no coincide):

```
Migration counts (source → inserted):
  ✓ customers: 26 → 26
  ✓ vehicles: 100 → 100
  ✓ transactions: 102 → 102
  ...
Tenant 'taller-central' (<uuid>) — ALL COUNTS MATCH
```

### 4. Validar referencias (spot-check)

```sql
-- Vehículos vinculados a un cliente, sin referencias colgadas
SELECT
 (SELECT count(*) FROM vehicles v JOIN tenants t ON t.id=v.tenant_id
    WHERE t.slug='taller-central' AND v.customer_id IS NOT NULL) AS con_cliente,
 (SELECT count(*) FROM vehicles v JOIN tenants t ON t.id=v.tenant_id
    WHERE t.slug='taller-central' AND v.customer_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id=v.customer_id)) AS colgadas;
```

`colgadas` debe ser **0**. Revisar también un par de fotos en `MEDIA_ROOT`.

### 5. Crear los usuarios del taller

El sistema viejo usaba Clerk; Momec tiene auth propia. Creá el/los usuarios:

```bash
cd apps/api
node --import tsx -e "
import { createUser } from './src/db/admin.ts';
import { db } from './src/db/client.ts'; import { pool } from './src/db/client.ts';
import { tenants } from './src/db/schema.ts'; import { eq } from 'drizzle-orm';
const [t] = await db.select().from(tenants).where(eq(tenants.slug,'taller-central'));
await createUser({ tenantId: t.id, name: 'Dueño', username: 'admin', password: 'CAMBIAR', role: 'admin' });
console.log('ok'); await pool.end();
"
```

### 6. Cargar el número de WhatsApp del taller

En Momec (Bot WhatsApp → Configuración) o por SQL: setear `wa_phone_number_id`,
`wa_display_number` y el access token (se guarda cifrado). El número actual del
taller se mantiene.

### 7. Cut-over a producción

1. Repetir 1–6 contra la base de **producción** (idealmente con un export fresco
   del mismo día para no perder lo cargado entre staging y prod).
2. **Congelar** el sistema viejo unos minutos (avisar que no carguen vehículos).
3. Export final → migración → validación de conteos.
4. Apuntar el DNS / webhook de Meta al nuevo deploy ([`DEPLOY.md`](../DEPLOY.md)).
5. Dejar el sistema viejo en solo-lectura 1–2 semanas como respaldo.

## Importar el cuaderno / planilla (CSV)

Si además hay datos en un cuaderno o Excel (no en Convex), el formato CSV del
cuaderno del taller ya está soportado (ver `datos_cuaderno_taller.csv` de ejemplo).
Se importa por la pantalla de importación del dashboard, scopeado al tenant.

## Rollback

Como cada migración crea un tenant nuevo y aislado, revertir es:

```sql
DELETE FROM tenants WHERE slug = 'taller-central';  -- borra en cascada todo lo migrado
```

El sistema viejo nunca se toca durante la migración, así que siempre es la red de seguridad.
