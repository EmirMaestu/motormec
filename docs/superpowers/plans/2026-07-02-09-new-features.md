# Plan 09 — Nuevas Features Implementation Plan

> **Para el que ejecuta:** leé primero [el plan maestro](2026-07-02-00-master-plan.md). Estas
> son las features de diferenciación. **Cada una requiere una sesión de diseño previa** con la
> skill `superpowers:brainstorming` para fijar el alcance con el dueño antes de codear — no son
> arreglos mecánicos, son producto nuevo. Este archivo da el marco (modelo, endpoints, criterios)
> para que la sesión de diseño arranque con contexto, no desde cero.

**Goal:** convertir a Momec en el mejor software de talleres del mercado con features que la
competencia no tiene, apoyándose en el foso de WhatsApp.

**Orden sugerido por impacto/esfuerzo:** FEAT-1 (agenda) → FEAT-4 (recordatorio de service) →
FEAT-2 (DVI) → FEAT-3 (portal) → FEAT-5 (reseñas) → FEAT-6 (multi-sucursal).

---

## FEAT-1: Agenda / turnos + recordatorios

**Por qué:** los talleres modernos agendan ingresos; hoy no hay forma. Alto valor, complejidad
media.

### Modelo de datos (`appointments`, tenant-scoped)
```
id, tenantId, customerId?, vehicleId?, plate?, customerName, phone,
scheduledAt (timestamp), durationMin, service, status (agendado|confirmado|en_taller|cancelado|no_show),
note, createdBy, createdAt
```

### Endpoints
- CRUD `/api/appointments` con filtros por rango de fechas.
- `GET /api/appointments/day?date=` y `?week=` para la vista calendario.
- Al llegar el auto: convertir turno → orden (reusar PAY-5 del plan 06).

### UI
- Vista calendario (día/semana) con turnos; crear/mover/cancelar.
- Recordatorio automático por WhatsApp 24h antes (integra con el bot / cola del plan 08).

### Decisión de diseño (brainstorming)
- ¿Cupos por mecánico o por taller? ¿Duración fija o por tipo de servicio? ¿El cliente puede
  auto-agendar desde un link público (roza FEAT-3)?

### Criterios de aceptación
- [ ] Crear/mover/cancelar turno; vista día y semana.
- [ ] Recordatorio 24h antes por WhatsApp (job en cola).
- [ ] Convertir turno en orden al ingresar el auto.

---

## FEAT-2: DVI — Inspección digital del vehículo con fotos

**Por qué:** Tekmetric/Shopmonkey lo tienen y es lo que más confianza genera en el cliente. Alto
valor y diferenciación.

### Modelo de datos (`inspections`, tenant-scoped)
```
id, tenantId, workOrderId, vehicleId,
items: jsonb [{ area, estado: "ok"|"atencion"|"urgente", nota, fotoPaths[] }],
createdBy, createdAt, sharedAt
```

### Flujo
- Plantilla de checklist configurable por taller (frenos, neumáticos, luces, fluidos, etc.).
- El mecánico marca cada ítem (verde/amarillo/rojo) y adjunta fotos (cámara mobile).
- Se genera un reporte enviable al cliente por WhatsApp (link o PDF) con semáforo y fotos.
- Los ítems "urgentes/atención" pueden convertirse en ítems de presupuesto con un toque.

### Decisión de diseño (brainstorming)
- Plantillas por defecto vs. por taller. ¿El reporte es PDF o página web (roza FEAT-3)?

### Criterios de aceptación
- [ ] Completar una inspección con fotos por ítem y semáforo.
- [ ] Enviar el reporte al cliente por WhatsApp.
- [ ] Convertir ítems marcados en un presupuesto.

---

## FEAT-3: Portal del cliente

**Por qué:** el cliente ve el estado de su auto, su historial y sus presupuestos sin llamar.
Reduce fricción y roza el efecto "wow".

### Diseño
- Acceso sin contraseña: link firmado (token de un solo uso, corto) enviado por WhatsApp, o
  login por OTP al teléfono.
