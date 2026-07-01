# MotorMec — SaaS multi-taller

Sistema de gestión para talleres mecánicos (Argentina) con **bot de WhatsApp** y
**dashboard web**, reconstruido como **SaaS multi-inquilino** sobre un stack propio
para correr en un VPS (sin Convex, sin Clerk, sin facturación por uso).

> Reescritura completa según [`docs/PROMPT_REBUILD.md`](docs/PROMPT_REBUILD.md) y
> [`docs/specs/2026-06-28-motormec-rebuild-design.md`](docs/specs/2026-06-28-motormec-rebuild-design.md).
> El código Convex/Vite original queda en `convex/` y `src/` solo como referencia.

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Node + TypeScript + **Fastify** + **Drizzle ORM** |
| Base de datos | **Postgres** (multi-taller por `tenant_id`) |
| Auth | Propia — cookie de sesión httponly+secure+samesite, hash **PBKDF2-HMAC-SHA256**, rate-limit |
| Frontend | **React 19** + Vite + Tailwind v4 + Radix (sigue la guía de diseño en `docs/`) |
| IA (parser WhatsApp) | **Groq** `llama-3.1-8b-instant` |
| Storage fotos | Disco del VPS detrás de `StorageProvider` (camino a R2) |
| Deploy | VPS + **Caddy** + **systemd** + Postgres ([`DEPLOY.md`](DEPLOY.md)) |

## Estructura (monorepo npm workspaces)

```
apps/
  api/   Fastify + Drizzle + Postgres — API, auth, bot WhatsApp, migración
  web/   SPA React (base '/app/') siguiendo la guía de diseño
infra/   docker-compose (Postgres), Caddyfile, systemd, backups
docs/    spec, prompt de reconstrucción y guía de diseño
```

Detalle del backend y decisiones de diseño: [`apps/api/README.md`](apps/api/README.md).

## Quick start (local)

```bash
npm install
npm run db:up                 # Postgres en Docker (puerto host 5433)

# API
cd apps/api
cp .env.example .env
npm run db:migrate
npm run seed:dev              # crea tenant 'taller-demo' (admin/admin123)
npm run dev                   # Fastify en :3001

# Web (otra terminal)
cd apps/web
npm run dev                   # Vite en :5173 (proxea /api y /webhooks → :3001)
```

Abrí http://localhost:5173/app/ e ingresá con `taller-demo` / `admin` / `admin123`.

## Tests

```bash
cd apps/api && npm test       # incluye tests de aislamiento entre talleres
```

## Funcionalidad

- **Vehículos:** alta/edición/baja, estados, historial de movimientos, responsables
  con cronómetro, costos (mano de obra + repuestos), repuestos, kilometraje, fotos.
- **Clientes:** CRUD, documento, métricas (vehículos, gastado, visitas), merge.
- **Finanzas:** ingresos/egresos, categorías, métodos de pago, suspensión.
- **Stock:** productos, punto de reorden, alerta de stock bajo, historial de inventario.
- **Socios, Servicios, Categorías** configurables.
- **Reportes y métricas** calculados al vuelo.
- **Bot WhatsApp** multi-taller: webhook único con firma verificada, idempotencia,
  máquina de estados, botones, parser Groq y descarga de fotos.

## Migración desde Convex

```bash
cd apps/api
npm run migrate:convex -- /ruta/dev-export.zip <slug> "Nombre Taller"
```

Mapea ids de Convex → uuids preservando referencias y valida conteos por tabla.
Correr primero en staging. Ver [`DEPLOY.md`](DEPLOY.md).
