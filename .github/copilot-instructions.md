# GitHub Copilot instructions for MullBot

## Objetivo (rápido) ✅
Ayuda a desarrolladores/agents a ser productivos rápidamente explicando la arquitectura, los flujos críticos, convenciones propias y puntos de integración. Usa ejemplos concretos y referencia archivos clave.

---

## Big picture & responsabilidades 🔧
- **Qué es**: MullBot es un agente de ventas por WhatsApp que usa **Gemini** (primario) y **Claude** (fallback) para generar respuestas. Interactúa con usuarios vía `whatsapp-web.js`, guarda sesiones en **MongoDB** y expone un panel admin en Express/EJS.
- **Componentes principales**:
  - `src/index.ts` — arranque: conecta DB, inicia `BotManager`, crons y rutas (EJS).
  - `src/bot.manager.ts` — orquesta el cliente WhatsApp, manejo de QR/sesiones, reconexiones y flujo de mensajes.
  - `src/commands/**` — comandos del bot; cada comando exporta `run(message, args, userI18n)`.
  - `src/utils/ai-fallback.util.ts` — lógica de IA: intenta Gemini, si falla usa Claude; contiene el *system prompt* de ventas.
  - `src/configs/*` — configuración (env, puppeteer, mongo store, logger).

## Qué debe saber un agent al editar/añadir código 🧭
- **Comandos**: seguir la firma y patrones de `src/commands/chat.command.ts` — primero comprobar respuestas rápidas (ahorran tokens), después llamar `aiCompletion`.
  - Ejemplo: `export const run = async (message, args, userI18n) => { ... }`.
- **Evitar**: volver a introducir soporte de OpenAI/ChatGPT; el archivo `src/utils/chat-gpt.util.ts` arroja un error a propósito.
- **IA**: la configuración de modelo por defecto está en `src/crm/models/bot-config.model.ts` y el prompt principal está en `src/utils/ai-fallback.util.ts` (modifícalo con cuidado, afecta ventas y cumplimiento de tono).
- **Sesiones WhatsApp**: la persistencia usa `wwebjs-mongo` (`MongoStore`) y guarda en colecciones como `auth_sessions`. Para forzar limpieza vea métodos en `BotManager` (`clearAllSessions`, `clearSessionFromMongoDB`, `logout`).
- **Escalado a agente humano**: Puedes configurar un `humanAgentPhone` desde el panel de administración y activar `notifyAgentOnAttention`. Cuando un contacto solicite atención humana, el bot pausará al contacto, enviará el mensaje de confirmación al usuario y notificará al número de agente (incluyendo el teléfono del usuario y el texto original). El admin puede entonces atender la conversación desde el panel (Chat modal) o responder directamente desde WhatsApp.
- **Puppeteer/Chrome**: el proyecto detecta rutas comunes en `src/configs/env.config.ts`. Si Puppeteer falla, comprueba `PUPPETEER_EXECUTABLE_PATH` y los logs (Railway puede necesitar `google-chrome-stable`).

## Flujos de desarrollo, build & debug ⚙️
- Desarrollo local: `npm install` → copiar `.env` desde `mullbot.env.example` → `npm run dev` (nodemon + TypeScript).
- Producción: `npm run build` (compila con `tsc` y corre `scripts/copy-assets.js` -> `dist/views`, `dist/public`) y luego `npm start`.
- Verificación de entorno/API: `npm run verify` ejecuta `scripts/verify-mullbot.ts` (comprueba GEMINI_API_KEY y conectividad básica con Gemini).
- Docker: `docker-compose up -d --build` levanta `app` + `mongo` (ver `docker-compose.yml`).
- Limpieza de sesiones: usar funciones de `BotManager` o inspeccionar colecciones relacionadas en Mongo (`authsessions`, `auth_sessions`, `sessions`, `whatsapp_sessions`, `wwebjs_sessions`).

## Variables críticas & comportamiento esperado 🗝️
- Obligatorias: `GEMINI_API_KEY`, `ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET` (validadas en `src/configs/env.config.ts`).
- Opcionales: `ANTHROPIC_API_KEY` (fallback Claude), `OPENWEATHERMAP_API_KEY`, `ASSEMBLYAI_API_KEY`, `SPEECHIFY_API_KEY`.
- Nota de versión: `package.json` exige Node >=20; README menciona 16 — **usar Node >=20**.

## Convenciones y patrones específicos 📐
- **Respuestas rápidas**: siempre intentar `getMainMenuResponse()` / `getOptionResponse()` antes de llamar a la IA (ver `src/utils/quick-responses.util.ts` y `src/commands/chat.command.ts`).
- **Delays**: tiempo de respuesta simulado configurable via `getBotDelay()` (respeta este patrón al enviar respuestas).
- **Voz**: el flujo voice→`speechToText`→IA→`textToSpeech` está implementado; sigue los ejemplos en `chat.command.ts` para manejo de archivos tmp y borrado (`del_file`).
- **Registro**: usar `logger` (`src/configs/logger.config.ts`) para trazabilidad; logs en `logs/`.

## Peligros y notas de mantenimiento ⚠️
- El admin panel puede mostrar modelos GPT en la UI (`src/views/admin.ejs`) pero el backend **no** soporta OpenAI: seleccionar GPT puede causar errores—la fuente de verdad está en `src/utils/ai-fallback.util.ts`.
- No hay tests automáticos activos (`npm test` es un placeholder). Si modificas lógica crítica (IA, pagos, sesiones), agrega pruebas y/o pasos manuales de verificación.
- Mantener el system prompt compatible con políticas y evitar exponer secretos en código.

## Quick checklist para PRs (rápido) ✅
- ¿`EnvConfig.validate()` pasa localmente? (usar `npm run verify`) 
- ¿No se están usando endpoints OpenAI por accidente? (`chat-gpt.util.ts` existe como stub)
- ¿Se respetan respuestas rápidas antes de la IA? (reduce consumo de tokens)
- ¿Agregaste logs suficientes para reproducciones de errores en producción?

---

¿Te parece que incluya extractos concretos de `ai-fallback.util.ts` o ejemplos de tests sugeridos para comandos específicos? Dime si quieres que lo amplíe o lo adapte al formato de tu equipo.