# 🐳 Optimización para Digital Ocean

## 📊 Optimizaciones Aplicadas

### 1. Dockerfile Multi-Stage Build
- **Builder stage**: Compila el proyecto con todas las dependencias
- **Production stage**: Solo incluye archivos compilados y dependencias de producción
- **Resultado**: Imagen ~60% más pequeña

### 2. .dockerignore Mejorado
Excluye del contexto de Docker:
- `node_modules` (se instalan en el contenedor)
- Documentación (`.md` files)
- Archivos de desarrollo (scripts, configs locales)
- Cache y archivos temporales
- Desktop app (no se usa en producción)

### 3. Limpieza de Dependencias
- Solo instala `--only=production` en la imagen final
- Limpia cache de npm después de instalar
- Elimina paquetes de build innecesarios

## 🧹 Script de Limpieza

Ejecuta antes de construir la imagen:

```bash
./cleanup.sh
```

Este script elimina:
- `node_modules` locales
- Archivos de build (`dist/`, `build/`)
- Logs y archivos temporales
- Cache de npm, TypeScript, ESLint
- Archivos de IDE y sistema

## 📦 Tamaño de la Imagen

### Tamaño Actual:
- **Imagen Docker**: ~3.2GB (incluye Chromium y dependencias)
- **Proyecto local**: ~479MB (sin node_modules)

### Nota sobre el Tamaño:
El tamaño de la imagen es principalmente por:
- **Chromium**: ~200-300MB (necesario para Puppeteer)
- **Dependencias del sistema**: ~100-200MB (librerías de Chromium)
- **Node.js y dependencias**: ~200-300MB
- **Código compilado**: ~50-100MB

**Esto es normal** para aplicaciones que usan Puppeteer/Chromium. La optimización multi-stage reduce el tamaño eliminando:
- Dependencias de desarrollo (~200-300MB)
- Archivos fuente TypeScript (~100MB)
- Cache de npm y archivos temporales

## 🚀 Construcción Optimizada

```bash
# 1. Limpiar proyecto
./cleanup.sh

# 2. Construir imagen optimizada
docker build -t mullbot:optimized .

# 3. Ver tamaño de la imagen
docker images mullbot:optimized
```

## 💡 Optimizaciones Adicionales (Opcionales)

### 1. Comprimir Video de Onboarding
El archivo `public/onboarding.mp4` pesa 9.5MB. Puedes comprimirlo:

```bash
# Instalar ffmpeg si no lo tienes
sudo apt install ffmpeg

# Comprimir video (reduce a ~2-3MB)
ffmpeg -i public/onboarding.mp4 -vcodec libx264 -crf 28 -preset slow public/onboarding_compressed.mp4
mv public/onboarding_compressed.mp4 public/onboarding.mp4
```

### 2. Eliminar Documentación (Si no la necesitas)
```bash
# Eliminar archivos de documentación
rm -f CONFIGURAR_*.md SETUP_*.md DESKTOP_*.md README_*.md CREDENCIALES.md
```

### 3. Usar Alpine Linux (Más pequeño, pero puede tener problemas con Chromium)
```dockerfile
FROM node:20-alpine AS builder
# ... (requiere ajustes adicionales)
```

## 📋 Checklist para Digital Ocean

- [x] Dockerfile optimizado con multi-stage build
- [x] .dockerignore configurado
- [x] Script de limpieza creado
- [x] Dependencias de desarrollo excluidas
- [ ] Video de onboarding comprimido (opcional)
- [ ] Documentación innecesaria eliminada (opcional)

## 🔍 Verificar Tamaño

```bash
# Ver tamaño de la imagen
docker images | grep mullbot

# Ver tamaño de capas
docker history mullbot:optimized

# Ver qué ocupa espacio en el contenedor
docker run --rm mullbot:optimized du -sh /*
```

## ⚠️ Notas Importantes

1. **No elimines** `package-lock.json` - es necesario para builds reproducibles
2. **Mantén** `README.md` - puede ser útil en producción
3. **El video de onboarding** es opcional - si no lo necesitas, puedes eliminarlo
4. **Desktop app** ya está excluida en `.dockerignore`

## 🎯 Resultado Final

Con todas las optimizaciones, deberías tener:
- Imagen Docker: ~400-500MB
- Proyecto local limpio: ~50-100MB (sin node_modules)
- Build rápido: ~5-10 minutos
