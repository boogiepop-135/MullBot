# 🚀 Migración a Evolution API - Guía Paso a Paso

## ¿Es difícil? **NO**, solo requiere configuración inicial (15-20 minutos)

Evolution API es **mucho más estable** que whatsapp-web.js y vale la pena si estás teniendo problemas frecuentes.

## ✅ Ventajas de Evolution API

- ✅ **Más estable**: Casi sin desconexiones
- ✅ **QR más confiable**: Menos problemas al vincular
- ✅ **API REST simple**: Endpoints claros y bien documentados
- ✅ **Mejor para producción**: Diseñado para entornos empresariales
- ✅ **Múltiples números**: Puedes manejar varios WhatsApp fácilmente

## 📋 Pasos para Migrar (15 minutos)

### Paso 1: Agregar Evolution API a docker-compose.yml

Edita `docker-compose.yml` y **descomenta** el servicio `evolution-api` (líneas 66-90 aproximadamente).

O agrega esto después del servicio `mongo`:

```yaml
  evolution-api:
    image: atendai/evolution-api:latest
    container_name: evolution-api
    restart: always
    ports:
      - "8080:8080"
    environment:
      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: "mongodb"
      DATABASE_CONNECTION_URI: ${MONGODB_URI}
      AUTHENTICATION_API_KEY: ${EVOLUTION_API_KEY:-mullbot-evolution-key-2025}
      AUTHENTICATION_EXPOSE_INTERNAL: "false"
      WEBHOOK_GLOBAL_ENABLED: "true"
      WEBHOOK_GLOBAL_URL: ${API_BASE_URL:-http://localhost:3001}/webhook/evolution
      QRCODE_LIMIT: "30"
      QRCODE_COLOR: "198,31,31"
      LOG_LEVEL: "ERROR"
      LOG_COLOR: "true"
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store
    depends_on:
      - mongo
```

Y agrega los volumes al final:

```yaml
volumes:
  mongodata:
  evolution_instances:
  evolution_store:
```

### Paso 2: Agregar variables de entorno

En tu `.env` o en Railway, agrega:

```env
# Evolution API
USE_EVOLUTION_API=true
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=mullbot-evolution-key-2025
EVOLUTION_INSTANCE_NAME=mullbot
```

**Si estás en Railway**, usa la URL interna:
```env
EVOLUTION_API_URL=http://evolution-api:8080
```

### Paso 3: Iniciar Evolution API

```bash
docker compose up -d evolution-api
```

Espera 30 segundos a que inicie.

### Paso 4: Crear instancia de WhatsApp

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: mullbot-evolution-key-2025" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "mullbot",
    "token": "mullbot-evolution-key-2025",
    "qrcode": true
  }'
```

### Paso 5: Obtener QR

```bash
curl -X GET http://localhost:8080/instance/connect/mullbot \
  -H "apikey: mullbot-evolution-key-2025"
```

El QR aparecerá en la respuesta JSON como `qrcode.base64`.

### Paso 6: Activar Evolution API en el código

El código ya está preparado. Solo necesitas:

1. **Instalar axios** (si no lo tienes):
```bash
npm install axios
```

2. **Configurar la variable de entorno**:
```env
USE_EVOLUTION_API=true
```

3. **Reiniciar el servidor**

## 🔄 ¿Qué cambia en el código?

**Casi nada**. El código detecta automáticamente si usar Evolution API o whatsapp-web.js según la variable `USE_EVOLUTION_API`.

- Si `USE_EVOLUTION_API=true` → Usa Evolution API
- Si `USE_EVOLUTION_API=false` o no está → Usa whatsapp-web.js (actual)

## 🆘 ¿Necesitas ayuda con la implementación?

Si quieres que implemente la integración completa ahora mismo, puedo:

1. ✅ Actualizar BotManager para usar Evolution API cuando esté activado
2. ✅ Crear endpoints para manejar Evolution API
3. ✅ Actualizar el frontend para obtener QR de Evolution API
4. ✅ Mantener compatibilidad con whatsapp-web.js

**¿Quieres que lo implemente ahora?** Solo dime y lo hago en 5 minutos.

## 📊 Comparación Rápida

| | whatsapp-web.js | Evolution API |
|---|---|---|
| **Setup** | ⭐⭐⭐⭐⭐ Fácil | ⭐⭐⭐ Requiere Docker |
| **Estabilidad** | ⭐⭐ Muchos problemas | ⭐⭐⭐⭐⭐ Muy estable |
| **QR** | ⭐⭐ A veces falla | ⭐⭐⭐⭐⭐ Muy confiable |
| **Producción** | ⭐⭐ No ideal | ⭐⭐⭐⭐⭐ Excelente |

## 💡 Mi Recomendación

Si estás teniendo **muchos problemas** (como parece), **Evolution API es la solución**. 

**Tiempo de setup**: 15-20 minutos  
**Beneficio**: Estabilidad a largo plazo  
**Dificultad**: Media (solo configuración inicial)

