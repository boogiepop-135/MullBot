# 🔐 Variables de Entorno - MullBot

Copia este contenido a tu archivo `.env` y completa con tus valores reales.

```env
# ================================
# MULLBOT - Configuración de Variables de Entorno
# ================================

# ================================
# CONFIGURACIÓN BÁSICA
# ================================
ENV=development
PORT=3001
NODE_ENV=development

# ================================
# INTELIGENCIA ARTIFICIAL - API KEYS
# ================================

# Gemini (Google AI) - REQUERIDO
# Obtener en: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=tu_gemini_api_key_aqui

# APIs adicionales de Gemini para rotación (opcional)
GEMINI_API_KEY_2=
GEMINI_API_KEY_3=

# Claude (Anthropic) - Opcional, para fallback
ANTHROPIC_API_KEY=

# ================================
# GOOGLE SHEETS - CATÁLOGO DE PRODUCTOS
# ================================

# API Key de Google Cloud Console - OPCIONAL
# Si se configura, el bot leerá el catálogo de productos desde Google Sheets en tiempo real
# Tutorial: https://developers.google.com/sheets/api/guides/authorizing#APIKey
GOOGLE_SHEETS_API_KEY=

# ID de tu hoja de cálculo (se obtiene de la URL)
# Ejemplo: https://docs.google.com/spreadsheets/d/1ABC123xyz.../edit
# El ID es: 1ABC123xyz...
GOOGLE_SHEETS_SPREADSHEET_ID=

# Rango de celdas a leer (incluye el nombre de la hoja)
# Formato: NombreHoja!RangoInicial:RangoFinal
# Ejemplo: CatálogoProductosWhatsapp!A1:F100
GOOGLE_SHEETS_RANGE=CatálogoProductosWhatsapp!A:F

# ================================
# BASE DE DATOS - PostgreSQL
# ================================

# URL de conexión a PostgreSQL - REQUERIDO
# Formato: postgresql://usuario:contraseña@host:puerto/nombre_bd?schema=public
DATABASE_URL=postgresql://evolution:evolutionpass@localhost:5432/mullbot_db?schema=public

# ================================
# EVOLUTION API - WhatsApp Multi-Dispositivo
# ================================

# URL de Evolution API - REQUERIDO
EVOLUTION_URL=http://localhost:8080

# API Key de Evolution - REQUERIDO
EVOLUTION_APIKEY=TuClaveSecretaChangeMe123

# Nombre de la instancia de WhatsApp
EVOLUTION_INSTANCE_NAME=mullbot-principal

# ================================
# SEGURIDAD
# ================================

# JWT Secret para autenticación - REQUERIDO
# Genera uno random en: https://generate-secret.vercel.app/32
JWT_SECRET=tu_jwt_secret_super_seguro_aqui

# Credenciales de Admin - Panel de control
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# ================================
# SERVIDOR PÚBLICO
# ================================

# URL pública de tu servidor (para webhooks)
# Ejemplo: https://tudominio.com o tu URL de ngrok
PUBLIC_URL=https://tudominio.com
API_BASE_URL=https://tudominio.com

# ================================
# APIs OPCIONALES
# ================================

# OpenWeatherMap - Para comandos de clima
OPENWEATHERMAP_API_KEY=

# Speechify - Text-to-Speech
SPEECHIFY_API_KEY=

# AssemblyAI - Speech-to-Text
ASSEMBLYAI_API_KEY=

# ================================
# CONFIGURACIÓN AVANZADA
# ================================

# Ruta al ejecutable de Chrome/Chromium (opcional, se detecta automáticamente)
PUPPETEER_EXECUTABLE_PATH=
```

## 📝 Notas Importantes

### Variables REQUERIDAS (el bot no funcionará sin estas):
- `GEMINI_API_KEY` - Para IA
- `ENV` - Entorno de ejecución
- `PORT` - Puerto del servidor
- `DATABASE_URL` - Conexión a PostgreSQL
- `JWT_SECRET` - Para autenticación
- `EVOLUTION_URL` - URL de Evolution API
- `EVOLUTION_APIKEY` - API key de Evolution

### Variables OPCIONALES (agregan funcionalidad extra):
- `GOOGLE_SHEETS_API_KEY` - Para catálogo en tiempo real
- `GOOGLE_SHEETS_SPREADSHEET_ID` - ID de tu hoja
- `GOOGLE_SHEETS_RANGE` - Rango de celdas
- `ANTHROPIC_API_KEY` - Fallback de IA
- `OPENWEATHERMAP_API_KEY` - Comandos de clima
- `SPEECHIFY_API_KEY` - Text-to-speech
- `ASSEMBLYAI_API_KEY` - Speech-to-text

## 🔒 Seguridad

1. **NUNCA** compartas tu archivo `.env`
2. El archivo `.env` ya está en `.gitignore`
3. No subas credenciales a Git
4. Cambia las contraseñas por defecto en producción
5. Genera JWT secrets seguros (mínimo 32 caracteres)

## 🆘 ¿Necesitas Ayuda?

- Para configurar Google Sheets, ve a: [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md)
- Para configurar Docker, ve a: [SETUP_DOCKER.md](SETUP_DOCKER.md)
- Revisa los logs del bot para ver errores detallados
