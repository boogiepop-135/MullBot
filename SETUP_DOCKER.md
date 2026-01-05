# 🐳 Guía de Configuración para Docker Local

## ✅ Lo que ya está configurado

- ✅ Dockerfile optimizado
- ✅ docker-compose.yml con MongoDB incluido
- ✅ Variables de entorno básicas en docker-compose.yml
- ✅ .dockerignore para optimizar builds

## 🔴 Lo que FALTA para ejecutar el proyecto

### 1. **Archivo `.env` con variables de entorno**

Necesitas crear un archivo `.env` en la raíz del proyecto con las siguientes variables **OBLIGATORIAS**:

```env
# API Key de Gemini (OBLIGATORIA)
# Obtén tu API key en: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=tu_api_key_de_gemini_aqui

# JWT Secret para autenticación (OBLIGATORIA)
# Genera un string aleatorio seguro (mínimo 32 caracteres)
JWT_SECRET=tu_jwt_secret_muy_seguro_minimo_32_caracteres
```

### 2. **Obtener API Key de Gemini**

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en "Create API Key"
4. Copia la key generada
5. Pégala en tu archivo `.env`

### 3. **Generar JWT Secret**

Puedes generar un JWT secret seguro usando cualquiera de estos métodos:

**Opción A - Usando Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Opción B - Usando OpenSSL:**
```bash
openssl rand -hex 32
```

**Opción C - Usando un generador online:**
- Visita: https://generate-secret.vercel.app/32

## 🚀 Pasos para ejecutar el proyecto

### Paso 1: Crear el archivo `.env`

```bash
# En la raíz del proyecto
cat > .env << EOF
GEMINI_API_KEY=tu_api_key_aqui
JWT_SECRET=tu_jwt_secret_aqui
EOF
```

### Paso 2: Construir y ejecutar con Docker Compose

```bash
# Construir las imágenes y levantar los servicios
docker-compose up -d --build

# Ver los logs en tiempo real
docker-compose logs -f app
```

### Paso 3: Verificar que todo funciona

1. **Verificar que los contenedores están corriendo:**
   ```bash
   docker-compose ps
   ```

2. **Verificar los logs de la aplicación:**
   ```bash
   docker-compose logs app
   ```

3. **Acceder al panel de administración:**
   - Abre tu navegador en: http://localhost:3000/admin

## 📋 Variables de entorno completas

### Variables OBLIGATORIAS (ya configuradas en docker-compose.yml o necesitas agregarlas)

| Variable | Estado | Descripción |
|----------|--------|-------------|
| `GEMINI_API_KEY` | ⚠️ **FALTA** | API Key de Google Gemini (obtener en Google AI Studio) |
| `JWT_SECRET` | ⚠️ **FALTA** | Secret para JWT (generar string aleatorio de 32+ caracteres) |
| `ENV` | ✅ Configurada | Ya está en docker-compose.yml como `production` |
| `PORT` | ✅ Configurada | Ya está en docker-compose.yml como `3000` |
| `MONGODB_URI` | ✅ Configurada | Ya está en docker-compose.yml apuntando al contenedor mongo |
| `PUPPETEER_EXECUTABLE_PATH` | ✅ Configurada | Ya está en docker-compose.yml como `/usr/bin/chromium` |
| `NODE_ENV` | ✅ Configurada | Ya está en docker-compose.yml como `production` |

### Variables OPCIONALES (para funcionalidades adicionales)

Estas variables NO son necesarias para el funcionamiento básico, pero habilitan funcionalidades adicionales:

```env
# Para usar Claude AI como fallback
ANTHROPIC_API_KEY=tu_api_key_de_anthropic

# Para comandos de clima
OPENWEATHERMAP_API_KEY=tu_api_key_de_openweathermap

# Para text-to-speech (respuestas de voz)
SPEECHIFY_API_KEY=tu_api_key_de_speechify

# Para speech-to-text (comandos de voz)
ASSEMBLYAI_API_KEY=tu_api_key_de_assemblyai

# URL base de la API (opcional, tiene valor por defecto)
API_BASE_URL=https://mullbot-production.up.railway.app
```

## 🔍 Solución de problemas

### Error: "GEMINI_API_KEY is missing"
**Solución:** Asegúrate de haber creado el archivo `.env` con tu API key de Gemini.

### Error: "JWT_SECRET is missing"
**Solución:** Agrega un JWT_SECRET en tu archivo `.env` (mínimo 32 caracteres).

### Error: "MONGODB_URI is missing"
**Solución:** Verifica que el servicio `mongo` esté corriendo:
```bash
docker-compose ps mongo
```

### Error de conexión a MongoDB
**Solución:** Espera unos segundos a que MongoDB se inicialice completamente:
```bash
docker-compose logs mongo
```

### Los contenedores no inician
**Solución:** Verifica que el puerto 3000 no esté en uso:
```bash
# En Linux/Mac
lsof -i :3000

# Si está en uso, detén el proceso o cambia el puerto en docker-compose.yml
```

## 📝 Comandos útiles

```bash
# Detener los servicios
docker-compose down

# Detener y eliminar volúmenes (borra la base de datos)
docker-compose down -v

# Reconstruir sin cache
docker-compose build --no-cache

# Ver logs de un servicio específico
docker-compose logs -f app
docker-compose logs -f mongo

# Ejecutar comandos dentro del contenedor
docker-compose exec app sh

# Reiniciar un servicio específico
docker-compose restart app
```

## ✅ Checklist final

Antes de ejecutar, verifica que tengas:

- [ ] Archivo `.env` creado en la raíz del proyecto
- [ ] `GEMINI_API_KEY` configurada en `.env`
- [ ] `JWT_SECRET` configurado en `.env` (mínimo 32 caracteres)
- [ ] Docker y Docker Compose instalados
- [ ] Puerto 3000 disponible

Una vez completado el checklist, ejecuta:
```bash
docker-compose up -d --build
```
