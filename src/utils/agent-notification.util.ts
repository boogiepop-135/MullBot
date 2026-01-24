/**
 * Agent Notification Utility
 * Notifica al agente humano cuando un usuario solicita atención
 */

import logger from "../configs/logger.config";
import prisma from "../database/prisma";
import { BotManager } from "../bot.manager";

/**
 * Notifica al agente cuando un contacto solicita atención humana
 */
export async function notifyAgentAboutContact(
    phoneNumber: string,
    contactName: string | null
): Promise<void> {
    try {
        // Obtener configuración del bot
        const botConfig = await prisma.botConfig.findFirst();
        
        if (!botConfig) {
            logger.warn('No se encontró configuración del bot');
            return;
        }

        // Verificar si la notificación está habilitada
        if (!botConfig.notifyAgentOnAttention) {
            logger.debug('Notificación de agente deshabilitada');
            return;
        }

        // Verificar si hay un número de agente configurado
        if (!botConfig.humanAgentPhone || botConfig.humanAgentPhone.trim() === '') {
            logger.warn('No hay número de agente configurado');
            return;
        }

        // Normalizar número del agente
        const agentPhone = botConfig.humanAgentPhone.replace(/[@c.us\s\-\(\)\+]/g, '');
        
        if (!agentPhone) {
            logger.warn('Número de agente inválido después de normalizar');
            return;
        }

        // Obtener últimos mensajes para mostrar contexto
        const recentMessages = await prisma.message.findMany({
            where: {
                OR: [
                    { phoneNumber: phoneNumber },
                    { phoneNumber: phoneNumber.replace(/^\+/, '') },
                    { phoneNumber: `${phoneNumber}@s.whatsapp.net` }
                ]
            },
            orderBy: { timestamp: 'desc' },
            take: 3
        });

        // Crear mensaje de notificación con contexto de conversación
        const displayName = contactName || phoneNumber;
        let conversationContext = '';
        if (recentMessages.length > 0) {
            conversationContext = '\n📝 *Últimos mensajes:*\n';
            recentMessages.reverse().forEach((msg, idx) => {
                const sender = msg.isFromBot ? 'Bot' : displayName;
                const preview = msg.body.substring(0, 50) + (msg.body.length > 50 ? '...' : '');
                conversationContext += `${idx + 1}. ${sender}: ${preview}\n`;
            });
        }

        const notificationMessage = `🔔 *Nueva Solicitud de Atención*

👤 *Contacto:* ${displayName}
📱 *Teléfono:* ${phoneNumber}
⏰ *Hora:* ${new Date().toLocaleString('es-ES', {
            timeZone: 'America/Mexico_City',
            dateStyle: 'short',
            timeStyle: 'short'
        })}

💬 Un cliente ha solicitado atención humana. El bot ha sido pausado automáticamente.
${conversationContext}
📊 Para gestionar este contacto, ve al panel de administración:
https://bot.soporteches.online/admin

⚡ *Acciones rápidas:*
• Responde a este número para comunicarte con el cliente
• El bot permanecerá pausado hasta que lo reactives manualmente`;

        // Enviar notificación al agente
        const botManager = BotManager.getInstance();
        await botManager.sendMessage(agentPhone, notificationMessage);
        
        // Guardar la notificación en la base de datos
        await botManager.saveSentMessage(agentPhone, notificationMessage, null);
        
        logger.info(`✅ Notificación enviada al agente ${agentPhone} sobre contacto ${phoneNumber}`);

    } catch (error) {
        logger.error('Error al notificar al agente:', error);
        // No lanzar error para que no afecte el flujo principal
    }
}

/**
 * Notifica al agente sobre un nuevo mensaje importante
 */
export async function notifyAgentAboutMessage(
    phoneNumber: string,
    contactName: string | null,
    message: string
): Promise<void> {
    try {
        const botConfig = await prisma.botConfig.findFirst();
        
        if (!botConfig?.notifyAgentOnAttention || !botConfig.humanAgentPhone) {
            return;
        }

        const agentPhone = botConfig.humanAgentPhone.replace(/[@c.us\s\-\(\)\+]/g, '');
        const displayName = contactName || phoneNumber;

        const notificationMessage = `💬 *Nuevo Mensaje de ${displayName}*

📱 ${phoneNumber}
💬 "${message.substring(0, 150)}${message.length > 150 ? '...' : ''}"

⏰ ${new Date().toLocaleTimeString('es-ES')}`;

        const botManager = BotManager.getInstance();
        await botManager.sendMessage(agentPhone, notificationMessage);
        await botManager.saveSentMessage(agentPhone, notificationMessage, null);
        
        logger.debug(`Notificación de mensaje enviada al agente ${agentPhone}`);

    } catch (error) {
        logger.error('Error al notificar mensaje al agente:', error);
    }
}

/**
 * Notifica al agente sobre una cita agendada
 */
