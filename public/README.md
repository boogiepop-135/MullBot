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

**Descripción:** Gestiona tu catálogo de productos y kits, sincroniza con Google Sheets y organiza por categorías.

### Vista Principal

#### 📑 Pestañas de Filtrado
**¿Para qué sirve?**
- Organiza tus productos por categoría para facilitar la gestión
- Filtra entre productos individuales y kits

**Pestañas disponibles:**
- **Todos**: Muestra todos los productos y kits
- **Productos**: Solo productos individuales
- **Kits**: Solo kits (productos combinados o paquetes)

**Cómo usar:**
1. Haz clic en la pestaña que quieres ver
2. La lista se filtrará automáticamente
3. Puedes cambiar entre pestañas en cualquier momento

#### 🔄 Sincronizar desde Google Sheets
**¿Para qué sirve?**
- Importa productos desde tu hoja de Google Sheets
- Actualiza precios y productos sin editar manualmente
- Sincroniza el catálogo completo desde la hoja
- **Nota**: Los cambios manuales pueden ser sobrescritos por la sincronización automática

**Cómo usar:**
1. Asegúrate de tener Google Sheets configurado (variables de entorno)
2. Haz clic en "Sincronizar desde Google Sheets"
3. El sistema importará los productos automáticamente
4. Los productos aparecerán en la lista
5. Recibirás notificaciones si hay cambios de precio o productos nuevos

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
   - **Categoría**: Selecciona entre "Producto", "Kit" u "Otro"
   - **Imagen**: URL de la imagen del producto
   - **En Stock**: Si el producto está disponible
3. Guarda el producto
4. **Nota**: Los cambios de precio o creación de productos notificarán automáticamente al agente

### Vista de Productos (Tarjetas)

Cada producto se muestra en una tarjeta con:

- **Imagen**: Foto del producto (o ícono por defecto)
- **Nombre**: Nombre del producto
- **Descripción**: Descripción truncada (máximo 3 líneas)
- **Precio**: Precio destacado en verde
- **Estado**: Badge "En Stock" o "Agotado"
- **Categoría**: Badge con la categoría (Producto, Kit, Otro)

#### ✏️ Editar Producto
**¿Para qué sirve?**
- Modifica un producto existente
- Actualiza precio, descripción, imagen, categoría, etc.
- **Nota**: Los cambios de precio notificarán automáticamente al agente

**Cómo usar:**
1. Haz clic en el botón de editar (ícono de lápiz) en la tarjeta
2. Modifica los campos necesarios
3. Puedes cambiar la categoría entre Producto, Kit u Otro
4. Guarda los cambios

#### 🗑️ Eliminar Producto
**¿Para qué sirve?**
- Elimina un producto del catálogo
- Útil para productos que ya no vendes
- **Nota**: La eliminación notificará automáticamente al agente

**Cómo usar:**
1. Haz clic en el botón de eliminar (ícono de basura)
2. Confirma la eliminación
3. El producto se eliminará permanentemente

### Notificaciones Automáticas

El sistema envía notificaciones automáticas al agente cuando:
- Se crea un nuevo producto
- Se elimina un producto
- Cambia el precio de un producto
- Se sincroniza desde Google Sheets con cambios

Estas notificaciones aparecen en WhatsApp del agente configurado.

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

**Descripción:** Edita las respuestas automáticas, comandos y mensajes predefinidos del bot. Organizado por categorías para facilitar la gestión.

### Vista Principal

#### 📑 Pestañas de Categorías
**¿Para qué sirve?**
- Organiza el contenido del bot por tipo para facilitar la gestión
- Filtra entre respuestas rápidas, comandos y otros contenidos

**Pestañas disponibles:**
- **Respuestas Rápidas**: Mensajes automáticos que el bot usa en conversaciones (ej: menú principal, opciones, etc.)
- **Comandos**: Respuestas a comandos específicos como `/precios`, `/productos`, etc.
- **Otros**: Contenido adicional que no encaja en las otras categorías

**Cómo usar:**
1. Haz clic en la pestaña que quieres ver
2. La lista se filtrará automáticamente
3. Puedes cambiar entre pestañas en cualquier momento

