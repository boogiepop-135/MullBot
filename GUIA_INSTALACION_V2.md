# 📦 Guía de Instalación - MullBot v2.0

## ✅ Todas las Funcionalidades Implementadas

Esta guía te ayudará a instalar y configurar todas las nuevas funcionalidades de MullBot v2.0.

---

## 🎯 Funcionalidades Implementadas

### 1. ✨ Sistema de Gestión de Modelos de IA con Fallback
- Rotación automática entre modelos Gemini
- Detección de errores 429 (Quota Exceeded) y 503 (Service Unavailable)
- Cooldown automático de 15 minutos para modelos agotados
- Sistema de prioridades
- Endpoint `/api/ai-status` para monitoreo

### 2. 📱 Autenticación por Código de Vinculación (Pairing Code)
- Método alternativo al QR para vincular WhatsApp
- UI moderna con tabs (QR / Pairing Code)
- Validación de números telefónicos
- Endpoint `/api/pairing-code` para generación de códigos

### 3. 🖥️ Dashboard de Monitoreo de IA
- Vista en tiempo real del estado de los modelos
- Estadísticas detalladas por modelo
- Sistema de alertas automáticas
- Gráficos de distribución de uso
- Acciones rápidas (resetear, probar, exportar)

### 4. 💾 Sistema de Caché para Respuestas
- Caché en memoria (LRU) para respuestas ultra-rápidas
- Persistencia en PostgreSQL
- Estadísticas de hit rate y ahorro de API calls
- Estimación de ahorro en costos
- Top queries más frecuentes

### 5. 📊 Métricas de Rendimiento
- Tiempo de respuesta promedio por modelo
- Tasa de éxito por modelo
- Contador de requests y errores
- Estadísticas acumuladas

---

## 🚀 Pasos de Instalación

### 1. Actualizar Dependencias

Ya tienes todas las dependencias necesarias en tu `package.json`. Solo asegúrate de tenerlas instaladas:

```bash
npm install
```

### 2. Actualizar Base de Datos (Prisma)

La nueva funcionalidad requiere una tabla adicional para el caché:

```bash
# Generar migración
npx prisma migrate dev --name add_ai_cache

# O si prefieres, aplicar directamente
npx prisma db push

# Generar cliente de Prisma
npm run prisma:generate
```

### 3. Configurar Variables de Entorno

Actualiza tu archivo `.env` con las siguientes variables:

```env
# API Keys principales (REQUERIDAS)
GEMINI_API_KEY=tu_clave_de_gemini_api

# API Keys adicionales (OPCIONAL - para rotación de cuota)
# Descomenta si tienes múltiples claves
# GEMINI_API_KEY_2=tu_segunda_clave_gemini
# GEMINI_API_KEY_3=tu_tercera_clave_gemini

# Claude API (OPCIONAL - fallback final)
# ANTHROPIC_API_KEY=tu_clave_de_anthropic

# Evolution API (REQUERIDAS)
EVOLUTION_URL=http://localhost:8080
EVOLUTION_APIKEY=tu_clave_de_evolution_api
EVOLUTION_INSTANCE_NAME=mullbot-principal

# Base de datos (REQUERIDA)
DATABASE_URL=postgresql://user:password@localhost:5432/mullbot?schema=public

# JWT (REQUERIDA)
JWT_SECRET=tu_secreto_jwt_super_seguro

# Otras (OPCIONAL)
PORT=3000
ENV=development
NODE_ENV=development
API_BASE_URL=http://localhost:3000
```

### 4. Iniciar el Sistema

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

---

## 📋 Verificación de la Instalación

### 1. Verificar Backend

Cuando inicies el servidor, deberías ver estos logs:

```
🤖 AIModelManager inicializado
✅ 3 modelos de IA configurados
➕ Modelo agregado: gemini-2.0-flash-exp (prioridad: 1)
➕ Modelo agregado: gemini-1.5-flash (prioridad: 2)
➕ Modelo agregado: gemini-1.5-pro (prioridad: 3)
💾 AICacheService inicializado
💾 Caché inicializado con X entradas populares
```

### 2. Verificar Endpoints

