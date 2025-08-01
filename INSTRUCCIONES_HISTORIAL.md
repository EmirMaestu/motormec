# Instrucciones para activar el historial de inventario

## Paso 1: Sincronizar con Convex

Ejecuta en tu terminal:

```bash
cd /mnt/c/Users/emir1/Desktop/motormec
npx convex dev
```

Esto actualizará el schema y las nuevas funciones del historial.

## Paso 2: Activar las queries del historial

Una vez que `convex dev` esté corriendo, ve a `src/stock-management.tsx` y reemplaza las líneas 52-56:

```tsx
// Comentado temporalmente hasta que se ejecute convex dev
// const inventoryMovements = useQuery(api.products.getInventoryMovements, { limit: 50 });
// const movementStats = useQuery(api.products.getMovementStats);
const inventoryMovements = [];
const movementStats = null;
```

Por:

```tsx
const inventoryMovements = useQuery(api.products.getInventoryMovements, { limit: 50 });
const movementStats = useQuery(api.products.getMovementStats);
```

## Paso 3: Descomentar parámetros del usuario

También en `src/stock-management.tsx`, descomenta las líneas 167-168:

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

## Funcionalidades agregadas:

✅ **Eliminar productos**: Botón de papelera en cada fila de la tabla
✅ **Historial completo**: Registra creación, actualización, eliminación y cambios de stock
✅ **Vista de historial**: Pestaña separada con estadísticas y lista detallada
✅ **Información del usuario**: Registra quién hizo cada cambio
✅ **Motivos**: Permite agregar motivos para las eliminaciones

Una vez ejecutado `convex dev`, el sistema de historial estará completamente funcional.