# MotorMec — Diseño de reescritura (Convex → VPS, multi-taller)

**Fecha:** 2026-06-28
**Estado:** aprobado (decisiones de stack confirmadas por el dueño)

Este documento es la fuente de verdad del rediseño. El prompt para el LLM que va a
reconstruir el sistema vive en `docs/PROMPT_REBUILD.md` y se deriva de acá.

## Objetivo

Reescribir MotorMec **de cero** para venderlo como **SaaS multi-taller**, sacándolo de
Convex y moviéndolo a un **VPS** propio, **sin perder ninguna funcionalidad** y mejorando
seguridad, aislamiento y costo. Debe "funcionar como Yumi": mismo modelo de deploy
(VPS + Caddy + systemd), auth propia, costo fijo.

## Decisiones (confirmadas)

| Tema | Decisión |
|------|----------|
| Modelo de venta | **Multi-inquilino**: un solo deploy, todos los talleres aislados por `tenant_id`. |
| Backend | **Node/TypeScript** (Fastify + Drizzle ORM). Se elige TS sobre Python porque la lógica actual (~6.700 líneas Convex) ya es TS → se porta ~1:1, mínimo riesgo de perder funcionalidad. |
| Base de datos | **Postgres** (multi-taller con escrituras concurrentes). |
| Auth | **Propia**: cookie httponly+secure+samesite, hash PBKDF2, rate-limit en login (patrón Yumi). |
| Tiempo real | **No**: TanStack Query con refetch/polling. |
| Storage fotos | **Disco del VPS** por tenant; camino a Cloudflare R2 si escala. |
| IA parser | **Groq LLaMA 3.1 8B** (se mantiene; gratis/barato). |
| Frontend | React 19 + Vite + Tailwind v4 + Radix/shadcn (se mantiene); **sigue la guía de diseño** que adjunta el dueño. |

## Estado actual (lo que NO se puede perder)

**Stack hoy:** React 19/Vite/TS/Tailwind v4/Radix en **Vercel**; **Clerk** (auth);
backend **100% Convex** + **Convex Storage** (fotos). **No es multi-taller.**

**Funcionalidad existente:**

1. **Bot de WhatsApp** (webhook Convex `/whatsapp` ↔ Meta Cloud API):
   - Máquina de estados por teléfono (`conversaciones`): `verificando_cliente → confirmando → pidiendo_fotos`. Expira a los 30 min.
   - **Botones interactivos** de WhatsApp (con fallback a texto).
   - Extracción por IA (**Groq LLaMA 3.1 8B-instant**, temp 0.1) de: `marca_modelo`, `kilometraje`, `patente`, `tarea` (literal, sin resumir), `cliente`.
   - Busca cliente por nombre en la base → si lo encuentra, pide confirmar con botones; si no, lo marca nuevo.
   - Descarga fotos de Meta (Graph API) y las guarda.
   - Crea el vehículo con estado `Ingresado` y vincula el registro de `historial_taller`.
   - **Whitelist de números** (`numerosAutorizados`); número no autorizado recibe rechazo.
   - Idempotencia por `whatsappMessageId`.

2. **Dashboard web:**
   - **Vehículos**: alta/edición, estados (Ingresado → En Reparación → Listo → Entregado), **historial de movimientos** (`vehicleMovements`), **responsables/mecánicos** con **cronómetro de trabajo** (sesiones start/end, tiempo total), **costos** (mano de obra + repuestos), **repuestos** (cliente vs comprados, proveedor), kilometraje, fotos.
   - **Clientes**: alta/edición, documento, contacto, notas, **métricas** (total vehículos, total gastado, última visita, cantidad de visitas).
   - **Finanzas**: transacciones Ingreso/Egreso, categoría, método de pago, proveedor, vínculo a vehículo, suspensión.
   - **Stock/Productos**: cantidad, unidad, tipo, precio, punto de reorden, alerta de stock bajo, **historial de inventario** (`inventoryMovements`).
   - **Socios** (`partners`): % de inversión, aporte mensual, total aportado.
   - **Reportes** (`reports.ts`, ~950 líneas): generación, filtros por rango de fecha, export, plantillas.
   - **Servicios** y **categorías** configurables.
   - **Gráficos** (ingresos/egresos/balance por mes) y **métricas** del dashboard.
   - Importación de datos desde CSV (cuaderno del taller).

## Arquitectura objetivo

```
WhatsApp (Meta Cloud API)
        │  webhook (firma X-Hub-Signature-256 verificada)
        ▼
  Caddy (reverse proxy, TLS, headers de seguridad)
        ├── /            → Landing (estática)            [opcional]
        ├── /app/*       → SPA React (build estático)
        ├── /api/*       → Fastify (Node/TS)  :PORT
        ├── /webhooks/whatsapp → Fastify (mismo server)
        └── /media/*     → archivos (fotos) por tenant
        ▼
  Fastify (Node/TS)  ── Drizzle ORM ──►  Postgres
        └── Groq API (parser IA)
        └── Disco /var/www/motormec-media/<tenant_id>/...
```