Prueba que los endpoints estén funcionando:

```bash
# Estado de IA
curl http://localhost:3000/api/ai-status

# Estadísticas de caché
curl http://localhost:3000/api/ai-cache-stats

# Estado de salud
curl http://localhost:3000/api/health
```

### 3. Verificar Dashboard

1. Abre tu navegador en `http://localhost:3000/admin`
2. Inicia sesión
3. Ve a **"Monitor IA"** en el menú lateral
4. Deberías ver:
   - Estado de los modelos
   - Estadísticas de caché
   - Alertas (si aplica)
   - Gráficos de distribución

### 4. Verificar Pairing Code

1. Ve a **Configuración > WhatsApp**
2. Selecciona el tab **"Código de Vinculación"**
3. Ingresa un número de teléfono (ej: `521234567890`)
4. Clic en **"Obtener Código"**
5. Deberías recibir un código de 8 dígitos

---

## 🎯 Uso del Sistema

### Monitor de IA

#### Acceder al Monitor
1. Dashboard > **Monitor IA** (ícono de cerebro 🧠)

#### Funcionalidades Disponibles

**Estadísticas Generales:**
- Modelo activo actual
- Total de requests procesados
- Total de errores
- Tasa de éxito general

**Estadísticas de Caché:**
- Tasa de hit del caché
- Entradas en memoria/base de datos
- API calls ahorradas
- Ahorro estimado en dólares

**Tabla de Modelos:**
- Estado de cada modelo (Disponible/Agotado/Error)
- Prioridad
- Requests y errores por modelo
- Tasa de éxito individual
- Tiempo de respuesta promedio
- Último error (si aplica)

**Acciones Rápidas:**
- **Resetear Estadísticas**: Limpia todos los contadores
- **Probar Conexión**: Hace una petición de prueba a la IA
- **Limpiar Caché**: Elimina todas las entradas del caché
- **Exportar Estadísticas**: Descarga CSV con todos los datos

#### Auto-Refresh
- El dashboard se actualiza automáticamente cada 30 segundos
- Puedes refrescar manualmente con el botón "Actualizar"

### Sistema de Caché

#### Cómo Funciona
1. **Primera consulta**: Se llama a la API de Gemini y se guarda la respuesta
2. **Consultas siguientes**: Se obtiene la respuesta del caché (instantáneo)
3. **TTL**: Las entradas expiran después de 1 hora por defecto
4. **LRU**: Si el caché está lleno, se elimina la entrada menos usada

#### Consultas Cacheables
- Preguntas frecuentes generales
- Información del negocio
- Preguntas sobre productos
- Consultas técnicas comunes

#### Consultas NO Cacheables
- Queries muy cortas (< 10 caracteres)
- Consultas con información personal
- Comandos del bot
- Mensajes de sistema

### Pairing Code

#### Ventajas sobre QR
✅ No requiere cámara  
✅ Más estable  
✅ Funciona mejor en móviles  
✅ Menos propenso a errores  

#### Pasos para Vincular
1. **Obtener Código**:
   - Configuración > WhatsApp
   - Tab "Código de Vinculación"
   - Ingresar número con código de país
   - Clic en "Obtener Código"

2. **En WhatsApp**:
   - Abrir WhatsApp en el teléfono
   - Ir a Ajustes > Dispositivos vinculados
   - Tocar "Vincular un dispositivo"
   - Seleccionar "Vincular con número de teléfono"
   - Ingresar el código de 8 dígitos

3. **Confirmar**:
   - El dashboard mostrará "Conectado" cuando se complete
   - El bot estará listo para usar

---

## 🔧 Configuración Avanzada

### Múltiples Claves de API

Para distribuir la carga entre varias claves de Gemini:

1. **Agregar claves al .env**:
```env
GEMINI_API_KEY=clave_principal
GEMINI_API_KEY_2=clave_secundaria
GEMINI_API_KEY_3=clave_terciaria
```

2. **Actualizar AIModelManager**:

Abre `src/services/ai-model-manager.service.ts` y modifica `initializeModels()`:

