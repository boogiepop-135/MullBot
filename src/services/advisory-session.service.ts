import prisma from '../database/prisma';
import logger from '../configs/logger.config';
import { BotManager } from '../bot.manager';

/**
 * Estados de una sesión de asesoría
 */
export enum AdvisorySessionState {
    PENDING = 'PENDING',           // Esperando respuesta del agente
    ACTIVE = 'ACTIVE',             // Asesoría en curso
    COMPLETED = 'COMPLETED',       // Asesoría finalizada
    TIMEOUT = 'TIMEOUT',           // Expirada por inactividad
    REJECTED = 'REJECTED'          // Agente rechazó o no disponible
}

interface AdvisorySession {
    id: string;
    customerPhone: string;
    customerName: string;
    agentPhone: string;
    state: AdvisorySessionState;
    startedAt: Date;
    lastActivityAt: Date;
    completedAt?: Date;
}

/**
 * Servicio para gestionar sesiones de asesoría humana
 */
export class AdvisorySessionService {
    private static instance: AdvisorySessionService;
    private sessions: Map<string, AdvisorySession> = new Map();
    private readonly INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutos
    private readonly PENDING_TIMEOUT = 5 * 60 * 1000; // 5 minutos para aceptar
    private botManager?: BotManager;

    private constructor() {
        // Iniciar limpieza periódica de sesiones inactivas
        setInterval(() => this.cleanupInactiveSessions(), 60 * 1000); // Cada minuto
    }

    public static getInstance(): AdvisorySessionService {
        if (!AdvisorySessionService.instance) {
            AdvisorySessionService.instance = new AdvisorySessionService();
        }
        return AdvisorySessionService.instance;
    }

    public setBotManager(botManager: BotManager) {
        this.botManager = botManager;
    }