#### 🎯 Plantillas Predefinidas
**¿Para qué sirve?**
- Crea contenido nuevo rápidamente usando plantillas predefinidas
- Ahorra tiempo al crear respuestas comunes
- Incluye ejemplos de respuestas rápidas y comandos comunes

**Cómo usar:**
1. Haz clic en "Nuevo Contenido"
2. Selecciona una plantilla del menú desplegable (opcional)
3. Los campos se llenarán automáticamente con datos de ejemplo
4. Personaliza el contenido según tus necesidades
5. Guarda

**Plantillas disponibles:**
- Menú principal
- Respuesta sobre precios
- Respuesta sobre productos
- Catálogo disponible
- Y más...

#### ➕ Nuevo Contenido
**¿Para qué sirve?**
- Crea nuevas respuestas o comandos personalizados
- Útil para agregar funcionalidades específicas al bot

**Cómo usar:**
1. Haz clic en "Nuevo Contenido"
2. Completa el formulario:
   - **Clave (Key)**: Identificador único (ej: `main_menu`, `option_2_price`)
   - **Categoría**: Selecciona entre Respuesta Rápida, Comando u Otro
   - **Descripción**: Descripción breve del contenido
   - **Contenido**: El mensaje que enviará el bot
   - **Plantilla (Opcional)**: Selecciona una plantilla para pre-llenar campos
3. Guarda el contenido

#### 📝 Editar Contenido Existente
**¿Para qué sirve?**
- Modifica respuestas existentes del bot
- Actualiza mensajes sin crear nuevos contenidos
- Personaliza comandos y respuestas rápidas

**Cómo usar:**
1. Haz clic en el contenido que quieres editar
2. Se abrirá el modal de edición
3. Modifica el contenido del mensaje
4. Opcionalmente, actualiza la ruta de imagen
5. Guarda los cambios

#### 🖼️ Asociar Media
**¿Para qué sirve?**
- Agrega imágenes o archivos a las respuestas del bot
- Por ejemplo, una imagen de catálogo con el comando `/precios`
- El bot enviará el archivo junto con el mensaje

**Cómo usar:**
1. Al editar un contenido, ingresa la ruta de la imagen en "Ruta de Imagen"
2. Ejemplo: `public/precio.png` o `public/info.png`
3. El bot enviará el archivo junto con el mensaje
4. Guarda los cambios

#### 🔄 Inicializar Predeterminados
**¿Para qué sirve?**
- Crea un conjunto básico de respuestas y comandos si no tienes contenido configurado
- Útil para empezar rápidamente o restaurar contenido básico
- Incluye: menú principal, respuestas sobre precios, catálogo, etc.

**Cómo usar:**
1. Haz clic en "Inicializar Predeterminados"
2. Se crearán los contenidos básicos automáticamente
3. Puedes editarlos después según tus necesidades

### Comandos Disponibles

El bot reconoce los siguientes comandos (puedes personalizar sus respuestas):

- `/precios` - Muestra el catálogo de productos con precios
- `/productos` - Información sobre productos disponibles
- `/guia` - Guía de uso del producto
- `/contacto` - Información de contacto
- `/pago` - Métodos de pago disponibles
- `/tarjeta` - Información sobre pago con tarjeta
- `/help` - Muestra ayuda y comandos disponibles
- `/chat` - Inicia conversación con el bot

**Nota**: Para personalizar la respuesta de un comando, crea un contenido con la clave `command_[nombre]`, por ejemplo: `command_precios` para personalizar `/precios`.

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
- Configuración básica del bot y comportamiento

**Campos:**
- **Nombre del Bot**: Nombre que verán los usuarios al chatear (ej: "MüllBlue")
- **Emoji del Bot**: Emoji que aparecerá junto al nombre (ej: 🌱)
- **Delay de Respuesta (ms)**: Tiempo de espera antes de responder (simula tiempo humano)
  - Ejemplo: 10000ms = 10 segundos
  - Recomendado: Entre 5000ms (5s) y 15000ms (15s)
  - Valores muy bajos pueden parecer robóticos
  - Valores muy altos pueden frustrar a los usuarios

