# Salir a producción — guía corta (lo que tenés que hacer vos)

Esta es la versión "al grano". El runbook completo y reproducible está en
[`DEPLOY.md`](../DEPLOY.md). Acá va sólo lo que depende de vos: qué credenciales
conseguir y los comandos mínimos.

## 1. Lo único que tenés que conseguir vos

| Credencial | De dónde sale | Para qué |
|---|---|---|
| **VPS** (Ubuntu/Debian) + dominio | tu proveedor (Hetzner, DigitalOcean, Contabo…) | dónde corre todo |
| **ANTHROPIC_API_KEY** | console.anthropic.com → API Keys | que el bot entienda los mensajes con IA |
| **WhatsApp** (App Secret, Verify Token, Phone Number ID, Access Token) | tu app de Meta (ya la tenés del Motormec actual) | recibir y responder mensajes |

> Si ya venías usando el número de Motormec, **reutilizás las mismas credenciales
> de Meta**. Lo único nuevo es la `ANTHROPIC_API_KEY`. No hay que rehacer la app de Meta.

Los demás secretos se **generan en el server** (no los pedís a nadie):

```bash
openssl rand -base64 48   # SESSION_SECRET
openssl rand -hex 32      # SECRETS_KEY  (cifra los tokens de WhatsApp en la DB)
```

## 2. Comandos mínimos en el VPS

### Camino rápido — VPS que YA tiene otro proyecto (un comando)

`infra/vps-setup.sh` es aditivo y defensivo: **detecta antes de instalar, crea su
propia base y usuario, elige un puerto libre para la API, y NO toca tu proxy ni tu
base existentes**. Pide confirmación antes de cambiar algo.

```bash
# en el VPS, como root:
git clone https://github.com/EmirMaestu/motormec.git /opt/momec-setup
cd /opt/momec-setup
export MOMEC_DOMAIN=app.tudominio.com
export ANTHROPIC_API_KEY=sk-ant-...
export WHATSAPP_APP_SECRET=...          # de tu app de Meta
export WHATSAPP_VERIFY_TOKEN=momec_xxx  # el que elijas (lo usás en Meta)
bash infra/vps-setup.sh
```

Detecta si usás **nginx** o **Caddy** y suma el vhost del subdominio sin tocar el
resto. Al final imprime los últimos pasos (certbot, super-admin, webhook).

### Camino manual (VPS limpio)

Seguí `DEPLOY.md` pasos 0–3 (instalar Node/Postgres/Caddy, clonar, crear `.env`).
Después, todo el ciclo build+migrar+publicar+reiniciar es **un solo comando**:

```bash
cd /opt/motormec
sudo -u motormec bash infra/bootstrap.sh
```

`bootstrap.sh` corre `npm run preflight` antes de publicar: si te falta un secreto
o la DB no responde, **te avisa y corta** en vez de quedar a medias.

## 3. Crear tu super-admin (una vez)

```bash
cd /opt/motormec/apps/api
sudo -u motormec npm run seed:admin -- emir 'TU_PASSWORD_FUERTE' "Emir"
```

Entrás en `https://<tu-dominio>/app/admin` y desde ahí:

1. **Creás el taller** (nombre, slug, plan, usuario admin).
2. **Ligás el número de WhatsApp** a ese taller (Phone Number ID + Access token).
   Todo lo que entre por ese número cae en ese taller.
3. **Autorizás los teléfonos** que pueden cargar por el bot.

## 4. Apuntar el webhook de Meta (1 cambio)

En tu app de Meta → WhatsApp → Configuration → Webhook:

- **Callback URL:** `https://<tu-dominio>/webhooks/whatsapp`
- **Verify token:** el valor de `WHATSAPP_VERIFY_TOKEN` de tu `.env`
- Suscribí el evento **`messages`**.

> Un número de Meta apunta a **un** webhook. Mientras testeás, podés mantener el
> número viejo en el Motormec actual y usar un número de prueba para Momec, o
> mover el webhook cuando estés listo para cortar.

## 5. Verificar que está vivo

```bash
curl -s https://<tu-dominio>/api/health      # {"status":"ok","db":"up"}
```

- `https://<tu-dominio>/app/` → dashboard del taller
- `https://<tu-dominio>/app/admin` → tu consola
- Mandá un WhatsApp desde un número autorizado → debería aparecer en
  **Bot WhatsApp → Ingresos** y crear el vehículo + la orden.

## 6. Actualizaciones futuras

```bash
cd /opt/motormec && sudo -u motormec git pull
sudo -u motormec bash infra/bootstrap.sh
```

O, si configuraste los secrets del repo, un push a `main` despliega solo
(ver `deploy.yml` en `DEPLOY.md`).
