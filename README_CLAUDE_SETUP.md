# 🔧 Configuración de Claude (Anthropic) como Fallback

## 📝 Variable de Entorno

Para usar Claude como fallback cuando Gemini falla, agrega esta variable de entorno:

```env
ANTHROPIC_API_KEY=tu_api_key_de_anthropic_aqui
```

## 🔑 Obtener API Key de Anthropic

1. Ve a: https://console.anthropic.com/
2. Crea una cuenta o inicia sesión
3. Ve a "API Keys" en el menú
4. Clic en "Create Key"
5. Copia la API key (comienza con `sk-ant-...`)
6. Agrégala en Railway o en tu archivo `.env`

## 💰 Costos del Modelo Claude Haiku

El bot usa **`claude-3-haiku-20240307`**, que es el modelo más económico de Anthropic:

- **Input**: ~$0.25 por 1M tokens
- **Output**: ~$1.25 por 1M tokens
- **Con límite de 200 tokens output**: ~$0.00025 por respuesta
- **Muy económico comparado con otros modelos**

## 🔄 Flujo de Fallback

El bot intenta primero con Gemini:
1. ✅ Si Gemini responde → Usa Gemini
2. ❌ Si Gemini falla o timeout → Automáticamente usa Claude
3. ❌ Si ambos fallan → Mensaje de error amigable

## 🚀 Configuración en Railway

1. Ve a tu proyecto en Railway
2. Clic en "Variables" tab
3. Agrega nueva variable:
   - **Nombre**: `ANTHROPIC_API_KEY`
   - **Valor**: Tu API key de Anthropic (sk-ant-...)
4. Guarda y redeploy

## ✅ Verificación

Una vez configurado, verás en los logs:

```
🤖 Intentando Gemini para query: "..."
❌ Gemini falló: ...
🔄 Intentando Claude como fallback...
🤖 Intentando Claude (Haiku) para query: "..."
✅ Claude respondió exitosamente (X caracteres)
```

## 📊 Optimizaciones

El bot ya está optimizado para ahorrar tokens:
- ✅ Modelo Haiku (más económico)
- ✅ Max tokens: 200 (respuestas cortas)
- ✅ Temperature: 0.6 (consistente)
- ✅ Prompt corto y eficiente
- ✅ Solo se usa como fallback (no como primario)

