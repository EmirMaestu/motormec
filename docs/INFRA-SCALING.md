# Momec — Estrategia de infraestructura y escalado

Cómo mantener Momec **rápido, seguro, escalable y barato**, y cuándo (y cómo) mover
piezas a la nube sin perder datos. La recomendación es **no migrar a la nube todavía**:
el modelo actual (VPS + Caddy + systemd + Postgres) es el más barato y alcanza para
muchos talleres. Abajo, el camino de crecimiento por etapas.

## TL;DR

| Etapa | Talleres | Infra | Costo aprox/mes |
|------|----------|-------|-----------------|
| **0 — Hoy** | 1–50 | 1 VPS (Caddy + Fastify + Postgres + disco) | **USD 6–20** |
| **1 — Crecer** | 50–300 | VPS más grande + Postgres gestionado + R2 para fotos | USD 40–120 |
| **2 — Escala** | 300–2.000 | 2+ instancias API detrás de balanceador + Postgres gestionado HA + R2 + Redis | USD 150–500 |
| **3 — Nube full** | 2.000+ | Contenedores gestionados (Fly/Render/ECS) + RDS/Cloud SQL Multi-AZ + CDN | según uso |

La arquitectura ya está pensada para esto: API **stateless** (sesiones en DB),
multi-tenant por `tenant_id`, y storage detrás de una interfaz `StorageProvider`
(cambiar disco → R2/S3 es una sola clase).

## Por qué arrancar en VPS (etapa 0)

- **Costo fijo y bajísimo.** Un VPS de USD 6–12 (Hetzner, DigitalOcean, Vultr)
  corre todo: Caddy (TLS gratis), Fastify, Postgres local y las fotos en disco.
  Sin facturación por uso, sin sorpresas — clave para vender barato.
- **Simple de operar.** systemd reinicia el servicio, `pg_dump` diario hace backup,
  Caddy renueva certificados solo. Un runbook (`DEPLOY.md`) y listo.
- **Suficiente.** Postgres en un VPS chico maneja cómodo decenas de talleres con
  miles de órdenes. El cuello no es la base, es el disco/CPU — fácil de subir.

## Etapa 1 — separar estado (cuando duele el backup o el disco)

Dos cambios, sin reescribir nada:

1. **Postgres gestionado** (Neon, Supabase, DigitalOcean Managed PG, RDS).
   Te da backups automáticos, point-in-time recovery y réplicas. Solo cambia
   `DATABASE_URL`. Migración sin pérdida: `pg_dump`/restore o réplica lógica.
2. **Fotos a Cloudflare R2** (S3-compatible, **sin costo de egress**, free tier).
   Ya hay `StorageProvider`/`LocalDiskStorage`; se agrega `R2Storage` (misma
   interfaz, ~40 líneas) y el endpoint autenticado sigue sirviendo igual. Migración:
   copiar `MEDIA_ROOT` a R2 una vez (`rclone`), luego apuntar la nueva clase.

El VPS queda solo con la API (stateless) → se vuelve descartable y fácil de clonar.

## Etapa 2 — horizontal (cuando una instancia no da)

- **2+ instancias de la API** detrás de un balanceador (Caddy ya balancea, o un LB
  del proveedor). Como las **sesiones viven en Postgres** (no en memoria), cualquier
  instancia atiende cualquier request — no hace falta sticky sessions.
- **Idempotencia del bot** ya está por `wa_message_id` único → procesar el webhook
  desde varias instancias es seguro.
- **Redis opcional** para rate-limit distribuido y cache de queries calientes
  (reportes). Hoy el rate-limit es por instancia; con varias, moverlo a Redis.
- **Postgres con réplica de lectura** para reportes pesados, si hiciera falta.

## Etapa 3 — nube gestionada (cuando el equipo > la infra)

Recién acá conviene contenedizar y usar orquestación gestionada. Comparativa para
una app Node + Postgres + storage:

| Opción | Pro | Contra | Cuándo |
|--------|-----|--------|--------|
| **Fly.io / Render / Railway** | Deploy git-push, Postgres y volúmenes gestionados, barato, multi-región fácil | Menos control fino | **Recomendado** para saltar de VPS sin equipo de infra |
| **AWS (ECS Fargate + RDS + S3 + CloudFront)** | Máxima escala/control, todo integrado | Complejo, caro si no se cuida, curva alta | Cuando hay equipo DevOps y escala grande |
| **Azure (App Service/AKS + Postgres Flexible + Blob)** | Bueno si ya hay ecosistema Microsoft/créditos | Similar a AWS en complejidad | Si la empresa ya está en Azure |
| **GCP (Cloud Run + Cloud SQL + GCS)** | Cloud Run escala a cero, muy cómodo para apps stateless | Cloud SQL caro en HA | Buen punto medio AWS/Fly |

**Recomendación:** si hay que ir a la nube, **Fly.io o Render** primero (mejor
relación esfuerzo/costo para este stack). AWS/Azure solo con escala y equipo que lo
justifiquen — son más caros y complejos para lo que Momec necesita hoy.

## Seguridad (transversal a todas las etapas)

- **Aislamiento por tenant** forzado en la capa de datos (`forTenant`) + tests.
- **Headers** (HSTS, CSP, X-Frame DENY, nosniff) en Caddy; cookies httponly+secure+samesite.
- **Secretos cifrados en reposo** (tokens de WhatsApp con AES-256-GCM); nunca en logs.
- **Firma `X-Hub-Signature-256`** verificada en el webhook.
- **Postgres** no expuesto a internet (solo localhost o VPC); gestionado = TLS + backups.
- **Backups probados**: restaurar el `pg_dump` en staging periódicamente (un backup
  que no se restauró no es un backup).

## Costo — cómo mantenerlo bajo

- VPS único mientras se pueda (etapa 0) — es 5–10× más barato que la nube gestionada.
- **R2 para fotos** (egress gratis) en vez de S3/Cloud Storage (que cobran egress).
- Postgres gestionado **single-instance** hasta que el negocio justifique HA Multi-AZ
  (que duplica el costo de la base).
- Cloud Run / Fly **escalan a cero o casi** → pagás por uso real, no por idle.
- Métricas/reportes **calculados al vuelo** (sin tablas de métricas) → menos storage
  y menos jobs.

## Migrar sin perder datos (entre etapas)

Cada salto es un cambio de URL/clase, no una reescritura:

- **VPS → Postgres gestionado:** `pg_dump` + restore (downtime de minutos), o
  **réplica lógica** para cut-over casi sin downtime. Validar conteos por tabla.
- **Disco → R2:** copiar una vez (`rclone copy media r2:bucket`), luego cambiar la
  implementación de `StorageProvider`. Las rutas relativas en DB no cambian.
- **1 → N instancias:** sin migración de datos (estado ya está en Postgres). Solo
  poner el balanceador y, si hace falta, Redis para rate-limit.
- **Regla de oro:** correr siempre en staging sobre una **copia** antes de tocar prod,
  validar, y tener el origen en solo-lectura como rollback.