- **systemd**: `motormec-api.service` (Fastify, vía `node`/PM2). Igual patrón que Yumi.
- **Postgres** local en el VPS; backups por `pg_dump` programado.
- Frontend build con `base: '/app/'` servido por Caddy (igual a Yumi).

## Multi-tenancy (lo más importante)

- Tabla **`tenants`** = un taller. Cada otra tabla lleva **`tenant_id NOT NULL`** con FK e índice.
- **Aislamiento forzado en CADA query** a nivel de capa de datos (no en el front).
  Lección de Yumi: un incidente real expuso datos entre hogares por no filtrar en
  backend. Acá: helper/scope obligatorio (`withTenant(tenantId)`) que TODA query usa;
  prohibido escribir queries crudas sin `tenant_id`.
- **Tests de aislamiento** que verifican que el tenant A nunca ve datos del tenant B
  (vehículos, clientes, finanzas, stock, reportes, fotos, historial).
- El `tenant_id` se deriva de la **sesión** (cookie) en el dashboard, y del
  **`phone_number_id`** en el webhook de WhatsApp.

## WhatsApp multi-número

- Un solo webhook (`/webhooks/whatsapp`) atiende a todos los talleres.
- El payload de Meta trae `entry[].changes[].value.metadata.phone_number_id`.
  **Mapeo `phone_number_id → tenant_id`** (columna en `tenants`).
- Cada taller registra su propio número de WhatsApp Business; se guarda en `tenants`:
  `wa_phone_number_id`, `wa_access_token` (cifrado en reposo), `wa_display_number`.
- **Una sola Meta App** → un solo `WHATSAPP_APP_SECRET` (env) para verificar la firma
  `X-Hub-Signature-256` de TODOS los webhooks (hoy MotorMec **no valida la firma** —
  se cierra ese agujero). El access token es **por número** (por tenant) para enviar.
- El taller actual **mantiene su número** existente (se carga su `phone_number_id`/token
  en su fila de `tenants`).
- `numeros_autorizados` queda **scopeado por tenant** (cada taller su whitelist).

## Modelo de datos (Postgres)

Todas las tablas (salvo `tenants`) llevan `tenant_id` + `created_at`/`updated_at`.
Tipos de Convex que eran `v.any()`/objetos anidados → **`jsonb`**. IDs → `uuid` (o serial).

- **tenants**: `id, name, slug (único), plan, active, wa_phone_number_id (único), wa_access_token, wa_display_number, settings jsonb (branding/companyName/copyright), created_at`.
- **users**: `id, tenant_id, name, email, username (único por tenant), password_hash, role ('admin'|'mecanico'), active, created_at`. (Reemplaza Clerk.)
- **numeros_autorizados**: `id, tenant_id, phone, name, active, added_at, added_by`.
- **customers**: `id, tenant_id, name, email?, phone, address?, document_type?, document_number?, notes?, active, total_vehicles?, total_spent?, last_visit?, visit_count?, created_at`. Índices: `(tenant_id, phone)`, `(tenant_id, document_type, document_number)`.
- **vehicles**: `id, tenant_id, plate, brand, model, year, owner, phone, customer_id?, status, entry_date, exit_date?, services text[], cost, description?, in_taller?, mileage?, responsibles jsonb, costs jsonb {laborCost,partsCost,totalCost}, parts jsonb[], last_updated?, created_at`. Índices: `(tenant_id, plate)`, `(tenant_id, customer_id)`, `(tenant_id, status)`.
- **vehicle_movements**: historial de cambios de vehículo (created/status_changed/assigned/work_started/…/delivered/deleted) con estados/costos/responsables/sesiones de trabajo previos y nuevos. `tenant_id, vehicle_id?, ...`.
- **products**: `id, tenant_id, name, quantity, unit, type, price, reorder_point, low_stock`.
- **inventory_movements**: historial de stock (created/updated/deleted/stock_increase/stock_decrease) con cantidades y precios previos/nuevos. `tenant_id, product_id?, ...`.
- **transactions**: `id, tenant_id, date, description, type ('Ingreso'|'Egreso'), category, amount, active?, suspended_at?, vehicle_id?, vehicle_details jsonb?, supplier?, payment_method?, notes?`.
- **partners**: `id, tenant_id, name, email, phone, investment_percentage, monthly_contribution, total_contributed, join_date, active`.
- **services**: `id, tenant_id, name, active, usage_count?, created_at`. Índice `(tenant_id, name)`.
- **categories**: `id, tenant_id, name, type ('product'|'transaction'|'vehicle_status'|…), active`.
- **conversaciones**: `id, tenant_id, phone, etapa, datos jsonb, candidato_cliente_id?, candidato_cliente_nombre?, historial_id?, updated_at, created_at`. Índice `(tenant_id, phone)`.
- **historial_taller**: `id, tenant_id, wa_message_id (único), wa_from, wa_timestamp, raw_message?, marca_modelo?, kilometraje?, patente?, tarea?, cliente?, foto_paths text[], vehicle_id?, customer_id?, status ('pending'|'processed'|'error'|'linked'), error_message?, created_at`.

