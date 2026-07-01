# Momec — Deploy runbook (VPS + Caddy + systemd + Postgres)

> ¿Querés la versión corta de "qué tengo que hacer yo"? Mirá
> [`docs/PRODUCCION.md`](docs/PRODUCCION.md). Este archivo es el runbook completo.

Reproducible deploy for a single VPS. Model: Fastify API behind Caddy, static SPA
served by Caddy, Postgres local, per-tenant photos on disk, daily `pg_dump`.

Todo el ciclo build → migrar → publicar → reiniciar está envuelto en
`infra/bootstrap.sh` (idempotente): `sudo -u motormec bash infra/bootstrap.sh`.

```
WhatsApp (Meta) ─► Caddy (TLS, headers) ─► /api,/webhooks ─► Fastify :3001 ─► Postgres
                                         └► /app/*  ─────────► static SPA (dist)
                                                              photos: /var/www/motormec-media
```

## 0. Prerequisites (Ubuntu/Debian VPS)

```bash
# Node 20+ (LTS), Postgres, Caddy
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql caddy git
sudo useradd --system --create-home --shell /usr/sbin/nologin motormec
```

## 1. Postgres

```bash
sudo -u postgres psql <<'SQL'
CREATE USER motormec WITH PASSWORD 'CHANGE_ME_STRONG';
CREATE DATABASE motormec OWNER motormec;
SQL
```

`DATABASE_URL=postgres://motormec:CHANGE_ME_STRONG@localhost:5432/motormec`

## 2. Get the code

```bash
sudo mkdir -p /opt/motormec && sudo chown motormec:motormec /opt/motormec
sudo -u motormec git clone <repo-url> /opt/motormec
cd /opt/motormec
sudo -u motormec npm install
```

## 3. Configure the API

```bash
cd /opt/motormec/apps/api
sudo -u motormec cp .env.example .env
sudo -u motormec nano .env
```

Set, at minimum:

- `DATABASE_URL` — from step 1
- `SESSION_SECRET` — `openssl rand -base64 48`
- `SECRETS_KEY` — `openssl rand -hex 32` (32 bytes / 64 hex; encrypts per-tenant WA tokens)
- `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` — from the Meta app
- `GROQ_API_KEY`
- `COOKIE_SECURE=true`
- `MEDIA_ROOT=/var/www/motormec-media`
- `PORT=3001`

```bash
sudo mkdir -p /var/www/motormec-media && sudo chown motormec:motormec /var/www/motormec-media
```

## 4. Build + migrate

```bash
cd /opt/motormec/apps/api
sudo -u motormec npm run build
sudo -u motormec npm run db:migrate      # applies drizzle/ migrations
# optional seed for a first tenant/admin:
# sudo -u motormec npm run seed:dev
```

## 5. Build + publish the SPA

```bash
cd /opt/motormec/apps/web
sudo -u motormec npm run build            # base '/app/'
sudo mkdir -p /var/www/motormec/app
sudo cp -r dist/* /var/www/motormec/app/

# Marketing landing (static) served at the root domain
sudo mkdir -p /var/www/motormec/landing
sudo cp -r /opt/motormec/landing/* /var/www/motormec/landing/
```

## 6. systemd (API)

```bash
sudo cp /opt/motormec/infra/systemd/motormec-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now motormec-api
sudo systemctl status motormec-api
curl -s http://127.0.0.1:3001/api/health     # {"status":"ok","db":"up"}
```

## 7. Caddy

```bash
sudo cp /opt/motormec/infra/Caddyfile /etc/caddy/Caddyfile
# set your domain:
echo 'DOMAIN=taller.midominio.com' | sudo tee /etc/default/caddy
sudo systemctl restart caddy
```

Caddy provisions TLS automatically. Verify `https://<domain>/app/` loads and
`https://<domain>/api/health` returns ok.

## 8. WhatsApp webhook (Meta)

- Callback URL: `https://<domain>/webhooks/whatsapp`
- Verify token: the value of `WHATSAPP_VERIFY_TOKEN`
- Per tenant, set `wa_phone_number_id`, `wa_display_number` and the (encrypted)
  access token via the dashboard (Bot WhatsApp → Configuración) or directly in DB.
  Signature on every POST is verified with `WHATSAPP_APP_SECRET`.

## 9. Backups

```bash
sudo cp /opt/motormec/infra/systemd/motormec-backup.* /etc/systemd/system/
sudo chmod +x /opt/motormec/infra/backup.sh
sudo systemctl daemon-reload
sudo systemctl enable --now motormec-backup.timer
sudo systemctl start motormec-backup.service   # test once → /opt/motormec/backups
```

Restore: `gunzip -c backup.sql.gz | psql "$DATABASE_URL"`.

## 10. Migrate existing data from Convex (one-time)

```bash
# copy the Convex export to the server, then:
cd /opt/motormec/apps/api
sudo -u motormec npm run migrate:convex -- /path/to/dev-export.zip <slug> "Nombre Taller"
```

The script prints a per-table source→inserted count and exits non-zero on mismatch.
**Run against a staging copy first.**

## Updating

```bash
cd /opt/motormec && sudo -u motormec git pull && sudo -u motormec npm install
cd apps/api && sudo -u motormec npm run build && sudo -u motormec npm run db:migrate
sudo systemctl restart motormec-api
cd ../web && sudo -u motormec npm run build && sudo cp -r dist/* /var/www/motormec/app/
```

## Super-admin (consola de plataforma)

Creá tu usuario super-admin una sola vez:

```bash
cd /opt/motormec/apps/api
sudo -u motormec npm run seed:admin -- emir 'PASSWORD_FUERTE' "Emir"
```

Entrás en `https://<domain>/app/admin` (cookie `mm_admin`, separada de la del
taller). Desde la consola gestionás **todo sin tocar la DB**: crear talleres,
cambiar plan / suspender, ligar el número de WhatsApp a un taller, autorizar
teléfonos y ver el consumo del mes (usuarios / números / mensajes IA) contra los
límites del plan.

## New tenant (taller)

No hay signup público (YAGNI). Se provisiona desde la consola super-admin
(`/app/admin` → **Nuevo taller**): nombre, slug, plan y el usuario admin del
taller. El plan define los límites (usuarios, números de WhatsApp, mensajes IA/mes)
que la app y el bot aplican en runtime.

## CI/CD (GitHub Actions)

Dos workflows en `.github/workflows/`:

- **`ci.yml`** — en cada push/PR: instala, typecheck, corre los **38+ tests** de la
  API contra un Postgres de servicio, y buildea la web. No necesita configuración.
- **`deploy.yml`** — en push a `main` (o manual): buildea y despliega al VPS por SSH
  (rsync + `npm ci --omit=dev` + migraciones + copia de la web/landing + restart del
  servicio). Es **no-op hasta configurar los secrets** del repo (Settings → Secrets
  and variables → Actions):
  - `VPS_HOST` — IP o dominio del VPS
  - `VPS_USER` — usuario SSH (ej. `motormec` o uno con sudo)
  - `VPS_SSH_KEY` — clave privada SSH (sin passphrase) autorizada en el VPS
  - `VPS_PORT` — opcional (default 22)

  El usuario SSH necesita `sudo` sin password para `cp` a `/var/www` y `systemctl
  restart motormec-api` (o ajustá el workflow a tu layout).

## Health & logs

- `systemctl status motormec-api` / `journalctl -u motormec-api -f`
- `GET /api/health` → `{ status: "ok", db: "up" }`
- Caddy logs: `journalctl -u caddy -f`
