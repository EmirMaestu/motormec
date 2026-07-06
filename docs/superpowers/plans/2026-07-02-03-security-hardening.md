# Plan 03 — Endurecimiento de Seguridad Implementation Plan

> **Para el que ejecuta:** leé primero [el plan maestro](2026-07-02-00-master-plan.md). Este
> plan cierra las brechas Medium de la auditoría antes de cobrar. Mezcla tareas de código
> (con TDD) y tareas de ops (runbooks/checklists). Hacé cada una como commit separado.

**Goal:** rate limiting fino, política de contraseñas + lockout, aislamiento de billing con
tests, validación real de uploads, errores genéricos, backups off-site probados, y verificación
de firmas de webhooks de pago.

**Tech Stack:** Fastify, `@fastify/rate-limit`, Drizzle, zod, vitest, Caddy, rclone.

---

## Task SEC-1: Rate limit fino en endpoints caros

**Files:**
- Modify: `apps/api/src/routes/reports.ts`, `apps/api/src/routes/media.ts`, `apps/api/src/routes/orders.ts` (subida de fotos), `apps/api/src/routes/quotes.ts` (logo)

Depende de QW-7 (rate limit global ya activo). Acá agregamos límites por-ruta más estrictos.

- [ ] **Step 1: Límite en reportes.** En cada handler de `reports.ts`, agregar `config.rateLimit`.
Patrón (igual que `auth.ts:24-32`):
```ts
  app.get("/api/reports/financial", {
    preHandler: requireRole("admin"),
    config: { rateLimit: { max: env.NODE_ENV === "production" ? 20 : 100000, timeWindow: "1 minute" } },
  }, async (request, reply) => { /* ... */ });
```
Importar `env` si no está: `import { env } from "../config/env.js";`. Aplicar a los 4-6
endpoints de reportes.

- [ ] **Step 2: Límite en uploads.** En el `POST` de fotos de orden (`orders.ts`, el handler
con `bodyLimit`) y en el `POST` de logo (`quotes.ts`), agregar
`config: { rateLimit: { max: env.NODE_ENV === "production" ? 30 : 100000, timeWindow: "1 minute" } }`.

- [ ] **Step 3: Suite + typecheck.** `cd apps/api && npm test && npm run typecheck` → verde.

- [ ] **Step 4: Commit.**
```bash
git add apps/api/src/routes/reports.ts apps/api/src/routes/orders.ts apps/api/src/routes/quotes.ts
git commit -m "feat(security): rate-limit por ruta en reportes y uploads"
```

---

## Task SEC-2: Política de contraseñas + lockout por usuario

**Problema:** el admin crea usuarios con cualquier contraseña; no hay mínimo ni bloqueo tras
N fallos (el rate limit es por IP, no por usuario). Ver SEC-8 de la auditoría.

**Files:**
- Modify: `apps/api/src/db/schema.ts` (tabla `users`: agregar `failedLoginCount`, `lockoutUntil`)
- Modify: `apps/api/src/routes/admin.ts` (creación de usuario: validar fuerza)
- Modify: `apps/api/src/auth/service.ts` (login: contar fallos, bloquear)
- Test: `apps/api/test/auth.test.ts`

- [ ] **Step 1: Leer el login actual.** Abrí `apps/api/src/auth/service.ts` y ubicá la función
`login(...)` (devuelve `{ ok: false }` en credenciales inválidas). Vas a insertar el conteo de
fallos y el chequeo de lockout ahí.

- [ ] **Step 2: Agregar columnas al schema.**

En `schema.ts`, tabla `users`, agregar antes de `createdAt`:
```ts
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockoutUntil: timestamp("lockout_until", { withTimezone: true }),
```
Luego: `cd apps/api && npm run db:generate && npm run db:migrate`.

- [ ] **Step 3: Test que falla (política de fuerza).**

En `apps/api/test/auth.test.ts`, agregar un caso que cree un usuario con contraseña corta y
espere rechazo. Mirá cómo el test crea usuarios hoy (probablemente vía `createTenant` +
helper de creación de usuario o vía la ruta admin). Ejemplo con función de dominio (ajustar al
helper real):
```ts
  it("rejects a weak password on user creation", async () => {
    // Usar el mismo camino que usa admin.ts para crear usuarios.
    await expect(createUserSomehow({ password: "123" })).rejects.toThrow(/contraseña/i);
  });
```
> Nota: si la validación de fuerza vive en la ruta (no en dominio), testeala con
> `app.inject({ method: "POST", url: "/api/admin/tenants/:id/users", ... })` autenticado como
> platform-admin (mirá `admin.test.ts` para el patrón de auth de plataforma).

