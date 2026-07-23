# Bot de WhatsApp — verificación, números y plantillas

Referencia **de producción** del canal de WhatsApp de Momec: cómo se verifica, cómo se
rutean los mensajes entre talleres, y — lo más importante — **cuándo hace falta una
plantilla aprobada por Meta** y qué falta implementar para que los avisos al cliente
funcionen de verdad.

> Para probar en **local** con un túnel (cloudflared), ver [`WHATSAPP-SETUP.md`](WHATSAPP-SETUP.md).
> Ese documento usa una URL de túnel que cambia en cada reinicio; acá va el flujo de producción.

---

## 0. TL;DR

1. Hay **tres verificaciones distintas** que se confunden: la del **webhook** (una vez), la de la
   **firma** (cada mensaje) y la de **números autorizados** (quién puede usar el bot).
2. WhatsApp tiene una **ventana de servicio de 24 horas**. Dentro de ella podés mandar texto
   libre; fuera de ella **solo plantillas aprobadas**.
3. ⚠️ **Gap actual:** los avisos automáticos al cliente (`notifyOrderStatusChange`) mandan texto
   libre. Para un cliente que no escribió en 24 h, Meta los rechaza y **fallan en silencio**.
   Hay que crear plantillas y agregar el envío por plantilla. Ver [§5](#5-estado-actual-del-código--el-gap).

---

## 1. Arquitectura del canal

```
                        ┌─ verify token (GET, una vez)
Meta / WhatsApp ────────┤
                        └─ POST /webhooks/whatsapp  ──► firma HMAC (x-hub-signature-256)
                                    │
                                    ▼
                        ruteo por  phone_number_id  ──►  ¿de qué taller es este mensaje?
                                    │
                                    ▼
                        ¿el remitente está en numeros_autorizados del taller?
                                    │  sí
                                    ▼
                        stateMachine → agente (Claude) → respuesta
```

**Un solo webhook público atiende a todos los talleres.** Cada taller registra su
`wa_phone_number_id`, su número visible y su **access token** (guardado cifrado con
`SECRETS_KEY`). El webhook mira el `phone_number_id` del mensaje entrante para saber a qué
taller pertenece y con qué token responder.

**Dos números distintos en juego:**

| Número | De dónde sale | Para qué se usa |
|---|---|---|
| **Del taller** | `tenants.wa_phone_number_id` + token cifrado (cargado en la app) | Conversación del bot: recibe y **responde** los mensajes del taller |
| **De plataforma** | `env.WHATSAPP_PHONE_NUMBER_ID` + `env.WHATSAPP_ACCESS_TOKEN` | Avisos automáticos al **cliente final** (`notifyOrderStatusChange`) |

---

## 2. Las tres verificaciones

### A. Verificación del webhook (una sola vez)

Meta hace un `GET` a la callback URL con `hub.mode`, `hub.verify_token` y `hub.challenge`.
Momec compara el token contra `WHATSAPP_VERIFY_TOKEN` y, si coincide, devuelve el challenge.

- **Callback URL (producción):** `https://momec.pro/webhooks/whatsapp`
- **Verify token:** el valor de `WHATSAPP_VERIFY_TOKEN` en `apps/api/.env` del VPS
  (esa es la fuente de verdad — no uses uno "de memoria").
- Dónde: Meta → tu app → **WhatsApp → Configuration → Webhook → Verify and Save**.
- Después de verificar, **suscribite al campo `messages`** (si no, Meta verifica pero nunca
  te manda nada).

### B. Verificación de la firma (en cada mensaje)

Cada `POST` de Meta trae el header `x-hub-signature-256`, un HMAC del cuerpo con el
**App Secret**. Momec lo valida contra `WHATSAPP_APP_SECRET`; si no coincide responde **401**.

Esto es lo que hace seguro tener un único webhook público: nadie puede inyectar mensajes
falsos sin el App Secret.

> Si usás un App Secret de ejemplo (`dev_app_secret`), Meta manda los mensajes pero la firma
> **no valida** y todo responde 401. Tiene que ser el App Secret real (App → Settings → Basic).

### C. Números autorizados (quién puede usar el bot)

Tabla `numeros_autorizados`, **por taller**. Solo los números activos pueden operar el bot
(cargar vehículos, pedir presupuestos, etc.). Un remitente no autorizado recibe:

> ⛔ Este número no está autorizado para usar el bot. Contactá al taller para solicitar acceso.

- Dónde se cargan: Momec → **Bot WhatsApp → Números autorizados**.
- Formato **E.164 sin `+`**, ej. `5492611234567`.

---

## 3. La ventana de 24 horas (lo que hay que entender sí o sí)

WhatsApp separa los mensajes en dos mundos:

| | Ventana de servicio abierta | Ventana cerrada |
|---|---|---|
| **Cuándo** | El cliente te escribió hace **menos de 24 h** | Nunca te escribió, o pasaron **más de 24 h** |
| **Qué podés mandar** | Texto libre, botones, PDFs, imágenes | **Solo plantillas aprobadas** |
| **Si mandás texto libre** | ✅ Funciona | ❌ Error **131047** — el mensaje no se entrega |

Cada mensaje entrante del cliente **reabre** la ventana por otras 24 h.

**Traducido a Momec:**

- ✅ **Las respuestas del bot están bien.** El taller escribe primero → la ventana está abierta →
  el bot puede responder texto libre, botones y mandar el PDF del presupuesto. Nada que cambiar.
- ❌ **Los avisos automáticos al cliente NO.** "Tu auto está listo para retirar" se manda cuando
  el taller cambia el estado de la orden; ese cliente casi nunca escribió en las últimas 24 h.
  **Eso necesita plantilla aprobada.**

---

## 4. Plantillas aprobadas por Meta

### Cómo son

Una plantilla es un mensaje **pre-aprobado** por Meta, con variables (`{{1}}`, `{{2}}`, …) que
completás al enviar. Se crean en **Meta Business Manager → WhatsApp Manager → Message Templates**.

- **Categorías:** `UTILITY` (transaccional: estado de un pedido/servicio), `MARKETING`
  (promocional), `AUTHENTICATION` (códigos). **Los avisos de Momec son `UTILITY`.**
- **Idioma:** crear en `es_AR` (o `es`) y usar exactamente ese código al enviar.
- **Aprobación:** de minutos a ~24 h. Si Meta la rechaza, la editás y reenviás.
- **Motivos típicos de rechazo:** contenido promocional en una plantilla marcada `UTILITY`,
  variables al principio o al final del texto sin contexto, variables consecutivas (`{{1}} {{2}}`),
  texto que es *solo* variables, o placeholders sin ejemplo cargado.

> **Costos:** Meta cobra por mensaje de plantilla, con tarifas distintas por categoría y país,
> y las `UTILITY` enviadas **dentro** de una ventana de servicio abierta no se cobran. Las tarifas
> cambian seguido — confirmá los valores vigentes en la página de precios de Meta antes de
> proyectar costos.

### Las plantillas que necesita Momec

Una por cada estado que hoy genera aviso en `notifications.ts`, más las del módulo de cobro:

| Nombre sugerido | Categoría | Texto propuesto (variables: `{{1}}` cliente, `{{2}}` vehículo, `{{3}}` taller / monto) |
|---|---|---|
| `orden_en_reparacion` | UTILITY | Hola {{1}}, ya comenzamos a trabajar en {{2}}. Te avisamos cuando esté listo. — {{3}} |
| `orden_esperando_repuestos` | UTILITY | Hola {{1}}, {{2}} está a la espera de repuestos. Te avisamos en cuanto lleguen. — {{3}} |
| `orden_lista` | UTILITY | Hola {{1}}, {{2}} ya está listo para retirar. Total: {{3}}. ¡Te esperamos! — {{4}} |
| `orden_entregada` | UTILITY | Hola {{1}}, registramos la entrega de {{2}}. ¡Gracias por confiar en nosotros! — {{3}} |
| `presupuesto_enviado` | UTILITY | Hola {{1}}, te enviamos el presupuesto para {{2}} por {{3}}. Cualquier duda, respondé este mensaje. — {{4}} |
| `saldo_pendiente` | UTILITY | Hola {{1}}, te recordamos que queda un saldo de {{2}} por {{3}}. — {{4}} |

Notas de armado:
- Sin emojis al inicio y sin variables pegadas entre sí (evita rechazos).
- El nombre de la plantilla va en minúsculas con guiones bajos.
- Cargá un **ejemplo** para cada variable al crearla; sin ejemplos Meta rechaza.
- Una vez aprobada, **el texto no se edita libremente** — editar la manda a revisión de nuevo.
  Por eso conviene dejar el monto y el nombre del taller como variables y no hardcodearlos.

---

## 5. Estado actual del código — el gap

**Lo que hay hoy:**

| Archivo | Qué hace | Estado |
|---|---|---|
| `whatsapp/client.ts` | `enviarMensaje` (`type: "text"`), `enviarMensajeConBotones` (`interactive`), `enviarDocumento` (`document`), `subirMedia`, `descargarMedia` | ⚠️ **No existe envío por plantilla** (`type: "template"`) |
| `domain/notifications.ts` | `plantilla(status, ctx)` arma un **string de texto libre** por estado y lo manda con `enviarMensaje` | ❌ La función se llama "plantilla" pero **no** es una plantilla de Meta |
| `notifyOrderStatusChange` | `catch { return false }` — best-effort, nunca lanza | ❌ **Falla en silencio**: si Meta rechaza, nadie se entera |

**Consecuencia concreta:** hoy los avisos al cliente solo llegan si ese cliente le escribió al
número de plataforma en las últimas 24 h. En la práctica, **casi nunca**. Los demás se pierden
sin error visible.

**Qué hay que hacer (pendiente, no implementado):**

1. **Crear y aprobar** las plantillas de la tabla de arriba en WhatsApp Manager.
2. **Agregar `enviarPlantilla()`** en `client.ts`:
   ```ts
   export async function enviarPlantilla(
     ctx: SendCtx, to: string, nombre: string, idioma: string, variables: string[],
   ): Promise<boolean> {
     return post(ctx, {
       messaging_product: "whatsapp",
       to: normalizarNumeroEnvio(to),
       type: "template",
       template: {
         name: nombre,
         language: { code: idioma },
         components: [{
           type: "body",
           parameters: variables.map((v) => ({ type: "text", text: v })),
         }],
       },
     });
   }
   ```
3. **Mapear estado → plantilla** en `notifications.ts` (en vez de armar el string), pasando
   cliente / vehículo / monto / taller como variables.
4. **Dejar de fallar en silencio:** que `post()` devuelva el error de Meta y que
   `notifyOrderStatusChange` lo registre en el log (y ojalá lo muestre en la orden), para poder
   distinguir "no se avisó porque no hay teléfono" de "Meta rechazó el mensaje".

---

## 6. Configuración paso a paso

### Lado Meta

1. Cuenta de **Meta Business** + app en developers.facebook.com con el producto **WhatsApp**.
2. Del número de WhatsApp Business sacás: **Phone number ID**, **Access token** (generá uno
   **permanente**, los temporales vencen en 24 h) y el **App Secret** (App → Settings → Basic).
3. **WhatsApp → Configuration → Webhook:**
   - Callback URL: `https://momec.pro/webhooks/whatsapp`
   - Verify token: el `WHATSAPP_VERIFY_TOKEN` del `.env` del VPS
   - **Verify and Save** → suscribirse al campo **`messages`**
4. **Message Templates:** crear las plantillas de [§4](#4-plantillas-aprobadas-por-meta) y esperar aprobación.

### Lado Momec

5. En el `.env` del VPS: `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `ANTHROPIC_API_KEY`,
   y (para avisos al cliente) `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN`.
   Reiniciar: `sudo systemctl restart motormec-api`.
6. En la app → **Bot WhatsApp → Configuración del número**: Phone Number ID, número visible y
   access token del taller (se guarda cifrado).
7. En **Bot WhatsApp → Números autorizados**: agregar los celulares del taller en E.164
   (`5492611234567`).

### Probar

Desde un número autorizado, mandar al número del taller:

> *Entró un Ford Focus, patente AB123CD, 185.000 km, cambio de aceite, cliente Pedro.*

También se puede cargar **por partes**: el bot mantiene el hilo **5 minutos** de inactividad;
pasado ese tiempo arranca conversación nueva y avisa
(*"🔄 Pasaron unos minutos sin actividad, así que arranco una charla nueva."*).

Comandos por chat: `cancelá la #128` · `marcá #128 entregada` · `km #128 50000` ·
`mano de obra #128 25000`.

---

## 7. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| Webhook responde **401** | `WHATSAPP_APP_SECRET` incorrecto | Poner el App Secret real de la app de Meta |
| "Verify and Save" falla | `hub.verify_token` ≠ `WHATSAPP_VERIFY_TOKEN`, o la API no responde | Comparar contra el `.env` del VPS; probar `curl :3002/api/health` |
| Meta verifica pero no llegan mensajes | Falta suscribirse al campo **`messages`** | Webhook fields → activar `messages` |
| Error **131047** | Fuera de la ventana de 24 h | Usar **plantilla aprobada** (ver §4/§5) |
| Error **131030** | Número no está en la lista de destinatarios permitidos (app en modo desarrollo) | Agregar el número en Meta, o pasar la app a producción |
| El bot no responde a un número | No está en `numeros_autorizados` o está inactivo | Agregarlo en Bot WhatsApp → Números autorizados |
| Andaba y dejó de andar | Access token temporal vencido | Generar un token **permanente** |
| Avisos al cliente que "no llegan" | El gap de §5 (texto libre fuera de 24 h) | Implementar plantillas |

---

## 8. Checklist

- [ ] App de Meta con producto WhatsApp y **App Secret real** en el `.env`
- [ ] Webhook verificado en `https://momec.pro/webhooks/whatsapp`
- [ ] Suscripción al campo **`messages`**
- [ ] Access token **permanente** (no el de 24 h)
- [ ] Phone Number ID + token cargados en el taller (Bot WhatsApp)
- [ ] Celulares del taller en **Números autorizados** (E.164)
- [ ] Prueba real: alta de vehículo por partes + consulta + presupuesto con montos correctos
- [ ] **Plantillas `UTILITY` creadas y aprobadas** en WhatsApp Manager
- [ ] **`enviarPlantilla()` implementado** y `notifications.ts` migrado a plantillas
- [ ] Errores de envío **logueados** (no más fallo silencioso)
