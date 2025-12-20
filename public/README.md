# 📖 Guía de Uso del CRM MüllBot

Esta guía explica cómo utilizar todas las mejoras y funcionalidades del panel de administración del CRM.

## 📑 Índice

- [🎨 Cambiar el Logo](#cambiar-el-logo)
- [💬 Enviar y Recibir Mensajes](#enviar-y-recibir-mensajes)
- [🔄 QR de Sincronización](#qr-de-sincronización)
- [👥 Gestión de Usuarios (Rol de Administrador)](#gestión-de-usuarios-rol-de-administrador)
- [🔐 Modificar Contraseña Propia](#modificar-contraseña-propia)
- [🏷️ Personalizar Estado y Automatizaciones](#personalizar-estado-y-automatizaciones)
- [📢 Campañas por Lotes](#campañas-por-lotes)
- [📥📤 Importación y Exportación Masiva de Contactos](#importación-y-exportación-masiva-de-contactos)
- [📞 Soporte](#soporte)

---

## 🎨 Cambiar el Logo {#cambiar-el-logo}

El logo del CRM se muestra en la barra lateral y en la pantalla de login. El sistema utiliza automáticamente el archivo `Logo_cara.png` ubicado en la carpeta `public/`.

**Ubicación actual del logo:** `/public/Logo_cara.png`

**Para cambiar el logo:**
1. Reemplaza el archivo `Logo_cara.png` en la carpeta `public/` con tu nuevo logo
2. Asegúrate de que el archivo tenga el mismo nombre: `Logo_cara.png`
3. El nuevo logo se reflejará automáticamente en:
   - La barra lateral del dashboard
   - La pantalla de login
   - Cualquier otra parte del sistema que muestre el logo

**Requisitos del logo:**
- Formato: PNG (recomendado) o cualquier formato de imagen web
- Tamaño recomendado: 512x512 píxeles para mejor calidad
- El sistema ajustará automáticamente el tamaño según el contexto

---

## 💬 Enviar y Recibir Mensajes {#enviar-y-recibir-mensajes}

El CRM permite enviar y recibir mensajes directamente desde el panel de administración, manteniendo una comunicación en tiempo real con los contactos.

### Enviar Mensajes

1. **Desde la sección de Contactos:**
   - Ve a la sección **"Contactos"** en el menú lateral
   - Busca el contacto con el que deseas comunicarte
   - Haz clic en el botón **"Enviar Mensaje"** o en el ícono de chat junto al contacto
   - Escribe tu mensaje en el campo de texto
   - Haz clic en **"Enviar"**

2. **Desde el Dashboard:**
   - En la sección de contactos recientes, haz clic en el botón de mensaje del contacto deseado
   - Escribe y envía tu mensaje directamente

### Recibir Mensajes

Los mensajes entrantes se muestran automáticamente en el CRM:

1. **Notificaciones en tiempo real:**
   - Los mensajes nuevos aparecen en la sección de notificaciones
   - Se actualizan automáticamente sin necesidad de recargar la página

2. **Visualizar mensajes:**
   - Ve a la sección **"Contactos"**
   - Los contactos con mensajes nuevos se marcan con un indicador
   - Haz clic en el contacto para ver el historial completo de mensajes

3. **Responder desde el CRM:**
   - Abre la conversación con el contacto
   - Escribe tu respuesta en el campo de mensaje
   - Haz clic en **"Enviar"**

**Nota:** Los mensajes se sincronizan automáticamente entre WhatsApp y el CRM. No es necesario realizar acciones adicionales.

---

## 🔄 QR de Sincronización {#qr-de-sincronización}

El código QR es necesario para sincronizar el bot de WhatsApp con el CRM. El sistema intenta actualizar automáticamente el QR cada 20 segundos.

### Visualizar el QR

1. Ve a la sección **"Dashboard"** o **"Configuración"**
2. Si el bot no está conectado, verás el código QR en pantalla
3. El QR se actualiza automáticamente cada 20 segundos si no ha sido escaneado

### Sincronizar WhatsApp

1. **Escanea el QR:**
   - Abre WhatsApp en tu teléfono
   - Ve a **Configuración** > **Dispositivos vinculados** > **Vincular un dispositivo**
   - Escanea el código QR mostrado en el CRM

2. **Verificar conexión:**
   - Una vez escaneado, el estado cambiará a **"✅ Conectado"**
   - El QR desaparecerá automáticamente de la pantalla
   - Verás el nombre y número del bot conectado

### Solución de Problemas

Si el QR no se actualiza automáticamente o no se puede escanear:

1. **Regenerar QR manualmente:**
   - Haz clic en el botón **"Regenerar QR"** si está disponible
   - Espera a que se genere un nuevo código

2. **Desconectar y reconectar:**
   - Si el QR expiró o no funciona:
     - Ve a **Configuración** > **WhatsApp**
     - Haz clic en **"Desconectar WhatsApp"**
     - Espera a que se genere un nuevo QR
     - Escanea el nuevo código

3. **Verificar el estado:**
   - Si persisten los problemas, verifica que:
     - Tu conexión a internet esté estable
     - El servidor del CRM esté funcionando correctamente
     - No haya sesiones de WhatsApp activas en otros dispositivos

**Nota:** El QR expira después de un tiempo determinado por WhatsApp. Si no lo escaneas rápidamente, regenera un nuevo código.

---

## 👥 Gestión de Usuarios (Rol de Administrador) {#gestión-de-usuarios-rol-de-administrador}

Los administradores pueden gestionar todos los usuarios del sistema, incluyendo crear, editar, eliminar y modificar permisos.

### Acceder a la Gestión de Usuarios

1. Ve a la sección **"Configuración"** en el menú lateral
2. Selecciona la pestaña **"Usuarios"** o **"Gestión de Usuarios"**

### Funciones Disponibles

#### Crear Nuevo Usuario

1. Haz clic en el botón **"Crear Usuario"** o **"Agregar Usuario"**
2. Completa el formulario:
   - **Nombre de usuario:** Nombre único para el usuario
   - **Contraseña:** Contraseña segura
   - **Rol:** Selecciona entre "Administrador" o "Usuario"
3. Haz clic en **"Guardar"** o **"Crear"**

#### Editar Usuario

1. En la lista de usuarios, encuentra el usuario que deseas editar
2. Haz clic en el botón **"Editar"** o en el ícono de lápiz
3. Modifica los campos deseados:
   - **Nombre de usuario:** Puedes cambiarlo si es necesario
   - **Contraseña:** Deja en blanco para mantener la actual o ingresa una nueva
   - **Rol:** Puedes cambiar el rol del usuario
4. Haz clic en **"Guardar cambios"**

#### Eliminar Usuario

1. En la lista de usuarios, encuentra el usuario que deseas eliminar
2. Haz clic en el botón **"Eliminar"** o en el ícono de papelera
3. Confirma la eliminación en el diálogo que aparece
4. El usuario será eliminado permanentemente del sistema

**⚠️ Advertencia:** La eliminación de usuarios es permanente y no se puede deshacer.

#### Modificar Contraseña de Usuario

Como administrador, puedes cambiar la contraseña de cualquier usuario:

1. Edita el usuario (ver sección "Editar Usuario")
2. En el campo de contraseña, ingresa la nueva contraseña
3. Si dejas el campo vacío, se mantendrá la contraseña actual
4. Guarda los cambios

---

## 🔐 Modificar Contraseña Propia {#modificar-contraseña-propia}

Todos los usuarios pueden modificar su propia contraseña desde su perfil.

### Cambiar Tu Contraseña

1. **Accede a tu perfil:**
   - Haz clic en tu nombre de usuario en la esquina superior derecha
   - O ve a **"Configuración"** > **"Mi Perfil"**

2. **Cambiar contraseña:**
   - Localiza la sección **"Cambiar Contraseña"**
   - Ingresa tu **contraseña actual**
   - Ingresa la **nueva contraseña** (dos veces para confirmar)
   - Haz clic en **"Actualizar Contraseña"**

3. **Confirmación:**
   - Verás un mensaje de confirmación si el cambio fue exitoso
   - La próxima vez que inicies sesión, usa tu nueva contraseña

**Requisitos de contraseña:**
- Mínimo 6 caracteres (recomendado: 8 o más)
- Mezcla de letras y números para mayor seguridad
- Evita contraseñas demasiado simples o comunes

**Nota:** Si olvidaste tu contraseña, contacta a un administrador para que te asigne una nueva.

---

## 🏷️ Personalizar Estado y Automatizaciones {#personalizar-estado-y-automatizaciones}

El CRM permite crear y gestionar estados personalizados para tus contactos, así como configurar automatizaciones que ejecuten acciones en momentos específicos.

### Gestión de Estados Personalizados

#### Crear un Estado Personalizado

1. Ve a **"Configuración"** > **"Estados"** o **"Estados Personalizados"**
2. Haz clic en **"Crear Nuevo Estado"**
3. Completa el formulario:
   - **Nombre del estado:** Ej: "Primer Contacto", "Interesado", "Seguimiento"
   - **Color:** Selecciona un color para identificar visualmente el estado
   - **Descripción:** (Opcional) Descripción del estado
4. Haz clic en **"Guardar"**

#### Editar o Eliminar Estados

1. En la lista de estados, haz clic en **"Editar"** o **"Eliminar"**
2. Para editar, modifica los campos y guarda
3. Para eliminar, confirma la acción

### Configurar Automatizaciones

Las automatizaciones permiten ejecutar acciones automáticas basadas en condiciones y horarios específicos.

#### Crear una Automatización

1. Ve a **"Configuración"** > **"Automatizaciones"**
2. Haz clic en **"Nueva Automatización"**
3. Configura la automatización:

   **Condición:**
   - Selecciona cuándo se debe ejecutar:
     - Al cambiar a un estado específico
     - Después de X días sin interacción
     - En una fecha/hora específica
     - Etc.

   **Acción:**
   - Selecciona qué acción realizar:
     - Enviar mensaje automático
     - Cambiar estado del contacto
     - Enviar notificación
     - Etc.

   **Horario de Ejecución:**
   - Define cuándo se debe ejecutar la acción
   - Puedes programar días y horas específicos
   - Ejemplo: "Ejecutar todos los días a las 9:00 AM"

4. Haz clic en **"Guardar Automatización"**

#### Ejemplo de Automatización

**Escenario:** Enviar recordatorio a contactos que están en estado "Interesado" después de 3 días sin interacción.

1. **Condición:** Contacto con estado "Interesado" y última interacción hace más de 3 días
2. **Acción:** Enviar mensaje: "Hola, queremos saber si tienes alguna pregunta sobre nuestro producto..."
3. **Horario:** Todos los días a las 10:00 AM
4. **Estado resultante:** Cambiar a "Seguimiento"

#### Gestionar Automatizaciones

- **Activar/Desactivar:** Puedes activar o desactivar una automatización sin eliminarla
- **Editar:** Modifica cualquier parte de la automatización
- **Eliminar:** Elimina permanentemente la automatización
- **Ver historial:** Consulta cuándo y cómo se ejecutó cada automatización

---

## 📢 Campañas por Lotes {#campañas-por-lotes}

Las campañas por lotes permiten enviar mensajes masivos a múltiples contactos de manera controlada, dividiendo el envío en lotes con intervalos de tiempo entre cada uno.

### Crear una Campaña por Lotes

1. Ve a la sección **"Campañas"** en el menú lateral
2. Haz clic en **"Nueva Campaña"** o **"Crear Campaña"**

### Configurar la Campaña

#### Paso 1: Información Básica

- **Nombre de la campaña:** Ej: "Promoción Diciembre 2025"
- **Mensaje:** El texto que se enviará a todos los contactos
  - Puedes usar variables como `{{nombre}}` para personalizar
  - Ejemplo: "Hola {{nombre}}, tenemos una oferta especial para ti..."

#### Paso 2: Filtrar Contactos por Estado

- Selecciona los **Estados de Venta** que deseas incluir
- Ejemplos: "Lead", "Interesado", "Info Solicitada"
- El sistema mostrará cuántos contactos tienen ese estado
- Puedes seleccionar múltiples estados

**Ejemplo:**
- Si seleccionas "Lead" y hay 200 contactos con ese estado
- El sistema indicará: "200 contactos con este estado"

#### Paso 3: Configurar Envío por Lotes

Habilita la opción **"Campaña por Lotes"** y configura:

- **Lote Máximo:** Número de contactos por lote
  - Ejemplo: 50 contactos por lote

- **Intervalo de Pausa:** Tiempo de espera entre lotes (en minutos)
  - Ejemplo: 15 minutos entre cada lote

- **Programar Envío Inicial:** Fecha y hora del primer lote
  - Ejemplo: 13/12/2025 10:00 AM

#### Paso 4: Revisar y Confirmar

El sistema calculará automáticamente:
- **Total de contactos:** Número total que recibirán el mensaje
- **Número de lotes:** Cuántos lotes se crearán
- **Horario de cada lote:** Cuándo se enviará cada lote

**Ejemplo de Cálculo:**

Si tienes:
- **200 contactos** con estado "Lead"
- **Lote máximo:** 50 contactos
- **Intervalo:** 15 minutos
- **Inicio:** 13/12/2025 10:00 AM

El sistema creará:
- **Lote 1:** 50 contactos - 13/12/2025 10:00 AM
- **Lote 2:** 50 contactos - 13/12/2025 10:15 AM
- **Lote 3:** 50 contactos - 13/12/2025 10:30 AM
- **Lote 4:** 50 contactos - 13/12/2025 10:45 AM

**Nota sobre residuos:** Si el número total no es divisible exactamente por el tamaño del lote, el último lote contendrá los contactos restantes.

**Ejemplo con residuo:**
- **110 contactos** totales
- **Lote máximo:** 25 contactos
- Resultado:
  - Lote 1: 25 contactos
  - Lote 2: 25 contactos
  - Lote 3: 25 contactos
  - Lote 4: 25 contactos
  - Lote 5: 10 contactos (residuo)

### Monitorear la Campaña

Una vez creada, puedes ver:
- **Estado:** Programada, Enviando, Completada, Fallida
- **Progreso:** Cuántos lotes se han enviado
- **Contactos enviados:** Número de mensajes enviados exitosamente
- **Errores:** Número de mensajes que fallaron
- **Próximo lote:** Cuándo se enviará el siguiente lote

### Cancelar una Campaña

Si necesitas detener una campaña:
1. Ve a la lista de campañas
2. Haz clic en **"Cancelar"** en la campaña deseada
3. Confirma la acción
4. Los lotes pendientes no se enviarán

---

## 📥📤 Importación y Exportación Masiva de Contactos {#importación-y-exportación-masiva-de-contactos}

El CRM permite importar y exportar contactos de manera masiva usando archivos Excel (.xlsx) o CSV (.csv).

### Exportar Contactos

1. Ve a la sección **"Contactos"**
2. Haz clic en el botón **"Exportar Contactos"** o **"Descargar Contactos"**
3. Selecciona el formato:
   - **Excel (.xlsx)** - Recomendado
   - **CSV (.csv)** - Alternativa
4. El archivo se descargará automáticamente

#### Estructura del Archivo Exportado

El archivo incluye las siguientes columnas en este orden:

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| Teléfono | Número de teléfono del contacto | 5215530105862 |
| Nombre | Nombre del contacto | Usuario |
| Estado | Estado de venta del contacto | Lead |
| Última interacción | Fecha y hora de la última interacción | 29/11/2025 12:48 AM |
| Acciones | Estado de pausa del bot | Pausar |

### Importar Contactos

1. Ve a la sección **"Contactos"**
2. Haz clic en el botón **"Importar Contactos"** o **"Cargar Contactos"**
3. Selecciona tu archivo (.xlsx o .csv)
4. El sistema procesará el archivo y mostrará un resumen
5. Haz clic en **"Confirmar Importación"**

#### Preparar el Archivo para Importar

**Formato requerido:**

Tu archivo debe tener estas columnas en el siguiente orden:

1. **Teléfono** (Obligatorio)
   - Formato: Número completo sin guiones ni espacios
   - Ejemplo: `5215530105862`
   - Debe incluir el código de país

2. **Nombre** (Opcional)
   - Si está vacío, se usará el `profile_name` del contacto de WhatsApp
   - Ejemplo: `Usuario` o dejar vacío

3. **Estado** (Opcional)
   - Valores válidos: `Lead`, `Interesado`, `Info Solicitada`, `Pago Pendiente`, `Cita Agendada`, `Cita Confirmada`, `Completado`
   - Si está vacío, se asignará automáticamente `Lead`
   - Ejemplo: `Lead` o dejar vacío

4. **Última interacción** (Opcional)
   - Formato de fecha: `DD/MM/YYYY HH:MM AM/PM`
   - Ejemplo: `29/11/2025 12:48 AM`
   - Si está vacío, se asignará `Sin registro`
   - Se actualizará automáticamente cuando se envíe o reciba un mensaje

5. **Acciones** (Opcional)
   - Si contiene `Pausar`, el bot se pausará para ese contacto
   - Si está vacío o tiene otro valor, el contacto estará activo
   - Ejemplo: `Pausar` o dejar vacío

#### Ejemplo de Archivo Excel/CSV

```
Teléfono,Nombre,Estado,Última interacción,Acciones
5215530105862,Usuario,Lead,29/11/2025 12:48 AM,Pausar
5215512345678,Juan Pérez,Interesado,01/12/2025 10:30 AM,
5215598765432,,Lead,,
```

#### Reglas de Importación

1. **Contactos duplicados:**
   - Si un contacto ya existe (mismo teléfono), se **actualizará** con los nuevos datos
   - Los campos vacíos en el archivo no sobrescribirán datos existentes
   - Solo se actualizarán los campos que tengan valores

2. **Nombre vacío:**
   - Si la columna "Nombre" está vacía, el sistema usará el `profile_name` del contacto desde WhatsApp
   - Si no hay `profile_name`, se usará el número de teléfono

3. **Estado vacío:**
   - Si la columna "Estado" está vacía, se asignará automáticamente `Lead`

4. **Última interacción vacía:**
   - Si está vacía, se asignará `Sin registro`
   - Se actualizará automáticamente cuando haya una nueva interacción

5. **Acciones:**
   - Si contiene la palabra `Pausar` (sin importar mayúsculas/minúsculas), el bot se pausará para ese contacto
   - Los contactos pausados no recibirán mensajes automáticos del bot

#### Resultado de la Importación

Después de importar, verás un resumen:
- ✅ **Contactos importados:** Nuevos contactos agregados
- 🔄 **Contactos actualizados:** Contactos existentes que fueron modificados
- ⚠️ **Errores:** Filas que no se pudieron procesar (con motivo del error)

---

## 📞 Soporte {#soporte}

Si tienes dudas o problemas con alguna funcionalidad:

1. Revisa esta guía primero
2. Consulta la sección de ayuda en el CRM
3. Contacta al administrador del sistema
4. Revisa los logs del sistema para errores técnicos

---

**Última actualización:** Diciembre 2025  
**Versión del CRM:** 1.0.0

