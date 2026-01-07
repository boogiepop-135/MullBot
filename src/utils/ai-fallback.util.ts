import { GoogleGenerativeAI } from "@google/generative-ai";
import EnvConfig from "../configs/env.config";
import logger from "../configs/logger.config";

export type AIProvider = "gemini" | "claude";

export interface AIResponse {
    text: string;
    provider: AIProvider;
}

export const aiCompletion = async (query: string): Promise<AIResponse> => {
    // Limpiar y normalizar el query para evitar problemas
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length === 0) {
        throw new Error("Query vacío");
    }
    //HOLA SOY ALDAIR woooh
    // Intentar primero con Gemini
    try {
        if (EnvConfig.GEMINI_API_KEY) {
            logger.info(`🤖 Intentando Gemini para query: "${cleanQuery.substring(0, 50)}..."`);
            const geminiResponse = await tryGemini(cleanQuery);
            if (geminiResponse && geminiResponse.trim().length > 0) {
                logger.info(`✅ Gemini respondió exitosamente (${geminiResponse.length} caracteres)`);
                return {
                    text: geminiResponse,
                    provider: "gemini"
                };
            }
        } else {
            logger.warn("GEMINI_API_KEY no configurada, saltando a Claude");
        }
    } catch (error) {
        logger.error(`❌ Gemini falló: ${error.message}`);
        logger.info(`🔄 Intentando Claude como fallback...`);
        // Continuar con Claude si Gemini falla
    }

    // Si Gemini falla o no está configurada, intentar con Claude
    try {
        if (EnvConfig.ANTHROPIC_API_KEY) {
            logger.info(`🤖 Intentando Claude (Haiku) para query: "${cleanQuery.substring(0, 50)}..."`);
            const claudeResponse = await tryClaude(cleanQuery);
            if (claudeResponse && claudeResponse.trim().length > 0) {
                logger.info(`✅ Claude respondió exitosamente (${claudeResponse.length} caracteres)`);
                return {
                    text: claudeResponse,
                    provider: "claude"
                };
            }
        } else {
            logger.warn("ANTHROPIC_API_KEY no configurada - Claude fallback no disponible");
        }
    } catch (error) {
        logger.error(`❌ Claude falló: ${error.message}`);
    }

    // Si ambas fallan, lanzar error específico
    logger.error("❌ Todas las APIs de IA fallaron");
    throw new Error("Todas las APIs de IA están temporalmente no disponibles. Por favor intenta de nuevo más tarde.");
};

const tryGemini = async (query: string): Promise<string> => {
    const genAI = new GoogleGenerativeAI(EnvConfig.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp", // Modelo más reciente y eficiente
        generationConfig: {
            maxOutputTokens: 200, // Reducido para ahorrar tokens
            temperature: 0.6, // Reducido para respuestas más consistentes
        }
    });
    
    // Prompt más corto y eficiente para ahorrar tokens
    const systemPrompt = `Eres Asistente Técnico Experto para SoporteChes. Responde en español. Consultas sobre cursos de software y química.

IMPORTANTE:
- Tono técnico pero accesible (explicaciones detalladas)
- Responde concisamente para optimizar ancho de banda
- Si preguntan por estado de servicios, valida que la API esté ON
- NO inventes datos de cursos; si no conoces detalles, remite al soporte humano

CONTEXTO: Infraestructura modular (Evolution API + PostgreSQL)

ÁREAS: Cursos de software y química. Para detalles específicos de cursos, remite al soporte.`;

    // Usar solo el query del usuario para reducir tokens de entrada
    const fullQuery = `${systemPrompt}\n\nUsuario: ${query}`;
    
    try {
        const result = await model.generateContent([fullQuery]);
        const responseText = result.response.text();
        if (!responseText || responseText.trim().length === 0) {
            throw new Error("Empty response from Gemini");
        }
        return responseText;
    } catch (error) {
        logger.error(`Gemini API error: ${error.message}`);
        throw error;
    }
};

const tryClaude = async (query: string): Promise<string> => {
    if (!EnvConfig.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY no configurada");
    }
    
    // Prompt más corto para ahorrar tokens (optimizado para Claude Haiku)
    const systemPrompt = `Eres Asistente Técnico Experto para SoporteChes. Responde en español. Consultas sobre cursos de software y química.

IMPORTANTE:
- Tono técnico pero accesible (explicaciones detalladas)
- Responde concisamente para optimizar ancho de banda
- Si preguntan por estado de servicios, valida que la API esté ON
- NO inventes datos de cursos; si no conoces detalles, remite al soporte humano

CONTEXTO: Infraestructura modular (Evolution API + PostgreSQL)

ÁREAS: Cursos de software y química. Para detalles específicos de cursos, remite al soporte.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': EnvConfig.ANTHROPIC_API_KEY,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307', // Modelo más económico de Claude (muy bajo costo)
            max_tokens: 200, // Reducido para ahorrar tokens (~$0.00025 por 1K tokens output)
            temperature: 0.6, // Mismo que Gemini para consistencia
            messages: [
                {
                    role: 'user',
                    content: `${systemPrompt}\n\nUsuario: ${query}`
                }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Claude API error: ${response.status} - ${errorText}`);
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const responseText = data.content?.[0]?.text;
    if (!responseText || responseText.trim().length === 0) {
        throw new Error("Empty response from Claude");
    }
    return responseText;
};