**Cómo usar:**
1. Ve a Configuración → Pestaña "General"
2. Modifica los valores necesarios
3. Haz clic en "Guardar Configuración"
4. Los cambios se aplicarán inmediatamente

**Nota**: El prompt del sistema y perfil de vendedor se configuran en Monitor IA, no aquí.

#### 🏢 Negocio
**¿Para qué sirve?**
- Información de tu empresa para que el bot la comparta
- Datos de contacto y redes sociales

**Campos:**
- **Nombre del Negocio**: Nombre oficial de tu empresa
- **Descripción**: Descripción breve del negocio
- **Teléfono**: Teléfono de contacto principal
- **Email**: Email de contacto
- **Dirección**: Dirección física (opcional)
- **Horarios de Atención**: Horarios en que está disponible el equipo
- **Redes Sociales**: 
  - Facebook
  - Instagram
  - TikTok
- **Teléfono del Agente**: Número donde recibir notificaciones de cambios importantes
  - Recibirá notificaciones cuando:
    - Se crea o elimina un producto
    - Cambia el precio de un producto
    - Un cliente solicita atención humana

#### 💬 Mensajes
**¿Para qué sirve?**
- Personaliza mensajes automáticos del bot

**Campos:**
- **Mensaje de Bienvenida**: Mensaje cuando alguien escribe por primera vez
- **Mensaje de Pausa**: Mensaje cuando el bot se pausa para atención humana

#### 💰 Pagos
**¿Para qué sirve?**
- Información de métodos de pago
- Datos bancarios y enlaces de pago

**Campos:**
- **Información Bancaria**: Datos para transferencias
  - Número de cuenta
  - CLABE
  - Nombre del titular
- **Email de PayPal**: Para pagos por PayPal
- **Link de Mercado Pago**: Enlace para pagos con tarjeta

**Nota**: Esta información se mostrará cuando los clientes pregunten por métodos de pago.

#### 📱 WhatsApp
**¿Para qué sirve?**
- Gestiona la conexión de WhatsApp
- Herramientas de diagnóstico y solución de problemas

**Funcionalidades:**

**Estado de Conexión:**
- Muestra si WhatsApp está conectado o desconectado
- Actualiza automáticamente cada pocos segundos
- Indicadores visuales: Verde (conectado), Rojo (desconectado)

**Método de Conexión:**
- **QR Code**: Escanea el código QR con tu teléfono
  1. Haz clic en "Mostrar QR"
  2. Abre WhatsApp en tu teléfono
  3. Ve a Configuración → Dispositivos vinculados → Vincular dispositivo
  4. Escanea el código QR
  5. Espera a que se conecte (puede tardar unos segundos)
  
- **Pairing Code**: Ingresa el código de 8 dígitos en WhatsApp
  1. Haz clic en "Generar Pairing Code"
  2. Abre WhatsApp en tu teléfono
  3. Ve a Configuración → Dispositivos vinculados → Vincular dispositivo
  4. Selecciona "Vincular con código de emparejamiento"
  5. Ingresa el código de 8 dígitos mostrado

**Gestión de Instancia:**
- **Crear Instancia**: Crea una nueva instancia de WhatsApp
  - Útil si la instancia actual está corrupta o no funciona
  - Nota: Tendrás que escanear el QR nuevamente
  
- **Eliminar Instancia**: Borra la instancia actual
  - Útil si se traba o hay problemas de conexión
  - Nota: Tendrás que crear una nueva instancia después
  
- **Reiniciar Instancia**: Reinicia la conexión sin eliminar
  - Útil para resolver problemas temporales
  - Mantiene la sesión activa

**Contactos Pausados:**
- **Despausar Todos**: Reactiva todos los contactos pausados
  - Útil después de una campaña o atención masiva
  - El bot volverá a responder automáticamente a todos

**Cómo usar:**
1. Ve a Configuración → Pestaña "WhatsApp"
2. Si no está conectado, escanea el QR o ingresa el pairing code
3. Verifica el estado de conexión
4. Usa las herramientas de emergencia si hay problemas
5. Si nada funciona, elimina la instancia y crea una nueva

