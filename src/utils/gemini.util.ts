import { GoogleGenerativeAI } from "@google/generative-ai";
import EnvConfig from "../configs/env.config";
import prisma from "../database/prisma";
import { AIModelManager } from "../services/ai-model-manager.service";

export type GeminiModel = "gemini-2.0-flash-exp" | "gemini-1.5-flash" | "gemini-1.5-pro";
const genAI = new GoogleGenerativeAI(EnvConfig.GEMINI_API_KEY);
const aiManager = AIModelManager.getInstance();

// Mapeo de personalidades a descripciones
const personalityMap: { [key: string]: string } = {
    'experto': 'un experto vendedor altamente capacitado y profesional',
    'amigable': 'un asistente amigable y cercano que genera confianza',
    'formal': 'un asesor formal y corporativo con trato profesional',
    'persuasivo': 'un vendedor persuasivo experto en técnicas de cierre de ventas'
};

// Valores por defecto para la configuración del vendedor
const defaultSellerConfig = {
    sellerPersonality: 'experto',
    canOfferDiscounts: false,
    maxDiscountPercent: 10,
    discountConditions: 'Solo ofrecer descuentos cuando el cliente pregunte directamente por promociones o descuentos. No ofrecer descuentos de forma proactiva.'
};

export const geminiCompletion = async (query: string, modelName: GeminiModel = "gemini-2.0-flash-exp") => {
    try {
        if (!EnvConfig.GEMINI_API_KEY) {
            throw new Error("API key de Gemini no configurada");
        }

        // Cargar configuración del bot
        const botConfigDoc = await prisma.botConfig.findFirst();
        const sellerPersonality = botConfigDoc?.sellerPersonality || defaultSellerConfig.sellerPersonality;
        const canOfferDiscounts = botConfigDoc?.canOfferDiscounts ?? defaultSellerConfig.canOfferDiscounts;
        const maxDiscountPercent = botConfigDoc?.maxDiscountPercent || defaultSellerConfig.maxDiscountPercent;
        const discountConditions = botConfigDoc?.discountConditions || defaultSellerConfig.discountConditions;
        
        const personality = personalityMap[sellerPersonality] || personalityMap['experto'];
        
        // Configuración de descuentos
        let discountInstructions = '';
        if (canOfferDiscounts) {
            discountInstructions = `
POLÍTICA DE DESCUENTOS:
- Estás AUTORIZADO a ofrecer descuentos de hasta ${maxDiscountPercent}% máximo
- Condiciones: ${discountConditions}
- Cuando ofrezcas descuento, hazlo parecer una oferta especial y exclusiva para generar urgencia
- Nunca ofrezcas el descuento máximo de inmediato, empieza con un porcentaje menor si el cliente negocia`;
        } else {
            discountInstructions = `
POLÍTICA DE DESCUENTOS:
- NO estás autorizado a ofrecer descuentos
- Si el cliente pide descuento, explica que los precios ya incluyen el mejor valor posible con envío gratis y acompañamiento personalizado
- Destaca el valor del producto en lugar de negociar precio`;
        }
        
        // Obtener prompt completo de Müllblue desde el archivo centralizado
        const mullbluePromptModule = await import('./mullblue-prompt.util');
        const basePrompt = mullbluePromptModule.getFullMullbluePrompt();
        
        // Agregar solo las instrucciones de descuentos (el resto ya está en el prompt centralizado)
        const systemPrompt = basePrompt + `

${discountInstructions}
`;

        // Usar AIModelManager para generar con fallback automático
        const result = await aiManager.generateContent(query, systemPrompt);
        
        // Retornar en el formato esperado por el código existente
        return {
            response: {
                text: () => result.text
            }
        };
    } catch (error) {
        console.error("Error en Gemini API:", error);
        throw new Error(`Error de comunicación con Gemini: ${error.message}`);
    }
};
