# 🔍 Health Check de MullBot

Script de verificación que comprueba que todas las funcionalidades del bot estén operativas.

## 🚀 Cómo Ejecutar

### Opción 1: Script Simplificado (Recomendado)
```bash
npm run health-check
```

O directamente:
```bash
node scripts/health-check-simple.js
```

### Opción 2: Script TypeScript
```bash
npm run health-check:ts
```

O directamente:
```bash
npx ts-node scripts/health-check.ts
```

## ✅ Qué Verifica

El script verifica los siguientes componentes:

1. **Variables de Entorno**
   - DATABASE_URL
   - JWT_SECRET
   - GEMINI_API_KEY
   - EVOLUTION_URL
   - EVOLUTION_APIKEY
   - EVOLUTION_INSTANCE_NAME

2. **Base de Datos (PostgreSQL)**
   - Conexión a la base de datos
   - Verificación de que Prisma puede ejecutar consultas

3. **Evolution API**
   - Conexión a Evolution API
   - Estado de las instancias de WhatsApp
   - Verificación de que hay al menos una instancia configurada

4. **API Keys de IA**
   - Verificación de que hay al menos una API Key configurada (Gemini o Anthropic)
   - Muestra qué APIs están disponibles

5. **Google Sheets** (Opcional)
   - Verificación de conexión a Google Sheets
   - Conteo de productos en la hoja
   - Solo se marca como error si está configurado pero no funciona

6. **Sistema de Asesorías**
   - Verificación de que el modelo Advisory existe en la BD
   - Conteo de asesorías existentes

7. **Sistema de Productos**
   - Verificación de que el modelo Product existe en la BD
   - Conteo de productos existentes

## 📊 Interpretación de Resultados

### ✅ OK (Verde)
- Todo funciona correctamente
- No hay problemas

### ⚠️ Warning (Amarillo)
- Funcionalidad opcional no configurada (ej: Google Sheets)
- Algo que debería estar pero no es crítico
- El sistema puede funcionar sin esto

### ❌ Error (Rojo)
- Problema crítico que impide el funcionamiento
- Variable de entorno faltante
- Conexión fallida a servicio crítico
- **Debe resolverse antes de usar el bot**

## 📈 Resumen Final

Al final del reporte verás:
- Cantidad de verificaciones OK
- Cantidad de warnings
- Cantidad de errores
- Estado general del sistema

## 🔧 Modo Debug

Para ver detalles adicionales de cada verificación:
```bash
DEBUG=1 npm run health-check
```

## 📝 Ejemplo de Salida

```
🔍 Iniciando Health Check de MullBot...

============================================================

📊 RESULTADOS:

1. ✅ Todas las variables críticas configuradas (6)
2. ✅ Conexión exitosa a PostgreSQL
3. ✅ Instancia "mullbot-principal" conectada (open)
4. ✅ API Keys disponibles: Gemini
5. ✅ Google Sheets conectado correctamente (15 productos encontrados)
6. ✅ Sistema de asesorías operativo (3 asesorías en BD)
7. ✅ Sistema de productos operativo (8 productos en BD)

============================================================

📈 RESUMEN:

✅ OK: 7
⚠️  Warnings: 0
❌ Errores: 0
📊 Total: 7

🎉 ¡Todas las funciones están operativas!
```

## 🐛 Solución de Problemas

### Error: "Cannot find module"
Asegúrate de haber ejecutado:
```bash
npm install
```

### Error: "DATABASE_URL is missing"
Verifica tu archivo `.env` y asegúrate de tener todas las variables configuradas.

### Error: "Evolution API connection failed"
- Verifica que Evolution API esté corriendo
- Verifica las variables `EVOLUTION_URL` y `EVOLUTION_APIKEY`
- Verifica que la instancia esté creada

### Error: "No API Keys configured"
Configura al menos `GEMINI_API_KEY` en tu archivo `.env`.

## 💡 Tips

- Ejecuta el health check después de cada cambio importante en la configuración
- Úsalo antes de hacer deploy a producción
- Ejecútalo periódicamente para verificar que todo sigue funcionando
- Si hay errores, resuélvelos antes de continuar
