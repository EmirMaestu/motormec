# Probar el bot de WhatsApp con IA desde tu celular

Cómo conectar un número de WhatsApp al bot de Momec y probarlo en vivo, usando un
**túnel** para exponer tu `localhost` mientras desarrollás. En producción esto lo
reemplaza el dominio del VPS (ver [`DEPLOY.md`](../DEPLOY.md)); el túnel es solo para
probar localmente.

## 0. Lo que vas a necesitar (lado Meta)

- Una **cuenta de Meta Business** y una **app** en https://developers.facebook.com
  con el producto **WhatsApp** agregado.
- Un **número de WhatsApp Business** (sirve el número de prueba que da Meta, o el
  número real del taller). De ahí sacás:
  - **Phone number ID** (no es el número en sí; es un id).
  - **Access token** (para enviar mensajes — generá uno permanente).
  - **App Secret** (App → Settings → Basic) — sirve para verificar la firma.

## 1. El túnel (para exponer localhost)

Ya está descargado `cloudflared` y corriendo un túnel a `http://localhost:3001`.
La URL pública actual es:

```
https://interesting-hundreds-lows-bias.trycloudflare.com
```

> ⚠️ Las URLs de túnel rápido **cambian cada vez que reiniciás** cloudflared. Si lo
> reiniciás, actualizá la URL en Meta. Para levantarlo de nuevo:
>
> ```bash
> cloudflared tunnel --url http://localhost:3001 --no-autoupdate
> ```
>
> (la primera línea con `https://...trycloudflare.com` es tu nueva URL).

Tu **webhook** es esa URL + `/webhooks/whatsapp`:

```
https://interesting-hundreds-lows-bias.trycloudflare.com/webhooks/whatsapp
```

## 2. Configurar el `.env` y reiniciar la API

En `apps/api/.env` poné (los dos primeros son **tuyos**, de Meta y Anthropic):

```
WHATSAPP_APP_SECRET=<el App Secret de tu app de Meta>
WHATSAPP_VERIFY_TOKEN=dev_verify_token        # cualquier string; lo repetís en Meta
ANTHROPIC_API_KEY=sk-ant-...                   # para que la IA extraiga los datos
CLAUDE_MODEL_PARSER=claude-haiku-4-5
```

Reiniciá la API para que tome los cambios:

```bash
cd apps/api && npm run build && node dist/server.js
```

> Importante: con el `WHATSAPP_APP_SECRET` de ejemplo (`dev_app_secret`), Meta manda
> mensajes pero **la firma no valida** y el webhook responde 401. Para probar de
> verdad **tenés que poner el App Secret real** de tu app.

## 3. Conectar el webhook en Meta

En tu app de Meta → **WhatsApp → Configuration → Webhook**:

1. **Callback URL:** la del paso 1 (`.../webhooks/whatsapp`).
2. **Verify token:** el mismo `WHATSAPP_VERIFY_TOKEN` del `.env` (`dev_verify_token`).
3. Tocá **Verify and Save** → Meta hace un GET y Momec devuelve el challenge (ya
   probado: funciona ✓).
4. En **Webhook fields**, suscribite a **`messages`**.

## 4. Cargar el número y el token en el taller (en la app)

Entrá a Momec (http://localhost:5173/app/ · `taller-demo` / `admin` / `admin123`) →
**Bot WhatsApp**:

1. En **Configuración del número**, cargá el **Phone Number ID**, el número visible
   y el **Access token** (se guarda cifrado). Así Momec sabe a qué taller corresponde
   cada mensaje y con qué token responder.
2. En **Números autorizados**, agregá **tu número de celular** (formato E.164, ej.
   `5492611234567`). Solo los números autorizados pueden cargar vehículos.

> El ruteo es por `phone_number_id`: cada taller registra el suyo, y el webhook único
> atiende a todos. La firma se verifica con el único `WHATSAPP_APP_SECRET`.

## 5. Probar 🎉

Desde tu celular, mandá un WhatsApp al número del taller, por ejemplo:

> *Entró un Ford Focus, patente AB123CD, 185.000 km, cambio de aceite y filtro, cliente Pedro.*

El bot:
1. Verifica que tu número está autorizado.
2. Extrae los datos con **Claude** (Haiku).
3. Busca al cliente, te muestra el resumen con botones y, al confirmar, **crea la
   orden** vinculada al cliente. Podés mandar fotos antes de registrar.

También podés **editar/borrar por chat**:

- `cancelá la #128` · `marcá #128 entregada` · `km #128 50000` · `mano de obra #128 25000`

## Notas

- Si no ves respuesta: revisá el log de la API (`/tmp/mm-api.log` o la consola),
  confirmá que el `WHATSAPP_APP_SECRET` es el real, y que el túnel sigue vivo
  (la URL en Meta tiene que coincidir con la actual).
- Para producción no se usa túnel: el webhook es `https://<tu-dominio>/webhooks/whatsapp`
  servido por Caddy, con el mismo flujo de credenciales por taller.
