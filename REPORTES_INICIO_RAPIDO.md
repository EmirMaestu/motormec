# 🚀 Inicio Rápido - Sistema de Reportes MotorMec

## ⚡ Puesta en Marcha (3 Pasos)

### 1️⃣ Sincronizar con Convex
```bash
cd C:\Users\emirm\Desktop\emir\motormec
npx convex dev
```
✅ Esto actualizará todas las queries de reportes en la base de datos

### 2️⃣ Iniciar el Servidor
```bash
npm run dev
```
✅ La aplicación se abrirá en `http://localhost:5173`

### 3️⃣ Acceder a Reportes
- Ve a: `http://localhost:5173/reportes`
- **Importante:** Solo administradores tienen acceso
- Verás 8 pestañas con diferentes tipos de reportes

---

## 📊 Uso Inmediato

### Generar tu Primer Reporte Financiero
1. Click en pestaña **"Financiero"**
2. Click en botón **"Último mes"**
3. Verás:
   - Ingresos totales
   - Egresos totales
   - Balance
   - Ticket promedio
4. Click en **"Exportar"** → **"PDF"** para descargar

### Ver Tus Mejores Clientes
1. Click en pestaña **"Clientes"**
2. Aparece automáticamente el **Top 10** de clientes
3. Ordenados por mayor gasto
4. Exporta con **"Exportar"** → **"Excel"**

### Revisar Inventario Bajo Stock
1. Click en pestaña **"Inventario"**
2. Ve la tarjeta **"Bajo Stock"** en rojo/naranja
3. Scroll down para ver lista de productos
4. Productos más utilizados abajo

### Análisis Estratégico Rápido
1. Click en pestaña **"Estratégico"**
2. Verás 4 KPIs principales:
   - Tasa de retención
   - Ticket promedio
   - Clientes nuevos
   - Predicción de ingresos
3. Top 10 clientes rentables
4. Servicios más rentables
5. Alerta de clientes en riesgo (si aplica)

---

## 🔧 Filtros Rápidos

### Por Fechas
| Botón | Descripción |
|-------|-------------|
| **Hoy** | Solo transacciones de hoy |
| **Última semana** | Últimos 7 días |
| **Último mes** | Últimos 30 días |
| **Este mes** | Mes calendario actual |
| **Este año** | Año calendario actual |

### Personalizado
1. Selecciona **"Fecha inicio"**
2. Selecciona **"Fecha fin"**
3. Los datos se actualizan automáticamente

---

## 💾 Exportación Rápida

### PDF (Recomendado para Imprimir)
```
Click "Exportar" → "PDF"
```
- Se abre en nueva ventana
- Formato profesional
- Listo para imprimir

### Excel (Recomendado para Análisis)
```
Click "Exportar" → "Excel"
```
- Descarga archivo CSV
- Compatible con Excel
- Puedes hacer gráficos adicionales

### CSV (Para Sistemas Externos)
```
Click "Exportar" → "CSV"
```
- Formato estándar
- Importable en cualquier sistema

---

## 📋 Plantillas (Ahorra Tiempo)

### Usar Plantilla Predefinida
1. Ve a pestaña **"Plantillas"**
2. Verás 6 plantillas listas:
   - 💰 Reporte Financiero Mensual
   - 👥 Top 10 Clientes
   - 📦 Productos Bajo Stock
   - 👨‍🔧 Rendimiento de Mecánicos
   - 🚗 Resumen Operacional
   - 📈 KPIs Estratégicos
3. Click **"Generar"** en la que necesites

### Crear Tu Propia Plantilla
1. Click **"Nueva Plantilla"**
2. Completa el formulario:
   - Nombre: "Mi Reporte Semanal"
   - Tipo: Selecciona uno
   - Frecuencia: "weekly"
3. Click **"Guardar"**
4. Aparecerá en "Mis Plantillas"

### Programar Reporte Automático
1. Encuentra tu plantilla
2. Click en ícono de **reloj** ⏰
3. Ingresa: `weekly` (o daily, monthly, quarterly)
4. ¡Listo! Se generará automáticamente

---

## 🎯 Escenarios Comunes

### Escenario 1: Reunión con Socios (Fin de Mes)
```
1. Ir a "Financiero"
2. Click "Este mes"
3. Exportar a PDF
4. Ir a "Socios"
5. Exportar distribución
6. Presentar ambos PDFs
```

