# 📊 Configuración de Google Sheets para Catálogo de Productos

Esta guía te ayudará a configurar Google Sheets para que tu bot lea el catálogo de productos en tiempo real.

## 🎯 ¿Por qué usar Google Sheets?

- ✅ **Actualización en tiempo real**: Modifica precios y productos sin reiniciar el bot
- ✅ **Fácil de usar**: Edita desde cualquier dispositivo con Google Sheets
- ✅ **Colaborativo**: Múltiples personas pueden editar el catálogo
- ✅ **Backup automático**: Google guarda el historial de cambios

## 📋 Requisitos Previos

1. Una cuenta de Google
2. Acceso a Google Cloud Console
3. Una hoja de Google Sheets con tu catálogo

## 🚀 Paso 1: Crear tu Hoja de Cálculo

### Plantilla de Columnas

Tu hoja de Google Sheets debe tener las siguientes columnas (primera fila como encabezado):

| Producto | Descripción | Precio | Precio con descuento | Imagen Link | Disponibilidad |
|----------|-------------|--------|---------------------|-------------|----------------|
| Kit Completo Müllblue | Sistema de compostaje fermentativo 15L con biocatalizador | 1890 | 1490 | https://ejemplo.com/imagen.jpg | Sí |
| Biocatalizador 1kg | Activador natural para compostaje | 350 | | https://ejemplo.com/bio.jpg | Sí |

### Detalles de cada columna:

- **Producto** (REQUERIDO): Nombre del producto
- **Descripción** (REQUERIDO): Descripción breve del producto
- **Precio** (REQUERIDO): Precio normal (solo número, sin símbolos)
- **Precio con descuento** (OPCIONAL): Precio con descuento (mostrará el ahorro)
- **Imagen Link** (OPCIONAL): URL de la imagen del producto
- **Disponibilidad** (OPCIONAL): "Sí", "Si", "Yes", "1" para disponible. Cualquier otro valor = no disponible

### Ejemplo de URL de plantilla

Puedes usar esta plantilla como referencia:
```
https://docs.google.com/spreadsheets/d/TU_ID_AQUI/edit
```

## 🔑 Paso 2: Obtener API Key de Google Cloud

### 2.1 Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Dale un nombre (ej: "MullBot Catálogo")

### 2.2 Habilitar Google Sheets API

1. En el menú lateral, ve a **APIs y Servicios** > **Biblioteca**
2. Busca "Google Sheets API"
3. Haz clic en "Google Sheets API"
4. Clic en **HABILITAR**

### 2.3 Crear API Key

1. Ve a **APIs y Servicios** > **Credenciales**
2. Clic en **+ CREAR CREDENCIALES** > **Clave de API**
3. Se creará tu API Key
4. **IMPORTANTE**: Copia esta key, la necesitarás para tu `.env`

### 2.4 Restringir API Key (Recomendado para producción)

Por seguridad, es recomendable restringir tu API Key:

1. Clic en **EDITAR CLAVE DE API**
2. En **Restricciones de API**, selecciona "Restringir clave"
3. Marca solo **Google Sheets API**
4. Guarda los cambios

## 📝 Paso 3: Configurar el Bot

### 3.1 Obtener el ID de tu Hoja de Cálculo

De la URL de tu Google Sheet:
```
https://docs.google.com/spreadsheets/d/1ABC123xyz456DEF789/edit
```

El ID es: `1ABC123xyz456DEF789`

### 3.2 Hacer tu hoja pública (IMPORTANTE)

Para que la API pueda leerla:

1. Abre tu Google Sheet
2. Clic en **Compartir** (botón verde arriba a la derecha)
3. Clic en **Cambiar a cualquier persona con el enlace**
4. Asegúrate que el permiso sea **Lector**
5. Copia el enlace

### 3.3 Agregar Variables de Entorno

Edita tu archivo `.env` y agrega estas variables:

