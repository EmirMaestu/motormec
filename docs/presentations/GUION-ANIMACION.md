# Dirección de animación — Momec (motion design)

Guion de movimiento de las presentaciones. Principio rector: **movimiento con
propósito**. Cada animación guía la mirada, explica una relación o da sensación
de calidad. Nada se mueve "porque sí".

## Sistema (consistente en toda la presentación)

- **Curva principal:** `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out expresivo).
- **Duraciones:** microinteracciones 150–250 ms · entradas 300–700 ms ·
  transiciones de escena 500–950 ms.
- **Stagger:** 70–100 ms entre elementos de una misma escena.
- **Propiedades animadas:** sólo `transform`, `opacity`, `filter` y
  `clip-path`/`object-position` (nunca layout) → 60 FPS.
- **Jerarquía por movimiento:** lo importante entra primero y con más recorrido;
  lo secundario, después y más sutil.
- **Accesibilidad:** `prefers-reduced-motion` desactiva movimiento, deja el
  contenido visible.

## Shared Element: el celular

El **celular es el hilo conductor** de toda la parte de producto. En vez de que
un teléfono desaparezca y aparezca otro en cada slide, **hay un solo teléfono
persistente**: se mantiene en pantalla y su **contenido (la app) hace crossfade**
de una vista a la otra mientras scrollea. Da continuidad cinematográfica: es el
mismo dispositivo recorriendo toda la app. El teléfono sólo entra (scale + fade)
al empezar el recorrido y sale al terminarlo; entre medio, permanece.

## Timeline por slide

### 1 · Apertura — *intención: marca + promesa*
0.0s fondo profundo · 0.2s el logo M se **dibuja** (stroke) + escala · 0.6s
"Momec" revela por palabras · 1.1s subtítulo "El taller, bajo control." fade-up.

### 2 · Problema — *intención: tensión → alivio*
0.2s "Tu taller vive en un cuaderno." por palabras · 1.0s una línea chartreuse
**tacha** la frase · 1.4s "Momec lo ordena." entra en lima (respuesta).

### 3 · Dashboard *(entra el shared phone)* — *intención: "todo de un vistazo"*
0.1s el **teléfono entra** desde el fondo (scale 0.92→1 + fade) y empieza a
scrollear la app · 0.3s eyebrow "En tu bolsillo" · 0.5s título con **mask
reveal** · 0.9s bajada fade-up. La mirada va primero al teléfono (movimiento),
después al texto.

### 4 · "presupuestos" — *intención: palabra-ancla*
Las letras **se ensamblan** desde posiciones dispersas (scatter → assemble) ·
1.2s bajada "con la marca de tu taller".

### 5 · Presupuesto + PDF *(shared phone: crossfade a presupuestos)*
El teléfono **no reaparece**: su pantalla hace crossfade a Presupuestos · un
segundo teléfono (PDF) entra desde la derecha con leve tilt · título mask reveal.

### 6 · WhatsApp *(el teléfono sale; entra el chat)* — *intención: momento estrella*
El teléfono se retira (scale-down + fade). Eyebrow + título. Luego el chat se
construye como una conversación real: 1.2s burbuja del usuario · 2.5s "escribiendo…"
· 4.1s respuesta del bot · 4.9s **tarjeta PDF** aparece (pop). Ritmo de diálogo.

### 7 · Todo junto *(shared phone vuelve al centro; 2 acompañan)*
El teléfono central es el mismo (continuidad); dos teléfonos laterales entran
escalonados. Título mask reveal + bajada.

### 8 · Se instala como app *(shared phone: crossfade a dashboard)*
El teléfono queda; su pantalla vuelve al dashboard (cierre del recorrido). Texto
a la derecha fade-up.

### 9 · Planes — *intención: comparación clara*
Eyebrow + título · las 3 cards entran **una detrás de otra** (stagger, con
elevación) · los precios hacen **count-up** ($20/$49/$99). El plan Pro tiene un
glow sutil (jerarquía).

### 10 · Cierre — *intención: llamada a la acción*
Logo M se dibuja · "Empezá hoy." por palabras · bajada · "momec.pro" en lima.

## Transiciones entre slides

- **Depth crossfade** por defecto: la saliente se aleja (scale 0.99 + fade), la
  entrante llega desde el fondo (scale 1.02→1 + fade). Sin cortes secos.
- **Shared element:** cuando el teléfono existe en dos slides seguidas, **no se
  reinicia** — permanece y sólo cambia su contenido (crossfade + scroll).
- **Fondo:** el gradiente del fondo **morfea** de tono entre escenas (deep / lime
  / warm / dark) acompañando la narrativa.
