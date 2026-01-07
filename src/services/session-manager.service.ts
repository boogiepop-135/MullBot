/**
 * Session Manager Service
 * 
 * Gestiona el estado de la sesión de WhatsApp con Evolution API
 * Implementa una máquina de estados para prevenir bucles infinitos
 * y race conditions.
 */

import logger from '../configs/logger.config';
import { EvolutionAPIv2Service } from './evolution-api-v2.service';

export enum SessionState {
    IDLE = 'IDLE',                    // Sin sesión activa
    INITIALIZING = 'INITIALIZING',    // Inicializando instancia
    QR_READY = 'QR_READY',            // QR generado y listo
    AUTHENTICATED = 'AUTHENTICATED',  // Sesión autenticada
    DISCONNECTING = 'DISCONNECTING',  // Desconectando
    ERROR = 'ERROR'                   // Error en el proceso
}

interface SessionData {
    state: SessionState;
    qrCode: string | null;
    qrTimestamp: number | null;
    initializedAt: number | null;
    errorMessage: string | null;
    initializationAttempts: number;
}

export class SessionManagerService {
    private static instance: SessionManagerService;
    private sessionData: SessionData;
    private evolutionAPI: EvolutionAPIv2Service;
    private initializationLock: Promise<void> | null = null;
    private readonly MAX_INIT_ATTEMPTS = 10;
    private readonly INIT_TIMEOUT_MS = 60000; // 60 segundos
    private readonly QR_EXPIRY_MS = 300000; // 5 minutos

    private constructor(evolutionAPI: EvolutionAPIv2Service) {
        this.evolutionAPI = evolutionAPI;
        this.sessionData = {
            state: SessionState.IDLE,
            qrCode: null,
            qrTimestamp: null,
            initializedAt: null,
            errorMessage: null,
            initializationAttempts: 0
        };
    }

    public static getInstance(evolutionAPI: EvolutionAPIv2Service): SessionManagerService {
        if (!SessionManagerService.instance) {
            SessionManagerService.instance = new SessionManagerService(evolutionAPI);
        }
        return SessionManagerService.instance;
    }

    /**
     * Obtener estado actual de la sesión
     */
    public getState(): SessionState {
        return this.sessionData.state;
    }

    /**
     * Obtener datos de la sesión
     */
    public getSessionData(): SessionData {
        return { ...this.sessionData };
    }

    /**
     * Verificar si el QR está expirado
     */
    private isQRExpired(): boolean {
        if (!this.sessionData.qrTimestamp) return true;
        const now = Date.now();
        return (now - this.sessionData.qrTimestamp) > this.QR_EXPIRY_MS;
    }

    /**
     * Verificar si la inicialización está atascada (timeout)
     */
    private isInitTimeout(): boolean {
        if (!this.sessionData.initializedAt) return false;
        const now = Date.now();
        return (now - this.sessionData.initializedAt) > this.INIT_TIMEOUT_MS;
    }

    /**
     * Verificar si hay demasiados intentos de inicialización
     */
    private hasExceededMaxAttempts(): boolean {
        return this.sessionData.initializationAttempts >= this.MAX_INIT_ATTEMPTS;
    }

    /**
     * Inicializar sesión (con mutex para prevenir race conditions)
     */
    public async initializeSession(): Promise<void> {
        // Si ya hay una inicialización en progreso, esperar
        if (this.initializationLock) {
            logger.info('⏳ Inicialización ya en progreso, esperando...');
            await this.initializationLock;
            return;
        }

        // Crear lock para prevenir múltiples inicializaciones simultáneas
        this.initializationLock = this._doInitializeSession();
        
        try {
            await this.initializationLock;
        } finally {
            this.initializationLock = null;
        }
    }

