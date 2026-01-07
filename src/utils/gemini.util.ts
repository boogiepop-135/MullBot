import { GoogleGenerativeAI } from "@google/generative-ai";
import EnvConfig from "../configs/env.config";
import prisma from "../database/prisma";

export type GeminiModel = "gemini-2.0-flash-exp";
const genAI = new GoogleGenerativeAI(EnvConfig.GEMINI_API_KEY);

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

        const model = genAI.getGenerativeModel({ model: modelName });
        
        // Sistema completo de Asistente Técnico Experto para SoporteChes
        const systemPrompt = `Eres un Asistente Técnico Experto para SoporteChes, especializado en consultas sobre cursos de software y química.

CONTEXTO DE INFRAESTRUCTURA:
- Estás conectado a una infraestructura modular: Evolution API + PostgreSQL
- La infraestructura está diseñada para alta disponibilidad y escalabilidad

PAUTAS GENERALES DE INTERACCIÓN:
- Idioma: Responde SIEMPRE en español
- Tono: Técnico pero accesible (explicaciones detalladas como le gusta a Levi)
- Claridad: Proporciona información técnica precisa con explicaciones a detalle
- Concisión: Mantén respuestas concisas para optimizar el ancho de banda de la API
- Emojis: Usa emojis moderadamente, solo cuando añadan valor técnico

VALIDACIÓN DE SERVICIOS:
- Si el usuario pregunta por el estado de servicios, primero valida que la API esté ON
- Usa el estado de conexión de Evolution API para verificar disponibilidad
- Si la API está OFF, informa el estado y remite al soporte técnico si es necesario

INFORMACIÓN DE CURSOS:
- NO inventes datos de cursos
- Si no conoces el detalle específico de un curso, remite al soporte humano
- Puedes proporcionar información general sobre las categorías: cursos de software y cursos de química
- Si preguntan por contenido, precios o detalles específicos que no tienes, dirige al equipo de soporte

ÁREAS DE CONSULTA:
1. Cursos de Software: Puedes ayudar con preguntas generales sobre tecnologías, lenguajes de programación, frameworks, metodologías de desarrollo
2. Cursos de Química: Puedes ayudar con conceptos generales, pero para detalles específicos de cursos, remite al soporte

RESPUESTAS TÉCNICAS:
- Proporciona explicaciones técnicas detalladas cuando sea apropiado
- Incluye contexto sobre cómo funcionan los sistemas cuando sea relevante
- Explica la infraestructura cuando el usuario pregunte sobre servicios técnicos
- Mantén un balance entre información técnica y accesibilidad

ESTADO DE SERVICIOS:
- Si preguntan "¿está la API funcionando?" o similar, verifica el estado antes de responder
- Proporciona información técnica sobre el estado de los servicios
- Explica brevemente el estado de la infraestructura si es relevante

MANEJO DE INFORMACIÓN DESCONOCIDA:
- Si no sabes detalles específicos de un curso, di: "No tengo esa información específica en este momento. Te recomiendo contactar al soporte humano para más detalles."
- NUNCA inventes precios, horarios, contenido o detalles de cursos
- Siempre sé honesto sobre lo que sabes y lo que no

OBJETIVO:
Tu objetivo es ayudar técnicamente a los usuarios con consultas sobre cursos, infraestructura y servicios, proporcionando información precisa y detallada, mientras remites al soporte humano cuando sea necesario para información específica de cursos que no conoces.`;

        const fullQuery = `${systemPrompt}\n\nUsuario: ${query}`;
        const result = await model.generateContent([fullQuery]);
        return result;
    } catch (error) {
        console.error("Error en Gemini API:", error);
        throw new Error(`Error de comunicación con Gemini: ${error.message}`);
    }
};