    /**
     * Verificar si un agente está disponible (no tiene sesión activa)
     */
    public isAgentAvailable(agentPhone: string): boolean {
        for (const session of this.sessions.values()) {
            if (session.agentPhone === agentPhone && 
                (session.state === AdvisorySessionState.ACTIVE || 
                 session.state === AdvisorySessionState.PENDING)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Obtener el agente de soporte configurado
     */
    private async getSupportAgentPhone(): Promise<string | null> {
        try {
            const config = await prisma.botConfig.findFirst();
            return config?.humanAgentPhone || null;
        } catch (error) {
            logger.error('Error getting support agent phone:', error);
            return null;
        }
    }

    /**
     * Solicitar asesoría humana
     */
    public async requestAdvisory(customerPhone: string, customerName?: string): Promise<{
        success: boolean;
        message: string;
        sessionId?: string;
    }> {
        try {
            // Verificar si el cliente ya tiene una sesión activa
            const existingSession = this.getActiveSessionByCustomer(customerPhone);
            if (existingSession) {
                return {
                    success: false,
                    message: 'Ya tienes una asesoría en curso. Un asesor estará contigo pronto.'
                };
            }

            // Obtener teléfono del agente de soporte
            const agentPhone = await this.getSupportAgentPhone();
            if (!agentPhone) {
                return {
                    success: false,
                    message: 'No hay un agente de soporte configurado. Por favor contacta al administrador.'
                };
            }

            // Verificar disponibilidad del agente
            if (!this.isAgentAvailable(agentPhone)) {
                return {
                    success: false,
                    message: 'El asesor está ocupado en este momento. ¿Puedes esperar un momento o prefieres que te contactemos más tarde?'
                };
            }

            // Crear nueva sesión
            const sessionId = `advisory_${Date.now()}_${customerPhone}`;
            const session: AdvisorySession = {
                id: sessionId,
                customerPhone,
                customerName: customerName || 'Cliente',
                agentPhone,
                state: AdvisorySessionState.PENDING,
                startedAt: new Date(),
                lastActivityAt: new Date()
            };

            this.sessions.set(sessionId, session);

            // Notificar al agente
            await this.notifyAgent(session);

            logger.info(`📞 Sesión de asesoría creada: ${sessionId} (Cliente: ${customerPhone}, Agente: ${agentPhone})`);

            return {
                success: true,
                message: 'Perfecto, estoy notificando a un asesor. En un momento estará contigo 😊',
                sessionId
            };
        } catch (error) {
            logger.error('Error requesting advisory:', error);
            return {
                success: false,
                message: 'Hubo un error al solicitar la asesoría. Por favor intenta de nuevo.'
            };
        }
    }

    /**
     * Notificar al agente sobre una nueva solicitud
     */
    private async notifyAgent(session: AdvisorySession) {
        if (!this.botManager) {
            logger.error('BotManager no configurado en AdvisorySessionService');
            return;
        }

        const message = `📞 *Nueva Solicitud de Asesoría*

👤 Cliente: ${session.customerName}
📱 Teléfono: ${session.customerPhone}

¿Aceptas esta asesoría?
Responde *"Sí"* o *"Claro"* para aceptar.

⏰ Tienes 5 minutos para responder.`;

        try {
            await this.botManager.sendMessage(session.agentPhone, message);
            logger.info(`✅ Notificación enviada al agente ${session.agentPhone}`);
        } catch (error) {
            logger.error(`Error notificando al agente ${session.agentPhone}:`, error);
        }
    }

    /**
     * Agente acepta la asesoría
     */
    public async acceptAdvisory(agentPhone: string): Promise<{ success: boolean; message: string }> {
        // Buscar sesión PENDING para este agente
        const session = Array.from(this.sessions.values()).find(
            s => s.agentPhone === agentPhone && s.state === AdvisorySessionState.PENDING
        );

        if (!session) {
            return {
                success: false,
                message: 'No hay solicitudes de asesoría pendientes.'
            };
        }

        // Actualizar estado a ACTIVE
        session.state = AdvisorySessionState.ACTIVE;
        session.lastActivityAt = new Date();
        this.sessions.set(session.id, session);

        // Notificar al cliente
        if (this.botManager) {
            const clientMessage = `✅ *Un asesor está contigo ahora*

Puedes hacer tus preguntas. El asesor te responderá en este mismo chat.

⏰ La sesión expirará después de 20 minutos de inactividad.`;

            try {
                await this.botManager.sendMessage(session.customerPhone, clientMessage);
            } catch (error) {
                logger.error('Error notificando al cliente:', error);
            }
        }

        logger.info(`✅ Sesión ${session.id} activada - Asesor ${agentPhone} aceptó`);

        return {
            success: true,
            message: `✅ Asesoría aceptada. Ahora estás en sesión con ${session.customerName} (${session.customerPhone})`
        };
    }

    /**
     * Registrar actividad en una sesión (actualiza el timeout)
     */
    public updateActivity(phoneNumber: string) {
        const session = this.getActiveSessionByParticipant(phoneNumber);
        if (session && session.state === AdvisorySessionState.ACTIVE) {
            session.lastActivityAt = new Date();
            this.sessions.set(session.id, session);
        }
    }

    /**
     * Finalizar sesión de asesoría
     */
    public async endAdvisory(phoneNumber: string): Promise<{ success: boolean; message: string }> {
        const session = this.getActiveSessionByParticipant(phoneNumber);
        
        if (!session) {
            return {
                success: false,
                message: 'No hay una sesión de asesoría activa.'
            };
        }

        if (session.state !== AdvisorySessionState.ACTIVE) {
            return {
                success: false,
                message: 'La sesión no está activa.'
            };
        }

        // Finalizar sesión
        session.state = AdvisorySessionState.COMPLETED;
        session.completedAt = new Date();
        this.sessions.set(session.id, session);

        // Notificar a ambas partes
        if (this.botManager) {
            const endMessage = '✅ La sesión de asesoría ha finalizado. ¡Gracias!';
            
            try {
                await this.botManager.sendMessage(session.customerPhone, endMessage);
                await this.botManager.sendMessage(session.agentPhone, `✅ Sesión con ${session.customerName} finalizada.`);
            } catch (error) {
                logger.error('Error notificando fin de sesión:', error);
            }
        }

        logger.info(`✅ Sesión ${session.id} finalizada`);

        // Limpiar sesión después de 1 minuto
        setTimeout(() => this.sessions.delete(session.id), 60 * 1000);

        return {
            success: true,
            message: 'Sesión de asesoría finalizada.'
        };
    }

    /**
     * Verificar si un mensaje es parte de una asesoría activa
     */
    public isInAdvisorySession(phoneNumber: string): boolean {
        const session = this.getActiveSessionByParticipant(phoneNumber);
        return session?.state === AdvisorySessionState.ACTIVE;
    }

    /**
     * Obtener el destinatario del mensaje en una asesoría (cliente <-> agente)
     */
    public getAdvisoryRecipient(senderPhone: string): string | null {
        const session = this.getActiveSessionByParticipant(senderPhone);
        if (!session || session.state !== AdvisorySessionState.ACTIVE) {
            return null;
        }

        return senderPhone === session.customerPhone ? session.agentPhone : session.customerPhone;
    }

    /**
     * Obtener sesión activa por participante (cliente o agente)
     */
    private getActiveSessionByParticipant(phoneNumber: string): AdvisorySession | undefined {
        return Array.from(this.sessions.values()).find(
            s => (s.customerPhone === phoneNumber || s.agentPhone === phoneNumber) && 
                 (s.state === AdvisorySessionState.ACTIVE || s.state === AdvisorySessionState.PENDING)
        );
    }

    /**
     * Obtener sesión activa por cliente
     */
    private getActiveSessionByCustomer(customerPhone: string): AdvisorySession | undefined {
        return Array.from(this.sessions.values()).find(
            s => s.customerPhone === customerPhone && 
                 (s.state === AdvisorySessionState.ACTIVE || s.state === AdvisorySessionState.PENDING)
        );
    }

    /**
     * Limpiar sesiones inactivas (timeout)
     */
    private async cleanupInactiveSessions() {
        const now = Date.now();
        
        for (const [sessionId, session] of this.sessions.entries()) {
            const inactiveTime = now - session.lastActivityAt.getTime();
            
            // Timeout de sesiones ACTIVE por inactividad
            if (session.state === AdvisorySessionState.ACTIVE && 
                inactiveTime > this.INACTIVITY_TIMEOUT) {
                
                logger.info(`⏰ Sesión ${sessionId} expirada por inactividad (${Math.round(inactiveTime / 1000 / 60)} minutos)`);
                
                session.state = AdvisorySessionState.TIMEOUT;
                session.completedAt = new Date();
                
                // Notificar a ambas partes
                if (this.botManager) {
                    const timeoutMessage = '⏰ La sesión de asesoría ha expirado por inactividad (20 minutos).';
                    try {
                        await this.botManager.sendMessage(session.customerPhone, timeoutMessage);
                        await this.botManager.sendMessage(session.agentPhone, `⏰ Sesión con ${session.customerName} expirada por inactividad.`);
                    } catch (error) {
                        logger.error('Error notificando timeout:', error);
                    }
                }
                
                // Eliminar sesión
                this.sessions.delete(sessionId);
            }
            
            // Timeout de sesiones PENDING (agente no respondió)
            if (session.state === AdvisorySessionState.PENDING && 
                inactiveTime > this.PENDING_TIMEOUT) {
                
                logger.info(`⏰ Sesión ${sessionId} expirada - agente no respondió`);
                
                session.state = AdvisorySessionState.REJECTED;
                session.completedAt = new Date();
                
                // Notificar al cliente
                if (this.botManager) {
                    const rejectedMessage = 'Lo siento, el asesor no está disponible en este momento. ¿Puedo ayudarte en algo más?';
                    try {
                        await this.botManager.sendMessage(session.customerPhone, rejectedMessage);
                    } catch (error) {
                        logger.error('Error notificando rechazo:', error);
                    }
                }
                
                // Eliminar sesión
                this.sessions.delete(sessionId);
            }
        }
    }

    /**
     * Obtener todas las sesiones (para el panel de administración)
     */
    public getAllSessions(): AdvisorySession[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Obtener sesión por ID
     */
    public getSessionById(sessionId: string): AdvisorySession | undefined {
        return this.sessions.get(sessionId);
    }
}

export default AdvisorySessionService.getInstance();