**Solución de Problemas:**
- Si el QR no aparece: Espera unos segundos y recarga la página
- Si el QR expira: Se generará uno nuevo automáticamente
- Si no se conecta: Usa "Eliminar Instancia" y luego "Crear Instancia"
- Si persiste: Verifica las variables de entorno `EVOLUTION_URL` y `EVOLUTION_APIKEY`

#### 🔐 Seguridad
**¿Para qué sirve?**
- Cambiar tu contraseña personal
- Gestionar tu cuenta de administrador

**Cómo usar:**
1. Ve a Configuración → Pestaña "Seguridad"
2. Ingresa tu contraseña actual
3. Ingresa la nueva contraseña dos veces (para confirmar)
4. Guarda los cambios
5. La próxima vez que inicies sesión, usa la nueva contraseña

**Recomendaciones de Seguridad:**
- Usa una contraseña fuerte (mínimo 8 caracteres, con mayúsculas, minúsculas, números y símbolos)
- No compartas tu contraseña con nadie
- Cambia tu contraseña regularmente
- Si sospechas que tu cuenta fue comprometida, cambia la contraseña inmediatamente

---

## 🧠 Monitor IA {#monitor-ia}

**Descripción:** Monitorea el uso de tokens, costos y rendimiento de la inteligencia artificial. Configura el modelo, prompt del sistema y perfil de vendedor.

### Secciones

#### 📊 Estadísticas Generales
**¿Para qué sirve?**
- Vista general del rendimiento de la IA
- Monitorea el uso y costos en tiempo real

**Métricas:**
- **Modelo Activo**: Qué modelo de IA está siendo usado actualmente (Gemini, Claude, etc.)
- **Total Requests**: Total de peticiones a la IA desde el inicio
- **Total Errores**: Cantidad de errores encontrados
- **Tasa de Éxito**: Porcentaje de peticiones exitosas (debe ser >95% para buen rendimiento)

#### 💾 Estadísticas de Caché
**¿Para qué sirve?**
- Muestra cuánto estás ahorrando con el sistema de caché
- El caché evita llamadas repetidas a la API, reduciendo costos

**Métricas:**
- **Tasa de Caché**: Porcentaje de respuestas servidas desde caché (idealmente >30%)
- **Entradas Cache**: Cuántas respuestas están almacenadas
- **API Calls Ahorradas**: Peticiones que no se hicieron gracias al caché
- **Ahorro Estimado**: Dinero ahorrado en llamadas a la API

#### 📋 Estado de los Modelos
**¿Para qué sirve?**
- Ver el estado de cada modelo de IA configurado
- Identificar modelos con problemas o agotados
- Monitorear rendimiento individual de cada modelo

**Información mostrada:**
- **Modelo**: Nombre del modelo (Gemini 2.0 Flash, Claude, etc.)
- **Estado**: Disponible, Agotado, Error, o Activo (marcado con ⭐)
- **API Key**: Etiqueta de la API Key configurada (GEMINI_API_KEY, ANTHROPIC_API_KEY, etc.)
- **Requests**: Total de peticiones realizadas con este modelo
- **Errores**: Cantidad de errores
- **Tasa de Éxito**: Porcentaje de éxito
- **Tiempo Promedio**: Tiempo de respuesta promedio en milisegundos

#### ⚙️ Configuración de Inteligencia Artificial
**¿Para qué sirve?**
- Personaliza cómo funciona la IA del bot
- Define el comportamiento y personalidad del vendedor
- Configura el prompt del sistema para respuestas personalizadas

**Campos:**

**Modelo de IA:**
- Selecciona qué modelo usar como primario
- Opciones: Gemini 2.0 Flash (recomendado), GPT-4o Mini, GPT-4o, Claude
- El sistema usará automáticamente modelos de respaldo si el primario falla

**Prompt del Sistema:**
- Instrucciones personalizadas que seguirá la IA
- Déjalo vacío para usar el prompt predeterminado optimizado para ventas
- Útil para personalizar el comportamiento del bot
- **Ejemplo**: "Sé más directo y conciso" o "Enfócate en beneficios ambientales"

**Perfil de Vendedor:**

