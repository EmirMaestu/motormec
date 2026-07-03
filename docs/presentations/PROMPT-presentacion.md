# Prompt para generar la presentación animada de Momec

Copiá y pegá el prompt de abajo en la herramienta de IA que uses para armar
presentaciones/videos (Gamma, Tome, Beautiful.ai, Pitch, Canva Magic, o un
generador de video como Runway/Pika con guion). Adjuntale las capturas de
`docs/presentations/screenshots/`.

> **Nota:** las capturas ya están sacadas y guardadas en
> `docs/presentations/screenshots/` (numeradas). El prompt le indica a la IA que
> las use — no hace falta que las saque de nuevo, solo adjuntalas.

---

## PROMPT (copiar desde acá)

Sos un director de arte y motion designer. Creá una **presentación animada,
moderna y con mucho ritmo** (estilo keynote de producto tech — pensá Apple /
Linear / Stripe), pensada para **grabarla en video** explicando el producto
**Momec**, un software de gestión para talleres mecánicos con un **bot de
WhatsApp con IA**.

### Identidad visual (respetala estrictamente)
- **Colores:** verde bosque `#043f2e` (fondo principal / bloques), verde lima
  chartreuse `#c8f169` (acento, resaltados, CTAs), verde claro salvia `#eef2e3`
  (fondos suaves), blanco papel `#fcfcfc`, verde medio `#2a6f2b` (secundario),
  carbón `#242423` (texto).
- **Tipografía:** títulos en una **serif elegante** (tipo Fraunces / Georgia),
  cuerpo en una **sans limpia** (tipo Inter). Contraste fuerte serif+sans.
- **Logo:** la "M" chartreuse sobre cuadrado verde bosque (está en las capturas).
- **Estilo:** flat, mucho aire, esquinas redondeadas (16px), sin gradientes
  chillones, sin stock genérico. Elegante y con carácter.

### Tono
Español rioplatense (voseo), cercano y directo, para dueños de taller. Frases
cortas. Cero jerga técnica. Vender el "antes vs después": del cuaderno al orden.

### Animación (clave — es para video)
- Transiciones suaves con easing `cubic-bezier(0.22, 1, 0.36, 1)`.
- Entradas escalonadas (stagger) de textos y tarjetas.
- Números que cuentan hacia arriba (count-up) en las métricas.
- Las capturas entran con un leve zoom/parallax dentro de un mockup de
  celular/notebook; resaltá con un círculo/pulso chartreuse el elemento que se
  está explicando (ej: el botón, el menú, el ítem del presupuesto).
- Ritmo: 1 idea por slide, 4–8 segundos por slide, cortes limpios.
- Respetá `prefers-reduced-motion` si es web.

### Estructura (usá las capturas indicadas de la carpeta screenshots/)
1. **Apertura** — Logo Momec animándose + claim: "El taller, bajo control."
   Subtítulo: "Órdenes, clientes, presupuestos y finanzas — y un bot de WhatsApp
   que carga todo por vos." (usar `00-landing.png` de fondo con parallax)
2. **El problema** — "Tu taller vive en un cuaderno y en tu cabeza." Animar
   papeles/planillas desordenados que se transforman en la app ordenada.
3. **Entrar a la plataforma** — Cómo se ingresa: pantalla de login. "Cada taller
   con su usuario. Roles de admin y mecánico." (usar `01-login.png`)
4. **El tablero** — Vista general: qué autos hay, en reparación, balance del día.
   Count-up en las métricas. (usar `02-dashboard.png`)
5. **Vehículos y órdenes** — Cargar un auto, seguir su estado, historial y fotos.
   (usar `03-vehiculos.png` y `04-ordenes.png`, resaltar estados y fotos)
6. **⭐ El bot de WhatsApp (momento hero)** — Simular un chat de WhatsApp:
   el usuario escribe *"Generá un presupuesto de 10000 para Juan de cambio de
   correa, repuestos 30mil"* y el bot responde y **manda un PDF branded**.
   Mostrar el mensaje entrando, el "escribiendo…", y el PDF apareciendo.
   Recalcar: "Sin abrir la compu. Desde el celular, hablándole normal."
7. **Presupuestos** — La sección web: crear presupuesto con el logo del taller,
   ítems, total, y el mismo PDF. (usar `05-presupuestos.png`)
8. **Reportes y finanzas** — Ingresos automáticos al entregar, calendario de
   ingresos, export CSV/PDF. (usar `06-reportes.png`)
9. **Instalable en el celular (PWA)** — "Se instala como app, sin Play Store."
   Mostrar el ícono en la pantalla de inicio. (usar `10-mobile-dashboard.png`,
   `11-mobile-presupuestos.png`)
10. **Planes** — Starter / Pro / Max, con el bot de IA escalando por plan y la
    migración de tu cuaderno incluida en Pro. (barras/cards animadas)
11. **Cierre / CTA** — "Empezá hoy. Cargá el primer auto por WhatsApp." +
    `momec.pro` + logo.

### Formato de salida
- Relación de aspecto **16:9** (para YouTube/pantalla) — y opcional una versión
  **9:16** (para reels/estados de WhatsApp) del bloque del bot.
- Cada slide con su **guion/locución** debajo (para grabar la voz en off).
- Entregá un guion narrado slide por slide, listo para leer en el video.

Hacelo sentir premium y con energía, pero limpio. La estrella es el bot de
WhatsApp: dale el momento más grande.

---

## Guiones cortos por video (si querés hacer clips separados)

**Clip 1 — "Cómo entrar a Momec" (30s)**
Guion: "Entrás a momec.pro/app con tu usuario. El dueño ve todo — finanzas
incluidas — y los mecánicos ven su trabajo. En el celu se instala como app: lo
tocás y se abre, sin buscar el link." (capturas: 01-login, 02-dashboard,
10-mobile-dashboard)

**Clip 2 — "Hacé un presupuesto por WhatsApp" (30s)**
Guion: "Le escribís al bot como le hablarías a un empleado: 'presupuestá a Juan,
pastillas 15 mil, mano de obra 8 mil'. En segundos te manda el presupuesto en PDF
con el logo de tu taller, listo para reenviarle al cliente. Sin abrir la compu."
(capturas: 05-presupuestos + simulación de chat + PDF)

**Clip 3 — "Del cuaderno al orden" (30s)**
Guion: "Cargás un auto por WhatsApp y aparece en el tablero. Seguís su estado,
le sacás fotos, y cuando lo entregás, la plata entra sola a tus finanzas. Todo
en un lugar." (capturas: 03-vehiculos, 04-ordenes, 06-reportes)
