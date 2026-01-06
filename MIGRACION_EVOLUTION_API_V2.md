# 🚀 Migración Completa a Evolution API v2

## ✅ Migración Completada

El proyecto ha sido **completamente refactorizado** para usar **Evolution API v2** en lugar de `whatsapp-web.js`.

### Cambios Principales

1. **Eliminado `whatsapp-web.js`**: Ya no se usa Puppeteer ni Client de whatsapp-web.js
2. **Arquitectura basada en Webhooks**: El bot recibe mensajes mediante webhooks de Evolution API
3. **REST API para envío**: Los mensajes se envían mediante HTTP POST a Evolution API
4. **Inicialización automática**: La instancia se crea automáticamente si no existe

## 📋 Configuración Requerida

### Variables de Entorno

Agrega estas variables a tu `.env` o en Railway:

```env
# Evolution API v2 - Configuración principal
EVOLUTION_URL=http://evolution-api:8080
EVOLUTION_APIKEY=tu_api_key_segura_aqui
EVOLUTION_INSTANCE_NAME=mullbot-principal

# URL base de tu aplicación (para webhooks)
API_BASE_URL=https://tu-dominio.com
```

**Nota**: 
- `EVOLUTION_URL`: Dentro de Docker usa `http://evolution-api:8080`, desde fuera usa `http://localhost:8080`
- `EVOLUTION_APIKEY`: Debe coincidir con `AUTHENTICATION_API_KEY` en docker-compose.yml
- `EVOLUTION_INSTANCE_NAME`: Nombre único para tu instancia de WhatsApp

### Docker Compose

Evolution API ya está configurado en `docker-compose.yml`. Solo necesitas iniciarlo:

```bash
docker compose up -d evolution-api
```

## 🔧 Arquitectura Nueva

### Flujo de Mensajes

1. **Mensaje Entrante**:
   - WhatsApp → Evolution API
   - Evolution API → Webhook POST `/webhook/evolution`
   - BotManager procesa el mensaje
   - Bot responde usando Evolution API REST

2. **Mensaje Saliente**:
   - BotManager → `evolutionAPI.sendMessage(phone, text)`
   - HTTP POST a `/message/sendText/{instanceName}`
   - Evolution API → WhatsApp

### Archivos Principales

- **`src/bot.manager.ts`**: Gestión principal del bot (refactorizado)
- **`src/services/evolution-api-v2.service.ts`**: Servicio para comunicación con Evolution API
- **`src/api/webhook.api.ts`**: Handler de webhooks de Evolution API
- **`src/types/evolution-api.types.ts`**: Tipos TypeScript para Evolution API

## 🚀 Inicio Rápido

### 1. Configurar Variables de Entorno

```env
EVOLUTION_URL=http://evolution-api:8080
EVOLUTION_APIKEY=mullbot-evolution-key-2025
EVOLUTION_INSTANCE_NAME=mullbot-principal
API_BASE_URL=http://localhost:3001
```

### 2. Iniciar Evolution API

```bash
docker compose up -d evolution-api
```

### 3. Iniciar la Aplicación

```bash
docker compose up -d --build
```

### 4. Verificar Webhook

El webhook debe estar configurado en Evolution API:
- URL: `{API_BASE_URL}/webhook/evolution`
- Eventos: `messages.upsert`, `connection.update`, `qrcode.updated`

## 📡 Endpoints

### Webhook (Evolution API → Bot)
- `POST /webhook/evolution` - Recibe eventos de Evolution API

### API (Frontend → Bot)
- `GET /qr` - Obtener código QR
- `GET /health` - Estado de conexión
- `POST /crm/whatsapp/logout` - Desvincular WhatsApp

## 🔍 Verificación

### 1. Verificar que Evolution API está corriendo

```bash
docker compose ps evolution-api
docker compose logs evolution-api
```

### 2. Verificar que la instancia se creó

```bash
curl -X GET http://localhost:8080/instance/fetchInstances \
  -H "apikey: tu_api_key"
```

### 3. Verificar logs del bot

```bash
docker compose logs -f app
```

Deberías ver:
```
🚀 Evolution API v2 Service initialized
✅ Evolution API v2 inicializado correctamente
📥 Webhook recibido: messages.upsert
```

## ⚠️ Notas Importantes

1. **Webhook debe ser accesible**: Evolution API debe poder hacer POST a tu servidor
2. **API Key debe coincidir**: `EVOLUTION_APIKEY` debe ser igual a `AUTHENTICATION_API_KEY` en docker-compose
3. **Instancia se crea automáticamente**: No necesitas crearla manualmente
4. **QR se actualiza automáticamente**: El bot hace polling cada 5 segundos

## 🐛 Solución de Problemas

### Error: "Cannot connect to Evolution API"

**Solución**: Verifica que Evolution API esté corriendo:
```bash
docker compose ps evolution-api
docker compose logs evolution-api
```

### Error: "Webhook not receiving messages"

**Solución**: 
1. Verifica que `WEBHOOK_GLOBAL_URL` en docker-compose apunte a tu servidor
2. Verifica que tu servidor sea accesible desde Evolution API
3. Revisa los logs: `docker compose logs -f app`

### QR no aparece

**Solución**:
1. Desvincula WhatsApp desde el panel admin
2. Espera 5-10 segundos
3. El QR debería aparecer automáticamente

## 📚 Documentación Adicional

- [Evolution API Docs](https://doc.evolution-api.com/)
- [Webhook Events](https://doc.evolution-api.com/webhooks/events)

## ✅ Estado de la Migración

- ✅ BotManager refactorizado
- ✅ Webhook handler implementado
- ✅ Servicio Evolution API v2 creado
- ✅ Tipos TypeScript definidos
- ✅ Endpoints actualizados
- ⚠️ Funciones de comandos necesitan actualización (ver TODOs)
- ⚠️ Funciones de admin-info necesitan actualización (ver TODOs)

