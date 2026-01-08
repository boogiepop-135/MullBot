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

        // Crear mensaje de notificación
        const displayName = contactName || phoneNumber;
        const notificationMessage = `🔔 *Nueva Solicitud de Atención*

👤 *Contacto:* ${displayName}
📱 *Teléfono:* ${phoneNumber}
⏰ *Hora:* ${new Date().toLocaleString('es-ES', {
            timeZone: 'America/Mexico_City',
            dateStyle: 'short',
            timeStyle: 'short'
        })}

💬 Un cliente ha solicitado atención humana. El bot ha sido pausado automáticamente.

📊 Para gestionar este contacto, ve al panel de administración:
${botConfig.businessWebsite || 'https://tu-dominio.com'}/admin

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
 * Notifica al agente sobre un pago recibido
 */
export async function notifyAgentAboutPayment(
    phoneNumber: string,
    contactName: string | null
): Promise<void> {
    try {
        const botConfig = await prisma.botConfig.findFirst();
        
        if (!botConfig?.notifyAgentOnAttention || !botConfig.humanAgentPhone) {
            return;
        }

        const agentPhone = botConfig.humanAgentPhone.replace(/[@c.us\s\-\(\)\+]/g, '');
        const displayName = contactName || phoneNumber;

        const notificationMessage = `💰 *Posible Comprobante de Pago Recibido*

👤 *Contacto:* ${displayName}
📱 *Teléfono:* ${phoneNumber}
⏰ *Hora:* ${new Date().toLocaleTimeString('es-ES')}

📸 El contacto ha enviado una imagen que podría ser un comprobante de pago.

✅ Verifica el comprobante y confirma el pago en el panel de administración.`;

        const botManager = BotManager.getInstance();
        await botManager.sendMessage(agentPhone, notificationMessage);
        await botManager.saveSentMessage(agentPhone, notificationMessage, null);
        
        logger.info(`✅ Notificación de pago enviada al agente ${agentPhone}`);

    } catch (error) {
        logger.error('Error al notificar pago al agente:', error);
    }
}