```typescript
// Clave secundaria
if (EnvConfig.GEMINI_API_KEY_2) {
    this.addModel({
        name: "gemini-2.0-flash-exp",
        apiKey: EnvConfig.GEMINI_API_KEY_2,
        priority: 4, // Siguiente prioridad
        status: "available",
        requestCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        averageResponseTime: 0
    });
}
```

### Configurar TTL del Caché

Abre `src/services/ai-cache.service.ts` y modifica:

```typescript
private config: CacheConfig = {
    maxMemorySize: 200,        // Más entradas en memoria
    defaultTTL: 7200,          // 2 horas en lugar de 1
    minQueryLength: 15,        // Queries más largas
    similarityThreshold: 0.85  // Menos estricto
};
```

### Ajustar Cooldown de Modelos

Abre `src/services/ai-model-manager.service.ts`:

```typescript
// Cooldown más largo o más corto
private readonly COOLDOWN_TIME = 30 * 60 * 1000; // 30 minutos
```

---

## 📊 APIs Disponibles

### Gestión de IA

#### GET /api/ai-status
Obtiene el estado de todos los modelos de IA.

**Response:**
```json
{
  "models": [
    {
      "name": "gemini-2.0-flash-exp",
      "status": "available",
      "priority": 1,
      "requestCount": 1247,
      "errorCount": 3,
      "averageResponseTime": 1850
    }
  ],
  "activeModel": "gemini-2.0-flash-exp",
  "totalRequests": 1336,
  "totalErrors": 15
}
```

#### POST /api/ai-reset
Resetea todas las estadísticas de IA.

#### POST /api/ai-reset-model
Resetea un modelo específico.

**Request:**
```json
{
  "modelName": "gemini-2.0-flash-exp"
}
```

#### POST /api/ai-test
Prueba la conexión con IA.

**Request:**
```json
{
  "query": "Hola, prueba del sistema"
}
```

### Gestión de Caché

#### GET /api/ai-cache-stats
Estadísticas del caché.

**Response:**
```json
{
  "totalHits": 450,
  "totalMisses": 150,
  "hitRate": 75.00,
  "memoryEntries": 85,
  "dbEntries": 234,
  "savedAPICalls": 450,
  "estimatedSavings": "$0.0900 USD"
}
```

#### POST /api/ai-cache-clear
Limpia todo el caché.

#### GET /api/ai-cache-top?limit=10
Obtiene las consultas más frecuentes.

**Response:**
```json
[
  {
    "query": "¿Cuál es el horario de atención?",
    "hits": 156
  },
  {
    "query": "¿Tienen envío gratis?",
    "hits": 98
  }
]
```

### Pairing Code

#### POST /api/pairing-code
Genera un código de vinculación.

**Request:**
```json
{
  "phoneNumber": "521234567890"
}
```

**Response:**
```json
{
  "success": true,
  "code": "K9X2M4L7",
  "message": "Código de vinculación generado exitosamente"
}
```

---

## 🐛 Troubleshooting

### Problema: Modelos no aparecen en el dashboard

**Solución:**
1. Verifica que `GEMINI_API_KEY` esté configurada
2. Reinicia el servidor
3. Revisa los logs: `npm run dev`
4. Consulta `/api/ai-status` directamente

### Problema: Caché no funciona

**Solución:**
1. Verifica que la tabla `AICache` exista en la DB:
```sql
SELECT * FROM "AICache" LIMIT 1;
```
2. Si no existe, ejecuta:
```bash
npx prisma db push
```
3. Reinicia el servidor

### Problema: Pairing Code no se genera

**Solución:**
1. Verifica que Evolution API esté corriendo
2. Verifica configuración de Evolution en `.env`
3. Prueba el endpoint manualmente:
```bash
curl -X POST http://localhost:3000/api/pairing-code \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "521234567890"}'
```

### Problema: Todos los modelos marcados como "agotados"

**Solución:**
1. Espera 15 minutos (cooldown automático)
2. O resetea manualmente desde el dashboard:
   - Monitor IA > Resetear Estadísticas
3. O vía API:
```bash
curl -X POST http://localhost:3000/api/ai-reset
```

### Problema: Dashboard de IA no carga

