import EnvConfig from "../configs/env.config";
import logger from "../configs/logger.config";
import { AIModelManager } from "../services/ai-model-manager.service";
import { buildCrmContextForAI, getNoInfoMessage } from "./crm-context.util";
import { getBaseBehavioralPrompt } from "./mullblue-prompt.util";

export type AIProvider = "gemini" | "claude";

export interface AIResponse {
    text: string;
    provider: AIProvider;
}

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

async function buildSystemPrompt(): Promise<string> {
    const base = getBaseBehavioralPrompt();
    const crmContext = await buildCrmContextForAI();
    const noInfo = getNoInfoMessage();
    const criticalRules = `
---
REGLAS CRÍTICAS DE VENTA (OBLIGATORIAS):
1. Solo usa la información del bloque "INFORMACIÓN DEL CRM" arriba. Es tu única fuente de datos.
2. Si el cliente pregunta algo que NO está cubierto en ese bloque, responde EXACTAMENTE esto (no inventes ni resumas):
${noInfo}
3. ⚠️ CRÍTICO - PRECIOS:
   - NUNCA inventes precios, ni siquiera aproximados
   - Si preguntan por precios del kit o cualquier producto, NO menciones números
   - Responde SOLO: "Te muestro nuestros productos y precios actualizados..." y el sistema mostrará el catálogo automáticamente
   - Si ya se mostró el catálogo en el historial, refiere a él: "Como viste en el catálogo que te envié..." o "¿Te interesa alguno en particular del catálogo?"
4. Si preguntan por información específica de un kit/producto, el sistema buscará y enviará la imagen y datos automáticamente. NO inventes información.
5. Como VENDEDOR: Guía hacia la compra, destaca beneficios, crea valor, pero NUNCA inventes datos.`;

    let custom = '';
    try {
        const prisma = (await import('../database/prisma')).default;
        const botConfig = await prisma.botConfig.findFirst();
        if (botConfig?.aiSystemPrompt?.trim()) {
            custom = `\n\n--- INSTRUCCIONES ADICIONALES DEL CRM (BotConfig) ---\n${botConfig.aiSystemPrompt.trim()}`;
            logger.info('✅ Inyectando instrucciones adicionales desde BotConfig (CRM)');
        }
    } catch (e) {
        logger.warn('Error obteniendo BotConfig para prompt:', e);
    }

    return `${base}${custom}

---
INFORMACIÓN DEL CRM (ÚNICA FUENTE DE DATOS - solo responde con esto):
${crmContext}
${criticalRules}`;
}

export const aiCompletion = async (query: string, conversationHistory: ConversationMessage[] = []): Promise<AIResponse> => {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length === 0) {
        throw new Error("Query vacío");
    }

    try {
        if (EnvConfig.GEMINI_API_KEY) {
            logger.info(`🤖 Intentando Gemini con AIModelManager para query: "${cleanQuery.substring(0, 50)}..."`);
            const systemPrompt = await buildSystemPrompt();
            logger.debug('✅ System prompt construido con contexto CRM');

            let fullQuery = cleanQuery;
            if (conversationHistory.length > 0) {
                const historyText = conversationHistory
                    .map(msg => `${msg.role === 'user' ? 'Cliente' : 'Vendedor'}: ${msg.content}`)
                    .join('\n');
                
                // Verificar si ya se mostró el catálogo en el historial
                const catalogWasShown = conversationHistory.some(msg => 
                    msg.role === 'assistant' && (
                        msg.content.includes('CATÁLOGO') || 
                        msg.content.includes('CATALOGO') ||
                        msg.content.includes('Precio: *$')
                    )
                );
                
                const catalogContext = catalogWasShown 
                    ? '\n⚠️ IMPORTANTE: Ya se mostró el catálogo en el historial. NO inventes precios. Si preguntan por precios, refiere al catálogo que ya se mostró: "Como viste en el catálogo que te envié..." o "¿Te interesa alguno en particular del catálogo?"'
                    : '';
                
                fullQuery = `HISTORIAL DE CONVERSACIÓN:
${historyText}

MENSAJE ACTUAL DEL CLIENTE:
${cleanQuery}
${catalogContext}

IMPORTANTE: 
- Responde considerando el historial. Si el cliente escribió un número, refiere a la opción que le ofreciste.
- Solo usa información del CRM; si no está, di que no cuentas con ella y ofrece asesor (8).
- Si ya se mostró el catálogo, NO lo vuelvas a mencionar ni inventes precios. Enfócate en guiar hacia la compra o resolver dudas específicas.`;
                logger.debug(`📜 Contexto con ${conversationHistory.length} mensajes${catalogWasShown ? ' (catálogo ya mostrado)' : ''}`);
            }

            const aiManager = AIModelManager.getInstance();
            const result = await aiManager.generateContent(fullQuery, systemPrompt);
            if (result.text?.trim()) {
                logger.info(`✅ Gemini respondió (${result.modelUsed}, ${result.text.length} chars)`);
                return { text: result.text, provider: "gemini" };
            }
        } else {
            logger.warn("GEMINI_API_KEY no configurada, saltando a Claude");
        }
    } catch (error) {
        logger.error(`❌ Gemini falló: ${(error as Error).message}`);
        logger.info('🔄 Intentando Claude como fallback...');
    }

    try {
        if (EnvConfig.ANTHROPIC_API_KEY) {
            logger.info(`🤖 Intentando Claude para query: "${cleanQuery.substring(0, 50)}..."`);
            const systemPrompt = await buildSystemPrompt();
            const claudeResponse = await tryClaude(cleanQuery, systemPrompt);
            if (claudeResponse?.trim()) {
                logger.info(`✅ Claude respondió (${claudeResponse.length} caracteres)`);
                return { text: claudeResponse, provider: "claude" };
            }
        } else {
            logger.warn("ANTHROPIC_API_KEY no configurada");
        }
    } catch (error) {
        logger.error(`❌ Claude falló: ${(error as Error).message}`);
    }

    logger.error("❌ Todas las APIs de IA fallaron");
    throw new Error("Todas las APIs de IA están temporalmente no disponibles. Por favor intenta de nuevo más tarde.");
};

async function tryClaude(query: string, systemPrompt: string): Promise<string> {
    if (!EnvConfig.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY no configurada");
    }
    const payload = `${systemPrompt}\n\n---\nUsuario: ${query}`;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': EnvConfig.ANTHROPIC_API_KEY,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 400,
            temperature: 0.6,
            messages: [{ role: 'user', content: payload }]
        })
    });
    if (!response.ok) {
        const err = await response.text();
        logger.error(`Claude API ${response.status}: ${err}`);
        throw new Error(`Claude API ${response.status}: ${err}`);
    }
    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (!text?.trim()) throw new Error("Empty response from Claude");
    return text;
}