    /**
     * Lógica de inicialización real
     */
    private async _doInitializeSession(): Promise<void> {
        try {
            // Verificar estado actual
            if (this.sessionData.state === SessionState.AUTHENTICATED) {
                logger.info('✅ Sesión ya autenticada, no es necesario reinicializar');
                return;
            }

            if (this.sessionData.state === SessionState.INITIALIZING) {
                // Verificar timeout
                if (this.isInitTimeout()) {
                    logger.warn('⏰ Timeout en inicialización, forzando reinicio');
                    this.sessionData.state = SessionState.ERROR;
                    this.sessionData.errorMessage = 'Initialization timeout';
                    this.sessionData.initializationAttempts++;
                    
                    if (this.hasExceededMaxAttempts()) {
                        throw new Error('Maximum initialization attempts exceeded');
                    }
                    
                    // Resetear para reintentar
                    await this.forceReset();
                } else {
                    logger.info('⏳ Inicialización ya en progreso');
                    return;
                }
            }

            // Verificar intentos máximos
            if (this.hasExceededMaxAttempts()) {
                this.sessionData.state = SessionState.ERROR;
                this.sessionData.errorMessage = 'Maximum initialization attempts exceeded';
                throw new Error('Maximum initialization attempts exceeded');
            }

            // Cambiar estado a INITIALIZING
            this.sessionData.state = SessionState.INITIALIZING;
            this.sessionData.initializedAt = Date.now();
            this.sessionData.initializationAttempts++;
            this.sessionData.errorMessage = null;

            logger.info(`🚀 Inicializando sesión (intento ${this.sessionData.initializationAttempts}/${this.MAX_INIT_ATTEMPTS})`);

            // Verificar si la instancia ya existe y está conectada
            const isConnected = await this.evolutionAPI.isConnected();
            if (isConnected) {
                logger.info('✅ Instancia ya está conectada');
                this.sessionData.state = SessionState.AUTHENTICATED;
                this.sessionData.qrCode = null;
                this.sessionData.qrTimestamp = null;
                this.sessionData.initializedAt = null;
                return;
            }

            // Inicializar instancia de Evolution API
            await this.evolutionAPI.initInstance();

            // Intentar obtener QR
            const qr = await this.evolutionAPI.getQR();
            if (qr) {
                this.sessionData.qrCode = qr;
                this.sessionData.qrTimestamp = Date.now();
                this.sessionData.state = SessionState.QR_READY;
                this.sessionData.initializedAt = null; // Resetear timeout
                logger.info('✅ QR generado exitosamente');
            } else {
                // QR no disponible aún, mantener estado INITIALIZING
                logger.info('⏳ QR no disponible aún, esperando generación...');
                // El estado se actualizará cuando llegue el webhook o en el siguiente intento
            }

        } catch (error: any) {
            logger.error('❌ Error durante inicialización:', error);
            this.sessionData.state = SessionState.ERROR;
            this.sessionData.errorMessage = error.message || 'Unknown error';
            throw error;
        }
    }

