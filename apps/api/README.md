# @motormec/api

Backend for the MotorMec rebuild — **Fastify + Drizzle ORM + Postgres**, multi-tenant
SaaS. This package is built **by phases** (see `docs/PROMPT_REBUILD.md`).

## Phase 1 — scaffold (done)

Foundation for everything else:

- **Monorepo** via npm workspaces (`apps/*`). This is `apps/api`.
- **Postgres schema** (Drizzle) for all domain tables — every data table carries
  `tenant_id NOT NULL` + FK + indexes; nested objects are `jsonb`; PKs are `uuid`.
  See [`src/db/schema.ts`](src/db/schema.ts).
- **Forced tenant isolation** at the data layer: [`forTenant(tenantId)`](src/db/scope.ts)
  returns a `TenantDb` whose every read/write injects the tenant predicate. Routes
  use `request.tenantDb` — they never build raw queries against data tables.
- **Own auth** (no Clerk): PBKDF2-HMAC-SHA256 password hashing
  ([`src/auth/password.ts`](src/auth/password.ts)), server-side sessions with an
  httponly+secure+samesite=lax cookie ([`src/auth/session.ts`](src/auth/session.ts)),
  per-route rate-limit on `/api/login`, and middleware resolving
  `tenant_id`/`user_id`/`role` from the cookie ([`src/auth/middleware.ts`](src/auth/middleware.ts)).
- **Isolation tests** (vitest against real Postgres) proving tenant A never sees or
  mutates tenant B across every resource, plus HTTP-level auth/isolation tests.
  See [`test/`](test).

> The full domain CRUD (vehicles, finanzas, stock, etc.), the WhatsApp bot, the
> frontend, the Convex migration, and deploy are Phases 2–6.

## Requirements

- Node 20.12+ (uses `process.loadEnvFile`). Tested on Node 25.
- Docker (for local Postgres) — or any reachable Postgres.

## Quick start

```bash
# from the repo root
npm install
npm run db:up                      # Postgres via Docker (host port 5433)

cd apps/api
cp .env.example .env               # adjust if needed
npm run db:migrate                 # apply migrations to the dev DB
npm run seed:dev                   # demo tenant + users (see output)
npm run dev                        # Fastify on :3001
```

Smoke test:

```bash
curl localhost:3001/api/health
curl -X POST localhost:3001/api/login -H 'content-type: application/json' \
  -d '{"tenantSlug":"taller-demo","username":"admin","password":"admin123"}'
```

## Scripts

| Script | What |
|--------|------|
| `npm run dev` | Fastify with hot reload (tsx watch) |
| `npm run build` | Compile `src` → `dist` |
| `npm run start` | Run compiled server |
| `npm run typecheck` | `tsc` over src + tests + config |
| `npm test` | vitest (creates an isolated `motormec_test` DB) |
| `npm run db:generate` | Generate SQL migration from the schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema directly (dev only) |
| `npm run seed:dev` | Seed a demo tenant/users |

Tests need Postgres running (`npm run db:up`). They use a **separate**
`motormec_test` database, created and migrated automatically by the global setup,
so they never touch dev data.

## Decisions taken (where the prompt left it open)

- **Login is per-tenant by `slug`.** Usernames are unique only per tenant, so
  `POST /api/login` takes `{ tenantSlug, username, password }`. The dashboard is
  accessed per workshop (slug in the URL / future subdomain). `tenant_id` is
  **never** accepted as a client parameter — it is derived from the session
  (dashboard) or the WhatsApp `phone_number_id` (webhook).
- **Sessions are server-side** (a `sessions` table); the cookie holds an opaque
  random token and only its SHA-256 hash is stored. Enables real logout/revocation.
- **PBKDF2 iterations = 210k** (OWASP 2023 for PBKDF2-SHA256), with on-login
  re-hash when a stored hash uses weaker params (`verifyPassword.needsRehash`).
- **Secrets at rest** (per-tenant `wa_access_token`) use AES-256-GCM via
  [`src/crypto/secrets.ts`](src/crypto/secrets.ts), keyed by `SECRETS_KEY`.
- **Denormalized customer metrics** (`total_spent`, etc.) are kept as columns for
  fast reads but recomputed on writes — dashboard charts/metrics themselves are
  computed on the fly (no `metrics`/`chartData` tables, per the spec).
- **`historial_taller.wa_message_id` is globally unique** (not per-tenant): Meta
  message ids are globally unique and the single shared webhook needs global
  idempotency before the tenant is even resolved.
- **Local Postgres maps to host port 5433** to avoid clashing with any existing
  local Postgres on 5432.

## Layout

```
src/
  config/env.ts        # zod-validated env (.env via loadEnvFile)
  crypto/secrets.ts    # AES-256-GCM for secrets at rest
  db/
    schema.ts          # all tables (multi-tenant)
    client.ts          # pg Pool + drizzle instance
    scope.ts           # forTenant(): the mandatory isolation layer
    admin.ts           # cross-tenant provisioning (create tenant/user)
    migrate.ts         # migration runner
  auth/                # password, session, service, middleware
  routes/              # health, auth, customers (demo of the scoped pattern)
  scripts/seed-dev.ts
  app.ts               # Fastify app builder
  server.ts            # entrypoint
test/                  # globalSetup + isolation + auth tests
drizzle/               # generated SQL migrations (committed)
```
