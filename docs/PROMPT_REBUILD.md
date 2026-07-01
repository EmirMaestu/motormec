# PROMPT — Reconstruir MotorMec como SaaS multi-taller en un VPS

> **Cómo usar esto:** pegá TODO este prompt en el LLM que va a construir el proyecto.
> Adjuntá por separado tu **guía de diseño visual** (colores, tipografías, componentes):
> el LLM debe seguirla al pie para el frontend. Trabajá por fases y revisá cada fase
> antes de seguir.

---

## Rol y objetivo

Sos un ingeniero senior full-stack. Vas a **reconstruir desde cero** una app existente
llamada **MotorMec**: un sistema de gestión para **talleres mecánicos** (Argentina) con un
**bot de WhatsApp** para cargar vehículos y un **dashboard web**.

La versión actual corre sobre **Convex** (backend serverless) + **Clerk** (auth) +
**Vercel**, y es **mono-taller**. Tu trabajo es reescribirla para:

1. **Venderla como SaaS multi-taller** (multi-inquilino: un solo deploy, muchos talleres aislados).
2. **Sacarla de Convex** y correrla en un **VPS propio** (modelo: VPS + Caddy + systemd + Postgres).
3. **No perder NINGUNA funcionalidad** — todo lo que hace hoy tiene que seguir andando, mejor.
4. Mejorar **seguridad, aislamiento entre talleres y costo** (costo fijo, sin facturación por uso).

Prioridad #1: **fidelidad funcional**. Prioridad #2: **aislamiento total entre talleres**.

## Stack obligatorio

- **Backend:** Node.js + **TypeScript** + **Fastify** + **Drizzle ORM**.
- **DB:** **Postgres**.
- **Auth:** propia (cookie de sesión httponly+secure+samesite=lax, hash **PBKDF2-HMAC-SHA256**,
  rate-limit en login). **Nada de Clerk.**
- **Frontend:** React 19 + Vite + TypeScript + Tailwind v4 + Radix/shadcn (se mantiene).
  El frontend **debe seguir la guía de diseño adjunta** (no inventes estética).
- **Validación:** zod en todos los endpoints.
- **Estado/datos en el front:** TanStack Query con refetch/polling (no hace falta tiempo real).
- **IA (parser de WhatsApp):** **Groq** `llama-3.1-8b-instant` (mismo modelo que hoy).
- **Storage de fotos:** disco del VPS, detrás de una interfaz `StorageProvider`
  (para poder cambiar a Cloudflare R2 después sin tocar el resto).
- **Deploy:** VPS con **Caddy** (TLS + reverse proxy) + **systemd** (o PM2) + Postgres local.

> Si algún detalle no está especificado, elegí la opción más simple, escalable y barata,
> y dejala documentada. No agregues features que no estén pedidas (YAGNI).

## Funcionalidad que NO se puede perder

### A) Bot de WhatsApp (Meta Cloud API)
Webhook único `POST/GET /webhooks/whatsapp` que atiende a **todos los talleres**.

- **GET** = verificación de Meta (`hub.mode=subscribe` + `hub.verify_token` == `WHATSAPP_VERIFY_TOKEN` → devolver `hub.challenge`).
- **POST** = mensajes entrantes. Responder **200 rápido** y procesar en background.
- **Verificar la firma `X-Hub-Signature-256`** (HMAC con `WHATSAPP_APP_SECRET`) en cada POST.
  (La versión actual NO lo hace — es un agujero que tenés que cerrar.)
- **Ruteo multi-taller:** del payload, `entry[].changes[].value.metadata.phone_number_id`
  → buscar el `tenant` cuyo `wa_phone_number_id` coincide. Si no hay tenant, ignorar.
- **Idempotencia** por `wa_message_id` (no procesar dos veces el mismo mensaje).
- **Autorización:** el número del remitente (`from`) debe estar en `numeros_autorizados`
  **de ese tenant** y activo; si no, responder un rechazo y cortar.
- **Tipos soportados:** `text`, `image`, `interactive` (respuestas a botones). Otros se ignoran.

