# 🌱 Mullbot - Agente de Ventas Inteligente para WhatsApp

Mullbot es un agente de ventas experto especializado en WhatsApp que utiliza la API de Gemini de Google para ayudar a las personas a adquirir el compostero fermentador Mullbot. Nuestro asistente virtual proporciona información experta sobre productos, maneja objeciones y guía a los clientes hasta cerrar la venta.

## ✨ Características Principales

- **🌱 Agente de Ventas Experto**: Especializado en compostero fermentador de 15L
- **🤖 Inteligencia Artificial Avanzada**: Utiliza Gemini AI para respuestas contextuales y orientadas a ventas
- **📱 Comandos Especializados**: Comandos específicos para productos, precios, guías y métodos de pago
- **🎯 Seguimiento de Leads**: Sistema de puntuación y seguimiento de clientes potenciales
- **🗣️ Comandos de Voz**: Procesamiento de audio con speech-to-text
- **🔊 Respuestas de Voz**: Text-to-speech para respuestas en audio
- **🌍 Multilingüe**: Soporte completo para múltiples idiomas
- **🔄 Traducción Automática**: Traducción instantánea entre idiomas
- **🌐 Panel de Administración**: Interfaz web para gestión y estadísticas

## 🚀 Instalación y Configuración

### Prerrequisitos

- **Node.js** (versión 16 o superior)
- **MongoDB** (local o en la nube)
- **Google Chrome** instalado
- **API Key de Gemini** (gratuita)

### 1. Instalación

```bash
# Clonar el repositorio
git clone <tu-repositorio>
cd mullbot

# Instalar dependencias
npm install

# Configurar variables de entorno
cp mullbot.env.example .env
```

### 2. Configuración de Variables de Entorno

Edita el archivo `.env` con tus configuraciones:

```env
# API Key de Gemini (OBLIGATORIO)
GEMINI_API_KEY=tu_api_key_de_gemini_aqui

# Ruta de Chrome (ajusta según tu sistema operativo)
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# Configuración básica
ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/mullbot
JWT_SECRET=tu_jwt_secret_muy_seguro_minimo_32_caracteres_aqui
```

### 3. Obtener API Key de Gemini

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en "Create API Key"
4. Copia la key generada
5. Pégala en tu archivo `.env`

### 4. Ejecutar Mullbot

```bash
# Modo desarrollo (con recarga automática)
npm run dev

# Modo producción
npm start
```

## 🐳 Docker - MVP Local (Recomendado)

### ⚡ Inicio Rápido en 3 pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/boogiepop-135/MullBot.git
cd MullBot

# 2. Levantar servicios con Docker Compose
docker compose up -d --build

# 3. Acceder a la aplicación
# Abre: http://localhost:3000/admin
# Credenciales: admin / admin123
```

### 🚀 Script de inicio rápido

```bash
# Ejecutar script de inicio automático
./start.sh
```

### ✅ Verificar estado

```bash
# Verificar que todo funciona
./verify.sh
```

### 📋 Servicios incluidos

- **MullBot App** - Puerto 3000 (Panel de administración)
- **MongoDB** - Base de datos incluida y configurada
- **Ngrok** - Túnel público HTTPS (Dashboard en puerto 4040)

### 🔐 Credenciales por defecto

- **Usuario admin:** `admin`
- **Contraseña:** `admin123`
- ⚠️ **IMPORTANTE:** Cambia la contraseña después del primer login

### 📚 Documentación completa

Para más detalles sobre la configuración MVP, consulta:
- **[README_MVP.md](README_MVP.md)** - Guía completa MVP con todos los detalles
- **[SETUP_DOCKER.md](SETUP_DOCKER.md)** - Configuración detallada de Docker
- **[SETUP_NGROK.md](SETUP_NGROK.md)** - Configuración de Ngrok
- **[CREDENCIALES.md](CREDENCIALES.md)** - Información de credenciales

### 🛠️ Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f app

# Ver estado de servicios
docker compose ps

# Reiniciar servicios
docker compose restart

# Detener servicios
docker compose down

# Reconstruir y reiniciar
docker compose up -d --build
```

## 📊 Google Sheets - Catálogo de Productos en Tiempo Real

Mullbot puede leer tu catálogo de productos directamente desde Google Sheets, permitiendo actualizar precios y productos sin reiniciar el bot.

### ✨ Características

- 📈 **Actualización en tiempo real**: Modifica precios sin reiniciar
- 👥 **Colaborativo**: Múltiples personas pueden editar el catálogo
- 💰 **Precios con descuento**: Muestra ofertas especiales automáticamente
- 📦 **Control de disponibilidad**: Oculta productos agotados
- 🔄 **Fallback automático**: Si falla, usa catálogo estático

### 🚀 Configuración Rápida

1. **Crea tu hoja** con estas columnas:
   ```
   Producto | Descripción | Precio | Precio con descuento | Imagen Link | Disponibilidad
   ```