export async function notifyAgentAboutAppointment(
    phoneNumber: string,
    contactName: string | null,
    appointmentDate: Date
): Promise<void> {
    try {
        const botConfig = await prisma.botConfig.findFirst();
        
        if (!botConfig?.notifyAgentOnAttention || !botConfig.humanAgentPhone) {
            return;
        }

        const agentPhone = botConfig.humanAgentPhone.replace(/[@c.us\s\-\(\)\+]/g, '');
        const displayName = contactName || phoneNumber;

        const notificationMessage = `📅 *Nueva Cita Agendada*

👤 *Contacto:* ${displayName}
📱 *Teléfono:* ${phoneNumber}
📅 *Fecha de cita:* ${appointmentDate.toLocaleString('es-ES', {
            timeZone: 'America/Mexico_City',
            dateStyle: 'full',
            timeStyle: 'short'
        })}

✅ Revisa los detalles en el panel de administración.`;

        const botManager = BotManager.getInstance();
        await botManager.sendMessage(agentPhone, notificationMessage);
        await botManager.saveSentMessage(agentPhone, notificationMessage, null);
        
        logger.info(`✅ Notificación de cita enviada al agente ${agentPhone}`);

    } catch (error) {
        logger.error('Error al notificar cita al agente:', error);
    }
}

/**
 * Notifica al agente sobre un cambio de precio en un producto
 */
export async function notifyAgentAboutPriceChange(
    productName: string,
    oldPrice: number,
    newPrice: number,
    changedBy?: string
): Promise<void> {
    try {
        const botConfig = await prisma.botConfig.findFirst();
        
        if (!botConfig?.notifyAgentOnAttention || !botConfig.humanAgentPhone) {
            return;
        }

        const agentPhone = botConfig.humanAgentPhone.replace(/[@c.us\s\-\(\)\+]/g, '');
        const changedByText = changedBy ? `\n👤 *Modificado por:* ${changedBy}` : '';

        const priceChange = newPrice > oldPrice ? '📈 Aumentó' : '📉 Disminuyó';
        const difference = Math.abs(newPrice - oldPrice);
        const percentChange = ((difference / oldPrice) * 100).toFixed(1);

        const notificationMessage = `💰 *Cambio de Precio Detectado*

📦 *Producto:* ${productName}
${priceChange}: $${oldPrice.toFixed(2)} → $${newPrice.toFixed(2)}
💵 *Diferencia:* $${difference.toFixed(2)} (${percentChange}%)
⏰ *Hora:* ${new Date().toLocaleString('es-ES', {
            timeZone: 'America/Mexico_City',
            dateStyle: 'short',
            timeStyle: 'short'
        })}${changedByText}

✅ El precio ha sido actualizado en la base de datos.
📊 Verifica que el cambio sea correcto en el panel de administración.`;

        const botManager = BotManager.getInstance();
        await botManager.sendMessage(agentPhone, notificationMessage);
        await botManager.saveSentMessage(agentPhone, notificationMessage, null);
        
        logger.info(`✅ Notificación de cambio de precio enviada al agente ${agentPhone} para producto: ${productName}`);

    } catch (error) {
        logger.error('Error al notificar cambio de precio al agente:', error);
    }
}

/**
 * Notifica al agente sobre un producto creado o eliminado
 */
export async function notifyAgentAboutProductChange(
    action: 'created' | 'deleted',
    productName: string,
    price?: number,
    changedBy?: string
): Promise<void> {
    try {
        const botConfig = await prisma.botConfig.findFirst();
        
        if (!botConfig?.notifyAgentOnAttention || !botConfig.humanAgentPhone) {
            return;
        }

        const agentPhone = botConfig.humanAgentPhone.replace(/[@c.us\s\-\(\)\+]/g, '');
        const changedByText = changedBy ? `\n👤 *Modificado por:* ${changedBy}` : '';
        const priceText = price ? `\n💰 *Precio:* $${price.toFixed(2)}` : '';

        const actionText = action === 'created' ? '✅ Producto Creado' : '🗑️ Producto Eliminado';
        const emoji = action === 'created' ? '✨' : '⚠️';

        const notificationMessage = `${emoji} *${actionText}*

📦 *Producto:* ${productName}${priceText}
⏰ *Hora:* ${new Date().toLocaleString('es-ES', {
            timeZone: 'America/Mexico_City',
            dateStyle: 'short',
            timeStyle: 'short'
        })}${changedByText}

${action === 'created' 
    ? '✅ El producto está ahora disponible en el catálogo.' 
    : '⚠️ El producto ha sido eliminado del catálogo.'}
📊 Revisa los cambios en el panel de administración.`;

        const botManager = BotManager.getInstance();
        await botManager.sendMessage(agentPhone, notificationMessage);
        await botManager.saveSentMessage(agentPhone, notificationMessage, null);
        
        logger.info(`✅ Notificación de ${action} de producto enviada al agente ${agentPhone} para: ${productName}`);

    } catch (error) {
        logger.error(`Error al notificar ${action} de producto al agente:`, error);
    }
}
