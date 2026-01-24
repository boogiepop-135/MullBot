/**
 * Onboarding Utility para Evolution API
 * 
 * Maneja el proceso de onboarding de nuevos usuarios usando Evolution API
 */

import { EvolutionAPIv2Service } from '../services/evolution-api-v2.service';
import { AppConfig } from '../configs/app.config';
import { UserI18n } from './i18n.util';
import prisma from '../database/prisma';
import logger from '../configs/logger.config';
import * as fs from 'fs';

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
 * Enviar video de onboarding usando Evolution API
 */
export async function onboardEvolution(
    evolutionAPI: EvolutionAPIv2Service,
    phoneNumber: string,
    content: string,
    userI18n: UserI18n,
    autoOnboard: boolean = true,
    filePath: string = AppConfig.instance.getOnboardingVideoPath()
): Promise<void> {
    try {
        // Verificar si ya fue onboarded (solo si autoOnboard está activado)
        if (autoOnboard && await isUserOnboarded(phoneNumber)) {
            logger.debug(`Usuario ${phoneNumber} ya fue onboarded, omitiendo`);
            return;
        }

        // Verificar que el archivo existe
        if (!fs.existsSync(filePath)) {
            logger.warn(`Archivo de onboarding no encontrado: ${filePath}`);
            // Enviar mensaje de texto como fallback
            const caption = userI18n.t('onboardMessages.caption', { botName: AppConfig.instance.getBotName() });
            const pleaseHelp = userI18n.t('onboardMessages.pleaseHelp', { prefix: AppConfig.instance.getBotPrefix() });
            await evolutionAPI.sendMessage(phoneNumber, `${caption}\n\n${pleaseHelp}`);
            return;
        }

        // Preparar caption
        const caption = userI18n.t('onboardMessages.caption', { botName: AppConfig.instance.getBotName() });
        const pleaseHelp = userI18n.t('onboardMessages.pleaseHelp', { prefix: AppConfig.instance.getBotPrefix() });
        const fullCaption = `${caption}\n\n${pleaseHelp}`;

        // Determinar tipo de media por extensión
        const ext = require('path').extname(filePath).toLowerCase();
        let mediaType: 'image' | 'video' | 'audio' | 'document' = 'video';
        
        if (['.mp4', '.avi', '.mov', '.webm'].includes(ext)) {
            mediaType = 'video';
        } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
            mediaType = 'audio';
        } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            mediaType = 'image';
        } else {
            mediaType = 'document';
        }

        // Enviar media usando Evolution API
        await evolutionAPI.sendMedia(phoneNumber, filePath, fullCaption, mediaType);
        
        logger.info(`✅ Video de onboarding enviado a ${phoneNumber}`);
    } catch (error) {
        logger.error(`Error en onboarding para ${phoneNumber}:`, error);
        // Fallback: enviar mensaje de texto
        try {
            const caption = userI18n.t('onboardMessages.caption', { botName: AppConfig.instance.getBotName() });
            const pleaseHelp = userI18n.t('onboardMessages.pleaseHelp', { prefix: AppConfig.instance.getBotPrefix() });
            await evolutionAPI.sendMessage(phoneNumber, `${caption}\n\n${pleaseHelp}`);
        } catch (fallbackError) {
            logger.error('Error en fallback de onboarding:', fallbackError);
        }
    }
}
