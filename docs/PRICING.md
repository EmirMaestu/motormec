# MotorMec — Estrategia de pricing (SaaS multi-taller)

> Objetivo: vender dentro y fuera de Argentina. Piso global **USD 20/mes**.
> Modelo: suscripción por **taller** (workspace/tenant), no por uso. La feature
> estrella y diferencial es el **bot de WhatsApp/Telegram con IA**.

## 1. Principios

1. **Value-based, no cost-based.** El taller ahorra horas de carga manual y deja
   de perder trabajos/repuestos. El precio se ancla en ese valor, no en el costo
   de infraestructura (que es fijo y bajo: VPS + Postgres + Groq ~gratis).
2. **Simple y predecible.** Costo fijo mensual por plan, sin sorpresas por uso.
   Límites generosos con "fair use"; los excedentes se resuelven subiendo de plan
   o con add-ons claros, nunca con un corte abrupto.
3. **El bot vende.** Está en todos los planes (es el gancho), pero el **volumen de
   IA** y los **canales** (WhatsApp + Telegram, múltiples números) escalan con el plan.
4. **Multi-moneda.** Precio de lista en **USD** (ancla internacional). En Argentina
   se cobra el equivalente en **ARS vía MercadoPago**; afuera, **USD vía Stripe**.
5. **Anual con descuento.** Pago anual = **2 meses gratis** (~17% off) → mejora
   caja y baja churn.

## 2. Planes (precio de lista, USD/mes)

| | **Arranque** | **Pro** ⭐ | **Cadena** | **Enterprise** |
|---|---|---|---|---|
| **Precio** | **$20** | **$49** | **$99** | A medida |
| Talleres (sucursales) | 1 | 1 | hasta 5 | ilimitadas |
| Usuarios | 2 | 6 | ilimitados | ilimitados |
| Vehículos / órdenes | hasta 150/mes | ilimitadas* | ilimitadas* | ilimitadas |
| **Bot WhatsApp** | ✓ (1 número) | ✓ (1 número) | ✓ (varios) | ✓ |
| **Bot Telegram** | — | ✓ | ✓ | ✓ |
| **Cargas por IA** | 300/mes | 2.000/mes | 8.000/mes | a medida |
| Clientes · Vehículos · Órdenes | ✓ | ✓ | ✓ | ✓ |
| Inventario + descuento auto | ✓ | ✓ | ✓ | ✓ |
| Finanzas automáticas | ✓ | ✓ | ✓ | ✓ |
| Reportes | básicos | avanzados | avanzados + export | a medida |
| Cronómetro de mecánicos | ✓ | ✓ | ✓ | ✓ |
| Importación CSV | — | ✓ | ✓ | ✓ |
| Multi-sucursal / roles avanzados | — | — | ✓ | ✓ |
| Avisos al cliente ("tu auto está listo") | — | ✓ | ✓ | ✓ |
| Soporte | email | prioritario | dedicado | SLA + onboarding |
| Marca propia / white-label | — | — | — | ✓ |

\* "ilimitadas" con fair use (tope técnico alto anti-abuso).

**Add-ons** (cualquier plan): número de WhatsApp extra **$10/mes**, +1.000 cargas IA
**$15/mes**, sucursal extra **$25/mes**.

**Prueba gratis:** 14 días, sin tarjeta. **Anual:** 2 meses gratis.

## 3. Por qué estos números

- **$20 piso (Arranque):** cumple el mínimo pedido y posiciona el producto como
  herramienta profesional (no "app barata"). Un solo trabajo bien cobrado paga el
  mes. Apunta al taller chico / mecánico independiente.
- **$49 (Pro) — plan ancla:** el que más se vende. Suma Telegram, IA de sobra,
  reportes avanzados, importación y avisos al cliente. Salto de valor claro vs.
  Arranque (equipo + sin límites + comunicación con el cliente).
- **$99 (Cadena):** talleres con varias bocas/sucursales. Multi-sucursal y números
  múltiples justifican el precio; sigue siendo barato frente a un ERP.
- **Enterprise:** redes grandes, white-label, on-premise en su propio VPS, SLA.

El salto **20 → 49 → 99** (≈2,4×) es la clásica progresión "good/better/best": el
plan del medio se ve como la mejor relación y concentra las ventas.

## 4. Argentina y exterior

- **Argentina:** cobro en **ARS** vía **MercadoPago** (débito automático). El precio
  ARS se ajusta periódicamente al USD de lista (revisión mensual del tipo de cambio)
  para no quedar atrás por inflación; los clientes anuales fijan precio 12 meses.
- **LatAm / exterior:** **USD** vía **Stripe** (tarjeta). Mismos planes de lista.
- **Impuestos:** en AR se factura con IVA según condición; afuera, según país.
- **Descuento regional (opcional):** si hace falta competir en mercados de bajo
  poder adquisitivo, usar cupones puntuales — **sin bajar de USD 20** el plan base.

## 5. Conversión y retención

- **Trial 14 días → onboarding guiado:** crear el primer taller, conectar el número
  de WhatsApp y cargar el primer vehículo por el bot dentro del trial = "aha moment".
- **Anual con 2 meses gratis** para bajar churn y mejorar caja inicial.
- **Upgrade natural:** los límites de IA/usuarios empujan de Arranque→Pro cuando el
  taller crece; multi-sucursal empuja Pro→Cadena.
- **Migración incluida:** importar el cuaderno (CSV) o datos previos sin costo
  reduce la fricción de cambio.

## 6. Resumen para la landing

Tres planes visibles — **Arranque $20**, **Pro $49** (destacado), **Cadena $99** —
y "Enterprise: hablemos". Toggle mensual/anual (anual = 2 meses gratis). CTA
principal: **Probar gratis 14 días**. El bot con IA, presente y destacado en los tres.