    /**
     * Obtener QR (con validación de estado y expiración)
     */
    public async getQR(): Promise<{ qr: string | null; state: SessionState; error?: string }> {
        // Si está autenticado, no hay QR
        if (this.sessionData.state === SessionState.AUTHENTICATED) {
            return { qr: null, state: SessionState.AUTHENTICATED };
        }

        // Si hay un QR válido y no expirado, devolverlo
        if (this.sessionData.state === SessionState.QR_READY && this.sessionData.qrCode && !this.isQRExpired()) {
            return { qr: this.sessionData.qrCode, state: SessionState.QR_READY };
        }

        // Si el QR expiró, cambiar estado
        if (this.sessionData.state === SessionState.QR_READY && this.isQRExpired()) {
            logger.warn('⏰ QR expirado, cambiando estado');
            this.sessionData.state = SessionState.IDLE;
            this.sessionData.qrCode = null;
            this.sessionData.qrTimestamp = null;
        }

        // Si está inicializando, verificar timeout
        if (this.sessionData.state === SessionState.INITIALIZING) {
            if (this.isInitTimeout()) {
                logger.warn('⏰ Timeout en inicialización');
                this.sessionData.state = SessionState.ERROR;
                this.sessionData.errorMessage = 'Initialization timeout';
                return { 
                    qr: null, 
                    state: SessionState.ERROR, 
                    error: 'Initialization timeout. Please try disconnecting and reconnecting.' 
                };
            }
        }

        // Si está en IDLE o ERROR, intentar inicializar
        if (this.sessionData.state === SessionState.IDLE || this.sessionData.state === SessionState.ERROR) {
            try {
                await this.initializeSession();
                // Después de inicializar, verificar el estado actual (puede haber cambiado)
                const currentState = this.sessionData.state;
                
                // Si ahora está autenticado, no hay QR
                if (currentState === SessionState.AUTHENTICATED) {
                    return { qr: null, state: SessionState.AUTHENTICATED };
                }
                
                // Si ahora tiene QR listo, devolverlo
                if (currentState === SessionState.QR_READY && this.sessionData.qrCode) {
                    return { qr: this.sessionData.qrCode, state: SessionState.QR_READY };
                }
                
                // Si sigue en ERROR después de intentar inicializar
                if (currentState === SessionState.ERROR) {
                    return { 
                        qr: null, 
                        state: SessionState.ERROR, 
                        error: this.sessionData.errorMessage || 'Failed to initialize session' 
                    };
                }
                
                // Si está en INITIALIZING, el QR no está disponible aún
                if (currentState === SessionState.INITIALIZING) {
                    return { qr: null, state: SessionState.INITIALIZING };
                }
            } catch (error: any) {
                return { 
                    qr: null, 
                    state: SessionState.ERROR, 
                    error: error.message || 'Failed to initialize session' 
                };
            }
        }

        // Estado INITIALIZING sin QR aún (o cualquier otro estado no manejado)
        const currentState = this.sessionData.state;
        return { qr: null, state: currentState };
    }

    /**
     * Actualizar QR desde webhook
     */
    public updateQRFromWebhook(qrBase64: string): void {
        if (this.sessionData.state === SessionState.AUTHENTICATED) {
            // Ya está conectado, ignorar QR del webhook
            return;
        }

        this.sessionData.qrCode = qrBase64;
        this.sessionData.qrTimestamp = Date.now();
        this.sessionData.state = SessionState.QR_READY;
        this.sessionData.initializedAt = null; // Resetear timeout
        logger.info('📱 QR actualizado desde webhook');
    }

    /**
     * Marcar sesión como autenticada
     */
    public markAsAuthenticated(): void {
        this.sessionData.state = SessionState.AUTHENTICATED;
        this.sessionData.qrCode = null;
        this.sessionData.qrTimestamp = null;
        this.sessionData.initializedAt = null;
        this.sessionData.errorMessage = null;
        this.sessionData.initializationAttempts = 0;
        logger.info('✅ Sesión marcada como autenticada');
    }

    /**
     * Desconectar y limpiar sesión
     */
    public async disconnect(): Promise<void> {
        try {
            this.sessionData.state = SessionState.DISCONNECTING;
            logger.info('🔌 Desconectando sesión...');

            // Eliminar instancia de Evolution API
            await this.evolutionAPI.logout();

            // Resetear datos
            this.forceReset();
            
            logger.info('✅ Sesión desconectada y limpiada');
        } catch (error: any) {
            logger.error('❌ Error durante desconexión:', error);
            // Aún así, resetear datos
            this.forceReset();
            throw error;
        }
    }

    /**
     * Forzar reset del estado (sin desconectar)
     */
    public forceReset(): void {
        this.sessionData = {
            state: SessionState.IDLE,
            qrCode: null,
            qrTimestamp: null,
            initializedAt: null,
            errorMessage: null,
            initializationAttempts: 0
        };
        logger.info('🔄 Estado de sesión reseteado');
    }

    /**
     * Resetear contador de intentos (útil después de éxito)
     */
    public resetAttempts(): void {
        this.sessionData.initializationAttempts = 0;
    }
}

