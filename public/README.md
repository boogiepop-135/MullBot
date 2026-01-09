# 📖 Guía de Uso del CRM MüllBot

Esta guía explica cómo utilizar todas las funcionalidades del panel de administración del CRM.

## 📑 Índice

- [🏠 Dashboard](#dashboard)
- [📇 Contactos](#contactos)
- [🎧 Asesorías](#asesorías)
- [📢 Campañas](#campañas)
- [📝 Plantillas](#plantillas)
- [📦 Productos](#productos)
- [🤖 Contenido Bot](#contenido-bot)
- [✨ Automatizaciones](#automatizaciones)
- [⚙️ Configuración](#configuración)
- [🧠 Monitor IA](#monitor-ia)
- [📞 Soporte](#soporte)

---

## 🏠 Dashboard {#dashboard}

El Dashboard es la pantalla principal del CRM y muestra una vista general de todas tus métricas y estadísticas.

### Funcionalidades

- **Estadísticas de Contactos**: Contador de contactos por estado (Leads, Interesados, Completados, etc.)
- **Estadísticas de Campañas**: Total de campañas y mensajes enviados
- **Gráficos de Intenciones**: Visualización de las intenciones detectadas por el bot
- **Contactos Recientes**: Lista de los últimos contactos que han interactuado
- **Top Leads**: Los contactos más prometedores basados en puntuación

### Uso

Accede automáticamente al Dashboard al iniciar sesión. Todas las estadísticas se actualizan en tiempo real.

---

## 📇 Contactos {#contactos}

Gestiona todos tus contactos, cambia estados y chatea directamente con ellos.

### Funcionalidades

- **Lista de Contactos**: Vista completa de todos tus contactos con filtros y búsqueda
- **Cambiar Estado**: Actualiza el estado de venta de cada contacto
- **Chat Directo**: Envía mensajes a contactos directamente desde el panel
- **Historial de Conversación**: Ve todos los mensajes intercambiados con cada contacto
- **Importar Conversaciones Antiguas**: Importa contactos y mensajes desde Evolution API
- **Importar/Exportar XLSX**: Importa contactos desde Excel o exporta tu lista actual

### Cómo Usar

1. **Ver Contactos**: Haz clic en "Contactos" en el menú lateral
2. **Buscar**: Usa el campo de búsqueda para encontrar contactos por nombre o teléfono
3. **Filtrar por Estado**: Selecciona un estado de venta en el filtro superior
4. **Cambiar Estado**: Haz clic en el estado actual del contacto y selecciona el nuevo estado
5. **Chat**: Haz clic en el ícono de chat para abrir una conversación
6. **Importar Conversaciones**: Haz clic en "Importar Conversaciones Antiguas" para traer chats desde WhatsApp

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

Sistema de cola para atención humana. Cuando un cliente solicita hablar con un asesor, aparece aquí.

### Funcionalidades

- **Cola de Solicitudes**: Lista de clientes esperando atención humana
- **Chat Integrado**: Chatea directamente con el cliente desde el panel
- **Respuestas Rápidas**: Botones con respuestas predefinidas
- **Resumen de Conversación**: Vista breve del contexto antes de atender
- **Finalizar/Expulsar**: Completa o cancela la asesoría

### Cómo Usar

1. **Ver Solicitudes**: Haz clic en "Asesorías" en el menú lateral
2. **Atender Cliente**: Haz clic en una solicitud de la cola para abrir el chat
3. **Usar Respuestas Rápidas**: Haz clic en los botones de respuestas rápidas para enviar mensajes comunes
4. **Finalizar**: Cuando termines, haz clic en "Finalizar Exitosa" o "Expulsar"

### Notificaciones

Recibirás un sonido cuando llegue una nueva solicitud de asesoría.

---

## 📢 Campañas {#campañas}

Crea y programa campañas masivas de mensajería a tus contactos.

### Funcionalidades

- **Crear Campaña**: Define mensaje, destinatarios y fecha de envío
- **Programar Envío**: Programa campañas para enviarse en el futuro
- **Estadísticas**: Ve cuántos mensajes se enviaron y cuántos fallaron
- **Historial**: Revisa todas tus campañas pasadas y programadas

### Cómo Usar

1. **Crear Campaña**: Haz clic en "Nueva Campaña"
2. **Seleccionar Contactos**: Elige los destinatarios por estado o selección manual
3. **Escribir Mensaje**: Escribe el mensaje que quieres enviar
4. **Programar**: Elige si enviar ahora o programar para más tarde
5. **Enviar**: Haz clic en "Crear Campaña" para iniciar

---

## 📝 Plantillas {#plantillas}

Guarda y reutiliza mensajes predefinidos para respuestas rápidas.

### Funcionalidades

- **Crear Plantilla**: Guarda mensajes frecuentes
- **Usar en Chat**: Inserta plantillas directamente en el chat
- **Copiar al Portapapeles**: Copia plantillas para usar en otros lugares
- **Editar/Eliminar**: Modifica o elimina plantillas existentes

### Cómo Usar

1. **Crear**: Haz clic en "Nueva Plantilla"
2. **Escribir**: Escribe el mensaje que quieres guardar
3. **Guardar**: Dale un nombre descriptivo y guarda
4. **Usar**: Haz clic en una plantilla para usarla en el chat activo

---

## 📦 Productos {#productos}

Gestiona tu catálogo de productos y sincroniza con Google Sheets.

### Funcionalidades

- **Ver Productos**: Lista todos tus productos en formato de tarjetas
- **Crear Producto**: Agrega nuevos productos manualmente
- **Editar/Eliminar**: Modifica o elimina productos
- **Sincronizar desde Google Sheets**: Importa productos desde tu hoja de Google Sheets
- **Sincronizar a Google Sheets**: Exporta productos de la BD a Google Sheets

### Cómo Usar

1. **Ver Productos**: Haz clic en "Productos" en el menú lateral
2. **Crear**: Haz clic en "Nuevo Producto" para agregar uno manualmente
3. **Sincronizar desde Sheets**: Haz clic en "Sincronizar desde Google Sheets" para importar
4. **Editar**: Haz clic en el botón de editar en la tarjeta del producto
5. **Eliminar**: Haz clic en el botón de eliminar (confirmará antes de borrar)

### Sincronización con Google Sheets

El bot puede leer productos directamente desde Google Sheets para mantener precios actualizados en tiempo real. Configura las variables de entorno `GOOGLE_SHEETS_API_KEY` y `GOOGLE_SHEETS_SPREADSHEET_ID`.

---

## 🤖 Contenido Bot {#contenido-bot}

Edita las respuestas automáticas y mensajes predefinidos del bot.

### Funcionalidades

- **Comandos del Bot**: Edita las respuestas a comandos como `/precios`, `/productos`, etc.
- **Mensajes del Sistema**: Personaliza mensajes de bienvenida, pausa, etc.
- **Media**: Asocia imágenes o archivos a las respuestas

### Cómo Usar

1. **Ver Contenido**: Haz clic en "Contenido Bot"
2. **Editar**: Haz clic en el contenido que quieres modificar
3. **Guardar**: Guarda los cambios para que el bot los use

---

## ✨ Automatizaciones {#automatizaciones}

Crea reglas automáticas que se ejecutan cuando ocurren eventos.

### Funcionalidades

- **Estados Personalizados**: Crea nuevos estados de venta además de los predeterminados
- **Automatizaciones**: Define reglas que se ejecutan automáticamente
  - Cuando cambia el estado de un contacto
  - Cuando se recibe un mensaje con ciertas palabras
  - Cuando un contacto alcanza cierta puntuación

### Cómo Usar

1. **Ver Automatizaciones**: Haz clic en "Automatizaciones"
2. **Nuevo Estado**: Crea estados personalizados para clasificar mejor tus contactos
3. **Nueva Automatización**: Define una regla con condición y acción
4. **Activar/Desactivar**: Controla si las automatizaciones están activas

---

## ⚙️ Configuración {#configuración}

Configura aspectos generales del bot y la conexión de WhatsApp.

### Pestañas Disponibles

#### General
- **Nombre del Bot**: Nombre que verán los usuarios
- **Emoji del Bot**: Emoji que aparecerá junto al nombre
- **Delay de Respuesta**: Tiempo de espera antes de responder (simula tiempo humano)

#### Negocio
- Información de tu empresa (nombre, descripción, teléfono, email, dirección, horarios)
- Redes sociales (Facebook, Instagram, TikTok)
- Información del agente humano (teléfono para notificaciones)

#### Mensajes
- Mensaje de bienvenida
- Mensaje cuando se pausa el bot

#### Pagos
- Información bancaria
- Email de PayPal

#### WhatsApp
- **Estado de Conexión**: Verifica si WhatsApp está conectado
- **Método de Conexión**: QR Code o Pairing Code
- **Gestión de Instancia**: Crear, eliminar o reiniciar la instancia
- **Contactos Pausados**: Despausar todos los contactos de una vez

#### Seguridad
- Cambiar tu contraseña personal

### Cómo Usar

1. **Abrir Configuración**: Haz clic en "Configuración" en el menú lateral
2. **Seleccionar Pestaña**: Haz clic en la pestaña que quieres configurar
3. **Editar**: Modifica los valores que necesites
4. **Guardar**: Haz clic en "Guardar Configuración"

---

## 🧠 Monitor IA {#monitor-ia}

Monitorea el uso de tokens, costos y rendimiento de la inteligencia artificial.

### Funcionalidades

- **Estadísticas Generales**: Total de requests, errores, tasa de éxito
- **Estado de Modelos**: Ver qué modelos de IA están disponibles y su estado
- **Estadísticas de Caché**: Ver cuánto estás ahorrando con el caché
- **Configuración de IA**: 
  - Seleccionar modelo de IA (Gemini 2.0 Flash, GPT-4o Mini, GPT-4o)
  - Configurar prompt del sistema
  - Configurar perfil de vendedor (personalidad, descuentos)

### Cómo Usar

1. **Ver Monitor**: Haz clic en "Monitor IA" en el menú lateral
2. **Revisar Estadísticas**: Ve las métricas en tiempo real
3. **Configurar IA**: Usa la sección "Configuración de Inteligencia Artificial" para personalizar el comportamiento del bot
4. **Guardar**: Haz clic en "Guardar Configuración de IA" para aplicar cambios

### Perfil de Vendedor

- **Experto**: Profesional y capacitado
- **Amigable**: Cercano y genera confianza
- **Formal**: Corporativo y profesional
- **Persuasivo**: Experto en técnicas de cierre

---

## 📞 Soporte {#soporte}

### Verificar el Sistema

Ejecuta el health check para verificar que todo funciona correctamente:

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

### Problemas Comunes

#### Contactos antiguos no aparecen
- Usa el botón "Importar Conversaciones Antiguas" en la sección de Contactos
- Esto importará contactos y mensajes desde Evolution API

#### Productos no se muestran
- Verifica que Google Sheets esté configurado correctamente
- Usa "Sincronizar desde Google Sheets" para importar productos
- Verifica que la hoja tenga las columnas correctas: Producto, Descripción, Precio, etc.

#### Campañas no se envían
- Verifica que WhatsApp esté conectado
- Revisa los logs para ver errores específicos
- Asegúrate de que los contactos no estén pausados

#### Bot no responde
- Verifica que Evolution API esté funcionando en Configuración → WhatsApp
- Revisa que las API Keys de IA estén configuradas
- Verifica el Monitor IA para ver si hay errores

---

## 🆘 Ayuda Adicional

Para más información:
- Revisa los logs del servidor
- Consulta la documentación técnica en el repositorio
- Ejecuta el health check para diagnóstico

---

**MüllBot** - *Agente de ventas inteligente que transforma residuos en vida* 🌱✨