**Solución:**
1. Abre la consola del navegador (F12)
2. Busca errores en la pestaña Console
3. Verifica que el endpoint `/api/ai-status` responda
4. Limpia caché del navegador (Ctrl+Shift+R)

---

## 📈 Monitoreo y Mantenimiento

### Limpieza Regular

**Caché:**
```bash
# Manualmente desde el dashboard
Monitor IA > Limpiar Caché

# O vía API
curl -X POST http://localhost:3000/api/ai-cache-clear
```

**Base de datos:**
```sql
-- Eliminar entradas antiguas del caché (>7 días)
DELETE FROM "AICache" 
WHERE "createdAt" < NOW() - INTERVAL '7 days';

-- Vacuum (PostgreSQL)
VACUUM ANALYZE "AICache";
```

### Logs Importantes

Busca estos mensajes en los logs:

✅ **Buenos:**
```
✅ Generación exitosa con modelo: gemini-2.0-flash-exp
💾 Cache HIT (memoria): "pregunta..." (15 hits)
✨ Respuesta obtenida desde caché
```

⚠️ **Advertencias:**
```
⚠️ Modelo gemini-2.0-flash-exp marcado como agotado
🔄 Intentando Claude como fallback...
```

❌ **Errores:**
```
❌ Todos los modelos de IA fallaron
❌ Error generando con gemini-2.0-flash-exp: 429 Quota Exceeded
```

### Backups

**Base de datos:**
```bash
# Backup completo
pg_dump -U usuario mullbot > backup_$(date +%Y%m%d).sql

# Backup solo tabla AICache
pg_dump -U usuario -t AICache mullbot > cache_backup_$(date +%Y%m%d).sql
```

**Estadísticas:**
```bash
# Exportar desde el dashboard
Monitor IA > Exportar Estadísticas
```

---

## 🎓 Mejores Prácticas

### Para el Sistema de IA

1. ✅ Monitorea el dashboard diariamente
2. ✅ Configura múltiples claves si tienes alto volumen
3. ✅ Revisa la tasa de error semanalmente
4. ✅ Exporta estadísticas mensualmente
5. ✅ Mantén el caché limpio (< 1000 entradas)

### Para el Caché

1. ✅ Limpia entradas antiguas semanalmente
2. ✅ Monitorea el hit rate (objetivo: >50%)
3. ✅ Revisa las top queries para optimizar
4. ✅ Ajusta el TTL según tus necesidades
5. ✅ No caches información sensible

### Para Pairing Code

1. ✅ Usa como método preferido (más estable)
2. ✅ Guarda el QR como respaldo
3. ✅ Valida el formato del número
4. ✅ Documenta para los usuarios

---

## 📚 Recursos Adicionales

- **Documentación completa**: Ver `NUEVAS_FUNCIONALIDADES.md`
- **API de Gemini**: https://ai.google.dev/docs
- **Evolution API**: https://doc.evolution-api.com/
- **Prisma**: https://www.prisma.io/docs

---

## 🆘 Soporte

Si tienes problemas:

1. Revisa los logs del servidor
2. Consulta `/api/ai-status` para diagnosticar
3. Limpia caché y resetea estadísticas
4. Revisa que todas las variables de entorno estén configuradas
5. Verifica que PostgreSQL y Evolution API estén corriendo

---

## ✨ Próximas Mejoras Sugeridas

1. **Panel de Control Avanzado**
   - Gráficos interactivos con Chart.js
   - Predicción de agotamiento de cuota
   - Alertas por email/SMS

2. **Optimizaciones de Rendimiento**
   - Compresión de respuestas en caché
   - Índices adicionales en PostgreSQL
   - Redis para caché distribuido

3. **Análisis Avanzado**
   - ML para detectar patrones de uso
   - Recomendaciones automáticas de configuración
   - A/B testing de modelos

4. **Seguridad**
   - Rate limiting por IP
   - Autenticación de 2 factores
   - Encriptación de respuestas en caché

---

**¡Felicidades! Tu MullBot v2.0 está listo para producción.** 🎉

**Versión**: 2.0  
**Fecha**: 7 de Enero, 2025  
**Autor**: Arquitecto de Software Senior
