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

            if (!user.isMe) await this.trackContact(message, userI18n);
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
        const { detectPaymentReceipt, handlePaymentReceipt } = await import('../utils/payment-detection.util');
        
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
                    await chat.sendMessage(receiptMessage);
                }
                
                logger.info(`Payment receipt detected and processed for ${message.from}`);
                return;
            }
        } catch (error) {
            logger.error(`Error processing payment receipt detection: ${error}`);
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
                chat.sendMessage(`> 🤖 ${errorMessage}`);
            }
        } else {
            // Si no es un comando, tratar como conversación con el agente de ventas
            if (chat) await chat.sendStateTyping();
            await commands["chat"].run(message, content.split(/ +/), userI18n);
        }
    }
}