- [ ] **Step 4: Implementar la validación de fuerza.**

Crear `apps/api/src/auth/passwordPolicy.ts`:
```ts
export function assertStrongPassword(pw: string): void {
  if (typeof pw !== "string" || pw.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }
}
```
En `admin.ts`, en el/los handlers que crean o cambian contraseñas de usuario, llamar
`assertStrongPassword(password)` antes de hashear, y devolver 400 si lanza:
```ts
    try { assertStrongPassword(d.password); }
    catch (e) { return reply.code(400).send({ error: "weak_password", message: (e as Error).message }); }
```

- [ ] **Step 5: Test que falla (lockout).**

```ts
  it("locks the account after 5 failed logins", async () => {
    // Crear tenant + usuario con password conocida (usar el helper real del test suite).
    for (let i = 0; i < 5; i++) {
      const r = await login({ tenantSlug: "a", username: "user", password: "wrong" });
      expect(r.ok).toBe(false);
    }
    // El 6º intento, aun con password correcta, está bloqueado.
    const r = await login({ tenantSlug: "a", username: "user", password: "correcta" });
    expect(r.ok).toBe(false);
  });
```

- [ ] **Step 6: Implementar el lockout en `login()`.**

En `auth/service.ts`, dentro de `login`:
1. Tras encontrar el usuario, si `user.lockoutUntil && user.lockoutUntil > new Date()` →
   devolver `{ ok: false }` sin verificar la contraseña.
2. Si la contraseña es incorrecta → incrementar `failed_login_count`; si llega a 5, setear
   `lockout_until = now() + 15 min` y resetear el contador. Usar `db` directo (users no es
   tenant-scoped por `TenantDb`; se accede con `db` y `eq(users.id, ...)`).
3. Si la contraseña es correcta y no está bloqueado → resetear `failed_login_count = 0` y
   `lockout_until = null`.

Código orientativo (adaptá a la estructura de tu `login`):
```ts
  if (user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()) {
    return { ok: false };
  }
  const okPw = await verifyPassword(password, user.passwordHash); // función existente
  if (!okPw) {
    const next = (user.failedLoginCount ?? 0) + 1;
    await db.update(users).set(
      next >= 5
        ? { failedLoginCount: 0, lockoutUntil: new Date(Date.now() + 15 * 60_000) }
        : { failedLoginCount: next },
    ).where(eq(users.id, user.id));
    return { ok: false };
  }
  if (user.failedLoginCount || user.lockoutUntil) {
    await db.update(users).set({ failedLoginCount: 0, lockoutUntil: null }).where(eq(users.id, user.id));
  }
```

- [ ] **Step 7: Suite + typecheck + commit.**
```bash
cd apps/api && npm test && npm run typecheck
git add apps/api/src/db/schema.ts apps/api/src/auth apps/api/src/routes/admin.ts apps/api/drizzle apps/api/test/auth.test.ts
git commit -m "feat(security): política de contraseñas (mín 8) + lockout por usuario (5 fallos/15min)"
```

---

## Task SEC-3: Backups off-site + restore probado (ops, sin código)

**Problema:** `backup.sh` guarda todo en el mismo VPS. Ver SEC-4 de la auditoría.

- [ ] **Step 1: Crear un bucket externo** (Cloudflare R2 o S3). Anotar credenciales.

- [ ] **Step 2: Instalar y configurar `rclone` en el VPS.**
```bash
sudo apt-get install -y rclone
rclone config   # crear remote "backup" apuntando al bucket
```

- [ ] **Step 3: Extender `infra/backup.sh`** para sincronizar off-site al final. Agregar al
final del script (después del `pg_dump` y del `tar` de media):
```bash
# Sincronizar backups a almacenamiento externo (off-site).
rclone copy /opt/motormec/backups backup:motormec-backups --max-age 24h --transfers 4
```

- [ ] **Step 4: Confirmar que el cron/timer corre.** Verificar el systemd timer de backup:
```bash
systemctl list-timers | grep motormec
sudo systemctl status motormec-backup.timer
```
Si no existe, crear el timer (ver `infra/systemd/`).

- [ ] **Step 5: PROBAR UN RESTORE (obligatorio).** En una DB de staging vacía:
```bash
gunzip -c backup-YYYY-MM-DD.sql.gz | psql "$STAGING_DATABASE_URL"
```
Verificar que la app levanta contra staging y los datos están. Un backup nunca restaurado no
es un backup.