```env
# ================================
# GOOGLE SHEETS - CATÁLOGO DE PRODUCTOS
# ================================

# Tu API Key de Google Cloud Console
GOOGLE_SHEETS_API_KEY=AIzaSyA_TU_API_KEY_AQUI

# ID de tu hoja de cálculo (de la URL)
GOOGLE_SHEETS_SPREADSHEET_ID=1ABC123xyz456DEF789

# Nombre de la hoja y rango de celdas
# Si tu hoja se llama "CatálogoProductosWhatsapp" y quieres leer de A a F:
GOOGLE_SHEETS_RANGE=CatálogoProductosWhatsapp!A:F

# Nota: Si tu hoja se llama diferente (ej: "Hoja1"), usa:
# GOOGLE_SHEETS_RANGE=Hoja1!A:F
```

## 🧪 Paso 4: Probar la Integración

### 4.1 Reiniciar el Bot

Si usas Docker:
```bash
docker-compose restart app
```

Si usas desarrollo local:
```bash
npm run dev
```

### 4.2 Verificar los Logs

Busca en los logs del bot:
```
✅ Google Sheets API inicializada correctamente
📊 Obteniendo catálogo desde Google Sheets...
✅ Se obtuvieron X productos del catálogo
```

### 4.3 Probar en WhatsApp

Envía el comando que muestra precios (ej: "Ver precios", opción 1, etc.)

El bot debería responder con tu catálogo actualizado desde Google Sheets.

## 🔍 Solución de Problemas

### Error 403: Acceso Denegado

**Causa**: La hoja no es pública o la API Key no tiene permisos

**Solución**:
1. Verifica que la hoja sea pública (paso 3.2)
2. Verifica que Google Sheets API esté habilitada
3. Regenera la API Key si es necesario

### Error 404: Hoja No Encontrada

**Causa**: El SPREADSHEET_ID es incorrecto

**Solución**:
1. Verifica el ID de la URL de tu hoja
2. Asegúrate de copiar solo el ID (sin `https://` ni `/edit`)

### No se obtienen productos

**Causa**: El rango o nombre de la hoja es incorrecto

**Solución**:
1. Verifica que `GOOGLE_SHEETS_RANGE` incluya el nombre correcto de la hoja
2. Asegúrate de que la primera fila tenga los encabezados correctos
3. Verifica que haya datos en las filas siguientes

### El bot usa el catálogo antiguo

**Causa**: Las variables de Google Sheets no están configuradas

**Solución**:
1. Verifica que las 3 variables estén en tu `.env`:
   - `GOOGLE_SHEETS_API_KEY`
   - `GOOGLE_SHEETS_SPREADSHEET_ID`
   - `GOOGLE_SHEETS_RANGE`
2. Reinicia el bot después de agregar las variables

## 📌 Notas Importantes

1. **Caché**: El bot lee la hoja cada vez que se solicitan los precios, sin caché (siempre actualizado)
2. **Límites**: Google Sheets API tiene límites de uso. Para uso normal del bot es más que suficiente
3. **Fallback**: Si Google Sheets falla, el bot usará automáticamente el catálogo estático de la base de datos
4. **Formato de precios**: Escribe los precios como números simples (ej: `1490` no `$1,490`)
5. **Disponibilidad**: Para marcar productos no disponibles, escribe "No", "False" o deja en blanco

## 🎨 Consejos de Uso

1. **Actualiza precios en tiempo real**: Solo edita la hoja, los cambios se reflejan inmediatamente
2. **Agrega/elimina productos**: Solo agrégalos en nuevas filas, el bot los detectará automáticamente
3. **Ofertas temporales**: Usa la columna "Precio con descuento" para mostrar ofertas especiales
4. **Control de inventario**: Usa la columna "Disponibilidad" para ocultar productos agotados

## 🔐 Seguridad

- ✅ Usa restricciones de API para tu API Key
- ✅ Nunca compartas tu API Key públicamente
- ✅ Usa permisos de solo lectura para la hoja (no permitir edición pública)
- ✅ Guarda tu `.env` en `.gitignore` (ya viene configurado)

## 📞 Soporte

Si tienes problemas con la configuración, revisa los logs del bot para ver mensajes de error detallados.

---

¡Listo! Ahora tu bot leerá el catálogo de productos directamente desde Google Sheets 🚀
