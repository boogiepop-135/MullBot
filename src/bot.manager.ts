/**
 * BotManager - Gestión del bot de WhatsApp usando Evolution API v2
 * 
 * Este módulo ha sido completamente refactorizado para usar Evolution API v2
 * en lugar de whatsapp-web.js. Ahora funciona mediante webhooks y REST API.
 */

import logger from "./configs/logger.config";
import { UserI18n } from "./utils/i18n.util";
import commands from "./commands";
import { isUrl } from "./utils/common.util";
import { identifySocialNetwork, YtDlpDownloader } from "./utils/get.util";
import { onboard } from "./utils/onboarding.util";
import prisma from "./database/prisma";
import { detectPaymentReceipt, handlePaymentReceipt } from "./utils/payment-detection.util";
import { detectAppointmentProposal, handleAppointmentProposal } from "./utils/appointment-detection.util";
import { EvolutionAPIv2Service } from "./services/evolution-api-v2.service";
import { SessionManagerService, SessionState } from "./services/session-manager.service";
import { AppConfig } from "./configs/app.config";
import EnvConfig from "./configs/env.config";
import {
    EvolutionMessageData,
    EvolutionConnectionData,
    EvolutionQRData
} from "./types/evolution-api.types";

export class BotManager {
    private static instance: BotManager;
    
    // Evolution API v2 Service
    private evolutionAPI: EvolutionAPIv2Service;
    
    // Session Manager
    private sessionManager: SessionManagerService;
    
    // Estado del bot (mantenido por compatibilidad)
    public qrData = {
        qrCodeData: "",
        qrScanned: false
    };
    
    private userI18nCache = new Map<string, UserI18n>();
    private prefix = AppConfig.instance.getBotPrefix();
    private qrPollInterval: NodeJS.Timeout | null = null;

    private constructor() {
        // Inicializar Evolution API v2 Service
        this.evolutionAPI = new EvolutionAPIv2Service();
        // Inicializar Session Manager
        this.sessionManager = SessionManagerService.getInstance(this.evolutionAPI);
        logger.info("🤖 BotManager inicializado con Evolution API v2");
    }

    public static getInstance(): BotManager {
        if (!BotManager.instance) {
            BotManager.instance = new BotManager();
        }
        return BotManager.instance;
    }

    /**
     * Obtener Session Manager
     */
    public getSessionManager(): SessionManagerService {
        return this.sessionManager;
    }

    /**
     * Obtener Evolution API Service
     */
    public getEvolutionAPI(): EvolutionAPIv2Service {
        return this.evolutionAPI;
    }

    /**
     * Inicializar instancia de Evolution API
     * Verifica si existe, si no la crea automáticamente
     */
    public async initializeClient(): Promise<void> {
        try {
            logger.info("🚀 Inicializando Evolution API v2...");
            await this.sessionManager.initializeSession();
            logger.info("✅ Evolution API v2 inicializado correctamente");
            
            // Iniciar polling de QR si no está conectado
            this.startQRPolling();
        } catch (error) {
            logger.error("❌ Error inicializando Evolution API:", error);
            throw error;
        }
    }

    /**
     * Inicializar el bot (alias para compatibilidad)
     */
    public async initialize(): Promise<void> {
        await this.initializeClient();
    }

    /**
     * Iniciar polling de QR desde Evolution API
     */
    private startQRPolling(): void {
        // Limpiar intervalo anterior si existe
        if (this.qrPollInterval) {
            clearInterval(this.qrPollInterval);
        }

        // Polling cada 5 segundos para obtener QR y verificar conexión
        this.qrPollInterval = setInterval(async () => {
            try {
                // Verificar si está conectado
                const isConnected = await this.evolutionAPI.isConnected();
                
                if (isConnected) {
                    // Actualizar Session Manager
                    if (this.sessionManager.getState() !== SessionState.AUTHENTICATED) {
                        this.sessionManager.markAsAuthenticated();
                    }
                    
                    if (!this.qrData.qrScanned) {
                        this.qrData.qrScanned = true;
                        this.qrData.qrCodeData = "";
                        logger.info("✅ WhatsApp conectado vía Evolution API");
                    }
                    
                    // Si está conectado, detener polling
                    if (this.qrPollInterval) {
                        clearInterval(this.qrPollInterval);
                        this.qrPollInterval = null;
                    }
                    return;
                }

                // Si no está conectado, obtener QR
                const qr = await this.evolutionAPI.getQR();
                if (qr && qr !== this.qrData.qrCodeData) {
                    this.qrData.qrCodeData = qr;
                    this.qrData.qrScanned = false;
                    logger.info("📱 QR code actualizado desde Evolution API");
                }
            } catch (error) {
                logger.error("Error en polling de QR de Evolution API:", error);
            }
        }, 5000);

        logger.info("🔄 Polling de QR de Evolution API iniciado");
    }

