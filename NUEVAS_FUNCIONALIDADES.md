# 🚀 Nuevas Funcionalidades - MullBot v2.0

## 📋 Resumen de Cambios

Se han implementado dos funcionalidades críticas para mejorar la estabilidad y usabilidad de MullBot:

1. **Sistema de Gestión de Modelos de IA con Fallback Automático**
2. **Autenticación por Código de Vinculación (Pairing Code)**

---

## 🤖 1. Sistema de Gestión de Modelos de IA (AIModelManager)

### ¿Qué problema resuelve?

Cuando Gemini experimenta errores de cuota excedida (429 - Too Many Requests), el sistema ahora automáticamente cambia a modelos alternativos sin que el usuario note interrupciones.

### Características

#### ✅ Fallback Automático
- **Modelo Principal**: `gemini-2.0-flash-exp`
- **Respaldo 1**: `gemini-1.5-flash`
- **Respaldo 2**: `gemini-1.5-pro`
- **Respaldo Final**: Claude (si está configurado)

#### ✅ Detección Inteligente de Errores
El sistema detecta y maneja automáticamente:
- Error 429 (Too Many Requests / Quota Exceeded)
- Error 503 (Service Unavailable)
- Errores de red temporales (ECONNRESET, ETIMEDOUT)

#### ✅ Sistema de Cooldown
- Modelos agotados se marcan como "exhausted"
- Se reactivan automáticamente después de 15 minutos
- Permite recuperación sin intervención manual

#### ✅ Monitoreo en Tiempo Real
Nuevo endpoint: **GET /api/ai-status**

Respuesta ejemplo:
```json
{
  "models": [
    {
      "name": "gemini-2.0-flash-exp",
      "status": "available",
      "priority": 1,
      "requestCount": 1247,
      "errorCount": 3,
      "lastError": null
    },
    {
      "name": "gemini-1.5-flash",
      "status": "exhausted",
      "priority": 2,
      "requestCount": 89,
      "errorCount": 12,
      "lastError": "429 Quota Exceeded",
      "lastErrorTime": "2025-01-07T15:30:45.123Z"
    }
  ],
  "activeModel": "gemini-2.0-flash-exp",
  "totalRequests": 1336,
  "totalErrors": 15
}
```

### Cómo funciona

1. **Intento Inicial**: El sistema intenta usar el modelo principal (gemini-2.0-flash-exp)
2. **Detección de Error**: Si falla con error 429/503, marca el modelo como agotado
3. **Fallback Automático**: Cambia inmediatamente al siguiente modelo disponible
4. **Reintento**: Ejecuta la misma petición con el nuevo modelo
5. **Recuperación**: El modelo agotado se reactiva automáticamente después del cooldown

### Integración

El AIModelManager se integra automáticamente en:
- ✅ `gemini.util.ts` - Respuestas del bot
- ✅ `ai-fallback.util.ts` - Sistema de fallback general
- ✅ Todos los comandos que usan IA

**No requiere cambios en tu código existente** - funciona de forma transparente.

### Expansión Futura: Múltiples Claves

Para agregar más claves de API y aumentar la cuota:

1. Agrega las claves al archivo `.env`:
```env
GEMINI_API_KEY=tu_clave_principal
GEMINI_API_KEY_2=tu_clave_secundaria
GEMINI_API_KEY_3=tu_clave_terciaria
```

2. Modifica `src/services/ai-model-manager.service.ts` en el método `initializeModels()`:
```typescript
// Modelo principal
if (EnvConfig.GEMINI_API_KEY) {
    this.addModel({
        name: "gemini-2.0-flash-exp",
        apiKey: EnvConfig.GEMINI_API_KEY,
        priority: 1,
        status: "available",
        requestCount: 0,
        errorCount: 0
    });
}

// Clave secundaria
if (EnvConfig.GEMINI_API_KEY_2) {
    this.addModel({
        name: "gemini-2.0-flash-exp",
        apiKey: EnvConfig.GEMINI_API_KEY_2,
        priority: 2,
        status: "available",
        requestCount: 0,
        errorCount: 0
    });
}

// Y así sucesivamente...
```

---

## 📱 2. Autenticación por Código de Vinculación (Pairing Code)

### ¿Qué problema resuelve?

El método de autenticación por QR puede ser inestable. El Pairing Code es un método más moderno y confiable que permite vincular WhatsApp usando solo tu número de teléfono.

### Cómo funciona

#### Método QR (Tradicional)
1. Abrir WhatsApp en el teléfono
2. Escanear código QR desde la pantalla
3. Esperar confirmación

