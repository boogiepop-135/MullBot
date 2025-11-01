import { Client, Message, MessageTypes } from "whatsapp-web.js";
import { AppConfig } from "./configs/app.config";
import { getClientConfig } from "./configs/client.config";
import logger from "./configs/logger.config";
import { UserI18n } from "./utils/i18n.util";
import commands from "./commands";
import { isUrl } from "./utils/common.util";
import { identifySocialNetwork, YtDlpDownloader } from "./utils/get.util";
import { onboard } from "./utils/onboarding.util";
import { ContactModel } from "./crm/models/contact.model";
import { MessageModel } from "./crm/models/message.model";
import { detectPaymentReceipt, handlePaymentReceipt } from "./utils/payment-detection.util";
import { detectAppointmentProposal, handleAppointmentProposal } from "./utils/appointment-detection.util";
const qrcode = require('qrcode-terminal');

export class BotManager {
    private static instance: BotManager;
    public client: any;
    public qrData = {
        qrCodeData: "",
        qrScanned: false
    };
    private userI18nCache = new Map<string, UserI18n>();
    private prefix = AppConfig.instance.getBotPrefix();

    private constructor() {
        // NO crear el cliente aquí - debe ser asíncrono después de conectar MongoDB
        // El cliente se creará en initializeClient()
    }

    public static getInstance(): BotManager {
        if (!BotManager.instance) {
            BotManager.instance = new BotManager();
        }
        return BotManager.instance;
    }

    public async initializeClient() {
        // Verificar si el cliente ya existe
        if (this.client) {
            logger.info("Client already initialized");
            return;
        }

        try {
            logger.info("Initializing WhatsApp client...");
            // Obtener configuración del cliente (incluye RemoteAuth con MongoStore)
            const clientConfig = await getClientConfig();
            
            // Crear el cliente de WhatsApp
            this.client = new Client(clientConfig);
            
            // Configurar event handlers
            this.setupEventHandlers();
            
            logger.info("WhatsApp client created successfully");
        } catch (error) {
            logger.error("Error initializing client:", error);
            throw error;
        }
    }

    private setupEventHandlers() {
        if (!this.client) {
            throw new Error("Client must be initialized before setting up event handlers");
        }
        
        console.log("Setting up event handlers...");
        this.client.on('ready', this.handleReady.bind(this));
        this.client.on('qr', this.handleQr.bind(this));
        this.client.on('message_create', this.handleMessage.bind(this));
        this.client.on('message', this.handleSentMessage.bind(this)); // Capturar mensajes enviados
        this.client.on('disconnected', this.handleDisconnect.bind(this));
    }


    private async handleReady() {
        this.qrData.qrScanned = true;
        logger.info("Client is ready!");
        logger.info("WhatsApp session is now authenticated and saved in MongoDB");
        logger.info("Session will persist across Railway deployments");

        try {
            await YtDlpDownloader.getInstance().initialize();
        } catch (error) {
            logger.error("Downloader check failed:", error);
        }
    }

    private handleQr(qr: string) {
        logger.info('QR RECEIVED');
        this.qrData.qrCodeData = qr;
        this.qrData.qrScanned = false;
        console.log(qr);
        qrcode.generate(qr, { small: true });
    }

    /**
     * Maneja mensajes enviados por el bot (para guardarlos en la base de datos)
     */
    private async handleSentMessage(message: Message): Promise<void> {
        try {
            // Solo guardar mensajes enviados por el bot (fromMe)
            if (message.fromMe) {
                // Verificar que no sea un mensaje de estado o de grupo
                if (!message.isStatus && !message.to.includes('@g.us')) {
                    // Solo guardar mensajes a contactos individuales (@c.us)
                    if (message.to.includes('@c.us')) {
                        await this.saveMessage(message, true);
                    }
                }
            }
        } catch (error) {
            logger.error(`Error handling sent message: ${error}`);
            // No fallar si no se puede guardar
        }
    }

    private handleDisconnect(reason: string) {
        logger.info(`Client disconnected: ${reason}`);
        setTimeout(async () => {
            if (this.client) {
                await this.client.initialize();
            }
        }, 5000);
    }