    /**
     * Desvincular WhatsApp y eliminar instancia
     */
    public async logout(): Promise<number> {
        try {
            logger.info("=== INICIANDO LOGOUT COMPLETO ===");
            
            // Detener polling
            if (this.qrPollInterval) {
                clearInterval(this.qrPollInterval);
                this.qrPollInterval = null;
            }

            // Desconectar sesión usando Session Manager
            try {
                await this.sessionManager.disconnect();
            } catch (error: any) {
                // Si hay error, forzar reset
                logger.warn(`⚠️ Error en sessionManager.disconnect(), forzando reset: ${error.message || error}`);
                this.sessionManager.forceReset();
            }
            
            // Resetear QR data (mantenido por compatibilidad)
            this.qrData = {
                qrCodeData: "",
                qrScanned: false
            };

            logger.info("=== LOGOUT COMPLETO EXITOSO ===");
            return 1; // Retornar 1 para compatibilidad con código existente
        } catch (error) {
            logger.error(`❌ Error durante logout: ${error}`);
            // Aún así, resetear para permitir reconexión
            this.sessionManager.forceReset();
            this.qrData = {
                qrCodeData: "",
                qrScanned: false
            };
            logger.warn('⚠️ Continuando a pesar del error para permitir reconexión');
            return 0;
        }
    }

    /**
     * Enviar mensaje usando Evolution API
     * @param phoneNumber Número de teléfono (formato: 1234567890 o 1234567890@c.us)
     * @param message Texto del mensaje
     */
    public async sendMessage(phoneNumber: string, message: string): Promise<void> {
        try {
            await this.evolutionAPI.sendMessage(phoneNumber, message);
        } catch (error: any) {
            // Mejorar logging de error
            logger.error(`Error sending message to ${phoneNumber}: ${error?.message || error?.toString() || 'Unknown error'}`);
            if (error?.response?.data) {
                logger.error(`  API Response:`, JSON.stringify(error.response.data, null, 2));
            }
            if (error?.stack) {
                logger.error(`  Stack trace: ${error.stack}`);
            }
            throw error;
        }
    }