### Escenario 2: Necesitas Comprar Repuestos
```
1. Ir a "Inventario"
2. Ver tarjeta "Bajo Stock"
3. Scroll down para lista completa
4. Ver "Productos Más Utilizados"
5. Exportar a Excel para orden de compra
```

### Escenario 3: Evaluar Rendimiento del Equipo
```
1. Ir a "Mecánicos"
2. Ver resumen general
3. Revisar cada mecánico:
   - Vehículos atendidos
   - Horas trabajadas
   - Ingresos generados
4. Exportar para archivo
```

### Escenario 4: Estrategia de Marketing
```
1. Ir a "Estratégico"
2. Ver "Clientes en Riesgo" (alerta naranja)
3. Ir a "Clientes"
4. Ver Top 10 para identificar patrones
5. Crear campaña de retención
```

---

## ⚠️ Solución de Problemas

### ❌ "No veo datos en los reportes"
**Solución:**
1. Asegúrate de tener datos en el sistema (vehículos, transacciones)
2. Ajusta los filtros de fecha (quizás los datos son más antiguos)
3. Click "Limpiar filtros" para resetear

### ❌ "Exportar no funciona"
**Solución:**
1. Permite pop-ups en tu navegador
2. Verifica que tienes datos seleccionados
3. Intenta con otro formato (CSV en lugar de PDF)

### ❌ "No aparece la pestaña de Reportes"
**Solución:**
1. Verifica que eres **administrador**
2. Cierra sesión y vuelve a entrar
3. Asegúrate de que Convex está corriendo (`npx convex dev`)

### ❌ "Los totales no cuadran"
**Solución:**
1. Verifica el rango de fechas (puede estar filtrado)
2. Click "Limpiar filtros" para ver todos los datos
3. Revisa si hay transacciones suspendidas

---

## 📈 Tips Pro

### 💡 Tip 1: Compara Períodos
Para ver crecimiento mes a mes:
1. Exporta reporte del mes actual
2. Exporta reporte del mes pasado
3. Compara en Excel los totales
*(Próximamente: comparación automática en UI)*

### 💡 Tip 2: Análisis Semanal
Crea plantilla semanal:
1. Ve a "Plantillas"
2. Crea "Reporte Semanal"
3. Frecuencia: "weekly"
4. Se generará cada lunes automáticamente

### 💡 Tip 3: Dashboard Personal
Si eres mecánico:
1. Usa el Dashboard principal
2. Verás tu resumen personal
3. No necesitas ir a Reportes

### 💡 Tip 4: Backup de Datos
Cada mes:
1. Exporta reporte financiero completo a CSV
2. Guarda en carpeta de respaldo
3. Tienes historial permanente

---

## 🎓 Aprendizaje Progresivo

### Semana 1: Lo Básico
- [ ] Generar reporte financiero mensual
- [ ] Ver top 10 clientes
- [ ] Exportar tu primer PDF

### Semana 2: Filtros
- [ ] Usar filtros de fecha personalizados
- [ ] Filtrar por cliente específico
- [ ] Filtrar por categoría

### Semana 3: Plantillas
- [ ] Usar plantillas predefinidas
- [ ] Crear tu primera plantilla
- [ ] Programar reporte semanal

### Semana 4: Análisis Avanzado
- [ ] Revisar reportes estratégicos
- [ ] Identificar clientes en riesgo
- [ ] Analizar servicios más rentables
- [ ] Tomar decisiones basadas en datos

---

## ✅ Checklist Primera Vez

Completa esto hoy:
- [ ] Ejecutar `npx convex dev`
- [ ] Abrir `http://localhost:5173/reportes`
- [ ] Generar reporte financiero
- [ ] Exportar a PDF
- [ ] Ver top 10 clientes
- [ ] Crear una plantilla
- [ ] Revisar KPIs estratégicos

---

## 🆘 Ayuda Adicional

- **Documentación completa:** `REPORTES_README.md`
- **Código fuente:** `src/components/pages/reports-new.tsx`
- **Queries backend:** `convex/reports.ts`

---

## 🎉 ¡Listo!

Ya tienes todo lo necesario para:
- ✅ Generar reportes profesionales
- ✅ Analizar el rendimiento de tu taller
- ✅ Tomar decisiones basadas en datos
- ✅ Presentar información a socios
- ✅ Optimizar operaciones

**¡Comienza ahora y lleva tu taller al siguiente nivel! 🚀**