    public async initialize() {
        try {
            // Verificar si el cliente existe, si no, inicializarlo
            if (!this.client) {
                await this.initializeClient();
            }
            
            // Inicializar el cliente de WhatsApp
            await this.client.initialize();
        } catch (error) {
            logger.error(`Client initialization error: ${error}`);
            throw error;
        }
    }

    /**
     * Desvincular WhatsApp actual y limpiar sesión
     */
    public async logout(): Promise<void> {
        try {
            logger.info("Logging out WhatsApp client...");
            
            // Cerrar y destruir el cliente actual
            if (this.client) {
                try {
                    await this.client.logout();
                } catch (error) {
                    logger.warn(`Error during client logout: ${error}`);
                }
                try {
                    await this.client.destroy();
                } catch (error) {
                    logger.warn(`Error during client destroy: ${error}`);
                }
                this.client = null;
            }

            // Limpiar sesión de MongoDB
            await this.clearSessionFromMongoDB();

            // Resetear QR data
            this.qrData = {
                qrCodeData: "",
                qrScanned: false
            };

            logger.info("WhatsApp session cleared successfully");
        } catch (error) {
            logger.error(`Error logging out: ${error}`);
            throw error;
        }
    }

    /**
     * Limpiar sesión de MongoDB
     */
    private async clearSessionFromMongoDB(): Promise<void> {
        try {
            const mongoose = require('mongoose');
            // wwebjs-mongo guarda las sesiones en la colección 'authsessions'
            const db = mongoose.connection.db;
            if (db) {
                // Borrar todas las sesiones del clientId 'mullbot-client'
                const result = await db.collection('authsessions').deleteMany({ 
                    _id: { $regex: /^mullbot-client/ }
                });
                logger.info(`Cleared ${result.deletedCount} session(s) from MongoDB`);
            }
        } catch (error) {
            logger.error(`Error clearing session from MongoDB: ${error}`);
            throw error;
        }
    }

    private async trackContact(message: Message, userI18n: UserI18n) {
        try {
            const user = await message.getContact();

            await ContactModel.findOneAndUpdate(
                { phoneNumber: user.number },
                {
                    $set: {
                        name: user.name || user.pushname,
                        pushName: user.pushname,
                        language: userI18n.getLanguage(),
                        lastInteraction: new Date()
                    },
                    $inc: { interactionsCount: 1 }
                },
                { upsert: true, new: true }
            );
        } catch (error) {
            logger.error('Failed to track contact:', error);
        }
    }

    private async handleMessage(message: Message) {
        // Verificar que el cliente esté inicializado
        if (!this.client) {
            await this.initializeClient();
        }

        let chat = null;
        let userI18n: UserI18n;

        // Permitir mensajes con media aunque no tengan texto
        const content = message.body?.trim() || '';

        if (AppConfig.instance.getSupportedMessageTypes().indexOf(message.type) === -1) {
            return;
        }

        try {
            const user = await message.getContact();
            logger.info(`Message from @${user.pushname} (${user.number}): ${content}`);

            if (!user || !user.number) {
                return;
            }

            // Verificar si el usuario está pausado
            const contact = await ContactModel.findOne({ phoneNumber: user.number });
            if (contact && contact.isPaused) {
                logger.info(`Message from paused user ${user.number} - ignoring`);
                return; // No procesar mensajes de usuarios pausados
            }

            userI18n = this.getUserI18n(user.number);

            if (!user.isMe) {
                await this.trackContact(message, userI18n);
                // Guardar mensaje recibido en la base de datos
                await this.saveMessage(message, false);
            }
            chat = await message.getChat();

            if (message.from === this.client.info.wid._serialized || message.isStatus) {
                return;
            }

            await Promise.all([
                onboard(message, userI18n),
                this.processMessageContent(message, content, userI18n, chat)
            ]);

            // await onboard(message, userI18n);
            // await this.processMessageContent(message, content, userI18n, chat);

        } catch (error) {
            logger.error(`Message handling error: ${error}`);
            if (chat) {
                const errorMessage = userI18n?.t('errorOccurred') || 'An error occurred';
                chat.sendMessage(`> 🤖 ${errorMessage}`);
            }
        } finally {
            if (chat) await chat.clearState();
        }
    }

