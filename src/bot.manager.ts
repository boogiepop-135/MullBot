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

    public async initializeClient(skipSessionClear: boolean = false) {
        // Verificar si el cliente ya existe
        if (this.client) {
            logger.info("Client already initialized");
            return;
        }

        try {
            logger.info("Initializing WhatsApp client...");

            // Limpiar sesión anterior de MongoDB antes de crear nuevo cliente
            // Solo si no se especifica saltar (ej: después de logout ya se limpió)
            if (!skipSessionClear) {
                await this.clearSessionFromMongoDB();
                logger.info("Previous session cleared from MongoDB");
            }

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

        logger.info("Setting up event handlers...");
        this.client.on('ready', this.handleReady.bind(this));
        this.client.on('qr', this.handleQr.bind(this));
        this.client.on('authenticated', () => {
            logger.info("Client authenticated successfully");
            // Si se autentica pero no emite ready después de un tiempo, puede haber un problema
            setTimeout(() => {
                if (!this.qrData.qrScanned && !this.client.info) {
                    logger.warn("Client authenticated but not ready after 15 seconds. Session may be corrupted.");
                }
            }, 15000);
        });
        this.client.on('auth_failure', (msg) => {
            logger.error(`Authentication failure: ${msg}`);
            this.qrData.qrScanned = false;
        });
        this.client.on('loading_screen', (percent, message) => {
            logger.info(`Loading screen: ${percent}% - ${message}`);
        });
        this.client.on('message_create', this.handleMessage.bind(this));
        this.client.on('message', this.handleSentMessage.bind(this)); // Capturar mensajes enviados
        this.client.on('disconnected', this.handleDisconnect.bind(this));
    }


    private async handleReady() {
        this.qrData.qrScanned = true;
        logger.info("Client is ready!");
        
        // Limpiar sesiones antiguas y mantener solo la sesión actual
        // Esto asegura que no haya conflictos con sesiones previas
        try {
            await this.cleanupOldSessions();
            logger.info("Old sessions cleaned up, keeping only current active session");
        } catch (error) {
            logger.warn(`Failed to cleanup old sessions: ${error}`);
        }
        
        logger.info("WhatsApp session is now authenticated and saved in MongoDB");
        logger.info("Session will persist across Railway deployments");

        try {
            await YtDlpDownloader.getInstance().initialize();
        } catch (error) {
            logger.error("Downloader check failed:", error);
        }
    }

    private async handleQr(qr: string) {
        logger.info('QR RECEIVED');
        this.qrData.qrCodeData = qr;
        this.qrData.qrScanned = false;
        logger.info("QR Code generated:", qr);
        qrcode.generate(qr, { small: true });
        
        // NO limpiar sesiones aquí - esto puede interferir con la autenticación
        // La limpieza debe hacerse explícitamente antes de generar el QR (en logout/clear-sessions)
        logger.info("QR Code ready for scanning. Waiting for device authentication...");
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
        this.qrData.qrScanned = false;
        setTimeout(async () => {
            if (this.client) {
                logger.info("Attempting to reconnect after disconnect...");
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
            logger.info("Starting WhatsApp client initialization...");
            await this.client.initialize();
            logger.info("WhatsApp client.initialize() completed");
            
            // Esperar un momento para que los eventos se emitan
            // Si después de 20 segundos no hay QR ni ready, puede haber un problema con la sesión
            await new Promise(resolve => setTimeout(resolve, 20000));
            
            if (!this.qrData.qrScanned && !this.client.info) {
                logger.warn("Client initialized but no QR or ready event after 20 seconds. This may indicate a session issue.");
                logger.warn("The session may be corrupted. Try logging out and scanning QR again.");
                
                // Intentar forzar una desconexión y reinicialización para que genere un nuevo QR
                try {
                    logger.info("Attempting to force disconnect and reinitialize to trigger QR generation...");
                    if (this.client) {
                        try {
                            await this.client.logout();
                        } catch (error) {
                            logger.warn(`Error during forced logout: ${error}`);
                        }
                        
                        try {
                            await this.client.destroy();
                        } catch (error) {
                            logger.warn(`Error during forced destroy: ${error}`);
                        }
                        
                        // Limpiar sesión de MongoDB
                        await this.clearSessionFromMongoDB();
                        
                        // Crear nuevo cliente
                        this.client = null;
                        await this.initializeClient(true);
                        await this.client.initialize();
                        
                        logger.info("Client reinitialized, waiting for QR...");
                    }
                } catch (error) {
                    logger.error(`Error forcing reinitialize: ${error}`);
                }
            }
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
                    // Remover todos los event listeners primero para evitar errores
                    this.client.removeAllListeners();
                    logger.info("Event listeners removed");
                } catch (error) {
                    logger.warn(`Error removing event listeners: ${error}`);
                }
                
                try {
                    await this.client.logout();
                    logger.info("Client logout successful");
                } catch (error) {
                    logger.warn(`Error during client logout (may already be logged out): ${error}`);
                }
                
                try {
                    await this.client.destroy();
                    logger.info("Client destroyed successfully");
                } catch (error) {
                    logger.warn(`Error during client destroy: ${error}`);
                }
                
                this.client = null;
                logger.info("Client reference cleared");
            }

            // Limpiar sesión de MongoDB
            logger.info("Clearing session from MongoDB...");
            await this.clearSessionFromMongoDB();

            // Resetear QR data
            this.qrData = {
                qrCodeData: "",
                qrScanned: false
            };
            logger.info("QR data reset");

            logger.info("WhatsApp client logged out and session cleared successfully");
        } catch (error) {
            logger.error(`Error during logout: ${error}`);
            // Asegurar que el cliente se limpie incluso si hay errores
            this.client = null;
            this.qrData = {
                qrCodeData: "",
                qrScanned: false
            };
            throw error;
        }
    }

    /**
     * Limpiar TODAS las sesiones de WhatsApp de MongoDB
     * Limpia completamente todas las colecciones relacionadas con sesiones
     * IMPORTANTE: Elimina TODAS las sesiones sin filtros para forzar nuevo QR
     */
    public async clearAllSessions(): Promise<number> {
        try {
            const mongoose = require('mongoose');
            const db = mongoose.connection.db;
            if (!db) {
                logger.warn("MongoDB connection not available");
                return 0;
            }

            let totalDeleted = 0;

            // Lista de todas las colecciones que pueden contener sesiones
            const sessionCollections = [
                'authsessions',      // Colección usada por RemoteAuth
                'auth_sessions',     // Colección usada por MongoStore/wwebjs-mongo
                'sessions',          // Colección genérica de sesiones
                'whatsapp_sessions', // Sesiones de WhatsApp
                'wwebjs_sessions'    // Sesiones de wwebjs
            ];

            // Eliminar TODAS las sesiones de TODAS las colecciones sin filtros
            for (const collectionName of sessionCollections) {
                try {
                    const collection = db.collection(collectionName);
                    const count = await collection.countDocuments({});
                    if (count > 0) {
                        const result = await collection.deleteMany({}); // Sin filtros - eliminar TODO
                        totalDeleted += result.deletedCount;
                        logger.info(`Cleared ${result.deletedCount} session(s) from '${collectionName}' collection (TOTAL CLEAR)`);
                    } else {
                        logger.info(`Collection '${collectionName}' is empty`);
                    }
                } catch (error: any) {
                    // Si la colección no existe, continuar
                    if (error.codeName !== 'NamespaceNotFound') {
                        logger.warn(`Error clearing ${collectionName}: ${error}`);
                    }
                }
            }

            // También intentar eliminar cualquier documento que pueda contener 'mullbot' o 'client' en cualquier campo
            try {
                const allCollections = await db.listCollections().toArray();
                for (const collInfo of allCollections) {
                    const collName = collInfo.name;
                    // Solo verificar colecciones que puedan contener sesiones
                    if (collName.includes('auth') || collName.includes('session') || collName.includes('whatsapp')) {
                        try {
                            const collection = db.collection(collName);
                            // Buscar documentos que puedan ser sesiones relacionadas con nuestro cliente
                            const relatedDocs = await collection.find({
                                $or: [
                                    { _id: { $regex: /mullbot/i } },
                                    { clientId: { $regex: /mullbot/i } },
                                    { clientId: 'mullbot-client' }
                                ]
                            }).toArray();
                            
                            if (relatedDocs.length > 0) {
                                const result = await collection.deleteMany({
                                    $or: [
                                        { _id: { $regex: /mullbot/i } },
                                        { clientId: { $regex: /mullbot/i } },
                                        { clientId: 'mullbot-client' }
                                    ]
                                });
                                totalDeleted += result.deletedCount;
                                logger.info(`Cleared ${result.deletedCount} related session(s) from '${collName}' collection`);
                            }
                        } catch (error) {
                            // Continuar con la siguiente colección
                        }
                    }
                }
            } catch (error) {
                logger.warn(`Error scanning collections for related sessions: ${error}`);
            }

            logger.info(`Total: Cleared ${totalDeleted} session(s) from MongoDB (COMPLETE CLEAR)`);
            
            // Esperar un momento para asegurar que MongoDB procese las eliminaciones
            await new Promise(resolve => setTimeout(resolve, 500));
            
            return totalDeleted;
        } catch (error) {
            logger.error(`Error clearing all sessions from MongoDB: ${error}`);
            throw error;
        }
    }

    /**
     * Limpiar sesión de MongoDB
     * También limpia la colección 'auth_sessions' que usa wwebjs-mongo
     */
    private async clearSessionFromMongoDB(): Promise<void> {
        try {
            const mongoose = require('mongoose');
            const db = mongoose.connection.db;
            if (db) {
                let totalDeleted = 0;

                // Borrar todas las sesiones de 'authsessions' (colección usada por RemoteAuth)
                const authsessionsResult = await db.collection('authsessions').deleteMany({
                    _id: { $regex: /^mullbot-client/ }
                });
                totalDeleted += authsessionsResult.deletedCount;
                logger.info(`Cleared ${authsessionsResult.deletedCount} session(s) from 'authsessions' collection`);

                // Borrar todas las sesiones de 'auth_sessions' (colección usada por MongoStore/wwebjs-mongo)
                const authSessionsResult = await db.collection('auth_sessions').deleteMany({
                    _id: { $regex: /^mullbot-client/ }
                });
                totalDeleted += authSessionsResult.deletedCount;
                logger.info(`Cleared ${authSessionsResult.deletedCount} session(s) from 'auth_sessions' collection`);

                // También intentar borrar cualquier sesión que contenga 'mullbot' en el ID
                const allSessionsResult = await db.collection('auth_sessions').deleteMany({
                    $or: [
                        { _id: { $regex: /mullbot/i } },
                        { clientId: 'mullbot-client' }
                    ]
                });
                totalDeleted += allSessionsResult.deletedCount;
                logger.info(`Cleared ${allSessionsResult.deletedCount} additional session(s) from 'auth_sessions' collection`);

                logger.info(`Total: Cleared ${totalDeleted} session(s) from MongoDB`);
            }
        } catch (error) {
            logger.error(`Error clearing session from MongoDB: ${error}`);
            // No lanzar error para que la inicialización continúe incluso si hay un problema limpiando sesiones
            logger.warn("Continuing with client initialization despite session cleanup error");
        }
    }

    /**
     * Limpiar sesiones antiguas pero mantener solo la sesión actual activa
     * Se llama cuando se conecta un nuevo celular para evitar conflictos
     */
    private async cleanupOldSessions(): Promise<void> {
        try {
            const mongoose = require('mongoose');
            const db = mongoose.connection.db;
            if (!db) {
                logger.warn("MongoDB connection not available for cleanup");
                return;
            }

            let totalDeleted = 0;

            // Limpiar todas las sesiones antiguas de 'authsessions'
            // Mantener solo la más reciente si hay múltiples
            const authsessionsCollection = db.collection('authsessions');
            const authsessionsQuery: any = { _id: { $regex: /^mullbot-client/ } };
            
            const allAuthSessions = await authsessionsCollection.find(authsessionsQuery).sort({ _id: -1 }).toArray();
            if (allAuthSessions.length > 1) {
                // Mantener solo la más reciente, eliminar las demás
                const sessionsToDelete = allAuthSessions.slice(1);
                for (const session of sessionsToDelete) {
                    await authsessionsCollection.deleteOne({ _id: session._id });
                    totalDeleted++;
                }
                logger.info(`Cleaned up ${sessionsToDelete.length} old session(s) from 'authsessions', kept most recent`);
            }

            // Limpiar todas las sesiones antiguas de 'auth_sessions'
            // Mantener solo la más reciente si hay múltiples
            const authSessionsCollection = db.collection('auth_sessions');
            const authSessionsQuery: any = {
                $or: [
                    { _id: { $regex: /mullbot/i } },
                    { clientId: 'mullbot-client' }
                ]
            };

            const allSessions = await authSessionsCollection.find(authSessionsQuery).sort({ _id: -1 }).toArray();
            if (allSessions.length > 1) {
                // Mantener solo la más reciente, eliminar las demás
                const sessionsToDelete = allSessions.slice(1);
                for (const session of sessionsToDelete) {
                    await authSessionsCollection.deleteOne({ _id: session._id });
                    totalDeleted++;
                }
                logger.info(`Cleaned up ${sessionsToDelete.length} old session(s) from 'auth_sessions', kept most recent`);
            }

            if (totalDeleted > 0) {
                logger.info(`Total: Cleaned up ${totalDeleted} old session(s) from MongoDB`);
            } else {
                logger.info("No old sessions to clean up - only one session exists");
            }
        } catch (error) {
            logger.error(`Error cleaning up old sessions: ${error}`);
            // No lanzar error, solo loguear
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
        let userNumber: string = '';
        let userPushname: string = '';

        // Permitir mensajes con media aunque no tengan texto
        const content = message.body?.trim() || '';

        if (AppConfig.instance.getSupportedMessageTypes().indexOf(message.type) === -1) {
            return;
        }

        try {
            // Intentar obtener información del contacto de manera robusta
            try {
                const user = await message.getContact();
                userNumber = user?.number || '';
                userPushname = user?.pushname || '';
            } catch (contactError) {
                // Si falla getContact, extraer número del message.from
                logger.warn(`Could not get contact info, using fallback: ${contactError}`);
                userNumber = message.from.split('@')[0];
                userPushname = 'Usuario';
            }

            logger.info(`Message from @${userPushname} (${userNumber}): ${content}`);

            if (!userNumber) {
                logger.warn('Could not determine user number, skipping message');
                return;
            }

            // Verificar si el usuario está pausado
            const contact = await ContactModel.findOne({ phoneNumber: userNumber });
            if (contact && contact.isPaused) {
                logger.info(`Message from paused user ${userNumber} - ignoring`);
                return; // No procesar mensajes de usuarios pausados
            }

            userI18n = this.getUserI18n(userNumber);

            // Solo trackear si no es mensaje propio
            if (!message.fromMe) {
                await this.trackContactSimple(userNumber, userPushname, userI18n);
                // Guardar mensaje recibido en la base de datos
                await this.saveMessage(message, false, userNumber);
            }
            
            chat = await message.getChat();

            if (message.from === this.client.info.wid._serialized || message.isStatus) {
                return;
            }

            await Promise.all([
                onboard(message, userI18n),
                this.processMessageContent(message, content, userI18n, chat)
            ]);

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

    private async trackContactSimple(phoneNumber: string, pushName: string, userI18n: UserI18n) {
        try {
            await ContactModel.findOneAndUpdate(
                { phoneNumber },
                {
                    $set: {
                        pushName: pushName,
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
                // Extraer número del mensaje sin usar getContact (para evitar errores)
                const phoneNumber = message.from.split('@')[0];
                const contact = await ContactModel.findOne({ phoneNumber });

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
     * @param message - El mensaje de WhatsApp
     * @param isFromBot - Si el mensaje fue enviado por el bot
     * @param knownPhoneNumber - Número de teléfono si ya se conoce (evita llamar a getContact)
     */
    private async saveMessage(message: Message, isFromBot: boolean, knownPhoneNumber?: string): Promise<void> {
        try {
            // Determinar el número de teléfono del contacto
            let phoneNumber: string;
            let contact;

            if (isFromBot) {
                // Mensaje enviado por el bot: el destinatario está en message.to
                phoneNumber = message.to.split('@')[0];
                contact = await ContactModel.findOne({ phoneNumber });
            } else if (knownPhoneNumber) {
                // Si ya conocemos el número, usarlo directamente
                phoneNumber = knownPhoneNumber;
                contact = await ContactModel.findOne({ phoneNumber });
            } else {
                // Fallback: extraer del message.from
                phoneNumber = message.from.split('@')[0];
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

            // Obtener pushName del contacto en la base de datos
            let pushName: string | undefined = undefined;
            if (contact) {
                pushName = contact.pushName;
            }

            // Detectar si el mensaje requiere atención (solicitud de agente humano)
            let requiresAttention = false;
            if (!isFromBot && message.body) {
                const content = message.body.toLowerCase();
                const agentKeywords = ['agente', 'humano', 'persona', 'representante', 'atencion', 'atención', 'hablar con', 'hablar con un', 'quiero hablar', 'necesito hablar'];
                requiresAttention = agentKeywords.some(keyword => content.includes(keyword));

                // También detectar si es la opción 8 del menú
                const cleanContent = content.trim();
                const isOption8 = /^8[\s\.\)\-]*$/.test(cleanContent) ||
                    /^8[\s\.\)\-]/.test(cleanContent) ||
                    cleanContent === '8';

                requiresAttention = requiresAttention || isOption8;
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
                    requiresAttention: requiresAttention,
                    metadata: {
                        pushName: pushName,
                        isGroup: message.from.includes('@g.us') || message.to.includes('@g.us'),
                        isForwarded: message.isForwarded,
                        isStarred: message.isStarred
                    }
                },
                { upsert: true, new: true }
            );

            // Si el mensaje requiere atención, pausar temporalmente al contacto y enviar mensaje
            if (requiresAttention && contact && !isFromBot && this.client) {
                try {
                    // Pausar contacto
                    await ContactModel.findOneAndUpdate(
                        { phoneNumber: phoneNumber },
                        {
                            $set: { isPaused: true },
                            $push: { tags: 'requires_human_attention' }
                        }
                    );
                    logger.info(`Contact ${phoneNumber} paused temporarily - requested human agent`);

                    // Enviar mensaje automático de confirmación
                    try {
                        const formattedNumber = phoneNumber.includes('@')
                            ? phoneNumber
                            : `${phoneNumber}@c.us`;

                        const pauseMessage = `✅ *Solicitud Recibida*

Tu solicitud ha sido registrada correctamente.

👤 *Estado:* En cola para atención humana
⏰ *Horario de atención:* Lunes a Viernes 9am - 7pm

📝 Enseguida vendrá un asesor a atenderte. El bot ha sido pausado temporalmente para evitar respuestas automáticas.

¡Gracias por tu paciencia! 🌱`;

                        const sentMessage = await this.client.sendMessage(formattedNumber, pauseMessage);

                        // Guardar mensaje enviado en la base de datos
                        if (sentMessage) {
                            await this.saveMessage(sentMessage, true);
                        }

                        logger.info(`Pause confirmation message sent automatically to ${phoneNumber}`);

                        // NOTIFICAR AL AGENTE HUMANO SI ESTÁ CONFIGURADO
                        try {
                            const { BotConfigModel } = await import('./crm/models/bot-config.model');
                            const botCfg = await BotConfigModel.findOne();

                            if (botCfg && botCfg.humanAgentPhone && botCfg.notifyAgentOnAttention) {
                                const agentNumber = botCfg.humanAgentPhone;
                                const formattedAgent = agentNumber.includes('@') ? agentNumber : `${agentNumber}@c.us`;
                                const excerpt = (message.body || '').toString().substring(0, 300);
                                const notifyText = `📣 *Nueva solicitud de atención humana*\n\n*De:* ${phoneNumber}\n*Nombre:* ${pushName || 'Desconocido'}\n*Mensaje:* ${excerpt}\n\nResponde desde el panel de administración o envía mensaje directo usando este número.`;

                                try {
                                    const sentToAgent = await this.client.sendMessage(formattedAgent, notifyText);
                                    if (sentToAgent) await this.saveSentMessage(agentNumber, notifyText);

                                    // Asociar agente al contacto para seguimiento
                                    await ContactModel.findOneAndUpdate({ phoneNumber: phoneNumber }, { $set: { assignedAgentPhone: agentNumber } });

                                    logger.info(`Agent ${agentNumber} notified about ${phoneNumber}`);
                                } catch (notifyErr) {
                                    logger.error(`Error notifying agent ${agentNumber}:`, notifyErr);
                                }
                            }
                        } catch (cfgErr) {
                            logger.error('Error loading bot config for agent notification:', cfgErr);
                        }

                    } catch (messageError) {
                        logger.error(`Error sending automatic pause confirmation message to ${phoneNumber}:`, messageError);
                        // No fallar la operación de pausa si el mensaje falla
                    }
                } catch (error) {
                    logger.error(`Error pausing contact ${phoneNumber}: ${error}`);
                }
            }
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
                hasMedia: false,
                requiresAttention: false // Los mensajes del admin no requieren atención
            });
        } catch (error) {
            logger.error(`Error saving sent message: ${error}`);
        }
    }
}