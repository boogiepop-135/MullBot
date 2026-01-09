# 📝 Configuración para Escribir en Google Sheets (Sincronización)

Para sincronizar productos desde la base de datos hacia Google Sheets, necesitas **Service Account** porque las API Keys públicas solo permiten lectura.

## 🎯 Opción 1: Service Account (Recomendado para servidores)

### Paso 1: Crear Service Account

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto (o crea uno nuevo)
3. Ve a **IAM y administración** > **Cuentas de servicio**
4. Clic en **+ CREAR CUENTA DE SERVICIO**
5. Nombre: `mullbot-sheets-sync`
6. Descripción: `Cuenta de servicio para sincronizar productos`
7. Clic en **Crear y continuar**

### Paso 2: Asignar Roles

1. En la siguiente pantalla, asigna el rol: **Editor** o **Google Sheets API User**
2. Clic en **Continuar** y luego **Listo**

### Paso 3: Crear y Descargar Key JSON

1. Clic en la cuenta de servicio recién creada
2. Ve a la pestaña **Claves**
3. Clic en **Agregar clave** > **Crear nueva clave**
4. Selecciona **JSON**
5. Clic en **Crear** - Se descargará un archivo JSON

### Paso 4: Compartir la Hoja con el Service Account

1. Abre el archivo JSON descargado
2. Copia el email que está en `client_email` (ej: `mullbot-sheets-sync@tu-proyecto.iam.gserviceaccount.com`)
3. Abre tu Google Sheet
4. Clic en **Compartir**
5. Pega el email del Service Account
6. Da permisos de **Editor**
7. **IMPORTANTE**: Desactiva "Notificar a las personas"

### Paso 5: Actualizar Variables de Entorno

En lugar de usar `GOOGLE_SHEETS_API_KEY`, necesitas usar el JSON del Service Account:

```env
# OPCIÓN 1: Ruta al archivo JSON (recomendado para servidores)
GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH=/ruta/al/service-account-key.json

# OPCIÓN 2: JSON como string en variable de entorno
GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"..."}
```

## 🎯 Opción 2: Usar API Key con OAuth2 (Más complejo)

Para usar OAuth2 necesitarías implementar un flujo completo de autenticación, lo cual es más complejo. Service Account es más simple para servidores.

## ⚠️ Nota Importante

Si solo necesitas **leer** productos desde Google Sheets (que ya funciona), no necesitas hacer nada más. La sincronización **DB → Sheets** requiere Service Account.

Si prefieres **editar manualmente** en Google Sheets y que el bot lo lea, eso ya funciona con la API Key pública.

## 🔄 Flujo de Trabajo Recomendado

**Opción A: Editar en Google Sheets (Ya funciona)**
1. Edita productos directamente en Google Sheets
2. El bot lee automáticamente cuando alguien pide precios
3. No necesitas sincronizar

**Opción B: Editar en Panel Admin y Sincronizar (Requiere Service Account)**
1. Edita productos en el Panel de Administración
2. Clic en "Sincronizar a Google Sheets"
3. Los productos se actualizan en Google Sheets
4. El bot lee desde Google Sheets

## 📝 Actualización del Código

Una vez configures Service Account, necesito actualizar `google-sheets.util.ts` para que use Service Account en lugar de API Key cuando esté disponible. Por ahora, el código usa API Key para lectura y está preparado para Service Account para escritura.