    private getUserI18n(userNumber: string): UserI18n {
        if (!this.userI18nCache.has(userNumber)) {
            const userI18n = new UserI18n(userNumber);
            this.userI18nCache.set(userNumber, userI18n);
            logger.info(`New user detected: ${userNumber} (${userI18n.getLanguage()})`);
        }
        return this.userI18nCache.get(userNumber)!;
    }

    private async processMessageContent(message: Message, content: string, userI18n: UserI18n, chat: any) {
        // Detectar comprobantes de pago primero
        try {
            const isPaymentReceipt = await detectPaymentReceipt(message);
            if (isPaymentReceipt) {
                const user = await message.getContact();
                const contact = await ContactModel.findOne({ phoneNumber: user.number });
                
                await handlePaymentReceipt(message);
                
                // Mensaje personalizado según el estado del contacto
                let receiptMessage = '';
                
                if (contact && contact.saleStatus === 'appointment_confirmed') {
                    receiptMessage = `✅ *Comprobante Recibido*

Gracias por enviar tu comprobante de pago. Lo hemos recibido.

📝 *Nota:* Ya tienes una cita confirmada para la instalación. Este comprobante adicional será revisado por nuestro equipo.

Te confirmaremos cualquier actualización si es necesario.

¿Tienes alguna pregunta?`;
                } else {
                    receiptMessage = `✅ *Comprobante Recibido*

Gracias por enviar tu comprobante de pago. Lo hemos recibido y lo estamos revisando.

⏳ *Estado:* Esperando confirmación

Te confirmaremos el pago en breve. Una vez confirmado, coordinaremos la fecha para la instalación de tu compostero Müllblue.

¿Tienes alguna pregunta mientras tanto?`;
                }

                if (chat) {
                    const sentMsg = await chat.sendMessage(receiptMessage);
                    // Guardar mensaje enviado
                    if (sentMsg) {
                        await this.saveMessage(sentMsg, true);
                    }
                }
                
                logger.info(`Payment receipt detected and processed for ${message.from}`);
                return;
            }
        } catch (error) {
            logger.error(`Error processing payment receipt detection: ${error}`);
        }

        // Detectar propuestas de horarios/citas
        try {
            const appointmentResult = await detectAppointmentProposal(message);
            if (appointmentResult.isAppointmentProposal) {
                await handleAppointmentProposal(message, appointmentResult.proposedDates);
                // Continuar procesando el mensaje normalmente
            }
        } catch (error) {
            logger.error(`Error processing appointment proposal detection: ${error}`);
        }

        if (message.type === MessageTypes.VOICE) {
            await this.handleVoiceMessage(message, userI18n);
            return;
        }

        // Manejar mensajes con media que no sean comprobantes de pago
        if (message.hasMedia && (message.type === MessageTypes.IMAGE || message.type === MessageTypes.DOCUMENT)) {
            // Si es media pero no es comprobante, tratarlo como mensaje de texto normal
            await this.handleTextMessage(message, content, userI18n, chat);
            return;
        }

        if (message.type === MessageTypes.TEXT) {
            await this.handleTextMessage(message, content, userI18n, chat);
        }
    }

    private async handleVoiceMessage(message: Message, userI18n: UserI18n) {
        const args = message.body.trim().split(/ +/).slice(1);
        await commands[AppConfig.instance.getDefaultAudioAiCommand()].run(message, args, userI18n);
    }