2. **Obtén API Key** de [Google Cloud Console](https://console.cloud.google.com/)
   - Habilita "Google Sheets API"
   - Crea una API Key

3. **Configura variables de entorno** en tu `.env`:
   ```env
   GOOGLE_SHEETS_API_KEY=tu_api_key_aqui
   GOOGLE_SHEETS_SPREADSHEET_ID=1ABC123xyz456DEF789
   GOOGLE_SHEETS_RANGE=CatálogoProductosWhatsapp!A:F
   ```

4. **Haz tu hoja pública** (Compartir → Cualquiera con el enlace → Lector)

5. **Reinicia el bot** y ¡listo! 🎉

### 📚 Documentación Completa

Para instrucciones detalladas, consulta: **[GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md)**

## 📱 Comandos del Agente de Ventas

### Comandos Especializados en Ventas

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/productos` | Información completa del compostero fermentador 15L | `/productos` |
| `/precios` | Precios, métodos de pago y garantías | `/precios` |
| `/guia` | Guía completa de uso del compostero | `/guia` |
| `/contacto` | Información de contacto y canales de atención | `/contacto` |
| `/pago` | Métodos de pago detallados | `/pago` |

### Comandos Generales

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/chat [mensaje]` | Chatea con el agente de ventas | `/chat ¿Cuánto cuesta el compostero?` |
| `/help` | Muestra todos los comandos disponibles | `/help` |
| `/ping` | Verifica si Mullbot está funcionando | `/ping` |

### Comandos de Administración

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/estadisticas` | Estadísticas de ventas y leads | `/estadisticas` |

## 🎯 Características del Agente de Ventas

### Conocimiento Especializado
- **Producto**: Compostero fermentador de 15L
- **Precio**: $1,490 MXN (antes $1,890)
- **Incluye**: Compostero + Biocatalizador + Envío gratis
- **Proceso**: 4 pasos simples (depositar, espolvorear, compactar, tapar)
- **Tiempo**: 4-6 semanas para llenar, 2 semanas de fermentación

### Manejo de Objeciones
- **Precio**: Destaca valor, acompañamiento incluido, garantía
- **Tamaño**: Dimensiones compactas (30x30x40 cm)
- **Olor**: Sistema hermético, biocatalizador elimina olores
- **Espacio**: Diseñado para espacios pequeños

### Métodos de Pago
- **Transferencia Bancaria**: Banco Azteca, Cuenta: 127180013756372173
- **Tarjetas**: 3 meses sin intereses via Mercado Pago
- **Enlace**: https://mpago.li/1W2JhS5

### Seguimiento de Leads
- Sistema de puntuación automática
- Detección de intenciones de compra
- Estadísticas de conversión
- Seguimiento de interacciones

## 🔧 APIs Opcionales

Para funcionalidades adicionales, puedes configurar:

```env
# Para comandos de clima
OPENWEATHERMAP_API_KEY=tu_api_key

# Para text-to-speech
SPEECHIFY_API_KEY=tu_api_key

# Para speech-to-text
ASSEMBLYAI_API_KEY=tu_api_key
```

## 🌐 Panel de Administración

- **Web**: Accede en `http://localhost:3000/admin`
- **Desktop App**: Aplicación de escritorio disponible (ver [DESKTOP_APP.md](DESKTOP_APP.md))
- Gestión de usuarios y configuraciones
- Monitoreo del estado del bot
- Estadísticas de ventas y leads

## 🖥️ Aplicación de Escritorio

MullBot ahora incluye una aplicación de escritorio para Windows, Linux y macOS.

### Inicio Rápido

```bash
cd desktop
npm install
npm start
```

### Construir para Producción

```bash
# Linux
npm run build:linux

# Windows
npm run build:win

# macOS
npm run build:mac
```

Para más detalles, consulta [DESKTOP_APP.md](DESKTOP_APP.md)

## 🛠️ Solución de Problemas

### Error de API Key
```
Environment variable GEMINI_API_KEY is missing
```
**Solución**: Verifica que tu API key de Gemini esté correctamente configurada en `.env`

### Error de Chrome
```
PUPPETEER_EXECUTABLE_PATH is missing
```
**Solución**: Instala Google Chrome y actualiza la ruta en `.env`

### Error de MongoDB
```
MONGODB_URI is missing
```
**Solución**: Instala MongoDB y configura la URI de conexión

### Error de Conexión
```
Error comunicándose con Mullbot
```
**Solución**: Verifica tu conexión a internet y la validez de tu API key

## 📊 Monitoreo y Logs

Mullbot genera logs detallados para:
- Interacciones de ventas
- Puntuación de leads
- Objeciones manejadas
- Conversiones realizadas
- Errores de API

## 🔒 Seguridad

- Todas las comunicaciones están cifradas
- Las API keys se almacenan de forma segura
- No se almacenan mensajes personales
- Cumple con las políticas de WhatsApp

## 🤝 Contribuir

¿Quieres contribuir a Mullbot? ¡Excelente!

1. Fork el repositorio
2. Crea una rama para tu feature
3. Haz commit de tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles.

## 🆘 Soporte

¿Necesitas ayuda? Contacta con nosotros:
- 📱 WhatsApp: +52 56 6453 1621
- 📧 Email: mullblue.residuos@gmail.com
- 📘 Facebook: Composta fácil con Müllblue
- 📸 Instagram: @mullblue.oficial

---

**Mullbot** - *Agente de ventas inteligente que transforma residuos en vida* 🌱✨