# 🚗 Módulo de Clientes - MotorMec

## 📋 Resumen

Se ha implementado exitosamente el módulo de **Gestión de Clientes** que permite transformar el sistema de vehículos individuales en un sistema centrado en clientes, donde cada cliente puede tener múltiples vehículos asociados y se pueden generar métricas detalladas por cliente.

## ✅ Funcionalidades Implementadas

### 🗄️ Base de Datos
- **Nueva tabla `customers`** con campos completos
- **Relación clientes-vehículos** mediante `customerId`
- **Índices optimizados** para búsquedas por teléfono, email y documento
- **Métricas automáticas** calculadas en tiempo real

### 🔄 Integración con Vehículos
- **Auto-creación de clientes** al ingresar vehículos con teléfonos nuevos
- **Actualización automática de métricas** cuando se modifican vehículos
- **Asignación de vehículos** a clientes existentes
- **Migración automática** de vehículos existentes

### 🖥️ Interfaz de Usuario
- **Página principal** `/clientes` con gestión completa
- **Dashboard de métricas** con análisis detallado
- **Formularios** para crear y editar clientes
- **Búsqueda y filtrado** de clientes
- **Vista detallada** por cliente con historial de vehículos

### 📊 Métricas y Análisis
- **Total gastado** por cliente
- **Cantidad de vehículos** atendidos por cliente
- **Frecuencia de visitas** y retención
- **Top 5 clientes** más valiosos
- **Análisis de segmentación** por gasto
- **Tendencias mensuales** de ingresos

## 🚀 Cómo Usar

### 1. Inicialización (Primera vez)
```bash
# Visita la página de ejemplo para inicializar el módulo
http://localhost:5173/ejemplos/clientes

# O ve directamente a la página de clientes
http://localhost:5173/clientes
```

### 2. Navegación
- **Página principal**: `/clientes`
- **Ejemplo/Demo**: `/ejemplos/clientes`
- El módulo se agrega automáticamente al menú lateral

### 3. Operaciones Principales

#### Crear Cliente
1. Ir a `/clientes`
2. Hacer clic en "Nuevo Cliente"
3. Llenar el formulario con:
   - Nombre (requerido)
   - Teléfono (requerido)
   - Email (opcional)
   - Dirección (opcional)
   - Documento (opcional)
   - Notas (opcional)

#### Auto-creación de Clientes
- Cuando ingresas un vehículo con un teléfono nuevo
- El sistema automáticamente crea un cliente
- Asocia el vehículo al cliente
- Actualiza las métricas

#### Ver Métricas de Cliente
1. Seleccionar cliente de la lista
2. Ver pestañas:
   - **Resumen**: Métricas principales
   - **Vehículos**: Historial de vehículos
   - **Contacto**: Información de contacto

## 📁 Estructura de Archivos

### Backend (Convex)
```
convex/
├── customers.ts          # Funciones CRUD de clientes
├── initCustomers.ts      # Migración e inicialización
├── navigation.ts         # Navegación actualizada
├── schema.ts            # Schema con tabla customers
└── vehicles.ts          # Funciones actualizadas con clientes
```

### Frontend (React)
```
src/
├── components/
│   ├── pages/
│   │   ├── customers.tsx         # Página principal de clientes
│   │   └── customer-dashboard.tsx # Dashboard analítico
│   └── module-cards/
│       └── CustomerCards.tsx     # Tarjetas de métricas
├── examples/
│   └── CustomersUsageExample.tsx # Ejemplo y demo
└── router/
    └── AppRouter.tsx            # Rutas actualizadas
```

## 🔧 API Disponible

### Queries (Consultas)
```typescript
// Obtener todos los clientes activos
api.customers.getActiveCustomers

// Obtener cliente por ID
api.customers.getCustomerById({ customerId })

// Buscar cliente por teléfono
api.customers.getCustomerByPhone({ phone })

// Obtener vehículos de un cliente
api.customers.getCustomerVehicles({ customerId })

// Obtener métricas de cliente
api.customers.getCustomerMetrics({ customerId })

// Estadísticas generales
api.customers.getCustomersStats

// Vehículos con información de cliente
api.vehicles.getVehiclesWithCustomers
```