**Flujo de carga de vehículo (máquina de estados por teléfono, tabla `conversaciones`):**
1. Llega texto → **extraer con IA (Groq)** los campos: `marca_modelo`, `kilometraje`
   (solo número), `patente` (mayúsculas), `tarea` (literal, **sin resumir ni abreviar**),
   `cliente` (nombre propio). Si un campo no está, string vacío (no inventar).
2. Buscar cliente por nombre en `customers` del tenant.
   - Si hay candidato → estado `verificando_cliente`, mandar resumen + **botones** "✅ Sí, es él" / "❌ No, es otro".
   - Si no hay → estado `confirmando`, marcar cliente como nuevo, mandar resumen + botones "✅ Confirmar" / "❌ Cancelar".
3. `verificando_cliente`: sí → fija `customer_id`, pasa a `confirmando`. no → sigue como cliente nuevo, pasa a `confirmando`.
4. `confirmando`: confirmar → estado `pidiendo_fotos`, ofrecer botón "📋 Sin fotos". cancelar → borrar conversación.
5. `pidiendo_fotos`: si llega imagen, descargarla de Meta (Graph API) y guardarla; acumular;
   ofrecer botón "✅ Registrar vehículo". Si dice listo/sin fotos/etc → **crear el vehículo**
   con `status='Ingresado'`, `entry_date=hoy`, `services=[tarea]`, vincular el `historial_taller`,
   borrar la conversación y mandar confirmación final.
- La conversación **expira a los 30 min** de inactividad (se descarta y se arranca de nuevo).
- **Botones interactivos** de WhatsApp con **fallback a texto** si la API de botones falla.
- Detectar afirmativo/negativo/listo tanto por **id de botón** como por **texto libre**
  (sí/dale/ok/confirmar… ; no/cancelar… ; listo/ya/guardar…).
- Guardar cada ingreso en `historial_taller` (con `raw_message`, campos extraídos, `foto_paths`,
  `status`: pending/processed/error/linked, `wa_message_id`, `wa_from`, `wa_timestamp`).