- Vistas: estado del auto en vivo, historial de servicios, presupuestos (con botón "Aceptar" →
  dispara PAY-5), facturas (plan 06), próximo service (FEAT-4).
- Superficie **pública** → cuidar seguridad: tokens firmados con expiración, scope por cliente,
  rate limit, sin enumeración de ids.

### Decisión de diseño (brainstorming + revisar con seguridad)
- Modelo de acceso (link firmado vs OTP). Qué datos se exponen. Este es el punto donde más hay
  que cuidar el aislamiento (es la única superficie pública del producto).

### Criterios de aceptación
- [ ] El cliente abre un link firmado y ve SOLO su auto/historial/presupuestos.
- [ ] Token expira y no permite ver datos de otros clientes/talleres.
- [ ] Aceptar un presupuesto desde el portal crea la orden.

---

## FEAT-4: Recordatorio automático de service (por km / tiempo)

**Por qué:** retención automática. Alto valor de negocio, complejidad media. Se apoya en el bot.

### Diseño
- Por vehículo, guardar `lastServiceDate`, `lastServiceMileage` y una regla (cada X km o Y meses).
- Un job diario (cola, plan 08) detecta vehículos que alcanzan el umbral y manda un WhatsApp:
  "Tu Gol hizo el service hace 6 meses / 10.000 km, ¿lo traés?" con opción de agendar (FEAT-1).

### Criterios de aceptación
- [ ] Configurar la regla de service por vehículo/tipo.
- [ ] El job detecta y notifica (idempotente: no re-notificar el mismo umbral).
- [ ] El cliente puede agendar respondiendo.

---

## FEAT-5: Reseñas post-entrega (Google)

**Por qué:** más reseñas = más clientes. Bajo esfuerzo, buen retorno.

### Diseño
- Tras entregar (y cobrar), un job manda por WhatsApp un pedido de reseña con el link de Google
  del taller (configurable en Configuración). Rate-limited y con opt-out.

### Criterios de aceptación
- [ ] Configurar el link de reseña del taller.
- [ ] Envío automático post-entrega con opt-out.

---

## FEAT-6: Multi-sucursal

**Por qué:** talleres que crecen o cadenas. Complejidad alta; hacerlo cuando haya demanda.

### Diseño (decisión de arquitectura — brainstorming obligatorio)
- Opción A: cada sucursal es un `tenant` y se agrega un nivel "organización" por encima que
  agrupa tenants y da un consolidado. Menos cambios al modelo actual.
- Opción B: agregar `branchId` a las tablas de datos y scopear por sucursal dentro del tenant.
  Cambia el modelo de aislamiento (más invasivo).
- Recomendado: **Opción A** (organización → varios tenants) para no tocar el `TenantDb`.

### Criterios de aceptación
- [ ] Un dueño ve el consolidado de sus sucursales y puede entrar a cada una.
- [ ] El aislamiento entre sucursales de distintos dueños se mantiene.

---

## Backlog (100+ ideas priorizadas)

El resto de funcionalidades propuestas (catálogo de tiempos de mano de obra, video-inspección,
aprobación de presupuesto por WhatsApp con un tap, tarjeta de servicio en Wallet, marketplace de
talleres, benchmarking anónimo, Momec Capital, predicción de falla por modelo, copiloto de datos
en lenguaje natural, etc.) está en el informe de auditoría, clasificado por Impacto / Complejidad
/ Valor de negocio / Valor de usuario / Diferenciación. Cada una, cuando se priorice, entra por
el mismo camino: sesión de `superpowers:brainstorming` → spec → plan detallado como los de
`docs/superpowers/plans/`.

---

## Cierre

Estas features son el techo de largo plazo. Ninguna se empieza antes de tener el producto
"cobrable y confiable" (planes 01-06) y escalable (plan 08). El foso de WhatsApp da una ventana:
la prioridad estratégica es **cobrar y facturar** antes de que un competidor con recursos copie
el bot.