    /**
     * Procesar mensaje recibido desde webhook de Evolution API
     * @param messageData Datos del mensaje desde Evolution API
     */
    public async handleIncomingMessage(messageData: EvolutionMessageData): Promise<void> {
        try {
            // Filtrar mensajes del propio bot
            if (messageData.key.fromMe) {
                return;
            }

            // Extraer información del mensaje
            const remoteJid = messageData.key.remoteJid;
            const phoneNumber = remoteJid.split('@')[0];
            const pushName = messageData.pushName || 'Usuario';
            
            // Extraer contenido del mensaje
            let content = '';
            if (messageData.message.conversation) {
                content = messageData.message.conversation;
            } else if (messageData.message.extendedTextMessage?.text) {
                content = messageData.message.extendedTextMessage.text;
            } else if (messageData.message.imageMessage?.caption) {
                content = messageData.message.imageMessage.caption;
            } else if (messageData.message.videoMessage?.caption) {
                content = messageData.message.videoMessage.caption;
            }

            logger.info(`📨 Mensaje recibido de ${pushName} (${phoneNumber}): ${content || '[Media/Sticker]'}`);

            // Verificar si el usuario está pausado (buscar con diferentes formatos de número)
            const phoneNumberWithSuffix = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
            const contact = await prisma.contact.findFirst({
                where: {
                    OR: [
                        { phoneNumber: phoneNumber },
                        { phoneNumber: phoneNumberWithSuffix },
                        { phoneNumber: remoteJid }
                    ]
                }
            });
            if (contact && contact.isPaused) {
                logger.info(`⏸️ Mensaje de usuario pausado ${phoneNumber} - ignorando (isPaused: ${contact.isPaused})`);
                return;
            }

            // Obtener o crear UserI18n
            const userI18n = this.getUserI18n(phoneNumber);

            // Trackear contacto
            await this.trackContactSimple(phoneNumber, pushName, userI18n);

            // Guardar mensaje en base de datos
            await this.saveIncomingMessage(messageData, phoneNumber);

            // Verificar si es administrador
            try {
                const { isAdminPhone, sendAdminInfo, sendUpdatedAdminInfo } = await import('./utils/admin-info.util');
                const isAdmin = await isAdminPhone(phoneNumber);
                
                if (isAdmin) {
                    if (content.toLowerCase().trim() === '/info') {
                        await sendUpdatedAdminInfoEvolution(this.evolutionAPI, phoneNumber);
                        return;
                    }
                    
                    setTimeout(async () => {
                        await sendAdminInfoEvolution(this.evolutionAPI, phoneNumber);
                    }, 2000);
                }
            } catch (error) {
                logger.error('Error checking/sending admin info:', error);
            }

            // Procesar mensaje (onboard y comandos)
            await Promise.all([
                onboardEvolution(this.evolutionAPI, phoneNumber, content, userI18n),
                this.processMessageContentEvolution(phoneNumber, content, userI18n, messageData, pushName)
            ]);

        } catch (error) {
            logger.error(`❌ Error procesando mensaje entrante: ${error}`);
        }
    }

    /**
     * Obtener historial de conversación reciente para contexto
     */
    private async getConversationHistory(phoneNumber: string, limit: number = 6): Promise<Array<{role: 'user' | 'assistant', content: string}>> {
        try {
            const messages = await prisma.message.findMany({
                where: { phoneNumber },
                orderBy: { timestamp: 'desc' },
                take: limit * 2, // Tomar el doble porque incluye mensajes enviados y recibidos
            });

            // Convertir a formato de historial
            const history = messages
                .reverse() // Más antiguo primero
                .map(msg => ({
                    role: msg.isFromBot ? 'assistant' as const : 'user' as const,
                    content: msg.body
                }))
                .filter(msg => msg.content && msg.content.trim().length > 0);

            return history;
        } catch (error) {
            logger.error(`Error obteniendo historial: ${error}`);
            return [];
        }
    }

    /**
     * Procesar contenido del mensaje (comandos, URLs, etc.)
     */
    private async processMessageContentEvolution(
        phoneNumber: string,
        content: string,
        userI18n: UserI18n,
        messageData: EvolutionMessageData,
        pushName: string
    ): Promise<void> {
        try {
            // Detectar comprobantes de pago
            const hasImage = !!messageData.message.imageMessage;
            if (hasImage) {
                // Aquí puedes agregar lógica para detectar comprobantes de pago
                // Por ahora, solo procesamos texto
            }

            // Procesar comandos
            if (content.startsWith(this.prefix)) {
                const command = content.slice(this.prefix.length).split(' ')[0].toLowerCase();
                const args = content.slice(this.prefix.length + command.length).trim();

                if (commands[command]) {
                    logger.info(`Ejecutando comando: ${command}`);
                    await commands[command].execute(this.evolutionAPI, phoneNumber, args, userI18n);
                    return;
                }
            }

            // Procesar URLs
            if (isUrl(content)) {
                try {
                    const network = identifySocialNetwork(content);
                    if (network) {
                        const { YtDlpDownloader } = await import('./utils/get.util');
                        const downloader = YtDlpDownloader.getInstance();
                        await downloader.downloadAndSend(this.evolutionAPI, phoneNumber, content, network);
                        return;
                    }
                } catch (error) {
                    logger.error(`Error procesando URL: ${error}`);
                }
            }

            // Si no es comando ni URL, procesar como mensaje normal del bot
            
            // DETECTAR SOLICITUD DE AGENTE ANTES DE CUALQUIER OTRA COSA
            // Esto debe hacerse PRIMERO para asegurar que se pausa el bot y se crea la asesoría
            const normalizedQuery = content.toLowerCase().trim();
            const isAgentRequest = normalizedQuery === '8' ||
                /^8[\s\.\)\-]*$/.test(normalizedQuery) ||
                /^8[\s\.\)\-]/.test(normalizedQuery) ||
                normalizedQuery.includes('agente') ||
                normalizedQuery.includes('humano') ||
                normalizedQuery.includes('persona') ||
                normalizedQuery.includes('representante') ||
                normalizedQuery.includes('asesor') ||
                normalizedQuery.includes('pasarías con') ||
                normalizedQuery.includes('pasar con') ||
                normalizedQuery.includes('hablar con') ||
                normalizedQuery.includes('puedo hablar') ||
                normalizedQuery.includes('me gustaría hablar');

