import { Message, MessageMedia, MessageTypes } from "whatsapp-web.js";
import { aiCompletion } from "../utils/ai-fallback.util";
import logger from "../configs/logger.config";
import { AppConfig } from "../configs/app.config";
import { speechToText } from "../utils/speech-to-text.util";
import { textToSpeech } from "../utils/text-to-speech.util";
import { del_file } from "../utils/common.util";
import { UserI18n } from "../utils/i18n.util";
import SalesTracker from "../utils/sales-tracker.util";
import { getMainMenuResponse, getOptionResponse, addMenuFooter } from "../utils/quick-responses.util";

const fs = require('fs');
const path = require('path');

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
    let query = args.join(" ");
    const chat = await message.getChat();

    // Detectar saludos simples y mostrar opciones
    const saludosSimples = ['hola', 'hi', 'hello', 'buenos días', 'buenas tardes', 'buenas noches', 'hey'];
    const esSaludoSimple = saludosSimples.includes(query.toLowerCase().trim());

    if ((!query || esSaludoSimple) && message.type !== MessageTypes.VOICE) {
        const opcionesIniciales = await getMainMenuResponse();

        // Delay configurable para simular tiempo de respuesta humano
        const { getBotDelay } = await import('../utils/bot-config.util');
        const delay = await getBotDelay();
        await new Promise(resolve => setTimeout(resolve, delay));

        // Enviar mensaje usando Evolution API
        const { BotManager } = await import('../bot.manager');
        const botManager = BotManager.getInstance();
        const phoneNumber = message.from.split('@')[0];
        await botManager.sendMessage(phoneNumber, AppConfig.instance.printMessage(opcionesIniciales));
        
        // Guardar mensaje inicial en la base de datos
        await botManager.saveSentMessage(phoneNumber, AppConfig.instance.printMessage(opcionesIniciales), null);
        return;
    }

    if (message.type === MessageTypes.VOICE) {

        const audioPath = `${AppConfig.instance.getDownloadDir()}/${message.id.id}.wav`;
        const media = await message.downloadMedia();

        const base64 = media.data;
        const fileBuffer = Buffer.from(base64, 'base64');

        const dir = path.dirname(audioPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFile(audioPath, fileBuffer, (err) => {
            if (err) {
                logger.error(`Error saving file: ${err}`);
            } else {
                logger.info(`File saved successfully to ${audioPath}`);
            }
        });

        const transcript = await speechToText(audioPath);
        del_file(audioPath);
        query = transcript.text;

        if (!query || !query.length) {
            await message.reply(
                MessageMedia.fromFilePath(AppConfig.instance.getBotAvatar("confused")),
                null,
                { sendVideoAsGif: true, caption: AppConfig.instance.printMessage("Something went wrong. Please try again later.") },
            );
            return;
        }
    }

    // SIEMPRE verificar primero si hay una respuesta rápida disponible (ahorra tokens)
    // Esto debe hacerse ANTES de cualquier llamada a IA
    let quickResponse: { message: string; mediaPath?: string; intent?: string } | null = null;

    // Verificar si es una opción numérica (1-8)
    const optionMatch = query.match(/^(\d+)/);
    if (optionMatch) {
        const optionNumber = parseInt(optionMatch[1]);
        if (optionNumber >= 1 && optionNumber <= 8) {
            const response = await getOptionResponse(optionNumber);
            if (response) {
                quickResponse = { message: response, mediaPath: 'public/info.png' };
            }
        }
    }

    // Verificar si es solicitud de menú
    const normalizedQuery = query.toLowerCase().trim();
    if (normalizedQuery === 'menu' || normalizedQuery === 'menú' || normalizedQuery === 'volver') {
        quickResponse = { message: await getMainMenuResponse(), mediaPath: 'public/info.png' };
    }

    if (quickResponse) {
        logger.info(`✅ Using quick response for query: "${query}" - NO se usaron tokens de IA`);

        // Detectar si es la opción 8 (hablar con agente)
        // El bot ya se pausó automáticamente en handleMessage, pero enviamos la respuesta de todas formas
        const normalizedQuery = query.toLowerCase().trim();
        const isAgentRequest = normalizedQuery === '8' ||
            /^8[\s\.\)\-]*$/.test(normalizedQuery) ||
            /^8[\s\.\)\-]/.test(normalizedQuery) ||
            normalizedQuery.includes('agente') ||
            normalizedQuery.includes('humano') ||
            normalizedQuery.includes('persona') ||
            normalizedQuery.includes('representante');
        
        // Enviar respuesta rápida con media si está disponible
        const mediaPath = quickResponse.mediaPath || "public/info.png";
        const media = MessageMedia.fromFilePath(mediaPath);
        await message.reply(
            media,
            null,
            {
                caption: AppConfig.instance.printMessage(quickResponse.message)
            },
        );

        // Si es solicitud de agente, enviar mensaje adicional y notificar al agente
        if (isAgentRequest) {
            const agentMessage = `✅ *Solicitud Recibida*

Tu solicitud para hablar con un agente ha sido registrada.

📝 *Estado:* En cola para atención humana
⏰ Horario de atención: Lunes a Viernes 9am - 7pm

Nuestro equipo se pondrá en contacto contigo lo antes posible.

Mientras tanto, el bot ha sido pausado para evitar respuestas automáticas.`;

            const { getBotDelay } = await import('../utils/bot-config.util');
            const delay = await getBotDelay();
            await new Promise(resolve => setTimeout(resolve, delay));
            await message.reply(
                MessageMedia.fromFilePath("public/info.png"),
                null,
                {
                    caption: AppConfig.instance.printMessage(agentMessage)
                },
            );

            // Notificar al agente humano
            try {
                const { notifyAgentAboutContact } = await import('../utils/agent-notification.util');
                const contactName = message.from === message._data.notifyName ? message._data.notifyName : null;
                await notifyAgentAboutContact(message.from, contactName);
                logger.info(`Agent notified about contact request from ${message.from}`);
            } catch (notifyError) {
                logger.error('Error notifying agent about contact request:', notifyError);
                // No fallar si la notificación falla
            }
        }

        return; // IMPORTANTE: salir aquí para no llamar a IA
    }

    // Log cuando se va a usar IA (para debugging)
    logger.info(`🤖 Using AI for query: "${query}" (no quick response found)`);

    // Si no hay respuesta rápida, usar IA
    try {
        const result = await aiCompletion(query);
        const chatReply = result.text;
        const provider = result.provider;

        // Detectar intención y hacer seguimiento de ventas
        const intent = SalesTracker.detectIntent(query);
        SalesTracker.trackInteraction(message, query, chatReply, intent);

        // Log del proveedor usado
        logger.info(`Respuesta generada por: ${provider}`);

        if (message.type === MessageTypes.VOICE) {
            if (!chat) await chat.sendStateRecording();

            try {
                const filePath = await textToSpeech(chatReply, `${message.id.id}.wav`);
                const voice = await MessageMedia.fromFilePath(filePath);
                await message.reply(voice, null, { sendAudioAsVoice: true });
                del_file(filePath);
                return;
            } catch (error) {
                logger.error(error);
                if (chat) chat.clearState().then(() => {
                    // wait for 1.5 seconds before sending typing to avoid ban :)
                    setTimeout(() => {
                        chat.sendStateTyping();
                    }, 1500);
                });
                if (chat) await chat.sendStateTyping();
                message.reply(AppConfig.instance.printMessage(`${chatReply}\n\n_Sorry btw but i was unable to send this as voice._`));
                return;
            }
        }

        // Determinar qué imagen enviar según la intención detectada
        let mediaPath: string;

        switch (intent) {
            case 'price':
                mediaPath = "public/precio.png";
                break;
            case 'payment':
                mediaPath = "public/pago.png";
                break;
            case 'info':
            case 'product':
                mediaPath = "public/info.png";
                break;
            default:
                // Para otras consultas, usar imagen de información por defecto
                mediaPath = "public/info.png";
                break;
        }

        // Delay configurable para simular tiempo de respuesta humano
        const { getBotDelay } = await import('../utils/bot-config.util');
        const delay = await getBotDelay();
        await new Promise(resolve => setTimeout(resolve, delay));

        const media = MessageMedia.fromFilePath(mediaPath);
        await message.reply(
            media,
            null,
            {
                caption: AppConfig.instance.printMessage(chatReply)
            },
        );

    } catch (err) {
        logger.error(`Error en chat.command para query "${query}":`, err);

        // Intentar una última vez con respuesta rápida (por si acaso la query cambió)
        let fallbackQuickResponse: { message: string; mediaPath?: string } | null = null;
        const optionMatch = query.match(/^(\d+)/);
        if (optionMatch) {
            const optionNumber = parseInt(optionMatch[1]);
            if (optionNumber >= 1 && optionNumber <= 8) {
                const response = await getOptionResponse(optionNumber);
                if (response) {
                    fallbackQuickResponse = { message: response, mediaPath: 'public/info.png' };
                }
            }
        }
        if (fallbackQuickResponse) {
            logger.info(`✅ Fallback: usando respuesta rápida para query: "${query}"`);
            const { getBotDelay } = await import('../utils/bot-config.util');
            const delay = await getBotDelay();
            await new Promise(resolve => setTimeout(resolve, delay));

            const mediaPath = fallbackQuickResponse.mediaPath || "public/info.png";
            const media = MessageMedia.fromFilePath(mediaPath);
            await message.reply(
                media,
                null,
                {
                    caption: AppConfig.instance.printMessage(fallbackQuickResponse.message)
                },
            );
            return;
        }

        // Si no hay respuesta rápida de fallback, enviar mensaje de error más amigable
        const errorMessage = `Lo siento, no pude procesar tu consulta en este momento 😔

Para obtener información rápida, puedes usar:
*1* - Proceso de compostaje
*2* - Precios y promociones  
*3* - Métodos de pago
*4* - Qué incluye el kit
*5* - Dimensiones y espacio
*6* - Envío y entrega
*7* - Preguntas frecuentes
*8* - Hablar con agente

¿En cuál te puedo ayudar? 🌱`;

        // Delay configurable para simular tiempo de respuesta humano
        const { getBotDelay } = await import('../utils/bot-config.util');
        const delay = await getBotDelay();
        await new Promise(resolve => setTimeout(resolve, delay));

        await message.reply(
            MessageMedia.fromFilePath("public/info.png"),
            null,
            { caption: AppConfig.instance.printMessage(errorMessage) },
        );
        return;
    }
};
