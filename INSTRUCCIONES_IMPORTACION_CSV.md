# 📋 Instrucciones para Importar Datos del CSV

Este documento explica cómo importar los datos del archivo CSV al sistema.

## 📁 Archivos Necesarios

1. **`crea un excel con los datos de estas fotos, que r... - crea un excel con los datos de estas fotos, que r....csv`** - Archivo CSV con los datos a importar
2. **`import_csv_data.ts`** - Script TypeScript para importar los datos al sistema

## 🚀 Pasos para Importar

### Paso 1: Instalar dependencias (si no lo has hecho)

```bash
npm install
```

### Paso 2: Configurar la URL de Convex (si es necesario)

El script usa la variable de entorno `VITE_CONVEX_URL`. Si necesitas cambiarla:

```bash
export VITE_CONVEX_URL="tu-url-de-convex"
```

O edita el archivo `import_csv_data.ts` y cambia la línea:

```typescript
const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://charming-peacock-378.convex.cloud";
```

### Paso 3: Ubicar el archivo CSV

El script buscará el archivo CSV en las siguientes ubicaciones (en orden):

1. Un nivel arriba del directorio del script
2. En el directorio actual de trabajo
3. En el escritorio del usuario (`~/Desktop` o `C:\Users\Usuario\Desktop`)

Si el archivo está en otra ubicación, muévelo a una de estas ubicaciones o edita el script para agregar la ruta correcta.

### Paso 4: Ejecutar el script de importación

```bash
npx tsx import_csv_data.ts
```

## ✨ Características del Script

- ✅ **Clientes**: Busca clientes existentes por nombre (case-insensitive) y los matchea. Si no existe, crea uno nuevo.
- ✅ **Servicios/Items**: Crea cada servicio/item en la base de datos como un item reutilizable. Si ya existe, incrementa su contador de uso.
- ✅ **Vehículos**: Crea vehículos con todos sus datos asociados:
  - Placa (o "S/P" si es N/A)
  - Marca y modelo
  - Cliente asociado
  - Servicios realizados
  - Kilometraje
  - Descripción completa
  - Fecha de ingreso
- ✅ **Manejo de datos faltantes**: 
  - Si la fecha es "N/A", usa la fecha actual
  - Si la placa es "N/A", usa "S/P"
  - Si el modelo es "N/A", usa "Sin modelo"
  - Si el kilometraje es "N/A", se deja como undefined
- ✅ **Conversión de fechas**: Convierte fechas del formato DD/MM/YY a ISO
- ✅ **Estimación de año**: Estima el año del vehículo basándose en el kilometraje
- ✅ **Progreso en tiempo real**: Muestra el progreso de la importación
- ✅ **Resumen final**: Muestra estadísticas al finalizar

## 📊 Datos que se Importan

El script procesa las siguientes columnas del CSV:

| Columna | Descripción | Manejo |
|---------|-------------|--------|
| Fecha | Fecha de ingreso | Convierte DD/MM/YY a ISO |
| PLACA | Placa del vehículo | "S/P" si es N/A |
| MARCA | Marca del vehículo | Requerido |
| MODELO | Modelo del vehículo | "Sin modelo" si es N/A |
| CLIENTE | Nombre del cliente | Busca o crea cliente |
| SERVICIOS (Items) | Lista de servicios separados por comas | Crea items reutilizables |
| KILOMETRAJE | Kilometraje del vehículo | Opcional |
| DESCRIPCIÓN COMPLETA | Descripción detallada | Se guarda en el campo description |

## ⚠️ Importante

- **Ejecutar SOLO UNA VEZ**: El script no verifica duplicados, así que ejecútalo solo una vez para evitar datos duplicados.
- **Vehículos históricos**: Todos los vehículos se marcan como "Entregado" ya que son datos históricos.
- **Teléfono de clientes**: Se asigna "Sin teléfono" por defecto. Puedes actualizarlo manualmente después.
- **Costo**: Se establece en 0 por defecto. Puedes actualizarlo manualmente después.

## 🔍 Resolución de Problemas

### El archivo CSV no se encuentra

El script mostrará las rutas que intentó. Asegúrate de que el archivo esté en una de esas ubicaciones o edita el script para agregar la ruta correcta.

### Error al crear cliente

Si hay un error al crear un cliente, verifica que no haya caracteres especiales problemáticos en el nombre. El script maneja nombres vacíos o "N/A" asignándoles "Sin datos".

### Error al crear servicio

Los servicios se crean automáticamente. Si hay un error, verifica que el nombre del servicio no esté vacío después de limpiar espacios.

### Error de conexión con Convex

Verifica que la URL de Convex sea correcta y que tengas conexión a internet.

## 📝 Ejemplo de Salida

```
============================================================
IMPORTACIÓN DE DATOS DEL CSV
============================================================
Archivo CSV encontrado en: /ruta/al/archivo.csv

Total de registros a importar: 27

Importando: Mercedes-Benz Sprinter 515 - AD-673-QE
✓ Importado exitosamente: jh123abc...

...

============================================================
RESUMEN DE IMPORTACIÓN
============================================================
✓ Exitosos: 27
✗ Fallidos: 0
Total procesados: 27
Clientes únicos: 15
============================================================
```

## 🎯 Próximos Pasos

Después de importar los datos:

1. Revisa los clientes creados y actualiza sus teléfonos si los conoces
2. Revisa los vehículos y actualiza los costos si los conoces
3. Verifica que los servicios se hayan creado correctamente
4. Revisa las métricas de los clientes para asegurarte de que se calcularon correctamente

