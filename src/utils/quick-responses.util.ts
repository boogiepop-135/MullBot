import prisma from '../database/prisma';
import logger from '../configs/logger.config';

/**
 * Respuestas rápidas predefinidas para opciones del menú
 */

// Función para obtener respuesta del menú principal
export const getMainMenuResponse = async (): Promise<string> => {
    try {
        const content = await prisma.botContent.findUnique({ where: { key: 'main_menu' } });
        if (content) {
            logger.info(`✅ BotContent 'main_menu' encontrado (${content.content.length} caracteres)`);
            return content.content;
        } else {
            logger.warn('⚠️ BotContent "main_menu" no encontrado, usando fallback');
        }
    } catch (error) {
        logger.error('Error fetching main menu:', error);
    }

    // Fallback si no se encuentra en la base de datos
    return `👋 *MENÚ PRINCIPAL MÜLLBLUE*

¡Hola! ¿En qué puedo ayudarte hoy? 🤔

*Opciones disponibles:*

*1.* Conocer el proceso de compostaje fermentativo
*2.* Dudas sobre precios y promociones
*3.* Métodos de pago disponibles
*4.* ¿Qué incluye el kit?
*5.* Dimensiones y espacio necesario
*6.* Información sobre envío y entrega
*7.* Preguntas frecuentes
*8.* Hablar con un agente

Escribe el *número* de la opción que te interesa o pregunta lo que necesites 🌱

*💡 Tip:* Puedes escribir *menú* o *volver* en cualquier momento para ver estas opciones nuevamente`;
};

// Función para obtener respuesta de una opción específica
export const getOptionResponse = async (optionNumber: number): Promise<string | null> => {
    try {
        const key = `option_${optionNumber}_${getOptionKey(optionNumber)}`;
        const content = await prisma.botContent.findUnique({ where: { key } });
        if (content) {
            logger.info(`✅ BotContent '${key}' encontrado (${content.content.length} caracteres)`);
            return content.content;
        } else {
            logger.debug(`ℹ️ BotContent "${key}" no encontrado`);
        }
    } catch (error) {
        logger.error(`Error fetching option ${optionNumber}:`, error);
    }
    return null;
};

// Helper para obtener la clave de cada opción
function getOptionKey(optionNumber: number): string {
    const keys: { [key: number]: string } = {
        1: 'process',
        2: 'price',
        3: 'payment',
        4: 'kit',
        5: 'dimensions',
        6: 'shipping',
        7: 'faq',
        8: 'agent'
    };
    return keys[optionNumber] || '';
}

// Función para obtener contenido personalizado por key
export const getBotContentByKey = async (key: string): Promise<string | null> => {
    try {
        const content = await prisma.botContent.findUnique({ where: { key } });
        if (content) {
            return content.content;
        }
    } catch (error) {
        console.error(`Error fetching bot content for key "${key}":`, error);
    }
    return null;
};

// Función para obtener respuesta de agente personalizada
export const getAgentResponse = async (): Promise<string> => {
    try {
        const content = await prisma.botContent.findUnique({ where: { key: 'option_8_agent' } });
        if (content) {
            logger.info(`✅ BotContent 'option_8_agent' encontrado (${content.content.length} caracteres)`);
            return content.content;
        } else {
            logger.warn('⚠️ BotContent "option_8_agent" no encontrado, usando fallback');
        }
    } catch (error) {
        logger.error('Error fetching agent response:', error);
    }
    
    // Fallback si no se encuentra en la base de datos
    return `👤 *ATENCIÓN PERSONALIZADA*

Entiendo que prefieres hablar con una persona.

Tu solicitud ha sido registrada y un asesor te contactará pronto.

⏰ *Horario de atención:* Lunes a Viernes 9am - 7pm

¡Gracias por tu paciencia! 🌱`;
};

// Función para obtener catálogo personalizado
export const getCatalogResponse = async (): Promise<string | null> => {
    try {
        const content = await prisma.botContent.findUnique({ where: { key: 'catalogo_mullblue' } });
        if (content) {
            logger.info(`✅ BotContent 'catalogo_mullblue' encontrado (${content.content.length} caracteres)`);
            return content.content;
        } else {
            logger.debug('ℹ️ BotContent "catalogo_mullblue" no encontrado (opcional)');
        }
    } catch (error) {
        logger.error('Error fetching catalog response:', error);
    }
    return null;
};

// Función para agregar el footer a cualquier mensaje
export const addMenuFooter = (message: string): string => {
    return `${message}

---
*💡 Tip:* Escribe *menú* o *volver* para ver todas las opciones disponibles 🌱`;
};
