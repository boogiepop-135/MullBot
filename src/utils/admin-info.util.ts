import { Message } from "whatsapp-web.js";
import prisma from "../database/prisma";
import { getSystemInfo } from "./ngrok.util";
import logger from "../configs/logger.config";
import EnvConfig from "../configs/env.config";

/**
 * Verifica si un número de teléfono es el administrador/agente humano
 */
export async function isAdminPhone(phoneNumber: string): Promise<boolean> {
    try {
        const botConfig = await prisma.botConfig.findFirst();
        if (!botConfig || !botConfig.humanAgentPhone) {
            return false;
        }

        // Normalizar números (remover @c.us, espacios, etc.)
        const normalizedAdmin = botConfig.humanAgentPhone.replace(/[@c.us\s-]/g, '');
        const normalizedPhone = phoneNumber.replace(/[@c.us\s-]/g, '');

        return normalizedAdmin === normalizedPhone;
    } catch (error) {
        logger.error('Error checking if phone is admin:', error);
        return false;
    }
}

/**
 * Verifica si ya se le ha enviado información al admin (en las últimas 24 horas)
 */
async function hasReceivedInfo(phoneNumber: string): Promise<boolean> {
    try {
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);
        
        // Buscar si ya existe un mensaje del bot con información del sistema en las últimas 24h
        const infoMessage = await prisma.message.findFirst({
            where: {
                phoneNumber: phoneNumber,
                isFromBot: true,
                timestamp: { gte: oneDayAgo },
                body: { contains: 'Información del Sistema' }
            }
        });

        return !!infoMessage;
    } catch (error) {
        logger.error('Error checking if admin received info:', error);
        return false;
    }
}

/**
 * Envía información del sistema al administrador
 */
export async function sendAdminInfo(client: any, phoneNumber: string): Promise<void> {
    try {
        // Verificar si es admin
        const isAdmin = await isAdminPhone(phoneNumber);
        if (!isAdmin) {
            return;
        }

        // Verificar si ya recibió la información (evitar spam)
        const alreadyReceived = await hasReceivedInfo(phoneNumber);
        if (alreadyReceived) {
            logger.debug(`Admin ${phoneNumber} ya recibió información del sistema`);
            return;
        }

        // Obtener información del sistema
        const systemInfo = await getSystemInfo();

        // Formatear número para WhatsApp
        const formattedNumber = phoneNumber.includes('@') 
            ? phoneNumber 
            : `${phoneNumber}@c.us`;

        // Crear mensaje con información
        const publicUrlText = systemInfo.publicUrl 
            ? `🌍 *Pública:* ${systemInfo.publicUrl}/admin`
            : systemInfo.ngrokUrl 
                ? `🌍 *Pública (Ngrok):* ${systemInfo.ngrokUrl}/admin`
                : '⚠️ URL pública no configurada';

        const infoMessage = `🌐 *Información del Sistema MullBot*

📊 *URLs de Acceso:*
${publicUrlText}
🏠 *Local:* ${systemInfo.localUrl}/admin

🔐 *Credenciales de Administrador:*
👤 *Usuario:* \`${systemInfo.adminCredentials.username}\`
🔑 *Contraseña:* \`${systemInfo.adminCredentials.password}\`

⚠️ *IMPORTANTE:*
${systemInfo.publicUrl ? '• Usa tu dominio propio para acceder desde internet' : systemInfo.ngrokUrl ? '• La URL de Ngrok cambia cada vez que reinicias el servidor' : '• Configura PUBLIC_URL en .env para usar tu dominio'}
• Cambia la contraseña después del primer login
• Guarda esta información de forma segura

💡 *Comandos Útiles:*
• \`/help\` - Ver ayuda del bot
• \`/estadisticas\` - Ver estadísticas

🔄 Para actualizar esta información, envía: \`/info\``;

        // Enviar mensaje usando Evolution API
        const { BotManager } = await import('../bot.manager');
        const botManager = BotManager.getInstance();
        await botManager.sendMessage(phoneNumber.replace(/@[cg]\.us$/, ''), infoMessage);
        
        // Guardar mensaje en la base de datos
        await botManager.saveSentMessage(phoneNumber, infoMessage, null);
        
        logger.info(`✅ Información del sistema enviada al admin: ${phoneNumber}`);

    } catch (error) {
        logger.error(`Error sending admin info to ${phoneNumber}:`, error);
    }
}

/**
 * Envía información actualizada al admin (cuando solicita /info)
 */
export async function sendUpdatedAdminInfo(client: any, phoneNumber: string): Promise<void> {
    try {
        const isAdmin = await isAdminPhone(phoneNumber);
        if (!isAdmin) {
            return;
        }

        const systemInfo = await getSystemInfo();
        const formattedNumber = phoneNumber.includes('@') 
            ? phoneNumber 
            : `${phoneNumber}@c.us`;

        const publicUrlText = systemInfo.publicUrl 
            ? `🌍 *Pública:* ${systemInfo.publicUrl}/admin`
            : systemInfo.ngrokUrl 
                ? `🌍 *Pública (Ngrok):* ${systemInfo.ngrokUrl}/admin`
                : '⚠️ URL pública no configurada';

        const statusText = systemInfo.publicUrl 
            ? `\n✅ Dominio propio configurado: ${systemInfo.publicUrl}`
            : systemInfo.ngrokUrl 
                ? `\n✅ Ngrok activo: ${systemInfo.ngrokUrl}`
                : '\n⚠️ URL pública no configurada. Configura PUBLIC_URL en .env para usar tu dominio.';

        const infoMessage = `🔄 *Información Actualizada del Sistema*

📊 *URLs de Acceso:*
${publicUrlText}
🏠 *Local:* ${systemInfo.localUrl}/admin

🔐 *Credenciales:*
👤 *Usuario:* \`${systemInfo.adminCredentials.username}\`
🔑 *Contraseña:* \`${systemInfo.adminCredentials.password}\`
${statusText}`;

        // Enviar mensaje usando Evolution API
        const { BotManager } = await import('../bot.manager');
        const botManager = BotManager.getInstance();
        await botManager.sendMessage(phoneNumber.replace(/@[cg]\.us$/, ''), infoMessage);
        
        // Guardar mensaje en la base de datos
        await botManager.saveSentMessage(phoneNumber, infoMessage, null);
        
        logger.info(`✅ Información actualizada enviada al admin: ${phoneNumber}`);

    } catch (error) {
        logger.error(`Error sending updated admin info:`, error);
    }
}
