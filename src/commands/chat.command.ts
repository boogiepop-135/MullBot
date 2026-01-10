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

    // Normalizar query PRIMERO para poder usarlo en las verificaciones
    const normalizedQuery = query.toLowerCase().trim();

    // Verificar si es solicitud de precios/catálogo/productos (antes de otras opciones)
    // Keywords expandidos para detectar más variaciones
    const precioKeywords = [
        'precio', 'precios', 'catalogo', 'catálogo', 'productos', 'producto', 
        'cuanto', 'costo', 'paquete', 'paquetes', 'lista', 'listado',
        'tiene', 'tienes', 'ofreces', 'vendes', 'mostrar', 'ver',
        'que tienen', 'que tienes', 'que ofreces', 'que vendes',
        'productos que', 'lista de productos', 'catálogo de productos'
    ];
    
    // Keywords para productos específicos y compra/reposición
    const productSpecificKeywords = [
        'bio-catalizador', 'biocatalizador', 'activador', 'compostero', 'fermentador',
        'reponer', 'repon', 'comprar', 'compro', 'necesito', 'quiero', 'quisiera',
        'solo el', 'solo la', 'solo', 'sólo', 'únicamente', 'solamente',
        'individual', 'separado', 'por separado', 'cada uno'
    ];
    
    // Detectar solicitudes de productos/precios
    const hasProductKeyword = precioKeywords.some(keyword => normalizedQuery.includes(keyword));
    const hasProductSpecificKeyword = productSpecificKeywords.some(keyword => normalizedQuery.includes(keyword));
    const isNumericOption1 = /^1[\s\.\)\-]*$/.test(query.trim()) || /^1[\s\.\)\-]/.test(query.trim());
    // Detectar frases comunes sobre productos
    const isProductQuestion = /(que|qué|cuál|cuáles|cuáles).*(productos?|tienes?|tiene|ofreces?|vendes?|lista)/i.test(query) ||
                              /(productos?|lista|catálogo).*(tienes?|tiene|ofreces?|vendes?|tener)/i.test(query) ||
                              /(mostrar|ver|muestra|muéstrame).*(productos?|lista|catálogo)/i.test(query) ||
                              /(reponer|comprar|necesito|quiero|quisiera).*(bio-catalizador|biocatalizador|activador|compostero|producto)/i.test(query) ||
                              /(solo|sólo|únicamente).*(bio-catalizador|biocatalizador|activador|compostero|producto)/i.test(query);
    
    const isPrecioRequest = hasProductKeyword || hasProductSpecificKeyword || isNumericOption1 || isProductQuestion;
    
    if (isPrecioRequest) {
        // Intentar obtener catálogo desde Google Sheets
        try {
            const { googleSheetsService } = await import('../utils/google-sheets.util');
            const EnvConfig = await import('../configs/env.config');
            const useGoogleSheets = !!EnvConfig.default.GOOGLE_SHEETS_API_KEY && !!EnvConfig.default.GOOGLE_SHEETS_SPREADSHEET_ID;
            
            if (useGoogleSheets) {
                logger.info('📊 Obteniendo catálogo desde Google Sheets para solicitud de productos/precios...');
                logger.info(`📊 Query detectada: "${query}"`);
                const products = await googleSheetsService.getProductCatalog();
                
                if (products && products.length > 0) {
                    const catalogMessage = googleSheetsService.formatCatalogForWhatsApp(products);
                    quickResponse = { message: catalogMessage, mediaPath: 'public/precio.png', intent: 'price' };
                    logger.info(`✅ Catálogo de Google Sheets preparado (${products.length} productos) para query: "${query}"`);
                } else {
                    logger.warn(`⚠️ Google Sheets no retornó productos para query: "${query}"`);
                }
            } else {
                logger.warn('⚠️ Google Sheets no está configurado para query de productos');
            }
        } catch (error) {
            logger.error('❌ Error obteniendo catálogo de Google Sheets:', error);
            // Continuar con respuesta normal
        }
    }

    // Verificar si es una opción numérica (1-8)
    const optionMatch = query.match(/^(\d+)/);
    if (optionMatch && !quickResponse) {
        const optionNumber = parseInt(optionMatch[1]);
        if (optionNumber >= 1 && optionNumber <= 8) {
            const response = await getOptionResponse(optionNumber);
            if (response) {
                quickResponse = { message: response, mediaPath: 'public/info.png' };
            }
        }
    }

    // Verificar si es solicitud de menú
    if (normalizedQuery === 'menu' || normalizedQuery === 'menú' || normalizedQuery === 'volver') {
        quickResponse = { message: await getMainMenuResponse(), mediaPath: 'public/info.png' };
    }

    if (quickResponse) {
        logger.info(`✅ Using quick response for query: "${query}" - NO se usaron tokens de IA`);

        // Detectar si es la opción 8 (hablar con agente)
        // El bot ya se pausó automáticamente en handleMessage, pero enviamos la respuesta de todas formas
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

            // Crear asesoría en la base de datos
            try {
                const prisma = (await import('../database/prisma')).default;
                const { SaleStatus } = await import('@prisma/client');
                
                // Normalizar número de teléfono (remover @s.whatsapp.net para búsqueda)
                const phoneNumber = message.from.split('@')[0];
                const phoneNumberWithSuffix = message.from.includes('@') ? message.from : `${message.from}@s.whatsapp.net`;
                
                const contactName = message.from === (message as any)._data.notifyName ? (message as any)._data.notifyName : null;
                
                // Buscar mensajes usando el número normalizado y con sufijo
                const recentMessages = await prisma.message.findMany({
                    where: {
                        OR: [
                            { phoneNumber: message.from },
                            { phoneNumber: phoneNumberWithSuffix },
                            { phoneNumber: phoneNumber }
                        ]
                    },
                    orderBy: { timestamp: 'desc' },
                    take: 5
                });

                const conversationSnapshot = recentMessages.reverse().map(msg => ({
                    from: msg.isFromBot ? 'bot' : 'customer',
                    body: msg.body,
                    timestamp: msg.timestamp
                }));

                // Generar resumen breve
                const customerMessages = conversationSnapshot.filter(m => m.from === 'customer');
                let summary = 'Nueva solicitud de asesoría';
                if (customerMessages.length > 0) {
                    const lastMsg = customerMessages[customerMessages.length - 1].body;
                    summary = `"${lastMsg.substring(0, 80)}${lastMsg.length > 80 ? '...' : ''}"`;
                }

                // Verificar si ya existe una asesoría pendiente o activa para este contacto
                const existingAdvisory = await prisma.advisory.findFirst({
                    where: {
                        OR: [
                            { customerPhone: message.from },
                            { customerPhone: phoneNumberWithSuffix },
                            { customerPhone: phoneNumber }
                        ],
                        status: {
                            in: ['PENDING', 'ACTIVE']
                        }
                    }
                });

                if (existingAdvisory) {
                    logger.info(`ℹ️ Ya existe una asesoría activa para ${message.from}`);
                } else {
                    // Crear asesoría usando el número con sufijo (formato completo)
                    await prisma.advisory.create({
                        data: {
                            customerPhone: phoneNumberWithSuffix,
                            customerName: contactName || 'Cliente',
                            status: 'PENDING',
                            conversationSnapshot,
                            summary,
                            lastActivityAt: new Date()
                        }
                    });

                    logger.info(`✅ Asesoría creada en DB para ${phoneNumberWithSuffix}`);
                }

                // Actualizar estado del contacto a INFO_REQUESTED y pausar el bot
                await prisma.contact.updateMany({
                    where: {
                        OR: [
                            { phoneNumber: message.from },
                            { phoneNumber: phoneNumberWithSuffix },
                            { phoneNumber: phoneNumber }
                        ]
                    },
                    data: {
                        saleStatus: SaleStatus.INFO_REQUESTED,
                        isPaused: true,
                        saleStatusNotes: 'Cliente solicitó hablar con un asesor humano'
                    }
                });

                logger.info(`✅ Contacto ${phoneNumber} actualizado a INFO_REQUESTED y pausado`);

                // También notificar por el método anterior (opcional)
                try {
                    const { notifyAgentAboutContact } = await import('../utils/agent-notification.util');
                    await notifyAgentAboutContact(message.from, contactName);
                } catch (notifyError) {
                    logger.warn('Error en notificación legacy:', notifyError);
                }
            } catch (dbError) {
                logger.error('Error creando asesoría en DB:', dbError);
                // No fallar todo el flujo si falla la creación
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

        // Si la pregunta parece ser sobre productos específicos o compra, 
        // también enviar el catálogo después de la respuesta de la IA
        const productPurchaseKeywords = [
            'reponer', 'repon', 'comprar', 'compro', 'necesito', 'quiero', 'quisiera',
            'bio-catalizador', 'biocatalizador', 'activador', 'compostero', 'fermentador',
            'solo el', 'solo la', 'solo', 'sólo', 'únicamente', 'solamente',
            'individual', 'separado', 'por separado', 'cada uno', 'precio de', 'costo de'
        ];
        
        const isProductPurchaseQuery = productPurchaseKeywords.some(keyword => 
            normalizedQuery.includes(keyword)
        ) || /(que|qué|cuál).*(productos?|tienes?|tiene|ofreces?|vendes?)/i.test(query);

        if (isProductPurchaseQuery && (intent === 'product' || intent === 'price' || normalizedQuery.includes('producto'))) {
            try {
                const { googleSheetsService } = await import('../utils/google-sheets.util');
                const EnvConfig = await import('../configs/env.config');
                const useGoogleSheets = !!EnvConfig.default.GOOGLE_SHEETS_API_KEY && !!EnvConfig.default.GOOGLE_SHEETS_SPREADSHEET_ID;
                
                if (useGoogleSheets) {
                    logger.info('📊 Enviando catálogo adicional después de respuesta IA para query de productos...');
                    const products = await googleSheetsService.getProductCatalog();
                    
                    if (products && products.length > 0) {
                        const catalogMessage = googleSheetsService.formatCatalogForWhatsApp(products);
                        
                        // Pequeño delay antes de enviar el catálogo
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        const catalogMedia = MessageMedia.fromFilePath("public/precio.png");
                        await message.reply(
                            catalogMedia,
                            null,
                            {
                                caption: AppConfig.instance.printMessage(catalogMessage)
                            },
                        );
                        logger.info(`✅ Catálogo adicional enviado (${products.length} productos) después de respuesta IA`);
                    }
                }
            } catch (error) {
                logger.error('❌ Error enviando catálogo adicional:', error);
                // No fallar si hay error, solo loguear
            }
        }

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