- [ ] **Step 6: Documentar** el procedimiento de restore en `DEPLOY.md` (sección "Disaster
recovery") y commitear el `backup.sh` actualizado.
```bash
git add infra/backup.sh DEPLOY.md
git commit -m "ops(backup): sincronizar backups off-site con rclone + documentar restore"
```

---

## Task SEC-4: Tests de aislamiento cross-tenant de billing

**Problema:** las tablas de billing se acceden con `db` crudo filtrando a mano por `tenantId`;
no hay tests de aislamiento. Ver SEC-6 de la auditoría.

**Files:**
- Modify: `apps/api/test/billing.test.ts` (agregar casos de aislamiento) o `apps/api/test/isolation.test.ts`

- [ ] **Step 1: Escribir tests que prueben que un tenant NO ve billing de otro.**

Patrón (adaptá a los servicios reales de `domain/billing/service.ts`):
```ts
  it("billing: tenant A cannot read tenant B's subscription/charges/wallet", async () => {
    const A = await createTenant({ name: "A", slug: "a" });
    const B = await createTenant({ name: "B", slug: "b" });
    // Crear una subscription/charge/wallet entry para B con el service real.
    // ... setup con B ...
    // Consultar como A y verificar 0 filas de B.
    const asA = await listSubscriptions(A.id); // función del BillingService
    expect(asA.find((s) => s.tenantId === B.id)).toBeUndefined();
  });
```
Cubrir: `subscriptions`, `charges`, `wallet_ledger`, `payment_methods`, `billing_customers`.

- [ ] **Step 2: Correr y ver que pasan.** Si alguno falla, hay un `where` faltante en
`domain/billing/service.ts`: corregirlo (agregar `eq(tabla.tenantId, tenantId)` a esa query).

- [ ] **Step 3: (Recomendado) Enrutar billing por un accesor scopeado.** Evaluar mover las
lecturas/escrituras de billing a través de un `TenantDb` (agregando esas tablas a
`tenantScopedTables` en `schema.ts`). Si es mucho, al menos dejá los tests como red.

- [ ] **Step 4: Commit.**
```bash
git add apps/api/test/billing.test.ts apps/api/src/domain/billing
git commit -m "test(billing): aislamiento cross-tenant de subscriptions/charges/wallet"
```

---

## Task SEC-5: Validación de magic bytes en uploads

**Problema:** los uploads validan solo el prefijo del data-URL, no los bytes reales. Ver SEC
uploads de la auditoría.

**Files:**
- Create: `apps/api/src/lib/imageType.ts`
- Modify: `apps/api/src/routes/orders.ts` (subida de fotos), `apps/api/src/routes/quotes.ts` (logo)
- Test: `apps/api/test/imageType.test.ts`

- [ ] **Step 1: Test que falla.**

Crear `apps/api/test/imageType.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { detectImageType } from "../src/lib/imageType.js";

describe("detectImageType (magic bytes)", () => {
  it("detects PNG", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(detectImageType(png)).toBe("image/png");
  });
  it("detects JPEG", () => {
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    expect(detectImageType(jpg)).toBe("image/jpeg");
  });
  it("returns null for a text file pretending to be png", () => {
    expect(detectImageType(Buffer.from("not an image at all"))).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que falla.** `cd apps/api && npm test -- imageType` → FALLA.

- [ ] **Step 3: Implementar.**

Crear `apps/api/src/lib/imageType.ts`:
```ts
/** Detecta el tipo real de imagen por magic bytes (no confía en la extensión). */
export function detectImageType(buf: Buffer): "image/png" | "image/jpeg" | "image/webp" | "image/gif" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  return null;
}
```

- [ ] **Step 4: Usar en las subidas.** En `orders.ts` y `quotes.ts`, tras decodificar el
base64 del data-URL a `Buffer`, validar:
```ts
    const buf = Buffer.from(base64Data, "base64");
    const realType = detectImageType(buf);
    if (!realType || !ALLOWED.includes(realType)) {
      return reply.code(400).send({ error: "invalid_image", message: "El archivo no es una imagen válida." });
    }