    private async handleTextMessage(message: Message, content: string, userI18n: UserI18n, chat: any) {
        const url = content.trim().split(/ +/)[0];
        const socialNetwork = identifySocialNetwork(url);

        if (url && isUrl(url) && socialNetwork) {
            await commands["get"].run(message, null, url, socialNetwork, userI18n);
            return;
        }

        // Verificar si es un comando con prefijo
        if (content.startsWith(this.prefix)) {
            const args = content.slice(this.prefix.length).trim().split(/ +/);
            const command = args.shift()?.toLowerCase();

            if (command && command in commands) {
                if (chat) await chat.sendStateTyping();
                await commands[command].run(message, args, userI18n);
            } else {
                const errorMessage = userI18n.t('unknownCommand', {
                    command: command || '',
                    prefix: this.prefix
                });
                const sentMsg = await chat.sendMessage(`> 🤖 ${errorMessage}`);
                // Guardar mensaje enviado
                if (sentMsg) {
                    await this.saveMessage(sentMsg, true);
                }
            }
        } else {
            // Si no es un comando, tratar como conversación con el agente de ventas
            if (chat) await chat.sendStateTyping();
            await commands["chat"].run(message, content.split(/ +/), userI18n);
        }
    }

    /**
     * Guarda un mensaje en la base de datos
     */
    private async saveMessage(message: Message, isFromBot: boolean): Promise<void> {
        try {
            // Determinar el número de teléfono del contacto
            let phoneNumber: string;
            let contact;
            
            if (isFromBot) {
                // Mensaje enviado por el bot: el destinatario está en message.to
                phoneNumber = message.to.split('@')[0];
                contact = await ContactModel.findOne({ phoneNumber });
            } else {
                // Mensaje recibido: el remitente está en message.from
                const user = await message.getContact();
                phoneNumber = user.number;
                contact = await ContactModel.findOne({ phoneNumber });
            }
            
            // Intentar obtener media si existe
            let mediaUrl: string | undefined = undefined;
            let hasMedia = false;
            
            if (message.hasMedia) {
                hasMedia = true;
                try {
                    const media = await message.downloadMedia();
                    if (media) {
                        // Guardar media en un path temporal o procesarlo
                        // Por ahora, solo marcamos que tiene media
                        mediaUrl = `media_${message.id._serialized}`;
                    }
                } catch (error) {
                    logger.warn(`Failed to download media for message ${message.id._serialized}: ${error}`);
                }
            }

            // Obtener pushName solo para mensajes recibidos
            let pushName: string | undefined = undefined;
            if (!isFromBot) {
                try {
                    const user = await message.getContact();
                    pushName = user.pushname;
                } catch (error) {
                    logger.warn(`Failed to get contact info for message ${message.id._serialized}: ${error}`);
                }
            } else if (contact) {
                // Para mensajes del bot, usar el pushName del contacto si está disponible
                pushName = contact.pushName;
            }

            await MessageModel.findOneAndUpdate(
                { messageId: message.id._serialized },
                {
                    phoneNumber: phoneNumber,
                    contactId: contact?._id?.toString(),
                    from: message.from,
                    to: message.to,
                    body: message.body || '',
                    type: message.type,
                    isFromBot: isFromBot,
                    timestamp: new Date(message.timestamp * 1000), // WhatsApp timestamp en segundos
                    hasMedia: hasMedia,
                    mediaUrl: mediaUrl,
                    metadata: {
                        pushName: pushName,
                        isGroup: message.from.includes('@g.us') || message.to.includes('@g.us'),
                        isForwarded: message.isForwarded,
                        isStarred: message.isStarred
                    }
                },
                { upsert: true, new: true }
            );
        } catch (error) {
            logger.error(`Error saving message: ${error}`);
            // No fallar el procesamiento del mensaje si no se puede guardar
        }
    }

    /**
     * Guarda un mensaje enviado manualmente por el admin
     */
    public async saveSentMessage(phoneNumber: string, messageBody: string, messageId?: string): Promise<void> {
        try {
            const contact = await ContactModel.findOne({ phoneNumber });
            const formattedNumber = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
            
            await MessageModel.create({
                phoneNumber: phoneNumber,
                contactId: contact?._id.toString(),
                messageId: messageId || `admin_${Date.now()}_${phoneNumber}`,
                from: this.client?.info?.wid?._serialized || 'admin',
                to: formattedNumber,
                body: messageBody,
                type: 'TEXT',
                isFromBot: true,
                timestamp: new Date(),
                hasMedia: false
            });
        } catch (error) {
            logger.error(`Error saving sent message: ${error}`);
        }
    }
}