#### Método Pairing Code (Nuevo) ⭐
1. Ingresar tu número de teléfono con código de país
2. Recibir un código de 8 dígitos (Ej: `K9X2-M4L7`)
3. Abrir WhatsApp > Dispositivos vinculados
4. Seleccionar "Vincular con número de teléfono"
5. Ingresar el código de 8 dígitos

### Cómo usar en el Dashboard

1. **Ir a Configuración > WhatsApp**
2. **Seleccionar "Código de Vinculación"**
3. **Ingresar número con código de país**
   - Ejemplo México: `521234567890`
   - Ejemplo España: `34612345678`
   - Ejemplo Colombia: `573001234567`
4. **Clic en "Obtener Código"**
5. **Copiar el código de 8 dígitos**
6. **Seguir las instrucciones en pantalla**

### Formato del número

✅ **Correcto**:
- `521234567890` (México)
- `34612345678` (España)
- `573001234567` (Colombia)

❌ **Incorrecto**:
- `+521234567890` (con símbolo +)
- `52 123 456 7890` (con espacios)
- `52-123-456-7890` (con guiones)
- `1234567890` (sin código de país)

### API Endpoint

**POST /api/pairing-code**

Request:
```json
{
  "phoneNumber": "521234567890"
}
```

Response (Éxito):
```json
{
  "success": true,
  "code": "K9X2M4L7",
  "message": "Código de vinculación generado exitosamente"
}
```

Response (Error):
```json
{
  "success": false,
  "error": "Número de teléfono inválido. Debe contener entre 10 y 15 dígitos."
}
```

### Ventajas del Pairing Code

✅ Más estable que QR  
✅ No requiere cámara  
✅ Más rápido de implementar  
✅ Funciona mejor en dispositivos móviles  
✅ Menos propenso a errores de red  

---

## 🎯 Endpoints Nuevos

### 1. Estado del Sistema de IA
```bash
GET /api/ai-status
Authorization: Bearer {token}
```

### 2. Obtener Pairing Code
```bash
POST /api/pairing-code
Authorization: Bearer {token}
Content-Type: application/json

{
  "phoneNumber": "521234567890"
}
```

---

## 🔧 Configuración Técnica

### Variables de Entorno

```env
# API Keys principales
GEMINI_API_KEY=tu_clave_gemini
ANTHROPIC_API_KEY=tu_clave_claude  # Opcional, para fallback final

# API Keys adicionales (para expansión futura)
GEMINI_API_KEY_2=tu_segunda_clave  # Opcional
GEMINI_API_KEY_3=tu_tercera_clave  # Opcional

# Evolution API
EVOLUTION_URL=http://evolution-api:8080
EVOLUTION_APIKEY=tu_clave_evolution
EVOLUTION_INSTANCE_NAME=mullbot-principal
```

### Archivos Modificados

#### Nuevos Archivos:
- `src/services/ai-model-manager.service.ts` - Gestor de modelos de IA

#### Archivos Actualizados:
- `src/utils/gemini.util.ts` - Integración con AIModelManager
- `src/utils/ai-fallback.util.ts` - Fallback mejorado
- `src/services/evolution-api-v2.service.ts` - Métodos de pairing code
- `src/api/index.api.ts` - Nuevos endpoints
- `src/views/admin.ejs` - UI del dashboard
- `public/js/admin.js` - Funciones del frontend
- `src/configs/env.config.ts` - Variables de entorno

---

## 🧪 Testing

### Probar AIModelManager

1. **Consultar estado**:
```bash
curl -H "Authorization: Bearer {token}" \
     http://localhost:3000/api/ai-status
```

2. **Forzar error de cuota** (para testing):
   - Usa una API key inválida temporalmente
   - El sistema debería cambiar automáticamente al siguiente modelo
   - Los logs mostrarán el proceso de fallback

3. **Verificar logs**:
```bash
# En los logs deberías ver:
🤖 Intentando generar con modelo: gemini-2.0-flash-exp
❌ Error generando con gemini-2.0-flash-exp: 429 Quota Exceeded
⚠️ Modelo gemini-2.0-flash-exp marcado como agotado
🤖 Intentando generar con modelo: gemini-1.5-flash
✅ Generación exitosa con modelo: gemini-1.5-flash
```

### Probar Pairing Code

1. **Frontend**: Ve a Configuración > WhatsApp > Código de Vinculación
2. **API directa**:
```bash
curl -X POST http://localhost:3000/api/pairing-code \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"phoneNumber": "521234567890"}'
```

---

## 📊 Monitoreo

### Logs del Sistema