            if (isAgentRequest) {
                logger.info(`🔔 Solicitud de agente detectada: "${content}"`);
                
                try {
                    const prisma = (await import('./database/prisma')).default;
                    const { SaleStatus } = await import('@prisma/client');
                    
                    // Normalizar número de teléfono
                    const phoneNumberWithSuffix = `${phoneNumber}@s.whatsapp.net`;
                    const contactName = pushName || null;
                    
                    // Obtener últimos 5 mensajes para contexto
                    const recentMessages = await prisma.message.findMany({
                        where: {
                            OR: [
                                { phoneNumber: phoneNumber },
                                { phoneNumber: phoneNumberWithSuffix },
                                { phoneNumber: messageData.key.remoteJid }
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

                    // Verificar si ya existe una asesoría pendiente o activa
                    const existingAdvisory = await prisma.advisory.findFirst({
                        where: {
                            OR: [
                                { customerPhone: phoneNumber },
                                { customerPhone: phoneNumberWithSuffix },
                                { customerPhone: messageData.key.remoteJid }
                            ],
                            status: {
                                in: ['PENDING', 'ACTIVE']
                            }
                        }
                    });

                    if (existingAdvisory) {
                        logger.info(`ℹ️ Ya existe una asesoría activa para ${phoneNumberWithSuffix}. Actualizando...`);
                        await prisma.advisory.update({
                            where: { id: existingAdvisory.id },
                            data: {
                                lastActivityAt: new Date(),
                                summary: summary
                            }
                        });
                    } else {
                        // Crear asesoría
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

                    // Actualizar estado del contacto a AGENT_REQUESTED y pausar el bot
                    await prisma.contact.updateMany({
                        where: {
                            OR: [
                                { phoneNumber: phoneNumber },
                                { phoneNumber: phoneNumberWithSuffix },
                                { phoneNumber: messageData.key.remoteJid }
                            ]
                        },
                        data: {
                            saleStatus: SaleStatus.AGENT_REQUESTED,
                            isPaused: true,
                            saleStatusNotes: 'Cliente solicitó hablar con un asesor humano'
                        }
                    });

                    logger.info(`✅ Contacto ${phoneNumber} actualizado a AGENT_REQUESTED y pausado`);

                    // Enviar mensaje de confirmación
                    const agentMessage = `✅ *Solicitud Recibida*

Tu solicitud para hablar con un asesor ha sido registrada.

📝 *Estado:* En cola para atención humana
⏰ Horario de atención: Lunes a Viernes 9am - 7pm

Nuestro equipo se pondrá en contacto contigo lo antes posible.

Mientras tanto, el bot ha sido pausado para evitar respuestas automáticas.`;

                    await this.evolutionAPI.sendMessage(phoneNumber, agentMessage);
                    await this.saveSentMessage(phoneNumber, agentMessage);

                    // Notificar al agente
                    try {
                        const { notifyAgentAboutContact } = await import('./utils/agent-notification.util');
                        await notifyAgentAboutContact(phoneNumber, contactName);
                        logger.info(`✅ Notificación enviada al agente para ${phoneNumber}`);
                    } catch (notifyError) {
                        logger.error('Error notificando al agente:', notifyError);
                    }
                } catch (dbError) {
                    logger.error('Error creando asesoría en DB:', dbError);
                }

                // SALIR - no procesar más el mensaje
                return;
            }

            // Verificar si pregunta por catálogo de productos antes de usar IA
            const normalizedContent = content.toLowerCase().trim();
            const catalogKeywords = [
                'catalogo', 'catálogo', 'productos', 'producto', 'lista de productos',
                'que tienen', 'que tienes', 'que ofreces', 'que vendes',
                'mostrar productos', 'ver productos', 'muestra productos',
                'catálogo de productos', 'catalogo de productos'
            ];
            const isCatalogRequest = catalogKeywords.some(keyword => normalizedContent.includes(keyword));
            
            if (isCatalogRequest) {
                logger.info(`📊 Usuario solicita catálogo de productos: ${content}`);
                try {
                    const prisma = (await import('./database/prisma')).default;
                    const { formatProductsForWhatsApp } = await import('./utils/product-formatter.util');
                    
                    const products = await prisma.product.findMany({
                        where: { inStock: true },
                        orderBy: { createdAt: 'desc' }
                    });
                    
                    if (products && products.length > 0) {
                        const catalogMessage = formatProductsForWhatsApp(products);
                        await this.evolutionAPI.sendMedia(phoneNumber, 'public/precio.png', catalogMessage);
                        await this.saveSentMessage(phoneNumber, catalogMessage);
                        logger.info(`✅ Catálogo enviado (${products.length} productos)`);
                        return;
                    } else {
                        logger.warn('⚠️ No hay productos disponibles en la base de datos');
                    }
                } catch (error) {
                    logger.error('❌ Error obteniendo catálogo:', error);
                }
            }

            // Verificar si muestra interés en un producto específico
            const interestKeywords = ['tengo interes', 'tengo interés', 'me interesa', 'quiero saber de', 'información de', 'info de', 'detalles de'];
            const hasInterestKeyword = interestKeywords.some(keyword => normalizedContent.includes(keyword));
            
            if (hasInterestKeyword) {
                logger.info(`🔍 Usuario muestra interés en producto: ${content}`);
                try {
                    const prisma = (await import('./database/prisma')).default;
                    const { findProductByName, formatProductDetails } = await import('./utils/product-formatter.util');
                    
                    const products = await prisma.product.findMany({
                        where: { inStock: true },
                        orderBy: { createdAt: 'desc' }
                    });
                    
                    // Extraer nombre del producto del mensaje
                    const productName = content
                        .replace(/tengo interes en|tengo interés en|me interesa|quiero saber de|información de|info de|detalles de/gi, '')
                        .trim();
                    
                    if (productName && products.length > 0) {
                        const product = findProductByName(products, productName);
                        
                        if (product) {
                            const productDetails = formatProductDetails(product);
                            
                            // Si hay imagen URL, incluirla en el mensaje (el mensaje ya tiene el link)
                            // Si no hay imagen, usar imagen por defecto
                            if (product.imageUrl && product.imageUrl.startsWith('http')) {
                                // Es una URL, solo enviar mensaje con el link incluido
                                await this.evolutionAPI.sendMessage(phoneNumber, productDetails);
                            } else if (product.imageUrl) {
                                // Es una ruta local
                                await this.evolutionAPI.sendMedia(phoneNumber, product.imageUrl, productDetails);
                            } else {
                                // Sin imagen, usar imagen por defecto
                                await this.evolutionAPI.sendMedia(phoneNumber, 'public/precio.png', productDetails);
                            }
                            await this.saveSentMessage(phoneNumber, productDetails);
                            logger.info(`✅ Información del producto "${product.name}" enviada`);
                            return;
                        }
                    }
                } catch (error) {
                    logger.error('❌ Error obteniendo información del producto:', error);
                }
            }

            // Verificar si pregunta por estado de servicios antes de usar IA
            const { isServiceStatusQuery, generateServiceStatusResponse } = await import('./utils/service-status.util');
            
            if (isServiceStatusQuery(content)) {
                logger.info(`🔍 Usuario pregunta por estado de servicios: ${content}`);
                const statusResponse = await generateServiceStatusResponse(content);
                await this.evolutionAPI.sendMessage(phoneNumber, statusResponse);
                await this.saveSentMessage(phoneNumber, statusResponse);
                return;
            }

            // Si no pregunta por estado, usar IA para responder
            try {
                const { aiCompletion } = await import('./utils/ai-fallback.util');
                
                // Obtener historial de conversación (últimos 6 mensajes)
                const conversationHistory = await this.getConversationHistory(phoneNumber, 6);
                logger.info(`📜 Cargando historial: ${conversationHistory.length} mensajes previos`);
                
                const result = await aiCompletion(content, conversationHistory);
                
                logger.info(`📝 Respuesta de IA recibida (${result.text.length} chars): ${result.text.substring(0, 100)}...`);
                
                // Procesar respuesta para detectar y enviar imágenes
                const { processResponseWithImages } = await import('./utils/image-sender.util');
                logger.info(`🔍 Procesando respuesta para detectar imágenes...`);
                
                const cleanText = await processResponseWithImages(
                    result.text,
                    async (imagePath: string) => {
                        // Enviar imagen usando Evolution API
                        logger.info(`📤 Enviando imagen desde: ${imagePath}`);
                        await this.evolutionAPI.sendMedia(phoneNumber, imagePath, '');
                        logger.info(`✅ Imagen enviada correctamente`);
                    }
                );
                
                logger.info(`📝 Texto limpio después de procesar imágenes (${cleanText.length} chars): ${cleanText.substring(0, 100)}...`);
                
                // Enviar texto (si hay, después de las imágenes)
                if (cleanText && cleanText.length > 0) {
                    await this.evolutionAPI.sendMessage(phoneNumber, cleanText);
                    await this.saveSentMessage(phoneNumber, cleanText);
                }
            } catch (error) {
                logger.error(`Error usando IA para responder: ${error}`);
                const errorMessage = 'Lo siento, no pude procesar tu consulta en este momento. Por favor, intenta de nuevo o contacta al soporte.';
                await this.evolutionAPI.sendMessage(phoneNumber, errorMessage);
                await this.saveSentMessage(phoneNumber, errorMessage);
            }

        } catch (error) {
            logger.error(`Error procesando contenido del mensaje: ${error}`);
        }
    }

    /**
     * Guardar mensaje entrante en base de datos
     */
    private async saveIncomingMessage(messageData: EvolutionMessageData, phoneNumber: string): Promise<void> {
        try {
            const content = messageData.message.conversation || 
                          messageData.message.extendedTextMessage?.text || 
                          '[Media/Sticker]';

            const timestamp = new Date(messageData.messageTimestamp * 1000);
            const messageId = `${messageData.key.remoteJid}-${messageData.messageTimestamp}`;

            await prisma.message.upsert({
                where: { messageId },
                update: {
                    phoneNumber: phoneNumber,
                    from: messageData.key.remoteJid,
                    to: EnvConfig.EVOLUTION_INSTANCE_NAME || 'evolution-instance',
                    body: content,
                    type: 'text',
                    isFromBot: false,
                    timestamp: timestamp,
                    hasMedia: !!(messageData.message.imageMessage || 
                               messageData.message.videoMessage || 
                               messageData.message.audioMessage || 
                               messageData.message.documentMessage),
                    requiresAttention: false,
                    metadata: {
                        pushName: messageData.pushName,
                        isGroup: messageData.key.remoteJid.includes('@g.us'),
                        fromMe: messageData.key.fromMe
                    }
                },
                create: {
                    messageId,
                    phoneNumber: phoneNumber,
                    from: messageData.key.remoteJid,
                    to: EnvConfig.EVOLUTION_INSTANCE_NAME || 'evolution-instance',
                    body: content,
                    type: 'text',
                    isFromBot: false,
                    timestamp: timestamp,
                    hasMedia: !!(messageData.message.imageMessage || 
                               messageData.message.videoMessage || 
                               messageData.message.audioMessage || 
                               messageData.message.documentMessage),
                    requiresAttention: false,
                    metadata: {
                        pushName: messageData.pushName,
                        isGroup: messageData.key.remoteJid.includes('@g.us'),
                        fromMe: messageData.key.fromMe
                    }
                }
            });
        } catch (error) {
            logger.error('Error guardando mensaje en BD:', error);
        }
    }

    /**
     * Trackear contacto simple
     */
    private async trackContactSimple(phoneNumber: string, pushName: string, userI18n: UserI18n): Promise<void> {
        try {
            const existingContact = await prisma.contact.findUnique({ where: { phoneNumber } });
            
            if (existingContact) {
                await prisma.contact.update({
                    where: { phoneNumber },
                    data: {
                        pushName: pushName,
                        language: userI18n.getLanguage(),
                        lastInteraction: new Date(),
                        interactionsCount: { increment: 1 }
                    }
                });
            } else {
                await prisma.contact.create({
                    data: {
                        phoneNumber,
                        pushName: pushName,
                        language: userI18n.getLanguage(),
                        lastInteraction: new Date(),
                        interactionsCount: 1
                    }
                });
            }
        } catch (error) {
            logger.error('Failed to track contact:', error);
        }
    }

    /**
     * Obtener o crear UserI18n
     */
    private getUserI18n(userNumber: string): UserI18n {
        if (!this.userI18nCache.has(userNumber)) {
            const userI18n = new UserI18n(userNumber);
            this.userI18nCache.set(userNumber, userI18n);
            logger.info(`Nuevo usuario detectado: ${userNumber} (${userI18n.getLanguage()})`);
        }
        return this.userI18nCache.get(userNumber)!;
    }


    /**
     * Guardar mensaje enviado en base de datos
     * @param phoneNumber Número de teléfono
     * @param message Texto del mensaje
     * @param messageId ID del mensaje (opcional, para Evolution API puede ser null)
     */
    public async saveSentMessage(phoneNumber: string, message: string, messageId?: string | null): Promise<void> {
        try {
            const uniqueMessageId = messageId || `${phoneNumber}-${Date.now()}-${Math.random()}`;
            const timestamp = new Date();

            await prisma.message.upsert({
                where: { messageId: uniqueMessageId },
                update: {
                    phoneNumber: phoneNumber,
                    from: EnvConfig.EVOLUTION_INSTANCE_NAME || 'evolution-instance',
                    to: phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`,
                    body: message,
                    type: 'text',
                    isFromBot: true,
                    timestamp: timestamp,
                    hasMedia: false,
                    requiresAttention: false,
                    metadata: {
                        messageId: messageId || null,
                        fromMe: true
                    }
                },
                create: {
                    messageId: uniqueMessageId,
                    phoneNumber: phoneNumber,
                    from: EnvConfig.EVOLUTION_INSTANCE_NAME || 'evolution-instance',
                    to: phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`,
                    body: message,
                    type: 'text',
                    isFromBot: true,
                    timestamp: timestamp,
                    hasMedia: false,
                    requiresAttention: false,
                    metadata: {
                        messageId: messageId || null,
                        fromMe: true
                    }
                }
            });
        } catch (error) {
            logger.error('Error guardando mensaje enviado en BD:', error);
        }
    }

    // Métodos legacy para compatibilidad (deprecated)
    public get client(): any {
        logger.warn("⚠️ BotManager.client está deprecado. Usa getEvolutionAPI() en su lugar.");
        return null;
    }
}

/**
 * Funciones helper para Evolution API
 */

async function onboardEvolution(
    evolutionAPI: EvolutionAPIv2Service,
    phoneNumber: string,
    content: string,
    userI18n: UserI18n
): Promise<void> {
    // Implementar lógica de onboarding si es necesario
    // Por ahora, solo un placeholder
}

async function sendAdminInfoEvolution(
    evolutionAPI: EvolutionAPIv2Service,
    phoneNumber: string
): Promise<void> {
    try {
        const { sendAdminInfo } = await import('./utils/admin-info.util');
        // Adaptar sendAdminInfo para usar Evolution API
        // Por ahora, solo un placeholder
    } catch (error) {
        logger.error('Error sending admin info:', error);
    }
}

async function sendUpdatedAdminInfoEvolution(
    evolutionAPI: EvolutionAPIv2Service,
    phoneNumber: string
): Promise<void> {
    try {
        const { sendUpdatedAdminInfo } = await import('./utils/admin-info.util');
        // Adaptar sendUpdatedAdminInfo para usar Evolution API
        // Por ahora, solo un placeholder
    } catch (error) {
        logger.error('Error sending updated admin info:', error);
    }
}
