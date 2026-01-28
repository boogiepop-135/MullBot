/**
 * Onboarding Utility para Evolution API
 *
 * Primer mensaje = menú principal Müllblue (CRM) + imagen info.png.
 * Ya no se usa video genérico ni "type !help".
 */

import { EvolutionAPIv2Service } from '../services/evolution-api-v2.service';
import { UserI18n } from './i18n.util';
import prisma from '../database/prisma';
import logger from '../configs/logger.config';
import * as fs from 'fs';
import * as path from 'path';

/** Resultado del onboarding: si se envió algo y el texto (para guardar en BD). */
export type OnboardResult = { sent: boolean; message?: string };

/**
 * Verifica si un usuario ya ha sido onboarded (recibió mensaje del bot)
 */
async function isUserOnboarded(phoneNumber: string): Promise<boolean> {
    try {
        const messages = await prisma.message.findMany({
            where: {
                phoneNumber: {
                    in: [phoneNumber, `${phoneNumber}@s.whatsapp.net`]
                },
                isFromBot: true
            },
            orderBy: { timestamp: 'desc' },
            take: 2
        });
        return messages.length > 0;
    } catch (error) {
        logger.error('Error checking if user is onboarded:', error);
        return false;
    }
}

/**
 * Enviar primer mensaje: menú principal Müllblue (CRM) + info.png.
 * Retorna { sent, message } para que el handler guarde y evite duplicar con processMessage.
 */
export async function onboardEvolution(
    evolutionAPI: EvolutionAPIv2Service,
    phoneNumber: string,
    _content: string,
    _userI18n: UserI18n,
    autoOnboard: boolean = true
): Promise<OnboardResult> {
    try {
        if (autoOnboard && await isUserOnboarded(phoneNumber)) {
            logger.debug(`Usuario ${phoneNumber} ya fue onboarded, omitiendo`);
            return { sent: false };
        }

        const { getMainMenuResponse } = await import('./quick-responses.util');
        const menuText = await getMainMenuResponse();
        const infoPath = path.join(process.cwd(), 'public', 'info.png');

        if (fs.existsSync(infoPath)) {
            await evolutionAPI.sendMedia(phoneNumber, infoPath, menuText, 'image');
            logger.info(`✅ Onboarding enviado a ${phoneNumber}: menú Müllblue + info.png`);
            return { sent: true, message: menuText };
        }

        await evolutionAPI.sendMessage(phoneNumber, menuText);
        logger.info(`✅ Onboarding enviado a ${phoneNumber}: menú Müllblue (sin imagen)`);
        return { sent: true, message: menuText };
    } catch (error) {
        logger.error(`Error en onboarding para ${phoneNumber}:`, error);
        try {
            const { getNoInfoMessage } = await import('./crm-context.util');
            const fallback = `¡Hola! Soy el asistente de Müllblue 🌱. ¿En qué puedo ayudarte? Escribe *1* para ver productos y precios, *2* para dudas, *3* para hablar con un asesor. ${getNoInfoMessage()}`;
            await evolutionAPI.sendMessage(phoneNumber, fallback);
            return { sent: true, message: fallback };
        } catch (e) {
            logger.error('Fallback onboarding falló:', e);
            return { sent: false };
        }
    }
}