- **Normalización de número argentino** para envío (manejar el `9`/`15`).
- **Parser IA (Groq):** mismo system prompt que hoy (extractor de JSON estricto, sin markdown,
  `tarea` completa y literal, no inventar), `temperature: 0.1`, `max_tokens: 300`, timeout 30s,
  limpiar fences ```json del output, `JSON.parse`. Una sola `GROQ_API_KEY` global.

### B) Dashboard web (todo scopeado por tenant de la sesión)
- **Vehículos:** alta/edición/baja; estados (Ingresado → En Reparación → Listo → Entregado);
  **historial de movimientos** (cada cambio: creado, cambio de estado, mecánico asignado/desasignado,
  trabajo iniciado/pausado/completado, actualizado, suspendido, entregado, eliminado);
  **responsables/mecánicos** con **cronómetro de trabajo** (sesiones start/end, duración, tiempo total);
  **costos** (mano de obra + repuestos + total); **repuestos** (nombre, precio, cantidad,
  origen cliente/comprado, proveedor); kilometraje; fotos.
- **Clientes:** alta/edición; documento (DNI/CUIT/…); contacto; notas; **métricas**
  (total vehículos, total gastado, última visita, cantidad de visitas).
- **Finanzas:** transacciones Ingreso/Egreso; categoría; método de pago; proveedor;
  vínculo opcional a vehículo; suspender/reactivar.
- **Stock/Productos:** cantidad, unidad, tipo, precio, **punto de reorden**, **alerta de stock bajo**;
  **historial de inventario** (creado/actualizado/eliminado/aumento/disminución con cantidades y precios previos/nuevos).
- **Socios:** % de inversión, aporte mensual, total aportado, fecha de ingreso, activo.
- **Reportes:** generación on-demand, filtros por rango de fechas, export, plantillas.
- **Servicios** y **categorías** configurables (por tenant).
- **Gráficos** (ingresos/egresos/balance por mes) y **métricas** del dashboard —
  **calculados al vuelo** desde `transactions`/`vehicles` (no tablas de métricas persistidas).
- **Importación CSV** del cuaderno del taller (mantener el importador, scopeado a tenant).
- **Usuarios del taller:** admin (dueño) y mecánico; gestión de `numeros_autorizados` del tenant.

## Multi-tenancy (CRÍTICO)

- Tabla **`tenants`** = un taller. **TODAS** las demás tablas llevan `tenant_id NOT NULL` (FK + índice).
- **Aislamiento forzado en la capa de datos**, NO en el front. Implementá un helper/scope
  (ej. `db.forTenant(tenantId)`) que TODAS las queries usan; está **prohibido** escribir una
  query que toque tablas de datos sin filtrar por `tenant_id`.
- El `tenant_id` viene de la **sesión** (cookie) en el dashboard, y del **`phone_number_id`**
  en el webhook de WhatsApp. Nunca lo aceptes como parámetro del cliente.
- **Escribí tests de aislamiento**: el tenant A jamás ve/edita datos del tenant B en NINGÚN
  recurso (vehículos, clientes, finanzas, stock, reportes, fotos, historial, conversaciones).
  Esto es un criterio de aceptación, no opcional.

## Modelo de datos (Postgres / Drizzle)

Crear el esquema con Drizzle. Todas las tablas (salvo `tenants`) con `tenant_id` + timestamps.
Objetos/arrays anidados → `jsonb`. IDs → `uuid`.

- **tenants**(id, name, slug único, plan, active, wa_phone_number_id único, wa_access_token cifrado, wa_display_number, settings jsonb, created_at)
- **users**(id, tenant_id, name, email?, username, password_hash, role 'admin'|'mecanico', active, created_at) — username único por tenant
- **numeros_autorizados**(id, tenant_id, phone, name, active, added_at, added_by)
- **customers**(id, tenant_id, name, email?, phone, address?, document_type?, document_number?, notes?, active, total_vehicles?, total_spent?, last_visit?, visit_count?, created_at) — índices (tenant_id, phone) y (tenant_id, document_type, document_number)
- **vehicles**(id, tenant_id, plate, brand, model, year, owner, phone, customer_id?, status, entry_date, exit_date?, services text[], cost, description?, in_taller?, mileage?, responsibles jsonb, costs jsonb, parts jsonb, last_updated?, created_at) — índices (tenant_id, plate), (tenant_id, customer_id), (tenant_id, status)
- **vehicle_movements**(id, tenant_id, vehicle_id?, vehicle_plate, vehicle_info, owner, movement_type, previous/new status, previous/new cost, cost_change, assigned/unassigned user(+name), work_duration, work_session_id, previous/new services, reason, description, timestamp, user_id, user_name, details jsonb)
- **products**(id, tenant_id, name, quantity, unit, type, price, reorder_point, low_stock)
- **inventory_movements**(id, tenant_id, product_id?, product_name, product_type, movement_type, previous/new quantity, quantity_change, previous/new price, reason, timestamp, user_id, user_name, details jsonb)
- **transactions**(id, tenant_id, date, description, type 'Ingreso'|'Egreso', category, amount, active?, suspended_at?, vehicle_id?, vehicle_details jsonb?, supplier?, payment_method?, notes?)
- **partners**(id, tenant_id, name, email, phone, investment_percentage, monthly_contribution, total_contributed, join_date, active)
- **services**(id, tenant_id, name, active, usage_count?, created_at) — índice (tenant_id, name)
- **categories**(id, tenant_id, name, type, active)
- **conversaciones**(id, tenant_id, phone, etapa, datos jsonb, candidato_cliente_id?, candidato_cliente_nombre?, historial_id?, updated_at, created_at) — índice (tenant_id, phone)
- **historial_taller**(id, tenant_id, wa_message_id único, wa_from, wa_timestamp, raw_message?, marca_modelo?, kilometraje?, patente?, tarea?, cliente?, foto_paths text[], vehicle_id?, customer_id?, status 'pending'|'processed'|'error'|'linked', error_message?, created_at)

**Eliminadas a propósito** (mejora vs hoy): `metrics`, `chartData`, `dashboardItems`
(se calculan al vuelo); `navigationItems` (navegación en código); `appConfig` (→ `tenants.settings`).

## Auth (propia)

- `POST /api/login` (username + password del tenant) → cookie de sesión.
- Hash PBKDF2-HMAC-SHA256 (formato `pbkdf2$iters$salt$hash`), comparación con `timingSafeEqual`.
- Rate-limit por IP y por usuario en `/api/login`.
- Middleware que resuelve `tenant_id` + `user_id` + `role` desde la cookie y los inyecta en el request.
- Roles: `admin` y `mecanico`. El cronómetro/responsables usan `user_id` propio.

## Storage de fotos

- Interfaz `StorageProvider` con impl `LocalDiskStorage` (default).
- Fotos en `MEDIA_ROOT/<tenant_id>/<historial_id>/<uuid>.jpg`. En DB se guarda la ruta relativa.
- Servir fotos por un **endpoint autenticado** que valida el `tenant_id` de la sesión
  (no exponer `/media` público crudo, para no filtrar entre talleres).

## Migración de datos desde Convex (sin pérdida)

Script `scripts/migrate-from-convex.ts`:
1. Leer el export de Convex (`dev-export.zip` / `npx convex export`) — JSONL por tabla.
2. Crear 1 `tenant` para el taller actual.
3. Transformar cada documento al esquema Postgres asignando ese `tenant_id`; mapear ids de
   Convex → uuids nuevos manteniendo referencias (customer_id, vehicle_id, historial_id).
4. Descargar cada blob de Convex Storage y reubicarlo en `MEDIA_ROOT`; setear `foto_paths`.
5. **Validar**: conteo por tabla (export vs Postgres) + spot-check de referencias.
6. Correr primero en staging.

## Seguridad

- Aislamiento por tenant + tests (arriba).
- Firma `X-Hub-Signature-256` verificada en el webhook.
- Headers en Caddy: HSTS, CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff,
  Referrer-Policy, Permissions-Policy, ocultar `Server`.
- Cookies httponly+secure+samesite; rate-limit en login.
- `wa_access_token` cifrado en reposo; nunca loguear secretos.
- Webhook idempotente y con 200 rápido + proceso en background.

## Deploy (VPS, estilo Yumi)

- `motormec-api.service` (systemd) corriendo Fastify (node/PM2) en un puerto local.
- Front: `vite build` con `base: '/app/'` → estático servido por Caddy.
- Caddyfile: `/app/*` (SPA), `/api/*` y `/webhooks/*` → reverse_proxy al puerto, fotos por endpoint autenticado.
- Postgres local + `pg_dump` diario.
- Migraciones con `drizzle-kit` versionadas.
- `.env`: `DATABASE_URL`, `SESSION_SECRET`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`,
  `GROQ_API_KEY`, `MEDIA_ROOT`. (Los tokens de WhatsApp por tenant van en DB, cifrados.)

## Plan de trabajo sugerido (entregá por fases y pará a revisar en cada una)

1. **Scaffold:** monorepo o `apps/api` + `apps/web`; Fastify + Drizzle + Postgres + esquema; auth propia; multi-tenancy base + helper de scope + tests de aislamiento.
2. **Dominio core (API):** customers, vehicles (+ movements, responsables, cronómetro, costos, repuestos), products (+ inventory), transactions, partners, services, categories, reportes/métricas calculadas. Todo con CRUD + validación zod + scope por tenant.
3. **Bot de WhatsApp:** webhook multi-taller, firma, idempotencia, máquina de estados completa, botones, parser Groq, storage de fotos.
4. **Frontend:** SPA React siguiendo la **guía de diseño adjunta**; todas las páginas del dashboard; TanStack Query; login.
5. **Migración:** script desde el export de Convex + validación.
6. **Deploy:** Caddyfile, systemd, backups, runbook (`DEPLOY.md`).

## Criterios de aceptación

1. Toda la funcionalidad de "lo que no se puede perder" anda igual o mejor.
2. Cero fuga de datos entre talleres (tests de aislamiento en verde).
3. El bot atiende varios talleres por `phone_number_id`, con firma verificada e idempotencia.
4. Migración del taller actual sin pérdida (conteos validados).
5. Deploy reproducible (Caddy + systemd + Postgres) con runbook.
6. El frontend respeta la guía de diseño adjunta.

**Entregá código real, completo y ejecutable, por fases, y esperá revisión entre fases.**
No uses placeholders ni "TODO" en lógica crítica. Si una decisión es ambigua, tomá la más
simple/escalable/barata y dejala anotada.
