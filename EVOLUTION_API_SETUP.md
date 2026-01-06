# 🚀 Guía de Migración a Evolution API

Evolution API es una solución más robusta y estable que `whatsapp-web.js` para integrar WhatsApp. Ofrece mejor manejo de sesiones, API REST más estable, y mejor escalabilidad.

## 📋 Ventajas de Evolution API

- ✅ **Mayor estabilidad**: Menos desconexiones y problemas de autenticación
- ✅ **API REST profesional**: Endpoints bien documentados y estables
- ✅ **Mejor manejo de sesiones**: Gestión más robusta de múltiples instancias
- ✅ **Escalabilidad**: Soporta múltiples números de WhatsApp simultáneamente
- ✅ **Webhooks**: Sistema de notificaciones más confiable
- ✅ **Mejor para producción**: Diseñado para entornos empresariales

## 🐳 Instalación con Docker

### 1. Crear archivo `docker-compose.evolution.yml`

```yaml
version: '3.8'

services:
  evolution-api:
    image: atendai/evolution-api:latest
    container_name: evolution-api
    restart: always
    ports:
      - "8080:8080"
    environment:
      # Configuración de base de datos
      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: "mongodb"
      DATABASE_CONNECTION_URI: "${MONGODB_URI}"
      
      # Configuración de Redis (opcional pero recomendado)
      REDIS_ENABLED: "true"
      REDIS_URI: "${REDIS_URI}"
      
      # Configuración de seguridad
      AUTHENTICATION_API_KEY: "${EVOLUTION_API_KEY}"
      AUTHENTICATION_EXPOSE_INTERNAL: "false"
      
      # Configuración de webhooks
      WEBHOOK_GLOBAL_ENABLED: "true"
      WEBHOOK_GLOBAL_URL: "${WEBHOOK_URL}"
      
      # Configuración de QR
      QRCODE_LIMIT: "30"
      QRCODE_COLOR: "198,31,31"
      
      # Configuración de logs
      LOG_LEVEL: "ERROR"
      LOG_COLOR: "true"
      LOG_BAILEYS: "error"
      
      # Configuración de servidor
      SERVER_URL: "${SERVER_URL}"
      CONFIG_SESSION_PHONE_CLIENT: "Chrome"
      CONFIG_SESSION_PHONE_NAME: "MullBot"
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store
    networks:
      - evolution-network

volumes:
  evolution_instances:
  evolution_store:

networks:
  evolution-network:
    driver: bridge
```

### 2. Variables de entorno necesarias

Agrega estas variables a tu archivo `.env`:

```env
# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=tu_api_key_segura_aqui
WEBHOOK_URL=https://tu-dominio.com/webhook/evolution
SERVER_URL=https://tu-dominio.com
```

## 🔧 Integración con MullBot

### Opción 1: Adapter Pattern (Recomendado)

Crear un adapter que permita usar Evolution API o whatsapp-web.js según configuración:

```typescript
// src/utils/whatsapp-adapter.ts
export interface WhatsAppAdapter {
    sendMessage(phoneNumber: string, message: string): Promise<void>;
    getQR(): Promise<string | null>;
    isConnected(): Promise<boolean>;
    logout(): Promise<void>;
}

// src/utils/evolution-api.adapter.ts
export class EvolutionAPIAdapter implements WhatsAppAdapter {
    private apiUrl: string;
    private apiKey: string;
    private instanceName: string;

    constructor(apiUrl: string, apiKey: string, instanceName: string) {
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        this.instanceName = instanceName;
    }

    async sendMessage(phoneNumber: string, message: string): Promise<void> {
        const response = await axios.post(
            `${this.apiUrl}/message/sendText/${this.instanceName}`,
            {
                number: phoneNumber,
                text: message
            },
            {
                headers: {
                    'apikey': this.apiKey,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to send message');
        }
    }

    async getQR(): Promise<string | null> {
        const response = await axios.get(
            `${this.apiUrl}/instance/connect/${this.instanceName}`,
            {
                headers: { 'apikey': this.apiKey }
            }
        );
        
        return response.data?.qrcode?.base64 || null;
    }

    async isConnected(): Promise<boolean> {
        const response = await axios.get(
            `${this.apiUrl}/instance/fetchInstances`,
            {
                headers: { 'apikey': this.apiKey }
            }
        );
        
        const instance = response.data.find((i: any) => i.instance.instanceName === this.instanceName);
        return instance?.instance?.status === 'open';
    }

    async logout(): Promise<void> {
        await axios.delete(
            `${this.apiUrl}/instance/delete/${this.instanceName}`,
            {
                headers: { 'apikey': this.apiKey }
            }
        );
    }
}
```

