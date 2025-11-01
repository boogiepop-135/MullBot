import { Message, MessageMedia, MessageTypes } from "whatsapp-web.js";
import { aiCompletion } from "../utils/ai-fallback.util";
import logger from "../configs/logger.config";
import { AppConfig } from "../configs/app.config";
import { speechToText } from "../utils/speech-to-text.util";
import { textToSpeech } from "../utils/text-to-speech.util";
import { del_file } from "../utils/common.util";
import { UserI18n } from "../utils/i18n.util";
import SalesTracker from "../utils/sales-tracker.util";

const fs = require('fs');
const path = require('path');

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
    let query = args.join(" ");
    const chat = await message.getChat();

    // Detectar saludos simples y mostrar opciones
    const saludosSimples = ['hola', 'hi', 'hello', 'buenos días', 'buenas tardes', 'buenas noches', 'hey'];
    const esSaludoSimple = saludosSimples.includes(query.toLowerCase().trim());

    if ((!query || esSaludoSimple) && message.type !== MessageTypes.VOICE) {
        const opcionesIniciales = `
¡Hola 👋! ¡Qué bueno que te pusiste en contacto con Müllblue 🤩!

Estoy aquí para ayudarte a transformar tus residuos orgánicos en un recurso valioso para tu hogar y el planeta 🌎. Nuestro compostero fermentador es la solución perfecta para reducir residuos, eliminar malos olores y obtener biofertilizante de alta calidad.

¿Qué te gustaría saber sobre nuestro compostero fermentador Müllblue 🤔? Tenemos varias opciones:

*1.* Conocer el proceso de compostaje fermentativo
*2.* Dudas sobre precios y promociones
*3.* Métodos de pago disponibles
*4.* ¿Qué incluye el kit?
*5.* Dimensiones y espacio necesario
*6.* Información sobre envío y entrega
*7.* Preguntas frecuentes
*8.* Hablar con un agente

¡Espero tu respuesta para poder ayudarte mejor 😊!`;
        
        // Delay de 10 segundos para simular tiempo de respuesta humano
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        chat.sendMessage(AppConfig.instance.printMessage(opcionesIniciales));
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

        // Delay de 10 segundos para simular tiempo de respuesta humano
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const media = MessageMedia.fromFilePath(mediaPath);
        await message.reply(
            media,
            null,
            { 
                caption: AppConfig.instance.printMessage(chatReply) 
            },
        );

    } catch (err) {
        logger.error(err);
        
        // Manejar errores específicos de APIs de IA
        let errorMessage = "Error comunicándose con Mullbot. Por favor intenta de nuevo o contacta a nuestro equipo de soporte.";
        
        if (err.message && (err.message.includes("503 Service Unavailable") || err.message.includes("Todas las APIs de IA están temporalmente no disponibles"))) {
            errorMessage = "Los servicios de IA están temporalmente sobrecargados. Por favor intenta de nuevo en unos minutos. Mientras tanto, puedes usar los comandos específicos:\n\n*Comandos disponibles:*\n💰 *precios* - Información de precios\n💳 *pago* - Métodos de pago\n📦 *productos* - Información del producto\n\n¡Gracias por tu paciencia! 😊";
        }
        
        // Delay de 10 segundos para simular tiempo de respuesta humano
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        await message.reply(
            MessageMedia.fromFilePath("public/info.png"),
            null,
            { caption: AppConfig.instance.printMessage(errorMessage) },
        );
        return;
    }
};
