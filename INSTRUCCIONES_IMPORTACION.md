# 📋 Instrucciones para Importar Datos del Cuaderno

Este documento explica cómo importar los datos históricos del cuaderno físico del taller al sistema digital.

## 📁 Archivos Creados

1. **`datos_cuaderno_taller.csv`** - Archivo CSV con todos los datos extraídos del cuaderno
2. **`import_cuaderno_data.ts`** - Script TypeScript para importar los datos al sistema

## 🚀 Método 1: Usando el Script TypeScript

### Paso 1: Instalar dependencias (si no lo has hecho)

```bash
npm install
```

### Paso 2: Ejecutar el script de importación

```bash
npx tsx import_cuaderno_data.ts
```

### Características del script:

- ✅ Convierte fechas automáticamente al formato ISO
- ✅ Estima el año del vehículo basándose en el kilometraje
- ✅ Asigna "Sin teléfono" cuando no hay datos de contacto
- ✅ Marca todos los vehículos como "Entregado" (históricos)
- ✅ Crea clientes automáticamente si no existen
- ✅ Muestra progreso en tiempo real
- ✅ Genera un resumen al final

## 📊 Método 2: Importación Manual desde la Interfaz (Recomendado)

También puedes crear una página de importación en la aplicación web para hacer este proceso más fácil:

### Ventajas:
- No necesitas ejecutar comandos en la terminal
- Puedes revisar los datos antes de importar
- Puedes editar costos y otros detalles
- Interfaz visual con preview de los datos

## 📝 Datos Incluidos

El archivo incluye **27 registros de vehículos** con la siguiente información:

| Campo | Descripción | Estado |
|-------|-------------|--------|
| Fecha | Fecha de ingreso al taller | ✅ Completo |
| Marca | Marca del vehículo | ✅ Completo |
| Modelo | Modelo del vehículo | ✅ Completo |
| Placa | Placa/patente del vehículo | ⚠️ Algunos sin placa |
| Kilometraje | Km registrado | ⚠️ Algunos sin dato |
| Dueño | Nombre del cliente | ⚠️ Algunos sin dato |
| Teléfono | Contacto del cliente | ❌ No disponible en cuaderno |
| Servicios | Resumen del trabajo | ✅ Completo |
| Descripción | Detalle completo | ✅ Completo |
| Costo | Precio del servicio | ❌ Debe agregarse manualmente |

## ⚠️ Notas Importantes

1. **Ejecutar solo UNA VEZ**: El script no verifica duplicados. Si lo ejecutas múltiples veces, creará registros duplicados.

2. **Costos**: Los costos están en 0 por defecto. Deberás actualizarlos manualmente después de la importación.

3. **Teléfonos**: Como no están en el cuaderno, se asigna "Sin teléfono". Puedes actualizarlos después si tienes la información.

4. **Clientes**: Se crearán automáticamente clientes para cada dueño único. Los vehículos del mismo dueño quedarán vinculados.

5. **Placa "S/P"**: Algunos vehículos no tienen placa visible en el cuaderno, se les asignó "S/P" (Sin Placa).

## 🔍 Verificación Post-Importación

Después de importar, verifica:

1. ✅ Que todos los 27 vehículos aparezcan en el Historial
2. ✅ Que las fechas estén correctas
3. ✅ Que los servicios y descripciones sean legibles
4. ✅ Actualiza los costos según tus registros
5. ✅ Actualiza los teléfonos si los tienes

## 📞 Soporte

Si encuentras algún error durante la importación:

1. Revisa el log en la consola
2. Verifica que Convex esté corriendo (`npx convex dev`)
3. Asegúrate de que las credenciales estén correctas en `.env.local`

## 🎯 Próximos Pasos

Después de importar los datos históricos:

1. **Actualizar costos**: Agrega los precios de cada servicio
2. **Completar teléfonos**: Si tienes contactos, agrégalos
3. **Revisar clientes**: Verifica que no haya duplicados
4. **Generar reportes**: Usa los datos para análisis histórico

---

**Fecha de creación**: Diciembre 2025  
**Versión**: 1.0






