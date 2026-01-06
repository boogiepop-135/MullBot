# 🚀 Activar Evolution API - Guía Rápida

## ✅ Migración Completa Implementada

He migrado completamente el código para usar **Evolution API** cuando esté activado. El código detecta automáticamente si usar Evolution API o whatsapp-web.js según la configuración.

## 📋 Pasos para Activar (5 minutos)

### Paso 1: Agregar variables de entorno

En tu `.env` o en Railway, agrega:

```env
# Activar Evolution API
USE_EVOLUTION_API=true

# URL de Evolution API (en Docker, usar el nombre del servicio)
EVOLUTION_API_URL=http://evolution-api:8080

# API Key (puede ser cualquier string seguro)
EVOLUTION_API_KEY=mullbot-evolution-key-2025

# Nombre de la instancia (opcional)
EVOLUTION_INSTANCE_NAME=mullbot
```

**Si estás en Railway o servidor local:**
- `EVOLUTION_API_URL=http://evolution-api:8080` (dentro de Docker)
- `EVOLUTION_API_URL=http://localhost:8080` (si accedes desde fuera de Docker)

### Paso 2: Evolution API ya está en docker-compose.yml

El servicio `evolution-api` ya está configurado en `docker-compose.yml` y listo para usar. Solo necesitas iniciarlo:

```bash
docker compose up -d evolution-api
```

### Paso 3: Reiniciar la aplicación

```bash
docker compose restart app
```

O si estás reconstruyendo:

```bash
docker compose up -d --build
```

## 🎯 ¿Qué cambia?

**Antes (whatsapp-web.js):**
- ❌ Problemas frecuentes con QR
- ❌ Desconexiones constantes
- ❌ Sesiones corruptas

**Ahora (Evolution API):**
- ✅ QR más confiable y estable
- ✅ Menos desconexiones
- ✅ Mejor manejo de sesiones
- ✅ API REST profesional

## 🔍 Verificar que funciona

1. **Revisa los logs:**
```bash
docker compose logs -f app
```

Deberías ver:
```
🚀 Evolution API habilitado - usando Evolution API en lugar de whatsapp-web.js
Evolution API Service initialized - URL: http://evolution-api:8080, Instance: mullbot
✅ Evolution API instance created
```

2. **Revisa el panel de admin:**
   - Ve a la pestaña "WhatsApp"
   - Deberías ver el QR generado por Evolution API
   - El QR debería aparecer más rápido y ser más estable

## 🆘 Solución de Problemas

### Error: "Cannot connect to Evolution API"

**Solución:** Verifica que Evolution API esté corriendo:
```bash
docker compose ps
docker compose logs evolution-api
```

### Error: "Instance already exists"

**Solución:** Esto es normal si ya creaste la instancia antes. El código lo maneja automáticamente.

### QR no aparece

**Solución:** 
1. Desvincula WhatsApp desde el panel
2. Espera 5-10 segundos
3. El QR debería aparecer automáticamente

## 🔄 Volver a whatsapp-web.js

Si quieres volver a whatsapp-web.js (no recomendado):

1. Cambia en `.env`:
```env
USE_EVOLUTION_API=false
```

2. Reinicia:
```bash
docker compose restart app
```

## 📊 Comparación

| Característica | whatsapp-web.js | Evolution API |
|---|---|---|
| **Estabilidad** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **QR** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Sesiones** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Producción** | ⭐⭐ | ⭐⭐⭐⭐⭐ |

## ✅ Listo!

Una vez activado, Evolution API se usará automáticamente. El código detecta `USE_EVOLUTION_API=true` y cambia el comportamiento automáticamente.

**No necesitas cambiar nada más en el código** - todo está implementado y funcionando.