El sistema ahora proporciona logs detallados:

```
🤖 AIModelManager inicializado
✅ 3 modelos de IA configurados
➕ Modelo agregado: gemini-2.0-flash-exp (prioridad: 1)
➕ Modelo agregado: gemini-1.5-flash (prioridad: 2)
➕ Modelo agregado: gemini-1.5-pro (prioridad: 3)

📨 Mensaje recibido de Usuario (+52123456789)
🤖 Intentando generar con modelo: gemini-2.0-flash-exp (intento 1/3)
✅ Generación exitosa con modelo: gemini-2.0-flash-exp

📱 Solicitando pairing code para número: 521234567890
✅ Pairing code generado exitosamente: K9X2M4L7
```

### Dashboard de Monitoreo

En el futuro, puedes agregar una sección en el dashboard para mostrar:
- Estado de cada modelo de IA
- Número de requests por modelo
- Tasa de errores
- Tiempo de respuesta promedio
- Modelos activos/agotados

Ejemplo de implementación en el frontend:
```javascript
// Obtener estado cada 30 segundos
setInterval(async () => {
  const response = await fetch('/api/ai-status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const status = await response.json();
  updateAIDashboard(status);
}, 30000);
```

---

## 🚨 Troubleshooting

### Problema: Todos los modelos de IA fallan

**Síntomas**: Mensaje "Todas las APIs de IA están temporalmente no disponibles"

**Soluciones**:
1. Verificar que `GEMINI_API_KEY` esté configurada correctamente
2. Revisar cuota de Gemini en https://aistudio.google.com/
3. Verificar conexión a internet
4. Consultar `/api/ai-status` para ver detalles de errores

### Problema: Pairing Code no funciona

**Síntomas**: No se genera código o error al intentar vincular

**Soluciones**:
1. Verificar formato del número (sin +, espacios o guiones)
2. Asegurarse de incluir código de país
3. Verificar que Evolution API esté corriendo
4. Revisar logs de Evolution API
5. Asegurarse de que la versión de Evolution API soporte pairing codes

### Problema: QR sigue mostrándose después de usar Pairing Code

**Solución**: El QR y el Pairing Code son métodos alternativos, no simultáneos. Si uno funciona, el otro se desactiva automáticamente.

---

## 🎓 Mejores Prácticas

### Para el Sistema de IA

1. **Monitorea regularmente** el endpoint `/api/ai-status`
2. **Configura múltiples claves** si tienes alto volumen de requests
3. **Revisa los logs** para detectar patrones de errores
4. **Considera Claude** como fallback final si el presupuesto lo permite

### Para Pairing Code

1. **Usa Pairing Code** como método preferido (más estable)
2. **Guarda el QR** como método de respaldo
3. **Valida el número** antes de solicitar código
4. **Educa a los usuarios** sobre el formato correcto del número

---

## 📈 Próximos Pasos

### Mejoras Sugeridas

1. **Dashboard de IA**:
   - Gráfico de uso por modelo
   - Alertas de cuota
   - Predicción de agotamiento

2. **Rotación Inteligente**:
   - Distribución de carga entre modelos
   - Priorización dinámica basada en rendimiento
   - A/B testing de modelos

3. **Pairing Code Mejorado**:
   - Regeneración automática si expira
   - Notificación por SMS del código
   - Historial de códigos generados

4. **Estadísticas**:
   - Tasa de éxito de vinculación por método
   - Tiempo promedio de conexión
   - Errores más comunes

---

## 🤝 Soporte

Si encuentras algún problema o tienes sugerencias:

1. Revisa los logs del servidor
2. Consulta `/api/ai-status` para estado del sistema
3. Verifica configuración de variables de entorno
4. Revisa la documentación de Evolution API: https://doc.evolution-api.com/

---

## 📝 Notas Técnicas

### AIModelManager

- **Patrón Singleton**: Una única instancia gestiona todos los modelos
- **Thread-safe**: Maneja múltiples requests concurrentes
- **Stateful**: Mantiene estadísticas en memoria (se pierden al reiniciar)
- **Extensible**: Fácil agregar nuevos modelos o providers

### Pairing Code

- **REST API**: Usa Evolution API v2
- **Validación robusta**: Formato de número verificado en frontend y backend
- **Error handling**: Manejo graceful de errores de Evolution API
- **Compatible**: Funciona con WhatsApp Business y personal

---

**Fecha de Implementación**: 7 de Enero, 2025  
**Versión**: MullBot v2.0  
**Autor**: Arquitecto de Software Senior  
**Basado en**: Evolution API v2 + Google Gemini AI
