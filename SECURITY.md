# Informe de seguridad — Momec

Auditoría manual del código (aislamiento entre talleres, pérdida y filtración de
datos). Fecha: 2026-07. Alcance: API (Fastify + Drizzle + Postgres), auth, media,
billing, bot de WhatsApp, deploy/backup.

## Resumen

El **aislamiento por tenant** está bien diseñado: toda lectura/escritura de datos
de taller pasa por `TenantDb` (`forTenant`), que inyecta el predicado
`tenant_id = <sesión>` en cada query y nunca acepta `tenant_id` del cliente. La
autenticación (PBKDF2-SHA256 210k, sesiones opacas con hash SHA-256, cookie
httpOnly+secure+SameSite=lax, rate-limit en login) es sólida. Same-origin, sin
CORS abierto.

Se encontró **1 fuga cross-tenant real** (media path traversal) y varios riesgos
de pérdida/filtración de datos. Los ítems 🔴/🟠 marcados **[ARREGLADO]** ya se
corrigieron en este commit.

---

## Hallazgos

### 🔴 1. Fuga cross-tenant por path traversal en `/api/media` — [ARREGLADO]
`media.ts` validaba que la ruta empezara con `<tenantId>/`, pero no bloqueaba
`..`. Un taller autenticado podía leer archivos de otro con
`GET /api/media/<miTenant>/../<otroTenant>/<historialId>/foto.jpg`
(pasaba el prefijo y `normalize()` sólo evitaba salir del root, no llegar a la
carpeta de otro tenant).
**Fix:** se rechaza cualquier ruta con `..` o `\`. Test agregado
(`blocks cross-tenant media access`). Explotarlo requería conocer UUIDs del otro
taller, pero era una fuga real.

### 🟠 2. XSS almacenado vía logo SVG — [ARREGLADO]
El logo del taller aceptaba `image/svg+xml`. Un SVG puede contener `<script>`;
servido same-origin y abierto directo en `/api/media/...`, ejecutaba JS en el
origen de Momec (podía hacer requests autenticados; la cookie es httpOnly así que
no se roba directo, pero igual es CSRF/acción en nombre del usuario).
**Fix:** (a) subida de logo restringida a PNG/JPG/WEBP (SVG fuera; pdf-lib
tampoco lo embebe); (b) `/api/media` ahora responde con
`X-Content-Type-Options: nosniff` y `Content-Security-Policy: default-src 'none';
sandbox` como defensa en profundidad.

### 🟠 3. Pérdida de datos: media no se respaldaba — [ARREGLADO]
`backup.sh` sólo dumpeaba Postgres. Las fotos de órdenes y los logos viven en
disco (`MEDIA_ROOT`); una falla de disco las perdía aunque la DB estuviera a
salvo. **Fix:** el backup ahora también hace `tar.gz` de `MEDIA_ROOT` (retención
14 días, con prune).

### 🟠 4. Backups sin copia off-site (single point of failure)
Los backups se guardan en el **mismo VPS** (`/opt/motormec/backups`). Si el
servidor se pierde/compromete, se pierden con él.
**Recomendación (pendiente, requiere infra):** sincronizar a almacenamiento
externo (Cloudflare R2 / S3 / otro host) con `rclone`/`rsync` por cron. Verificar
además que `backup.sh` esté efectivamente en el `crontab` del VPS y **probar una
restauración** (un backup nunca probado no es un backup).

### 🟠 5. Rate limiting casi ausente (abuso / costo)
`rateLimit` está `global: false`; sólo `/api/login` lo tiene. El resto de
endpoints autenticados (reportes pesados, media, y sobre todo el **bot con IA**)
no tienen tope por request. El bot sí tiene cuota mensual de IA por plan
(`iaQuota`), lo que acota el costo de Claude, pero un usuario autenticado podría
martillar endpoints.
**Recomendación:** activar un rate-limit global razonable (p. ej. 300/min por IP)
y uno más estricto en endpoints caros (reportes, subida de imágenes).

### 🟠 6. Billing no pasa por `TenantDb` (aislamiento frágil)
Las tablas de billing (`subscriptions`, `charges`, `wallet_ledger`, etc.) se
acceden con `db` crudo filtrando a mano por `tenantId`. Hoy los filtros están
bien puestos, pero es el único lugar donde **olvidar un `where` cruzaría
talleres**, y no hay tests de aislamiento de billing.
**Recomendación:** o bien enrutar billing por un accesor scopeado, o agregar
tests de aislamiento cross-tenant para esas tablas antes de cobrar en serio.

### 🟡 7. Firma de webhooks de billing sin confirmar (Mobbex)
`verifyHmac` rechaza si el secreto está vacío (seguro por defecto: sin secreto,
no se procesa nada). Pero el **esquema HMAC real de Mobbex no está confirmado** —
si no coincide, en el peor caso aceptaría un webhook no auténtico y marcaría un
cobro como aprobado.
**Recomendación:** validar el esquema exacto en sandbox (mobbex.dev) antes de
producción. Los webhooks ya son idempotentes (dedup por `provider+event_id`).

### 🟡 8. Sin política de contraseñas
Los usuarios los crea el admin con cualquier contraseña; no hay mínimo de fuerza
ni bloqueo de cuenta (sólo rate-limit por IP en login).
**Recomendación:** exigir largo mínimo (8-10), y considerar lockout tras N intentos.

### 🟡 9. Mensajes de error con detalle interno
`billing` y `orders` devuelven `message: (err as Error).message` en 502/409.
Puede filtrar detalle del proveedor o interno.
**Recomendación:** loguear el detalle server-side y devolver un mensaje genérico.

### 🟡 10. No hay página pública de presupuesto (positivo)
El PDF del presupuesto se manda por WhatsApp como documento (media privada de
Meta), no por URL pública. No hay superficie pública que filtre presupuestos. ✔

---

## Lo que está BIEN (para que quede registrado)

- **Aislamiento por tenant** forzado en `TenantDb`; `tenant_id` nunca del cliente;
  cubierto por tests de isolation.
- **Sesiones:** token opaco de 32 bytes, sólo se guarda su hash SHA-256; cookie
  `httpOnly` + `secure` + `SameSite=lax`; TTL; se revalida `user.active` y
  expiración en cada request; logout y desactivación invalidan.
- **Contraseñas:** PBKDF2-SHA256 210k (OWASP 2023), salt por usuario,
  `timingSafeEqual`, rehash automático.
- **Roles:** `requireRole("admin")` en finanzas, billing, reportes, gestión de
  usuarios y números de WhatsApp.
- **Webhook de WhatsApp:** firma HMAC (`X-Hub-Signature-256`) verificada; media
  servida sólo con auth y prefijo de tenant.
- **Secretos at-rest:** `wa_access_token` cifrado (AES-256-GCM con `SECRETS_KEY`).
- **CSRF:** mitigado por `SameSite=lax` + no hay mutaciones por GET + same-origin.
- **PWA/SW:** el service worker **no** cachea `/api` ni `/webhooks` (sin datos
  sensibles en caché).

## Checklist antes de cobrar/escala

- [ ] Copia de backups off-site + restore probado.
- [ ] Confirmar `backup.sh` en cron.
- [ ] Rate-limit global + endpoints caros.
- [ ] Tests de aislamiento de billing.
- [ ] Confirmar firma de webhooks Mobbex/Rebill en sandbox.
- [ ] Política de contraseñas / lockout.
