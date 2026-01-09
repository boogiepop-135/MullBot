# 📖 Guía de Uso del CRM MüllBot

Esta guía explica todas las funcionalidades del panel de administración, organizadas por secciones del menú lateral.

## 📑 Índice

- [🏠 Dashboard](#dashboard)
- [📇 Contactos](#contactos)
- [🎧 Asesorías](#asesorías)
- [📢 Campañas](#campañas)
- [📝 Plantillas](#plantillas)
- [📦 Productos](#productos)
- [👥 Usuarios](#usuarios)
- [🤖 Contenido Bot](#contenido-bot)
- [✨ Automatizaciones](#automatizaciones)
- [⚙️ Configuración](#configuración)
- [🧠 Monitor IA](#monitor-ia)
- [📖 Guía de Uso](#guía-de-uso)
- [🔧 Solución de Problemas](#solución-de-problemas)

---

## 🏠 Dashboard {#dashboard}

**Descripción:** Vista general con estadísticas, métricas y contactos recientes del CRM.

### Funcionalidades Principales

- **Estadísticas de Contactos por Estado**
  - Muestra contadores de contactos según su estado de venta
  - Estados incluidos: Leads, Interesados, Info Solicitada, Pago Pendiente, Cita Agendada, Cita Confirmada, Completados, Pausados
  - Actualización en tiempo real

- **Estadísticas de Campañas**
  - Total de campañas creadas
  - Total de mensajes enviados

- **Gráficos de Intenciones**
  - Visualización de intenciones detectadas por el bot
  - Ayuda a entender qué buscan tus clientes

- **Contactos Recientes**
  - Lista de los últimos contactos que han interactuado
  - Acceso rápido al perfil de cada contacto

- **Top Leads**
  - Los contactos más prometedores basados en puntuación
  - Prioriza tu atención en los mejores prospectos

### Cómo Usar

1. El Dashboard se muestra automáticamente al iniciar sesión
2. Todas las estadísticas se actualizan en tiempo real
3. Haz clic en cualquier contacto reciente para ver su perfil completo

---

## 📇 Contactos {#contactos}

**Descripción:** Gestiona todos tus contactos, cambia estados, chatea directamente y gestiona conversaciones.

### Botones Principales

#### 🔄 Importar Conversaciones Antiguas
**¿Para qué sirve?**
- Importa contactos y mensajes históricos desde Evolution API
- Útil cuando los contactos antiguos no aparecen en la lista
- Sincroniza tu base de datos con WhatsApp

**Cómo usar:**
1. Haz clic en "Importar Conversaciones Antiguas"
2. Espera a que termine (puede tardar varios minutos)
3. Verás un resumen: contactos importados, mensajes importados, errores (si los hay)
4. Los contactos aparecerán automáticamente en la lista

**Nota:** Esta acción importa hasta 50 mensajes por chat para no sobrecargar la base de datos.

#### 📤 Importar XLSX
**¿Para qué sirve?**
- Importa contactos desde un archivo Excel (.xlsx o .csv)
- Útil para migrar contactos desde otros sistemas
- Formato requerido: Teléfono, Nombre, Estado, Última interacción, Acciones

**Cómo usar:**
1. Haz clic en "Importar XLSX"
2. Selecciona tu archivo Excel
3. El sistema procesará y mostrará un resumen
4. Confirma la importación

#### 📥 Exportar XLSX
**¿Para qué sirve?**
- Exporta todos tus contactos a un archivo Excel
- Útil para hacer respaldos o análisis externos
- Incluye: teléfono, nombre, estado, última interacción, si está pausado

**Cómo usar:**
1. Haz clic en "Exportar XLSX"
2. El archivo se descargará automáticamente
3. Ábrelo en Excel para editarlo o analizarlo

### Funcionalidades de la Tabla

#### 🔍 Buscar Contactos
**¿Para qué sirve?**
- Busca contactos por nombre o número de teléfono
- Búsqueda en tiempo real mientras escribes

#### 🏷️ Filtrar por Estado
**¿Para qué sirve?**
- Muestra solo contactos con un estado específico
- Estados: Todos, Lead, Interesado, Info Solicitada, Pago Pendiente, Cita Agendada, Cita Confirmada, Completado, Pausados

#### 💬 Chat Directo
**¿Para qué sirve?**
- Abre una conversación directa con el contacto
- Envía mensajes desde el panel sin salir del CRM
- Ve el historial completo de mensajes

**Cómo usar:**
1. Haz clic en el ícono de chat junto al contacto
2. Se abrirá un modal con la conversación
3. Escribe tu mensaje y presiona Enter o haz clic en "Enviar"
4. Los mensajes se envían a través de WhatsApp

#### ✏️ Cambiar Estado
**¿Para qué sirve?**
- Actualiza el estado de venta de un contacto
- Ayuda a organizar tu pipeline de ventas
- Permite agregar notas y fechas de citas

**Cómo usar:**
1. Haz clic en el estado actual del contacto
2. Selecciona el nuevo estado
3. Si es necesario, agrega fecha de cita o notas
4. Guarda los cambios

#### ⏸️ Pausar/Despausar
**¿Para qué sirve?**
- Pausar: El bot no responderá automáticamente a este contacto
- Despausar: Reactiva las respuestas automáticas del bot
- Útil cuando un asesor está atendiendo personalmente

### Estados de Venta

- **Lead**: Nuevo contacto sin clasificar
- **Interesado**: Contacto que ha mostrado interés
- **Info Solicitada**: Cliente que pidió más información
- **Pago Pendiente**: Cliente con pago pendiente
- **Cita Agendada**: Cliente con cita programada
- **Cita Confirmada**: Cliente con cita confirmada
- **Completado**: Venta finalizada

---

## 🎧 Asesorías {#asesorías}

**Descripción:** Cola de solicitudes de atención humana. Cuando un cliente solicita hablar con un asesor, aparece aquí.

### Vista Principal

#### 📋 Cola de Solicitudes
**¿Para qué sirve?**
- Lista de clientes esperando atención humana
- Muestra: nombre, teléfono, tiempo en cola, estado
- Se actualiza automáticamente cuando llegan nuevas solicitudes

#### 🔔 Notificación de Nuevas Solicitudes
**¿Para qué sirve?**
- Sonido de notificación cuando llega una nueva solicitud
- Badge con contador en el menú lateral
- Ayuda a no perder solicitudes

### Al Seleccionar una Solicitud

#### 💬 Chat Integrado
**¿Para qué sirve?**
- Chatea directamente con el cliente desde el panel
- Ve el historial completo de la conversación
- No necesitas WhatsApp abierto en tu teléfono

**Cómo usar:**
1. Haz clic en una solicitud de la cola
2. Se abrirá el chat en el panel derecho
3. Escribe tu mensaje y presiona Enter
4. Los mensajes se envían a través de WhatsApp

#### 📋 Resumen de Conversación
**¿Para qué sirve?**
- Vista breve del contexto antes de atender
- Muestra los últimos mensajes intercambiados
- Te ayuda a entender qué necesita el cliente

#### ⚡ Respuestas Rápidas
**¿Para qué sirve?**
- Botones con respuestas predefinidas comunes
- Ahorra tiempo al responder preguntas frecuentes
- Incluye: "Hola, ¿en qué puedo ayudarte?", "Un momento por favor", etc.

**Cómo usar:**
1. Haz clic en cualquier botón de respuesta rápida
2. El mensaje se insertará en el campo de texto
3. Puedes editarlo antes de enviar o enviarlo directamente

#### ✅ Finalizar Exitosa
**¿Para qué sirve?**
- Completa la asesoría cuando terminaste de atender
- Marca la solicitud como completada exitosamente
- El cliente vuelve al bot normal y puede seguir chateando

**Cómo usar:**
1. Cuando termines de atender, haz clic en "Finalizar Exitosa"
2. Opcionalmente, agrega un resumen de la conversación
3. La solicitud se marcará como completada

#### ❌ Expulsar
**¿Para qué sirve?**
- Cancela la asesoría si el cliente no respondió o canceló
- Remueve la solicitud de la cola
- Útil para limpiar solicitudes abandonadas

**Cómo usar:**
1. Haz clic en "Expulsar" si no pudiste completar la asesoría
2. Confirma la acción
3. La solicitud se eliminará de la cola

### Estadísticas

- **Pendientes**: Solicitudes esperando atención
- **En Atención**: Solicitudes siendo atendidas actualmente
- **Completadas Hoy**: Total de asesorías completadas hoy

---

## 📢 Campañas {#campañas}

**Descripción:** Crea y programa campañas masivas de mensajería a tus contactos.

### Vista Principal

#### ➕ Nueva Campaña
**¿Para qué sirve?**
- Crea una nueva campaña de mensajería masiva
- Envía mensajes a múltiples contactos a la vez
- Programa envíos para el futuro

**Cómo usar:**
1. Haz clic en "Nueva Campaña"
2. Completa el formulario:
   - **Nombre de la campaña**: Ej: "Promoción Diciembre 2025"
   - **Mensaje**: El texto que se enviará a todos
   - **Destinatarios**: Selecciona por estado o manualmente
   - **Fecha de envío**: Enviar ahora o programar para más tarde
3. Haz clic en "Crear Campaña"

### Crear Nueva Campaña - Detalles

#### 📝 Nombre de la Campaña
**¿Para qué sirve?**
- Identifica tu campaña fácilmente
- Útil para organizar múltiples campañas
- Solo visible para ti (no se envía al cliente)

#### 💬 Mensaje
**¿Para qué sirve?**
- El texto que recibirán todos los destinatarios
- Puedes usar variables como `{{nombre}}` para personalizar
- Ejemplo: "Hola {{nombre}}, tenemos una oferta especial para ti..."

#### 👥 Seleccionar Destinatarios
**¿Para qué sirve?**
- Define quiénes recibirán la campaña
- Puedes filtrar por estado de venta
- O seleccionar contactos manualmente

**Opciones:**
- **Por Estado**: Selecciona uno o varios estados (Lead, Interesado, etc.)
- **Selección Manual**: Elige contactos específicos uno por uno

#### ⏰ Programar Envío
**¿Para qué sirve?**
- Programa la campaña para enviarse más tarde
- Útil para enviar mensajes en horarios específicos
- O preparar campañas con anticipación

**Opciones:**
- **Enviar Ahora**: La campaña comienza inmediatamente
- **Programar**: Selecciona fecha y hora específica

### Lista de Campañas

#### 📊 Ver Estado
**¿Para qué sirve?**
- Ve el progreso de cada campaña
- Estados: Programada, Enviando, Completada, Fallida

#### 📈 Ver Estadísticas
**¿Para qué sirve?**
- Cuántos mensajes se enviaron exitosamente
- Cuántos mensajes fallaron
- Porcentaje de éxito

#### ❌ Cancelar Campaña
**¿Para qué sirve?**
- Detiene una campaña que está enviándose
- O cancela una campaña programada
- Los mensajes pendientes no se enviarán

---

## 📝 Plantillas {#plantillas}

**Descripción:** Guarda y reutiliza mensajes predefinidos para respuestas rápidas.

### Vista Principal

#### ➕ Nueva Plantilla
**¿Para qué sirve?**
- Crea un mensaje reutilizable
- Útil para respuestas comunes o mensajes frecuentes
- Ahorra tiempo al escribir lo mismo repetidamente

**Cómo usar:**
1. Haz clic en "Nueva Plantilla"
2. Escribe el mensaje que quieres guardar
3. Dale un nombre descriptivo (ej: "Saludo Inicial", "Información de Precios")
4. Guarda la plantilla

### Lista de Plantillas

#### ✏️ Editar Plantilla
**¿Para qué sirve?**
- Modifica una plantilla existente
- Actualiza el contenido sin crear una nueva

**Cómo usar:**
1. Haz clic en el botón de editar en la plantilla
2. Modifica el mensaje
3. Guarda los cambios

#### 🗑️ Eliminar Plantilla
**¿Para qué sirve?**
- Elimina plantillas que ya no necesitas
- Limpia tu lista de plantillas

#### 📋 Usar Plantilla
**¿Para qué sirve?**
- Inserta el contenido de la plantilla en el chat activo
- O copia al portapapeles para usar en otro lugar

**Cómo usar:**
1. Si hay un chat abierto, haz clic en la plantilla para insertarla
2. Si no hay chat abierto, se copiará al portapapeles
3. Edita el mensaje si es necesario antes de enviar

---

## 📦 Productos {#productos}

**Descripción:** Gestiona tu catálogo de productos y sincroniza con Google Sheets.

### Vista Principal

#### 🔄 Sincronizar desde Google Sheets
**¿Para qué sirve?**
- Importa productos desde tu hoja de Google Sheets
- Actualiza precios y productos sin editar manualmente
- Sincroniza el catálogo completo desde la hoja

**Cómo usar:**
1. Asegúrate de tener Google Sheets configurado (variables de entorno)
2. Haz clic en "Sincronizar desde Google Sheets"
3. El sistema importará los productos automáticamente
4. Los productos aparecerán en la lista

**Requisitos:**
- Hoja con columnas: Producto, Descripción, Precio, Precio con descuento, Imagen Link, Disponibilidad
- Variables de entorno configuradas: `GOOGLE_SHEETS_API_KEY` y `GOOGLE_SHEETS_SPREADSHEET_ID`

#### 📤 Sincronizar a Google Sheets
**¿Para qué sirve?**
- Exporta productos de la base de datos a Google Sheets
- Útil para hacer backup o compartir con tu equipo
- Requiere Service Account de Google configurado

#### ➕ Nuevo Producto
**¿Para qué sirve?**
- Agrega productos manualmente a tu catálogo
- Útil para productos que no están en Google Sheets
- O para crear productos rápidamente

**Cómo usar:**
1. Haz clic en "Nuevo Producto"
2. Completa el formulario:
   - **Nombre**: Nombre del producto
   - **Descripción**: Descripción detallada
   - **Precio**: Precio en pesos
   - **Imagen**: URL de la imagen del producto
   - **En Stock**: Si el producto está disponible
3. Guarda el producto

### Vista de Productos (Tarjetas)

Cada producto se muestra en una tarjeta con:

- **Imagen**: Foto del producto (o ícono por defecto)
- **Nombre**: Nombre del producto
- **Descripción**: Descripción truncada (máximo 3 líneas)
- **Precio**: Precio destacado en verde
- **Estado**: Badge "En Stock" o "Agotado"
- **Categoría**: Categoría del producto

#### ✏️ Editar Producto
**¿Para qué sirve?**
- Modifica un producto existente
- Actualiza precio, descripción, imagen, etc.

**Cómo usar:**
1. Haz clic en el botón de editar (ícono de lápiz) en la tarjeta
2. Modifica los campos necesarios
3. Guarda los cambios

#### 🗑️ Eliminar Producto
**¿Para qué sirve?**
- Elimina un producto del catálogo
- Útil para productos que ya no vendes

**Cómo usar:**
1. Haz clic en el botón de eliminar (ícono de basura)
2. Confirma la eliminación
3. El producto se eliminará permanentemente

---

## 👥 Usuarios {#usuarios}

**Descripción:** Administra los usuarios del sistema y sus roles. (Solo visible para administradores)

### Funcionalidades

- **Ver Lista de Usuarios**: Todos los usuarios del sistema
- **Crear Usuario**: Agregar nuevos usuarios
- **Editar Usuario**: Modificar datos o rol
- **Eliminar Usuario**: Remover usuarios del sistema

---

## 🤖 Contenido Bot {#contenido-bot}

**Descripción:** Edita las respuestas automáticas y mensajes predefinidos del bot.

### Funcionalidades

#### 📝 Editar Comandos del Bot
**¿Para qué sirve?**
- Personaliza las respuestas a comandos como `/precios`, `/productos`, `/guia`, etc.
- Define qué información muestra el bot para cada comando

**Cómo usar:**
1. Haz clic en "Contenido Bot"
2. Selecciona el comando que quieres editar
3. Modifica el texto de la respuesta
4. Opcionalmente, asocia una imagen
5. Guarda los cambios

#### 🖼️ Asociar Media
**¿Para qué sirve?**
- Agrega imágenes o archivos a las respuestas del bot
- Por ejemplo, una imagen de catálogo con el comando `/precios`

**Cómo usar:**
1. Al editar un contenido, sube una imagen o archivo
2. El bot enviará el archivo junto con el mensaje
3. Guarda los cambios

---

## ✨ Automatizaciones {#automatizaciones}

**Descripción:** Crea reglas automáticas que se ejecutan cuando ocurren eventos.

### Pestañas

#### 🏷️ Estados Personalizados
**¿Para qué sirve?**
- Crea estados de venta adicionales a los predeterminados
- Personaliza tu pipeline de ventas según tus necesidades
- Ejemplos: "Primera Visita", "Negociación", "En Seguimiento"

**Cómo usar:**
1. Haz clic en la pestaña "Estados Personalizados"
2. Haz clic en "Nuevo Estado"
3. Completa:
   - **Nombre**: Nombre del estado
   - **Color**: Color para identificarlo visualmente
   - **Descripción**: Descripción del estado
4. Guarda el estado

#### ⚙️ Automatizaciones
**¿Para qué sirve?**
- Define reglas que se ejecutan automáticamente
- Ejemplos:
  - Cuando un contacto cambia a "Interesado", enviar mensaje de seguimiento
  - Después de 3 días sin interacción, cambiar estado a "Seguimiento"
  - Cuando se detecta palabra "precio", enviar catálogo

**Cómo usar:**
1. Haz clic en la pestaña "Automatizaciones"
2. Haz clic en "Nueva Automatización"
3. Configura:
   - **Condición**: Cuándo se debe ejecutar
     - Cambio de estado
     - Mensaje recibido con palabras clave
     - Días sin interacción
   - **Acción**: Qué hacer
     - Enviar mensaje
     - Cambiar estado
     - Enviar notificación
4. Activa la automatización
5. Guarda

---

## ⚙️ Configuración {#configuración}

**Descripción:** Configura aspectos generales del bot, conexión de WhatsApp y ajustes del sistema.

### Pestañas

#### 🏠 General
**¿Para qué sirve?**
- Configuración básica del bot

**Campos:**
- **Nombre del Bot**: Nombre que verán los usuarios al chatear
- **Emoji del Bot**: Emoji que aparecerá junto al nombre (ej: 🌱)
- **Delay de Respuesta (ms)**: Tiempo de espera antes de responder (simula tiempo humano)
  - Ejemplo: 10000ms = 10 segundos

**Cómo usar:**
1. Ve a Configuración → Pestaña "General"
2. Modifica los valores necesarios
3. Haz clic en "Guardar Configuración"

#### 🏢 Negocio
**¿Para qué sirve?**
- Información de tu empresa para que el bot la comparta

**Campos:**
- **Nombre del Negocio**
- **Descripción**
- **Teléfono**
- **Email**
- **Dirección**
- **Horarios de Atención**
- **Redes Sociales**: Facebook, Instagram, TikTok
- **Teléfono del Agente**: Número donde recibir notificaciones

#### 💬 Mensajes
**¿Para qué sirve?**
- Personaliza mensajes automáticos del bot

**Campos:**
- **Mensaje de Bienvenida**: Mensaje cuando alguien escribe por primera vez
- **Mensaje de Pausa**: Mensaje cuando el bot se pausa para atención humana

#### 💰 Pagos
**¿Para qué sirve?**
- Información de métodos de pago

**Campos:**
- **Información Bancaria**: Datos para transferencias
- **Email de PayPal**: Para pagos por PayPal

#### 📱 WhatsApp
**¿Para qué sirve?**
- Gestiona la conexión de WhatsApp

**Funcionalidades:**
- **Estado de Conexión**: Verifica si WhatsApp está conectado
- **Método de Conexión**: 
  - **QR Code**: Escanea el código QR con tu teléfono
  - **Pairing Code**: Ingresa el código de 8 dígitos en WhatsApp
- **Gestión de Instancia**:
  - **Crear Instancia**: Crea una nueva instancia de WhatsApp
  - **Eliminar Instancia**: Borra la instancia actual (útil si se traba)
  - **Reiniciar Instancia**: Reinicia la conexión
- **Contactos Pausados**: Botón "Despausar Todos" para reactivar todos los contactos

**Cómo usar:**
1. Ve a Configuración → Pestaña "WhatsApp"
2. Si no está conectado, escanea el QR o ingresa el pairing code
3. Verifica el estado de conexión
4. Usa las herramientas de emergencia si hay problemas

#### 🔐 Seguridad
**¿Para qué sirve?**
- Cambiar tu contraseña personal

**Cómo usar:**
1. Ve a Configuración → Pestaña "Seguridad"
2. Ingresa tu contraseña actual
3. Ingresa la nueva contraseña dos veces
4. Guarda los cambios

---

## 🧠 Monitor IA {#monitor-ia}

**Descripción:** Monitorea el uso de tokens, costos y rendimiento de la inteligencia artificial.

### Secciones

#### 📊 Estadísticas Generales
**¿Para qué sirve?**
- Vista general del rendimiento de la IA

**Métricas:**
- **Modelo Activo**: Qué modelo de IA está siendo usado actualmente
- **Total Requests**: Total de peticiones a la IA
- **Total Errores**: Cantidad de errores
- **Tasa de Éxito**: Porcentaje de peticiones exitosas

#### 💾 Estadísticas de Caché
**¿Para qué sirve?**
- Muestra cuánto estás ahorrando con el sistema de caché

**Métricas:**
- **Tasa de Caché**: Porcentaje de respuestas servidas desde caché
- **Entradas Cache**: Cuántas respuestas están almacenadas
- **API Calls Ahorradas**: Peticiones que no se hicieron gracias al caché
- **Ahorro Estimado**: Dinero ahorrado en llamadas a la API

#### 📋 Estado de los Modelos
**¿Para qué sirve?**
- Ver el estado de cada modelo de IA configurado

**Información mostrada:**
- Modelo (Gemini, GPT-4o, etc.)
- Estado (Disponible, Agotado, Error)
- API Key configurada
- Requests y errores por modelo
- Tasa de éxito
- Tiempo de respuesta

#### ⚙️ Configuración de Inteligencia Artificial
**¿Para qué sirve?**
- Personaliza cómo funciona la IA del bot

**Campos:**
- **Modelo de IA**: Selecciona qué modelo usar
  - Gemini 2.0 Flash (recomendado)
  - GPT-4o Mini
  - GPT-4o
- **Prompt del Sistema**: Instrucciones personalizadas que seguirá la IA
  - Déjalo vacío para usar el prompt predeterminado
  - Útil para personalizar el comportamiento del bot
- **Perfil de Vendedor**:
  - **Personalidad**: 
    - 🧠 Experto: Profesional y capacitado
    - 😊 Amigable: Cercano y genera confianza
    - 👔 Formal: Corporativo y profesional
    - 💪 Persuasivo: Experto en técnicas de cierre
  - **¿Puede ofrecer descuentos?**: Sí/No
  - **Descuento Máximo (%)**: Si está habilitado, porcentaje máximo
  - **Condiciones para Descuentos**: Reglas específicas sobre cuándo ofrecer descuentos

**Cómo usar:**
1. Ve a Monitor IA
2. Modifica la configuración de IA según tus necesidades
3. Haz clic en "Guardar Configuración de IA"
4. Los cambios se aplicarán en las próximas respuestas del bot

#### 🔧 Herramientas
**Botones disponibles:**
- **Resetear Estadísticas**: Reinicia todas las métricas
- **Probar Conexión**: Verifica que las API Keys funcionan
- **Limpiar Caché**: Borra todas las respuestas almacenadas
- **Exportar Estadísticas**: Descarga un reporte en formato JSON

---

## 📖 Guía de Uso {#guía-de-uso}

**Descripción:** Esta misma guía de uso completa del CRM.

Muestra la documentación completa con instrucciones detalladas de cada sección.

---

## 🔧 Solución de Problemas {#solución-de-problemas}

### Contactos antiguos no aparecen
**Solución:**
1. Ve a Contactos
2. Haz clic en "Importar Conversaciones Antiguas"
3. Espera a que termine la importación
4. Los contactos deberían aparecer

### Productos no se muestran
**Solución:**
1. Verifica que Google Sheets esté configurado (variables de entorno)
2. Ve a Productos → "Sincronizar desde Google Sheets"
3. Verifica que la hoja tenga las columnas correctas: Producto, Descripción, Precio
4. Si no funciona, crea productos manualmente con "Nuevo Producto"

### Campañas no se envían
**Solución:**
1. Verifica que WhatsApp esté conectado (Configuración → WhatsApp)
2. Revisa los logs del servidor para errores
3. Asegúrate de que los contactos no estén pausados
4. Verifica que la campaña esté activa

### Bot no responde
**Solución:**
1. Verifica que Evolution API esté funcionando (Configuración → WhatsApp)
2. Revisa que las API Keys de IA estén configuradas
3. Ve a Monitor IA para ver si hay errores
4. Verifica el "Modelo Activo" en Monitor IA

### WhatsApp no se conecta
**Solución:**
1. Ve a Configuración → WhatsApp
2. Usa "Eliminar Instancia" si está trabada
3. Luego "Crear Instancia" para crear una nueva
4. Escanea el nuevo QR o ingresa el pairing code
5. Si persiste, revisa las variables de entorno `EVOLUTION_URL` y `EVOLUTION_APIKEY`

### Verificar el Sistema Completo
Ejecuta el health check para verificar todo:
```bash
npm run health-check
```

Este comando verificará:
- Variables de entorno
- Base de datos
- Evolution API
- API Keys de IA
- Google Sheets
- Sistemas de asesorías, productos y campañas

---

**MüllBot** - *Agente de ventas inteligente que transforma residuos en vida* 🌱✨

**Última actualización:** Enero 2026