### Opción 2: Migración Completa

Reemplazar completamente `whatsapp-web.js` con Evolution API requiere:

1. **Instalar dependencias**:
```bash
npm install axios
```

2. **Crear servicio de Evolution API**:
```typescript
// src/services/evolution-api.service.ts
import axios from 'axios';
import logger from '../configs/logger.config';
import EnvConfig from '../configs/env.config';

export class EvolutionAPIService {
    private apiUrl: string;
    private apiKey: string;
    private instanceName: string;

    constructor() {
        this.apiUrl = EnvConfig.EVOLUTION_API_URL || 'http://localhost:8080';
        this.apiKey = EnvConfig.EVOLUTION_API_KEY || '';
        this.instanceName = EnvConfig.EVOLUTION_INSTANCE_NAME || 'mullbot-instance';
    }

    async createInstance(): Promise<void> {
        try {
            const response = await axios.post(
                `${this.apiUrl}/instance/create`,
                {
                    instanceName: this.instanceName,
                    token: this.apiKey,
                    qrcode: true,
                    integration: 'WHATSAPP-BAILEYS'
                },
                {
                    headers: {
                        'apikey': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            logger.info('Evolution API instance created:', response.data);
        } catch (error: any) {
            logger.error('Error creating Evolution API instance:', error);
            throw error;
        }
    }

    async getQR(): Promise<string | null> {
        try {
            const response = await axios.get(
                `${this.apiUrl}/instance/connect/${this.instanceName}`,
                {
                    headers: { 'apikey': this.apiKey }
                }
            );
            
            return response.data?.qrcode?.base64 || null;
        } catch (error: any) {
            logger.error('Error getting QR from Evolution API:', error);
            return null;
        }
    }

    async sendMessage(phoneNumber: string, message: string): Promise<void> {
        try {
            const response = await axios.post(
                `${this.apiUrl}/message/sendText/${this.instanceName}`,
                {
                    number: phoneNumber,
                    text: message
                },
                {
                    headers: {
                        'apikey': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (!response.data.success) {
                throw new Error(response.data.message || 'Failed to send message');
            }
        } catch (error: any) {
            logger.error('Error sending message via Evolution API:', error);
            throw error;
        }
    }

    async isConnected(): Promise<boolean> {
        try {
            const response = await axios.get(
                `${this.apiUrl}/instance/fetchInstances`,
                {
                    headers: { 'apikey': this.apiKey }
                }
            );
            
            const instance = response.data.find(
                (i: any) => i.instance.instanceName === this.instanceName
            );
            
            return instance?.instance?.status === 'open';
        } catch (error) {
            logger.error('Error checking Evolution API connection:', error);
            return false;
        }
    }

    async logout(): Promise<void> {
        try {
            await axios.delete(
                `${this.apiUrl}/instance/delete/${this.instanceName}`,
                {
                    headers: { 'apikey': this.apiKey }
                }
            );
            
            logger.info('Evolution API instance deleted');
        } catch (error: any) {
            logger.error('Error deleting Evolution API instance:', error);
            throw error;
        }
    }
}
```

## 📝 Pasos para Migrar

1. **Instalar Evolution API con Docker**:
```bash
docker-compose -f docker-compose.evolution.yml up -d
```

2. **Configurar variables de entorno** en `.env`

3. **Crear instancia en Evolution API**:
```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "mullbot-instance",
    "token": "tu_api_key",
    "qrcode": true
  }'
```

4. **Obtener QR para vincular**:
```bash
curl -X GET http://localhost:8080/instance/connect/mullbot-instance \
  -H "apikey: tu_api_key"
```

5. **Configurar webhooks** para recibir mensajes

6. **Actualizar BotManager** para usar Evolution API en lugar de whatsapp-web.js

## 🔗 Recursos

- **Documentación oficial**: https://doc.evolution-api.com/
- **GitHub**: https://github.com/EvolutionAPI/evolution-api
- **Docker Hub**: https://hub.docker.com/r/atendai/evolution-api

## ⚠️ Consideraciones

- Evolution API requiere un servidor separado (Docker)
- Necesitas configurar webhooks para recibir mensajes
- La migración completa requiere cambios significativos en el código
- Evolution API es más robusto pero también más complejo de configurar inicialmente

## 💡 Recomendación

Si estás teniendo problemas frecuentes con whatsapp-web.js, Evolution API es una excelente alternativa. Sin embargo, primero intenta las mejoras que hemos hecho en la configuración actual. Si los problemas persisten, entonces considera migrar a Evolution API.