- **Personalidad**: 
  - 🧠 **Experto**: Profesional y capacitado, responde con conocimiento técnico
  - 😊 **Amigable**: Cercano y genera confianza, usa lenguaje casual
  - 👔 **Formal**: Corporativo y profesional, lenguaje más estructurado
  - 💪 **Persuasivo**: Experto en técnicas de cierre, enfocado en convertir

- **¿Puede ofrecer descuentos?**: Sí/No
  - Si está habilitado, el bot puede ofrecer descuentos automáticamente
  - Si está deshabilitado, el bot nunca mencionará descuentos

- **Descuento Máximo (%)**: Si los descuentos están habilitados, porcentaje máximo que puede ofrecer
  - Ejemplo: Si es 10%, el bot puede ofrecer hasta 10% de descuento

- **Condiciones para Descuentos**: Reglas específicas sobre cuándo ofrecer descuentos
  - Ejemplo: "Solo ofrecer descuento si el cliente menciona precio alto"
  - Ejemplo: "Ofrecer 5% en primera compra, 10% en compras mayores a $2000"

**Cómo usar:**
1. Ve a Monitor IA
2. Revisa las estadísticas para entender el rendimiento actual
3. Modifica la configuración de IA según tus necesidades
4. Haz clic en "Guardar Configuración de IA"
5. Los cambios se aplicarán en las próximas respuestas del bot

**Mejores Prácticas:**
- Monitorea la tasa de éxito regularmente (debe ser >95%)
- Si un modelo tiene muchos errores, considera cambiarlo
- Usa el caché para reducir costos en preguntas frecuentes
- Personaliza el prompt según tu audiencia y producto
- Ajusta la personalidad según tu marca y clientes objetivo

#### 🔧 Herramientas
**Botones disponibles:**

- **Resetear Estadísticas**: Reinicia todas las métricas (requests, errores, etc.)
  - Útil para empezar un nuevo período de medición
  - No afecta la configuración ni el caché

- **Probar Conexión**: Verifica que las API Keys funcionan correctamente
  - Prueba cada modelo configurado
  - Muestra errores si hay problemas de conexión o autenticación

- **Limpiar Caché**: Borra todas las respuestas almacenadas en caché
  - Útil si quieres forzar respuestas frescas
  - Nota: Esto aumentará temporalmente los costos de API

- **Exportar Estadísticas**: Descarga un reporte en formato JSON
  - Incluye todas las métricas y estado de modelos
  - Útil para análisis externos o reportes

---

## 📖 Guía de Uso {#guía-de-uso}

**Descripción:** Esta misma guía de uso completa del CRM.

Muestra la documentación completa con instrucciones detalladas de cada sección del panel de administración. Puedes navegar usando el índice al inicio del documento o hacer clic en los enlaces de cada sección.

**Cómo usar:**
1. Haz clic en "Guía de Uso" en el menú lateral
2. Navega por las secciones usando el índice
3. O busca información específica usando Ctrl+F (Cmd+F en Mac)
4. Puedes abrir la guía en una nueva pestaña haciendo clic en "Abrir en Nueva Pestaña"

---

## 🔧 Solución de Problemas {#solución-de-problemas}

### Contactos antiguos no aparecen
**Solución:**
1. Ve a Contactos
2. Haz clic en "Importar Conversaciones Antiguas"
3. Espera a que termine la importación (puede tardar varios minutos)
4. Los contactos deberían aparecer automáticamente

**Nota:** La importación trae hasta 50 mensajes por chat para no sobrecargar la base de datos.

### Productos no se muestran
**Solución:**
1. Verifica que Google Sheets esté configurado (variables de entorno)
2. Ve a Productos → "Sincronizar desde Google Sheets"
3. Verifica que la hoja tenga las columnas correctas: Producto, Descripción, Precio, Precio con descuento, Imagen Link, Disponibilidad
4. Si no funciona, crea productos manualmente con "Nuevo Producto"
5. Verifica que los productos tengan `inStock: true` para que aparezcan