**Mejoras (tablas que se eliminan):**
- `metrics`, `chartData`, `dashboardItems` → **se calculan al vuelo** desde `transactions`/`vehicles` (no se persisten métricas obsoletas).
- `navigationItems` → navegación en **código del front**, no en DB.
- `appConfig` → a `tenants.settings` (branding por taller).
- `reports` → los reportes se **generan on-demand**; solo se persiste si el dueño quiere snapshots.

## Auth (propia, estilo Yumi)

- Login `POST /api/login` (usuario+clave del tenant) → cookie de sesión httponly+secure+samesite=lax.
- Hash **PBKDF2-HMAC-SHA256** (formato `pbkdf2$iters$salt$hash`), `compare_digest` en verificación, re-hash de legacy on-login.
- **Rate-limit** en `/api/login` (por IP y por usuario).
- Roles: `admin` (dueño del taller) y `mecanico`. El cronómetro/responsables usan `user_id` propio (reemplaza Clerk userId).
- Sesión → `tenant_id` + `user_id` + `role`.

## Storage de fotos

- Las fotos que llegan por WhatsApp se descargan de Meta (Graph API) y se guardan en
  `/var/www/motormec-media/<tenant_id>/<historial_id>/<uuid>.jpg`.
- En DB se guarda la **ruta relativa** (`foto_paths text[]`), no un id de storage.
- Caddy sirve `/media/*` con control de acceso por tenant (o se sirven vía endpoint
  autenticado que valida `tenant_id` de la sesión — preferido para no filtrar entre talleres).
- Camino a escala: Cloudflare R2 (S3-compatible, sin egress, free tier) cambiando solo
  la capa de storage detrás de una interfaz `StorageProvider`.

## IA parser (se mantiene Groq)

- Mismo `systemPrompt` (extractor JSON estricto, `tarea` literal, no inventar).
- `llama-3.1-8b-instant`, temp 0.1, timeout 30s, limpieza de fences de markdown.
- Una sola `GROQ_API_KEY` global (no por tenant). Costo ~cero.
- Fallback opcional a Claude Haiku si Groq falla (como Yumi escala Haiku→Sonnet). Opcional.

## Migración de datos (sin pérdida)

1. Export de Convex (ya existe `dev-export.zip`; si hace falta, re-exportar con `npx convex export`).
2. Script de migración (`scripts/migrate-from-convex.ts`): lee los JSONL del export,
   transforma cada documento al esquema Postgres, **asigna `tenant_id`** del taller original
   (se crea 1 tenant para el taller actual), mapea ids de Convex → uuids nuevos manteniendo
   referencias (customer_id, vehicle_id, historial_id).
3. **Fotos**: por cada `_storage` id del export, descargar el blob y reubicarlo en
   `/var/www/motormec-media/<tenant>/...`; actualizar `foto_paths`.
4. **Validación**: conteo por tabla export vs Postgres; spot-check de referencias.
   (Igual que validamos migraciones de Yumi sobre copia de la DB viva antes de tocar prod.)
5. Correr una vez en staging, validar, y recién ahí en prod.

## Seguridad (estilo auditoría Yumi)

- Aislamiento por tenant forzado + tests (arriba).
- **Verificar firma `X-Hub-Signature-256`** del webhook con el App Secret (hoy falta).
- Headers en Caddy: HSTS, CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, ocultar `Server`.
- Rate-limit en login; cookies httponly+secure+samesite.
- Tokens de WhatsApp por tenant **cifrados en reposo**; nunca loguear secretos.
- Webhook responde 200 rápido y procesa en background (evita reintentos de Meta).
- Validación de entrada en todos los endpoints (zod) + manejo de errores que no filtra detalles.

## Deploy (igual a Yumi)

- `motormec-api.service` (systemd) corriendo Fastify (node/PM2) en un puerto local.
- Build del front (`npm run build`, base `/app/`) → `scp dist` → `/var/www/motormec/`.
- Caddy: `/app/*` estático, `/api/*` y `/webhooks/*` → reverse_proxy al puerto, `/media/*`.
- Postgres local; `pg_dump` diario a `infra/backups/`.
- Migraciones Drizzle (`drizzle-kit`) versionadas.
- `.env` con: `DATABASE_URL`, `SESSION_SECRET`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `GROQ_API_KEY`, `MEDIA_ROOT`. (Tokens de WhatsApp por tenant van en DB cifrados, no en `.env`.)

## Criterios de aceptación (no negociables)

1. Toda la funcionalidad listada en "Estado actual" funciona igual o mejor.
2. Cero fuga de datos entre talleres (tests de aislamiento en verde).
3. El bot de WhatsApp atiende múltiples talleres por `phone_number_id`, con firma verificada.
4. Migración del taller actual sin pérdida (conteos validados).
5. Deploy reproducible en VPS con Caddy + systemd + Postgres.
6. El front respeta la guía de diseño que adjunta el dueño.

## Fuera de alcance (por ahora)

- Avisos automáticos al cliente ("tu auto está listo") → **previsto** en el diseño
  (plantillas de utilidad de Meta), pero se implementa como feature aparte.
- Cobros/suscripciones de los talleres (MercadoPago) → fase posterior.
