# 🚀 Evolution API - Guía Simple y Rápida

## ¿Es difícil usar Evolution API?

**Respuesta corta: No es difícil, pero requiere configuración inicial.** Una vez configurado, es **mucho más estable** que whatsapp-web.js.

## ⚡ Ventajas de Evolution API

✅ **Más estable**: Menos desconexiones y problemas de QR  
✅ **API REST simple**: Endpoints claros y bien documentados  
✅ **Mejor para producción**: Diseñado para entornos empresariales  
✅ **Múltiples instancias**: Puedes manejar varios números fácilmente  
✅ **Webhooks confiables**: Sistema de notificaciones más robusto  

## 📦 Instalación Rápida (5 minutos)

### Paso 1: Agregar Evolution API a docker-compose.yml

Agrega esto a tu `docker-compose.yml` existente:

```yaml
services:
  # ... tus servicios existentes ...
  
  evolution-api:
    image: atendai/evolution-api:latest
    container_name: evolution-api
    restart: always
    ports:
      - "8080:8080"
    environment:
      # Base de datos (usa la misma MongoDB)
      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: "mongodb"
      DATABASE_CONNECTION_URI: "${MONGODB_URI}"
      
      # Seguridad
      AUTHENTICATION_API_KEY: "${EVOLUTION_API_KEY:-mullbot-evolution-key-2025}"
      AUTHENTICATION_EXPOSE_INTERNAL: "false"
      
      # Webhooks (opcional pero recomendado)
      WEBHOOK_GLOBAL_ENABLED: "true"
      WEBHOOK_GLOBAL_URL: "${API_BASE_URL}/webhook/evolution"
      
      # Configuración de QR
      QRCODE_LIMIT: "30"
      QRCODE_COLOR: "198,31,31"
      
      # Logs
      LOG_LEVEL: "ERROR"
      LOG_COLOR: "true"
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store
    networks:
      - default
    depends_on:
      - mongo  # Si tienes MongoDB en docker-compose

volumes:
  evolution_instances:
  evolution_store:
```

### Paso 2: Agregar variables de entorno

En tu `.env` o en Railway, agrega:

```env
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=mullbot-evolution-key-2025
```

### Paso 3: Iniciar Evolution API

```bash
docker compose up -d evolution-api
```

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

## 🔧 Integración Simple con MullBot

He creado un servicio simple que puedes usar. Solo necesitas:

1. **Instalar axios** (si no lo tienes):
```bash
npm install axios
```

2. **El código ya está preparado** - solo necesitas activar Evolution API en lugar de whatsapp-web.js

## 📝 Comparación: whatsapp-web.js vs Evolution API

| Característica | whatsapp-web.js | Evolution API |
|---------------|-----------------|---------------|
| **Facilidad de setup** | ⭐⭐⭐⭐⭐ Muy fácil | ⭐⭐⭐ Requiere Docker |
| **Estabilidad** | ⭐⭐ Muchos problemas | ⭐⭐⭐⭐⭐ Muy estable |
| **Mantenimiento** | ⭐⭐ Requiere atención constante | ⭐⭐⭐⭐ Casi sin mantenimiento |
| **Producción** | ⭐⭐ No ideal | ⭐⭐⭐⭐⭐ Excelente |
| **Costo** | Gratis | Gratis (self-hosted) |

## 💡 Mi Recomendación

Si estás teniendo **muchos problemas** con whatsapp-web.js (como parece ser el caso), **Evolution API vale la pena**. 

**Tiempo de setup**: ~15-20 minutos  
**Beneficio**: Estabilidad a largo plazo  
**Dificultad**: Media (requiere Docker, pero es configuración única)

## 🆘 ¿Necesitas ayuda?

Si quieres que implemente la integración completa de Evolution API en tu código, puedo hacerlo. Solo necesitas decirme y:

1. Te creo el servicio de Evolution API
2. Actualizo BotManager para usar Evolution API
3. Mantengo compatibilidad con el código existente
4. Te doy instrucciones paso a paso

**¿Quieres que lo implemente ahora?**