### Campañas no se envían
**Solución:**
1. Verifica que WhatsApp esté conectado (Configuración → WhatsApp)
2. Revisa los logs del servidor para errores
3. Asegúrate de que los contactos no estén pausados
4. Verifica que la campaña esté activa y programada correctamente
5. Si usas envío por lotes, verifica que el tamaño del lote sea adecuado (recomendado: 10-50 contactos por lote)

### Bot no responde
**Solución:**
1. Verifica que Evolution API esté funcionando (Configuración → WhatsApp)
2. Revisa que las API Keys de IA estén configuradas (Monitor IA)
3. Ve a Monitor IA para ver si hay errores en los modelos
4. Verifica el "Modelo Activo" en Monitor IA
5. Si todos los modelos están agotados, configura nuevas API Keys
6. Verifica que el bot no esté pausado para ese contacto específico

### WhatsApp no se conecta
**Solución:**
1. Ve a Configuración → WhatsApp
2. Usa "Eliminar Instancia" si está trabada
3. Luego "Crear Instancia" para crear una nueva
4. Escanea el nuevo QR o ingresa el pairing code
5. Si persiste, revisa las variables de entorno `EVOLUTION_URL` y `EVOLUTION_APIKEY`
6. Verifica que Evolution API esté corriendo y accesible

### Precios no se actualizan en el bot
**Solución:**
1. Verifica que los productos estén actualizados en la base de datos (Productos)
2. El bot siempre obtiene precios frescos desde la base de datos (sin caché)
3. Si cambias un precio, el bot debería usar el nuevo precio inmediatamente
4. Verifica que el producto tenga `inStock: true`
5. Si el bot sigue mostrando precios antiguos, verifica el prompt del sistema (Monitor IA) - no debe tener precios hardcodeados

### Contenido del bot no se actualiza
**Solución:**
1. Verifica que guardaste los cambios en Contenido Bot
2. El bot usa el contenido desde la base de datos en tiempo real
3. Si creaste un nuevo contenido, verifica que la clave (key) sea correcta
4. Para comandos, usa el formato `command_[nombre]`, ej: `command_precios`
5. Recarga la página y verifica que el contenido aparezca en la lista

### Verificar el Sistema Completo
Ejecuta el health check para verificar todo:
```bash
npm run health-check
```

Este comando verificará:
- Variables de entorno
- Base de datos (PostgreSQL)
- Evolution API (conexión y estado)
- API Keys de IA (Gemini, Claude)
- Google Sheets (si está configurado)
- Sistemas de asesorías, productos y campañas

---

## 💡 Mejores Prácticas para Bots de Ventas

Basado en las mejores prácticas de la industria para bots de ventas en WhatsApp (2025):

### Calificación de Leads
- **Automatiza la calificación**: El bot pregunta automáticamente sobre necesidades, presupuesto y timeline
- **Lead Scoring**: El sistema asigna puntuaciones basadas en respuestas e interacciones
- **Routing Inteligente**: Los leads calificados se enrutan automáticamente a asesores

### Engagement y Conversión
- **Respuesta Rápida**: WhatsApp tiene tasas de apertura del 90-98% vs 20-40% de email
- **Personalización**: Usa variables como `{{nombre}}` en mensajes para personalizar
- **Mensajes Contextuales**: El bot recuerda conversaciones anteriores y contexto

### Automatización del Funnel
- **Captura de Leads**: Múltiples puntos de entrada (QR codes, formularios, campañas)
- **Nurturing Automático**: Seguimiento automático según el estado del lead
- **Cierre de Ventas**: El bot puede procesar pedidos y enviar enlaces de pago directamente

### Métricas Clave
- **Tasa de Respuesta**: Monitorea cuántos contactos responden
- **Tiempo de Respuesta**: El bot responde en segundos (vs horas/días de email)
- **Tasa de Conversión**: De lead a venta
- **Costo por Lead**: Eficiencia de tus campañas

### Optimización Continua
- **A/B Testing**: Prueba diferentes mensajes y flujos
- **Análisis de Conversaciones**: Revisa qué funciona mejor
- **Iteración Basada en Datos**: Mejora basada en métricas reales

---

**MüllBot** - *Agente de ventas inteligente que transforma residuos en vida* 🌱✨

**Última actualización:** Enero 2026
