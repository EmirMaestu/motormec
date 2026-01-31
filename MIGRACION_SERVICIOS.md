# Migración de Servicios a Base de Datos

## Cambios Realizados

Se ha implementado un sistema completo para gestionar los servicios del taller en la base de datos de Convex. Esto permite un mejor seguimiento, reportes más precisos y evita inconsistencias.

## Archivos Modificados/Creados

### 1. **convex/schema.ts**
- Se agregó la tabla `services` con los siguientes campos:
  - `name`: Nombre del servicio
  - `active`: Estado del servicio
  - `createdAt`: Fecha de creación
  - `usageCount`: Contador de uso (para ordenar por frecuencia)
  - Índice por `name` para búsquedas rápidas

### 2. **convex/services.ts** (NUEVO)
Funciones para gestionar servicios:
- `getServices`: Obtiene servicios activos ordenados por uso
- `getAllServices`: Obtiene todos los servicios (incluidos inactivos)
- `getServiceByName`: Busca un servicio específico
- `createService`: Crea un nuevo servicio o incrementa su contador si existe
- `incrementServiceUsage`: Incrementa el contador de uso
- `updateService`: Actualiza un servicio
- `deleteService`: Desactiva un servicio
- `toggleServiceStatus`: Activa/desactiva un servicio
- `initializeDefaultServices`: Inicializa servicios predefinidos

### 3. **convex/migrateServices.ts** (NUEVO)
Script de migración que:
- Inicializa los servicios predefinidos comunes
- Extrae todos los servicios únicos de los vehículos existentes
- Los inserta en la tabla de servicios con sus contadores de uso
- Actualiza contadores si el servicio ya existe

### 4. **src/components/ui/creatable-select.tsx**
- Se agregó el prop `onCreateOption` para callback cuando se crea una nueva opción
- Ahora llama a este callback cuando se crea un servicio nuevo que no existe en las opciones
- Elimina duplicados entre opciones de BD y predefinidas

### 5. **src/components/pages/vehicles.tsx**
- Se agregaron queries y mutations para servicios:
  - `services = useQuery(api.services.getServices)`
  - `createService = useMutation(api.services.createService)`
- Se agregó `serviceOptions` que contiene los servicios de la BD
- Se actualizaron ambos `CreatableSelect` (crear y editar vehículo) para:
  - Recibir `options={serviceOptions}` con los servicios de la BD
  - Recibir `onCreateOption` que llama a `createService` cuando se crea un nuevo servicio

### 6. **src/components/admin/MigrateServices.tsx** (NUEVO)
Componente de interfaz para ejecutar la migración con:
- Botón para iniciar migración
- Indicador de progreso
- Reporte detallado de resultados
- Manejo de errores

## Cómo Ejecutar la Migración

### Opción 1: Desde la Consola de Convex (Recomendado para desarrollo)

1. Asegúrate de que el servidor de desarrollo esté corriendo:
   ```bash
   npm run dev
   ```

2. Abre la consola de Convex en tu navegador:
   ```
   https://dashboard.convex.dev/
   ```

3. Ve a tu proyecto y selecciona la pestaña "Functions"

4. Busca la función `migrateServices:migrateServicesToDatabase`

5. Haz clic en "Run" para ejecutarla

6. Verás un resultado como:
   ```json
   {
     "success": true,
     "defaultServicesInitialized": 20,
     "vehiclesProcessed": 15,
     "uniqueServicesFound": 25,
     "newServicesCreated": 5,
     "servicesUpdated": 20,
     "totalServicesInDatabase": 25
   }
   ```

### Opción 2: Desde la Interfaz de Usuario

1. Importa y usa el componente `MigrateServices` en cualquier página de admin:

   ```tsx
   import { MigrateServices } from "../components/admin/MigrateServices";
   
   // En tu componente
   <MigrateServices />
   ```

2. Haz clic en "Iniciar Migración"

3. Verás el progreso y resultado en pantalla

### Opción 3: Desde el Código (Programáticamente)

Puedes ejecutar la migración desde cualquier componente:

```tsx
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

function MyComponent() {
  const migrateServices = useMutation(api.migrateServices.migrateServicesToDatabase);
  
  const handleMigrate = async () => {
    const result = await migrateServices();
    console.log("Migración completada:", result);
  };
  
  return <button onClick={handleMigrate}>Migrar Servicios</button>;
}
```

## Funcionamiento Post-Migración

### Crear Vehículos
Cuando crees o edites un vehículo:

1. El `CreatableSelect` muestra servicios de la BD ordenados por uso
2. Puedes buscar y seleccionar servicios existentes
3. Si escribes un servicio nuevo y presionas Enter o haces clic en "Crear":
   - Se guarda automáticamente en la BD
   - Se incrementa su contador de uso
   - Aparecerá en futuras selecciones

### Reportes
Los servicios ahora se toman de una lista consistente, lo que significa:
- Los reportes mostrarán datos precisos
- No habrá variaciones por mayúsculas/minúsculas o espacios
- Se podrán analizar tendencias de servicios más solicitados

### Ventajas
- ✅ Consistencia: Todos usan los mismos nombres de servicios
- ✅ Autocompletado: Sugerencias basadas en uso real
- ✅ Reportes precisos: Datos limpios y estructurados
- ✅ Histórico: Se mantiene registro de todos los servicios usados
- ✅ Ordenamiento inteligente: Servicios más usados aparecen primero

## Verificación

Para verificar que la migración fue exitosa:

1. Ve a la consola de Convex
2. Abre la pestaña "Data"
3. Selecciona la tabla `services`
4. Deberías ver todos los servicios con sus contadores de uso

## Notas Importantes

- ⚠️ **La migración es segura**: No modifica ni elimina datos de vehículos existentes
- ⚠️ **Puede ejecutarse múltiples veces**: Si se ejecuta más de una vez, solo actualizará contadores
- ⚠️ **No elimina servicios**: Si un servicio ya existe en la BD, solo actualiza su contador
- ✅ **Backward compatible**: Los vehículos siguen guardando servicios como array de strings

## Troubleshooting

### Error: "Property 'services' does not exist on type..."

Esto es normal durante el desarrollo. Para solucionarlo:

1. Asegúrate de que el servidor de Convex esté corriendo
2. Convex regenerará automáticamente los tipos
3. Si persiste, ejecuta:
   ```bash
   npx convex dev
   ```

### Los servicios no aparecen en el selector

1. Verifica que la migración se haya ejecutado correctamente
2. Revisa la consola del navegador para errores
3. Verifica que `api.services.getServices` esté definido en los tipos generados

### Los servicios nuevos no se guardan

1. Verifica que `createService` esté conectado correctamente
2. Revisa los permisos de la base de datos
3. Verifica que el callback `onCreateOption` se esté pasando al `CreatableSelect`