```
(`ALLOWED` = la whitelist ya existente en cada ruta). Importar `detectImageType`.

- [ ] **Step 5: Suite + typecheck + commit.**
```bash
cd apps/api && npm test && npm run typecheck
git add apps/api/src/lib/imageType.ts apps/api/src/routes/orders.ts apps/api/src/routes/quotes.ts apps/api/test/imageType.test.ts
git commit -m "fix(security): validar magic bytes en uploads (no confiar en el content-type)"
```

---

## Task SEC-6: Mensajes de error genéricos al cliente

**Problema:** `billing.ts` y `orders.ts` devuelven `message: (err as Error).message` en 502/409,
filtrando detalle interno o del proveedor. Ver auditoría #9.

**Files:**
- Modify: `apps/api/src/routes/billing.ts`, `apps/api/src/routes/orders.ts` (y grep por otros)

- [ ] **Step 1: Encontrar los leaks.**
```bash
grep -rn "as Error).message" apps/api/src/routes
```

- [ ] **Step 2: Reemplazar** cada `message: (err as Error).message` por un mensaje genérico y
loguear el real server-side:
```ts
    } catch (err) {
      request.log.error({ err }, "fallo al procesar la operación");
      return reply.code(502).send({ error: "provider_error", message: "No se pudo procesar el pago. Probá de nuevo." });
    }
```
Excepción: los errores de negocio esperados (ej. "orden finalizada", "stock insuficiente") SÍ
pueden mostrarse — esos son mensajes controlados por nosotros, no del proveedor.

- [ ] **Step 3: Suite + commit.**
```bash
cd apps/api && npm test
git add apps/api/src/routes
git commit -m "fix(security): mensajes de error genéricos al cliente (loguear detalle server-side)"
```

---

## Task SEC-7: Segregación/rotación del token de WhatsApp (runbook)

**Problema:** `WHATSAPP_ACCESS_TOKEN` es global para todos los talleres; si se filtra, cae
todo. Ver auditoría bot #6.

- [ ] **Step 1: Documentar en `SECURITY.md`** que el token es global y su blast radius.
- [ ] **Step 2: Runbook de rotación:** generar token nuevo en Meta, actualizar el `.env` del
VPS, `systemctl restart motormec-api`, revocar el viejo. Agendar rotación trimestral.
- [ ] **Step 3: (Roadmap)** evaluar migrar a un WhatsApp Business Account por tenant (los
tokens por-tenant ya se guardan cifrados en `tenants.wa_access_token`). Anotar como tarea de
arquitectura futura; no se implementa acá.
- [ ] **Step 4: Commit** de la doc.
```bash
git add SECURITY.md
git commit -m "docs(security): runbook de rotación del token de WhatsApp"
```

---

## Task SEC-8: Confirmar firma HMAC de Mobbex en sandbox (ops)

**Problema:** el esquema HMAC real de Mobbex no está confirmado; si no coincide, un webhook
falso podría marcar un cobro como aprobado. Ver auditoría #7.

- [ ] **Step 1:** Crear cuenta sandbox en mobbex.dev.
- [ ] **Step 2:** Disparar un webhook de prueba y capturar el header de firma y el body crudo.
- [ ] **Step 3:** Verificar que `verifyHmac` en `domain/billing/mobbex.ts:136-147` valida ESE
esquema exacto (qué campos se firman, en qué orden, con qué secreto). Ajustar si difiere.
- [ ] **Step 4:** Agregar un test con el payload real capturado:
```ts
  it("verifyHmac accepts a real Mobbex sandbox signature", () => {
    const body = "..."; // body crudo capturado
    const sig = "...";  // header capturado
    expect(verifyHmac(body, sig, SANDBOX_SECRET)).toBe(true);
  });
```
- [ ] **Step 5:** Commit del test + fix.
```bash
git add apps/api/src/domain/billing/mobbex.ts apps/api/test/billing.test.ts
git commit -m "fix(billing): confirmar esquema HMAC de Mobbex contra sandbox + test"
```

---

## Task SEC-9: Headers globales + redacción de webhook bodies

- [ ] **Step 1: Verificar headers de seguridad en Caddy.** En `infra/Caddyfile`, confirmar que
existan `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy`. Si falta alguno, agregarlo al bloque `header`.

- [ ] **Step 2: No persistir el payload crudo de billing.** En `domain/billing/service.ts:223`,
donde se guarda `webhookEvents.payload` con el body completo, guardar solo los campos
necesarios (id, tipo, estado, monto) en vez del raw entero, para no dejar datos de pago en la
DB más de lo necesario.

- [ ] **Step 3: Commit.**
```bash
git add infra/Caddyfile apps/api/src/domain/billing/service.ts
git commit -m "fix(security): headers globales en Caddy + no persistir payload crudo de webhooks"
```

---

## Cierre del plan 03

Checklist final antes de cobrar (de `SECURITY.md`): backups off-site probados ✓, rate-limit
fino ✓, tests de aislamiento de billing ✓, HMAC Mobbex confirmado ✓, política de contraseñas
+ lockout ✓. Seguí con el [plan 04 — Bot/IA](2026-07-02-04-bot-ia-hardening.md).
