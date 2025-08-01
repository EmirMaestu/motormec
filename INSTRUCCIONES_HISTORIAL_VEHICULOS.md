# Instrucciones para activar el historial de vehículos

## Paso 1: Sincronizar con Convex

Ejecuta en tu terminal:

```bash
cd /mnt/c/Users/emir1/Desktop/motormec
npx convex dev
```

Esto actualizará el schema y las nuevas funciones del historial de vehículos.

## Paso 2: Activar las queries del historial

Una vez que `convex dev` esté corriendo, ve a `src/components/pages/vehicles.tsx` y reemplaza las líneas 227-231:

```tsx
// Queries del historial (comentadas temporalmente hasta ejecutar convex dev)
// const vehicleMovements = useQuery(api.vehicles.getVehicleMovements, { limit: 50 });
// const movementStats = useQuery(api.vehicles.getVehicleMovementStats);
const vehicleMovements = [];
const movementStats = null;
```

Por:

```tsx
const vehicleMovements = useQuery(api.vehicles.getVehicleMovements, { limit: 50 });
const movementStats = useQuery(api.vehicles.getVehicleMovementStats);
```

## Paso 3: Descomentar parámetros del usuario

También en `src/components/pages/vehicles.tsx`, descomenta las líneas 358-359:

```tsx
// Temporalmente comentado hasta ejecutar convex dev
// userId: user?.id,
// userName: user?.fullName || user?.firstName || "Usuario",
```

Por:

```tsx
userId: user?.id,
userName: user?.fullName || user?.firstName || "Usuario",
```

## Paso 4: Activar también el historial de inventario

Si aún no lo has hecho, también activa el historial de inventario siguiendo las instrucciones en `INSTRUCCIONES_HISTORIAL.md`.

## Funcionalidades agregadas:

✅ **Historial completo de vehículos**: Registra todos los movimientos desde ingreso hasta entrega
✅ **Seguimiento de trabajo**: Registra inicio, pausa y completado de sesiones de trabajo
✅ **Asignaciones**: Registra cuando se asignan o desasignan mecánicos
✅ **Cambios de estado**: Registra todos los cambios de estado del vehículo
✅ **Vista de historial**: Pestaña separada con estadísticas detalladas y lista de movimientos
✅ **Información del usuario**: Registra quién hizo cada cambio
✅ **Tiempos de trabajo**: Registra duración de sesiones de trabajo
✅ **Cambios de costo**: Registra modificaciones en el costo del vehículo

## Tipos de movimientos registrados:

- **created**: Vehículo ingresado al taller
- **status_changed**: Cambio de estado (Ingresado → En Reparación → Listo → Entregado)
- **assigned/unassigned**: Asignación/desasignación de mecánicos
- **work_started/paused/completed**: Sesiones de trabajo
- **updated**: Actualizaciones generales (costo, servicios, etc.)
- **suspended/delivered**: Vehículo suspendido o entregado

## Estadísticas disponibles:

- Total de movimientos
- Vehículos ingresados
- Cambios de estado
- Asignaciones de mecánicos
- Sesiones de trabajo
- Vehículos entregados
- Tiempo total de trabajo
- Promedio de sesiones

Una vez ejecutado `convex dev`, el sistema de historial de vehículos estará completamente funcional con seguimiento detallado de toda la actividad del taller.