### Mutations (Modificaciones)
```typescript
// Crear cliente
api.customers.createCustomer({ name, phone, email?, ... })

// Actualizar cliente
api.customers.updateCustomer({ customerId, name?, phone?, ... })

// Desactivar cliente
api.customers.deactivateCustomer({ customerId })

// Asignar vehículo a cliente
api.vehicles.assignVehicleToCustomer({ vehicleId, customerId })

// Inicializar módulo (migración)
api.initCustomers.initializeCustomersModule()
```

## 📊 Métricas Disponibles

### Por Cliente
- **Total gastado**: Suma de costos de todos sus vehículos
- **Cantidad de vehículos**: Total histórico
- **Última visita**: Fecha del último vehículo ingresado
- **Frecuencia**: Cantidad de visitas al taller

### Generales
- **Total clientes**: Cantidad de clientes activos
- **Ingresos totales**: Suma de todos los gastos de clientes
- **Promedio por cliente**: Gasto promedio
- **Top clientes**: Los 5 que más han gastado
- **Tasa de retención**: Clientes que regresan

### Análisis Avanzado
- **Segmentación por gasto**: Bajo, medio, alto
- **Distribución de vehículos**: 1, 2-5, 5+ vehículos
- **Tendencias mensuales**: Ingresos por mes
- **Clientes nuevos vs recurrentes**

## 🔄 Migración Automática

El sistema incluye migración automática que:
1. **Crea clientes** basados en vehículos existentes (por teléfono)
2. **Asocia vehículos** a sus respectivos clientes
3. **Calcula métricas** iniciales para todos los clientes
4. **Agrega navegación** al menú automáticamente

## 🎯 Casos de Uso

### 1. Taller Pequeño
- Gestionar base de clientes
- Ver qué clientes traen más vehículos
- Identificar clientes valiosos

### 2. Taller Mediano/Grande
- Análisis de rentabilidad por cliente
- Segmentación de clientes
- Estrategias de retención
- Proyección de ingresos

### 3. Análisis de Negocio
- Identificar patrones de clientes
- Optimizar servicios por segmento
- Métricas de crecimiento
- ROI por cliente

## ⚡ Rendimiento

- **Índices optimizados** para búsquedas rápidas
- **Cálculo de métricas** en tiempo real
- **Actualizaciones automáticas** cuando cambian datos
- **Interfaz responsive** y rápida

## 🛡️ Validaciones

- **Teléfonos únicos**: No permite duplicados
- **Campos requeridos**: Nombre y teléfono obligatorios
- **Desactivación protegida**: No permite borrar clientes con vehículos activos
- **Integridad referencial**: Mantiene consistencia de datos

## 📱 Responsive Design

- **Mobile-first**: Optimizado para móviles
- **Tablets**: Experiencia adaptada
- **Desktop**: Interfaz completa
- **Accesibilidad**: Cumple estándares

## 🎨 UI/UX

- **Diseño consistente** con el resto del sistema
- **Iconografía clara** y comprensible
- **Navegación intuitiva** 
- **Feedback visual** para todas las acciones
- **Estados de carga** y errores manejados

## 🚀 Próximos Pasos Sugeridos

1. **Notificaciones**: Email/SMS a clientes
2. **Historial detallado**: Timeline de interacciones
3. **Exportación**: Reportes en PDF/Excel
4. **API externa**: Integración con CRM
5. **Automatización**: Seguimiento de clientes
6. **Análisis predictivo**: ML para retención

---

## 💡 Tips de Uso

- Los clientes se crean automáticamente al ingresar vehículos
- Usa la búsqueda para encontrar clientes rápidamente
- Las métricas se actualizan en tiempo real
- El dashboard analítico ayuda a tomar decisiones
- Puedes editar información del cliente en cualquier momento

**¡El módulo de clientes está listo para usar! 🎉**