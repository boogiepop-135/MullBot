import prisma from '../database/prisma';
import logger from '../configs/logger.config';
import { getNoInfoMessage } from './crm-context.util';

/**
 * Respuestas rápidas predefinidas para opciones del menú
 * Todas deben provenir del CRM (BotContent). Si no están, se usa mensaje estándar de "no info + asesor".
 */

// Función para obtener respuesta del menú principal
export const getMainMenuResponse = async (): Promise<string> => {
    try {
        const content = await prisma.botContent.findUnique({ where: { key: 'main_menu' } });
        if (content) {
            logger.info(`✅ BotContent 'main_menu' encontrado (${content.content.length} caracteres)`);
            return content.content;
        } else {
            logger.warn('⚠️ BotContent "main_menu" no encontrado en CRM');
        }
    } catch (error) {
        logger.error('Error fetching main menu:', error);
    }

    // Si no está en CRM, informar y ofrecer asesor
    return `No tenemos el menú configurado en este momento. ${getNoInfoMessage()}`;
};

// Función para obtener respuesta de una opción específica
export const getOptionResponse = async (optionNumber: number): Promise<string | null> => {
    try {
        const key = `option_${optionNumber}_${getOptionKey(optionNumber)}`;
        const content = await prisma.botContent.findUnique({ where: { key } });
        if (content) {
            logger.info(`✅ BotContent '${key}' encontrado (${content.content.length} caracteres)`);
            // Filtrar links de wa.me/c/ que no deben mostrarse
            let filteredContent = content.content.replace(/https?:\/\/wa\.me\/c\/[^\s]+/gi, '');
            filteredContent = filteredContent.replace(/wa\.me\/c\/[^\s]+/gi, '');
            return filteredContent.trim() || content.content; // Si queda vacío, devolver original
        } else {
            logger.debug(`ℹ️ BotContent "${key}" no encontrado en CRM`);
        }
    } catch (error) {
        logger.error(`Error fetching option ${optionNumber}:`, error);
    }
    return null; // Caller debe manejar (puede usar getNoInfoMessage())
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
            logger.warn('⚠️ BotContent "option_8_agent" no encontrado en CRM');
        }
    } catch (error) {
        logger.error('Error fetching agent response:', error);
    }
    
    // Si no está en CRM, construir mensaje mínimo desde BotConfig o usar mensaje estándar
    try {
        const config = await prisma.botConfig.findFirst();
        const hours = config?.businessHours || 'No especificado';
        return `✅ *Solicitud Recibida*

Tu solicitud para hablar con un asesor ha sido registrada.

⏰ *Horario de atención:* ${hours}

Un asesor se pondrá en contacto contigo pronto. ¡Gracias por tu paciencia! 🌱`;
    } catch (e) {
        logger.error('Error obteniendo BotConfig para respuesta de agente:', e);
        return getNoInfoMessage();
    }
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
    return null; // Es opcional, el catálogo se construye desde productos si no hay contenido personalizado
};

// Función para agregar el footer a cualquier mensaje
export const addMenuFooter = (message: string): string => {
    return `${message}

---
*💡 Tip:* Escribe *menú* o *volver* para ver todas las opciones disponibles 🌱`;
};
