/**
 * Servicio Evolution API v2
 * Maneja toda la comunicación con Evolution API mediante REST API
 * 
 * Este servicio reemplaza completamente whatsapp-web.js
 */

import axios, { AxiosInstance } from 'axios';
import logger from '../configs/logger.config';
import EnvConfig from '../configs/env.config';
import {
    EvolutionInstanceStatus,
    EvolutionCreateInstanceResponse,
    EvolutionSendMessageResponse,
    EvolutionQRData
} from '../types/evolution-api.types';

export class EvolutionAPIv2Service {
    private apiUrl: string;
    private apiKey: string;
    private instanceName: string;
    private axiosInstance: AxiosInstance;

    constructor() {
        // --- INICIO BLOQUE BLINDADO ---
        // Valores por defecto para evitar crashes si las env vars fallan
        this.apiUrl = EnvConfig.EVOLUTION_URL || process.env.EVOLUTION_URL || 'http://localhost:8080';
        this.apiKey = EnvConfig.EVOLUTION_APIKEY || process.env.EVOLUTION_APIKEY || '';
        this.instanceName = EnvConfig.EVOLUTION_INSTANCE_NAME || process.env.EVOLUTION_INSTANCE_NAME || 'mullbot-principal';

        // Validación adicional para instanceName
        if (!this.instanceName || this.instanceName === 'undefined' || this.instanceName === 'null') {
            logger.warn('⚠️ Advertencia: Instance Name indefinido. Usando valor por defecto.');
            this.instanceName = 'mullbot-principal';
        }

        if (!this.apiKey) {
            logger.warn('⚠️ EVOLUTION_APIKEY no configurada. Algunas funciones pueden fallar.');
        }

        if (!this.apiUrl || this.apiUrl === 'undefined') {
            logger.warn('⚠️ EVOLUTION_URL no configurada. Usando localhost por defecto.');
            this.apiUrl = 'http://localhost:8080';
        }
        // --- FIN BLOQUE BLINDADO ---

        this.axiosInstance = axios.create({
            baseURL: this.apiUrl,
            headers: {
                'apikey': this.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        logger.info(`🚀 Evolution API v2 Service initialized`);
        logger.info(`   URL: ${this.apiUrl}`);
        logger.info(`   Instance: ${this.instanceName}`);
    }

    /**
     * Helper privado para obtener siempre un instanceName válido
     * Protege contra undefined/null en cualquier momento
     */
    private getSafeInstanceName(): string {
        return this.instanceName || 'mullbot-principal';
    }

    /**
     * Inicializar instancia de Evolution API
     * Verifica si existe, si no la crea automáticamente
     */
    async initInstance(): Promise<void> {
        try {
            const safeName = this.getSafeInstanceName();
            logger.info(`🔍 Verificando instancia: ${safeName}`);

            // Verificar si la instancia existe
            const instances = await this.fetchInstances();
            
            // CORREGIDO: Buscar por inst.name
            const instanceExists = instances.some((inst: any) => {
                const instanceName = inst?.name || inst?.instanceName || inst?.instance?.instanceName;
                return instanceName === safeName;
            });

            if (instanceExists) {
                logger.info(`✅ Instancia '${safeName}' ya existe`);
                return;
            }

            // Crear instancia si no existe
            logger.info(`📦 Creando nueva instancia: ${safeName}`);
            await this.createInstance();
            logger.info(`✅ Instancia '${safeName}' creada exitosamente`);

        } catch (error: any) {
            logger.error(`❌ Error inicializando instancia:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 🔧 MÉTODO DE AUTOCURACIÓN DE INSTANCIAS
     * Asegura que la instancia existe y está en buen estado
     * Implementa lógica de limpieza y recreación automática
     * 
     * @param force - Si es true, fuerza la eliminación y recreación de la instancia
     * @returns Estado de la instancia después del proceso
     */
    async ensureInstance(force: boolean = false): Promise<{ 
        success: boolean; 
        action: 'exists' | 'created' | 'recreated' | 'cleaned'; 
        message: string;
        instance?: EvolutionInstanceStatus;
    }> {
        const safeName = this.getSafeInstanceName();
        
        try {
            // PASO 1: CHECK - Verificar si la instancia existe
            logger.info(`🔍 [ensureInstance] Paso 1: Verificando existencia de instancia '${safeName}'...`);
            const existingInstance = await this.fetchInstance();

            if (!existingInstance && !force) {
                // No existe, crear nueva
                logger.info(`📦 [ensureInstance] Instancia no existe, creando nueva...`);
                await this.createInstance();
                const newInstance = await this.fetchInstance();
                
                return {
                    success: true,
                    action: 'created',
                    message: `Instancia '${safeName}' creada exitosamente`,
                    instance: newInstance || undefined
                };
            }

            if (existingInstance) {
                // PASO 2: VALIDATE - Verificar si está "bugeada"
                // CORREGIDO: Buscar estado en múltiples propiedades posibles
                const status = (existingInstance as any)?.connectionStatus || (existingInstance as any)?.status || existingInstance.instance?.status || 'unknown';
                const isBugged = status === 'connecting' || status === 'close';
                
                logger.info(`🔎 [ensureInstance] Paso 2: Estado actual: ${status}, Bugeada: ${isBugged}, Force: ${force}`);

                if (!isBugged && !force) {
                    // Está OK, no hacer nada
                    logger.info(`✅ [ensureInstance] Instancia OK, no requiere acción`);
                    return {
                        success: true,
                        action: 'exists',
                        message: `Instancia '${safeName}' existe y está en buen estado (${status})`,
                        instance: existingInstance
                    };
                }

                // PASO 3: CLEAN - La instancia está bugeada o force=true, eliminarla
                logger.warn(`🧹 [ensureInstance] Paso 3: Limpiando instancia (bugeada: ${isBugged}, force: ${force})`);
                try {
                    await this.deleteInstance();
                    logger.info(`🗑️ [ensureInstance] Instancia eliminada exitosamente`);
                    
                    // Esperar un momento para que Evolution API procese la eliminación
                    await new Promise(resolve => setTimeout(resolve, 1500));
                } catch (deleteError: any) {
                    // Si ya no existe (404), continuar
                    if (deleteError.response?.status !== 404) {
                        logger.error(`❌ [ensureInstance] Error eliminando instancia:`, deleteError.response?.data || deleteError.message);
                        throw deleteError;
                    }
                    logger.info(`ℹ️ [ensureInstance] Instancia ya no existía (404)`);
                }
            }

            // PASO 4: CREATE - Crear instancia nueva
            logger.info(`📦 [ensureInstance] Paso 4: Creando instancia nueva...`);
            await this.createInstance();
            
            // Esperar más tiempo para que Evolution API procese la creación
            logger.info(`⏳ Esperando 3 segundos para que la instancia se inicialice...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Verificar que se creó correctamente
            logger.info(`🔍 Verificando que la instancia se creó correctamente...`);
            const recreatedInstance = await this.fetchInstance();
            
            if (!recreatedInstance) {
                logger.warn(`⚠️ La instancia no aparece en la lista después de crearla. Puede tardar unos segundos más.`);
            } else {
                logger.info(`✅ [ensureInstance] Instancia recreada exitosamente con estado: ${recreatedInstance.instance?.status}`);
            }
            
            return {
                success: true,
                action: force ? 'recreated' : 'cleaned',
                message: `Instancia '${safeName}' ${force ? 'recreada' : 'limpiada y recreada'} exitosamente. ${!recreatedInstance ? 'Nota: Puede tardar unos segundos en aparecer en la lista.' : ''}`,
                instance: recreatedInstance || undefined
            };

        } catch (error: any) {
            // MANEJO DE ERRORES 403
            if (error.response?.status === 403) {
                const errorMsg = '⛔ Error de Permisos: La API Key configurada no es Maestra. Verifica EVOLUTION_APIKEY en Easypanel.';
                logger.error(errorMsg);
                throw new Error(errorMsg);
            }

            // MANEJO DE ERRORES 404
            if (error.response?.status === 404) {
                logger.warn(`⚠️ [ensureInstance] Endpoint no encontrado (404), intentando crear instancia desde cero...`);
                try {
                    await this.createInstance();
                    const newInstance = await this.fetchInstance();
                    return {
                        success: true,
                        action: 'created',
                        message: `Instancia '${safeName}' creada exitosamente después de 404`,
                        instance: newInstance || undefined
                    };
                } catch (retryError: any) {
                    logger.error(`❌ [ensureInstance] Error en reintento después de 404:`, retryError.message);
                    throw retryError;
                }
            }

            // Otros errores
            logger.error(`❌ [ensureInstance] Error general:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Obtener información de la instancia actual
     * @returns Información de la instancia o null si no existe
     */
    async fetchInstance(): Promise<EvolutionInstanceStatus | null> {
        try {
            const safeName = this.getSafeInstanceName();
            logger.info(`🔎 Buscando instancia '${safeName}' en la lista...`);
            
            const instances = await this.fetchInstances();
            
            // CORREGIDO: Buscar por inst.name en lugar de inst.instance.instanceName
            const instance = instances.find((inst: any) => {
                const instanceName = inst?.name || inst?.instanceName || inst?.instance?.instanceName;
                return instanceName === safeName;
            });
            
            if (instance) {
                const status = (instance as any)?.connectionStatus || (instance as any)?.status || instance.instance?.status || 'unknown';
                logger.info(`✅ Instancia '${safeName}' encontrada con estado: ${status}`);
            } else {
                logger.warn(`⚠️ Instancia '${safeName}' NO encontrada en la lista de ${instances.length} instancias`);
            }
            
            return instance || null;
        } catch (error: any) {
            logger.error('❌ Error fetching instance:', error.message);
            // Si es error de permisos, propagar
            if (error.message?.includes('403') || error.message?.includes('permisos')) {
                throw error;
            }
            return null;
        }
    }

    /**
     * Eliminar instancia actual
     */
    async deleteInstance(): Promise<void> {
        try {
            const safeName = this.getSafeInstanceName();
            logger.info(`🗑️ Eliminando instancia: ${safeName}`);
            await this.axiosInstance.delete(`/instance/delete/${safeName}`);
            logger.info(`✅ Instancia '${safeName}' eliminada`);
        } catch (error: any) {
            if (error.response?.status === 404) {
                logger.info(`ℹ️ Instancia no encontrada (puede estar ya eliminada)`);
                return; // No es un error crítico
            }
            logger.error('Error deleting instance:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Crear instancia de WhatsApp en Evolution API
     */
    async createInstance(): Promise<EvolutionCreateInstanceResponse> {
        const safeName = this.getSafeInstanceName(); // Declarar fuera del try para scope del catch
        try {
            const response = await this.axiosInstance.post<EvolutionCreateInstanceResponse>(
                '/instance/create',
                {
                    instanceName: safeName,
                    token: this.apiKey,
                    qrcode: true,
                    integration: 'WHATSAPP-BAILEYS'
                }
            );

            return response.data;
        } catch (error: any) {
            if (error.response?.status === 409) {
                logger.info(`ℹ️ Instancia '${safeName}' ya existe`);
                throw new Error('Instance already exists');
            }
            throw error;
        }
    }

    /**
     * Obtener todas las instancias
     */
    async fetchInstances(): Promise<EvolutionInstanceStatus[]> {
        try {
            logger.info('🔍 Solicitando lista de instancias a Evolution API...');
            const response = await this.axiosInstance.get<EvolutionInstanceStatus[]>('/instance/fetchInstances');
            logger.info(`✅ Instancias obtenidas: ${response.data?.length || 0} encontradas`);
            
            // Log detallado de las instancias
            if (response.data && response.data.length > 0) {
                response.data.forEach((inst: any, index: number) => {
                    // Mostrar TODAS las propiedades del objeto
                    const keys = Object.keys(inst);
                    logger.info(`   [${index}] Propiedades (${keys.length}): ${keys.join(', ')}`);
                    
                    // La estructura real parece ser: { name: "...", ... }
                    const instanceName = inst?.name || inst?.instanceName || inst?.instance?.instanceName;
                    const connectionStatus = inst?.connectionStatus || inst?.status || inst?.state || inst?.instance?.status;
                    
                    logger.info(`   [${index}] → Nombre: "${instanceName}", Estado: "${connectionStatus}"`);
                    
                    // Log de propiedades útiles para debug
                    logger.info(`   [${index}] Detalles: owner="${inst?.owner}", createdAt="${inst?.createdAt}", profileName="${inst?.profileName}"`);
                });
            } else {
                logger.warn('⚠️ No se encontraron instancias en el servidor');
            }
            
            return response.data || [];
        } catch (error: any) {
            const statusCode = error.response?.status;
            logger.error(`❌ Error fetching instances (HTTP ${statusCode}):`, error.response?.data || error.message);
            
            // Si es error 403, lanzar excepción para que se propague
            if (statusCode === 403) {
                throw new Error('Error 403: La API Key no tiene permisos para listar instancias. Verifica que sea una API Key Maestra (Global).');
            }
            
            return [];
        }
    }

    /**
     * Obtener código QR para vincular WhatsApp
     */
    async getQR(): Promise<string | null> {
        try {
            const safeName = this.getSafeInstanceName();
            const response = await this.axiosInstance.get<EvolutionQRData>(
                `/instance/connect/${safeName}`
            );

            if (response.data?.qrcode?.base64) {
                return response.data.qrcode.base64;
            }

            return null;
        } catch (error: any) {
            logger.error('Error getting QR:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Obtener código de vinculación (Pairing Code) para WhatsApp
     * Este método permite vincular WhatsApp sin escanear QR usando el número de teléfono
     * @param phoneNumber Número de teléfono en formato internacional sin + (ej: 521234567890)
     */
    async getPairingCode(phoneNumber: string): Promise<{ code: string | null; error?: string }> {
        try {
            logger.info(`📱 Solicitando pairing code para número: ${phoneNumber}`);

            // Normalizar número de teléfono (remover espacios, guiones, etc.)
            const cleanPhoneNumber = phoneNumber.replace(/[\s\-\(\)\+]/g, '');

            // Validar formato del número
            if (!/^\d{10,15}$/.test(cleanPhoneNumber)) {
                const error = 'Número de teléfono inválido. Debe contener entre 10 y 15 dígitos.';
                logger.error(error);
                return { code: null, error };
            }

            // Asegurarse de que la instancia existe antes de solicitar pairing code
            const safeName = this.getSafeInstanceName();
            logger.info(`🔍 Verificando instancia '${safeName}' antes de generar pairing code...`);
            
            try {
                await this.initInstance();
            } catch (initError: any) {
                logger.warn('⚠️ Error al verificar/crear instancia:', initError.message);
                // Continuar de todas formas, ya que el error puede ser que la instancia ya existe
            }

            // Llamar a Evolution API para obtener pairing code
            // El endpoint exacto puede variar según la versión de Evolution API
            // Documentación: https://doc.evolution-api.com/v2/pt/get-started/authentication
            logger.info(`🔗 Solicitando pairing code a Evolution API para instancia: ${safeName}`);
            const response = await this.axiosInstance.post(
                `/instance/connect/${safeName}`,
                {
                    number: cleanPhoneNumber,
                    method: 'pairing_code' // Método de autenticación por código
                }
            );

            if (response.data?.code || response.data?.pairingCode) {
                const code = response.data.code || response.data.pairingCode;
                logger.info(`✅ Pairing code generado exitosamente: ${code}`);
                return { code };
            }

            logger.warn('⚠️ Evolution API no devolvió un pairing code');
            return { 
                code: null, 
                error: 'No se pudo generar el código de vinculación. Intenta de nuevo.' 
            };

        } catch (error: any) {
            const statusCode = error.response?.status;
            const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
            
            logger.error(`❌ Error obteniendo pairing code (HTTP ${statusCode}): ${errorMessage}`);
            logger.error('📄 Error details:', JSON.stringify(error.response?.data || error.message));

            // Mensajes de error específicos según el código HTTP
            if (statusCode === 403) {
                return {
                    code: null,
                    error: 'API Key inválida o sin permisos. Por favor verifica tu EVOLUTION_APIKEY en las variables de entorno.'
                };
            } else if (statusCode === 404) {
                return {
                    code: null,
                    error: 'Instancia no encontrada. Intenta reiniciar la conexión de WhatsApp.'
                };
            } else if (statusCode === 409) {
                return {
                    code: null,
                    error: 'La instancia ya está conectada. Desvincula primero antes de generar un nuevo código.'
                };
            }

            return {
                code: null,
                error: `Error al generar código: ${errorMessage}`
            };
        }
    }

    /**
     * Conectar instancia usando pairing code (método alternativo)
     * @param phoneNumber Número de teléfono
     */
    async connectWithPairingCode(phoneNumber: string): Promise<{ success: boolean; code?: string; error?: string }> {
        try {
            logger.info(`🔗 Iniciando conexión con pairing code para: ${phoneNumber}`);

            // Obtener pairing code
            const result = await this.getPairingCode(phoneNumber);

            if (!result.code) {
                return {
                    success: false,
                    error: result.error || 'No se pudo generar el código'
                };
            }

            return {
                success: true,
                code: result.code
            };

        } catch (error: any) {
            logger.error(`❌ Error conectando con pairing code: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verificar si la instancia está conectada
     */
    async isConnected(): Promise<boolean> {
        try {
            const safeName = this.getSafeInstanceName();
            
            const instances = await this.fetchInstances();
            
            // CORREGIDO: Buscar por inst.name
            const instance = instances.find((inst: any) => {
                const instanceName = inst?.name || inst?.instanceName || inst?.instance?.instanceName;
                return instanceName === safeName;
            });

            if (!instance) {
                return false;
            }

            // CORREGIDO: Buscar estado en múltiples propiedades posibles
            const status = (instance as any)?.connectionStatus || (instance as any)?.status || (instance as any)?.instance?.status;
            return status === 'open';
        } catch (error: any) {
            logger.error('Error checking connection:', error.response?.data || error.message);
            return false;
        }
    }

    /**
     * Enviar mensaje de texto
     * @param phoneNumber Número de teléfono (formato: 1234567890 o 1234567890@c.us)
     * @param message Texto del mensaje
     */
    async sendMessage(phoneNumber: string, message: string): Promise<EvolutionSendMessageResponse> {
        try {
            // Normalizar número de teléfono
            const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
            const safeName = this.getSafeInstanceName();

            logger.info(`📤 Intentando enviar mensaje a ${normalizedPhone} (original: ${phoneNumber})`);
            logger.info(`   Instancia: ${safeName}`);
            logger.info(`   Endpoint: /message/sendText/${safeName}`);
            logger.info(`   Payload: ${JSON.stringify({ number: normalizedPhone, text: message.substring(0, 50) + '...' })}`);

            const response = await this.axiosInstance.post<EvolutionSendMessageResponse>(
                `/message/sendText/${safeName}`,
                {
                    number: normalizedPhone,
                    text: message
                }
            );

            logger.info(`📥 Respuesta HTTP Status: ${response.status}`);
            logger.info(`📥 Respuesta completa: ${JSON.stringify(response.data, null, 2)}`);
            logger.info(`📥 response.data.success: ${String((response.data as any)?.success)}`);

            // ✅ EVOLUTION API v2 (según instalación) puede NO devolver `success`.
            // Consideramos éxito si:
            // - HTTP 2xx, y
            // - `success !== false` (si existe), o existe un `key.id` (respuesta típica de sendText)
            const hasExplicitSuccess = typeof (response.data as any)?.success === 'boolean';
            const explicitSuccess = (response.data as any)?.success;
            const hasKeyId = !!(response.data as any)?.key?.id;
            const is2xx = response.status >= 200 && response.status < 300;
            const isOk = is2xx && (!hasExplicitSuccess || explicitSuccess === true || hasKeyId);

            if (!isOk) {
                const msg = (response.data as any)?.message;
                const errorMsg = typeof msg === 'string' ? msg : JSON.stringify(msg ?? response.data ?? 'Unknown error');
                logger.error(`❌ Evolution API respondió sin éxito (isOk=false): ${errorMsg}`);
                throw new Error(errorMsg);
            }

            logger.info(`✅ Mensaje enviado exitosamente a ${normalizedPhone}`);
            return response.data;
        } catch (error: any) {
            // Logging ultra-detallado de errores
            logger.error(`❌ Error enviando mensaje a ${phoneNumber}`);
            logger.error(`   Número normalizado: ${this.normalizePhoneNumber(phoneNumber)}`);
            
            // Intentar obtener detalles del error de diferentes formas
            try {
                if (error.response) {
                    logger.error(`   HTTP Status: ${error.response.status}`);
                    logger.error(`   HTTP Status Text: ${error.response.statusText}`);
                    logger.error(`   Response Headers: ${JSON.stringify(error.response.headers)}`);
                    logger.error(`   Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
                } else {
                    logger.error(`   No HTTP Response - Error Type: ${error.constructor.name}`);
                    logger.error(`   Error Code: ${error.code}`);
                }
                
                // Intentar serializar el error de múltiples formas
                logger.error(`   Error.message type: ${typeof error.message}`);
                logger.error(`   Error.message: ${String(error.message)}`);
                logger.error(`   Error.toString(): ${error.toString()}`);
                
                // Si error.message es un objeto, intentar expandirlo
                if (typeof error.message === 'object') {
                    logger.error(`   Error.message object keys: ${Object.keys(error.message).join(', ')}`);
                    logger.error(`   Error.message stringified: ${JSON.stringify(error.message, null, 2)}`);
                }
                
                // Intentar util.inspect para objetos complejos
                const util = require('util');
                logger.error(`   Full Error (util.inspect): ${util.inspect(error, { depth: 3, colors: false })}`);
            } catch (logError) {
                logger.error(`   Error al procesar error details: ${logError}`);
            }
            
            throw error;
        }
    }

    /**
     * Desvincular y eliminar instancia
     */
    async logout(): Promise<void> {
        try {
            const safeName = this.getSafeInstanceName();
            logger.info(`🔌 Desvinculando instancia: ${safeName}`);
            await this.axiosInstance.delete(`/instance/delete/${safeName}`);
            logger.info(`✅ Instancia '${safeName}' eliminada`);
        } catch (error: any) {
            const safeName = this.getSafeInstanceName();
            // Error 404: Instancia no encontrada (ya eliminada)
            if (error.response?.status === 404) {
                logger.info(`ℹ️ Instancia '${safeName}' no encontrada (puede estar ya eliminada)`);
                return; // No es un error crítico
            }
            
            // Errores de conexión (servicio no disponible, DNS, etc.)
            if (error.code === 'ECONNREFUSED' || 
                error.code === 'ENOTFOUND' || 
                error.code === 'EAI_AGAIN' ||
                error.message?.includes('getaddrinfo') ||
                error.message?.includes('EAI_AGAIN')) {
                logger.warn(`⚠️ Evolution API no está accesible en ${this.apiUrl}. La instancia puede no haberse eliminado, pero continuando con el logout.`);
                logger.warn(`   Error: ${error.message || error.code}`);
                return; // Permitir continuar sin fallar
            }
            
            // Otros errores
            logger.error('Error deleting instance:', error.response?.data || error.message);
            // No lanzar error para evitar que el proceso falle completamente
            // Si Evolution API no está disponible, aún podemos continuar
            logger.warn('⚠️ Continuando con el logout a pesar del error de Evolution API');
        }
    }

    /**
     * Obtener estado de la instancia
     */
    async getStatus(): Promise<EvolutionInstanceStatus | null> {
        try {
            const safeName = this.getSafeInstanceName();
            
            const instances = await this.fetchInstances();
            
            // CORREGIDO: Buscar por inst.name
            const instance = instances.find((inst: any) => {
                const instanceName = inst?.name || inst?.instanceName || inst?.instance?.instanceName;
                return instanceName === safeName;
            });

            return instance || null;
        } catch (error: any) {
            logger.error('Error getting status:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Enviar archivo multimedia (imagen, video, audio, documento)
     * @param phoneNumber Número de teléfono
     * @param filePath Ruta del archivo local
     * @param caption Texto opcional para el archivo
     * @param mediaType Tipo de media: 'image', 'video', 'audio', 'document'
     */
    async sendMedia(
        phoneNumber: string,
        filePath: string,
        caption?: string,
        mediaType: 'image' | 'video' | 'audio' | 'document' = 'video'
    ): Promise<EvolutionSendMessageResponse> {
        try {
            const fs = require('fs');
            const FormData = require('form-data');
            
            // Normalizar número de teléfono
            const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

            // Verificar que el archivo existe
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            // Leer el archivo
            const fileBuffer = fs.readFileSync(filePath);
            const fileName = require('path').basename(filePath);
            const mimeType = this.getMimeType(filePath, mediaType);

            // Crear FormData
            const formData = new FormData();
            formData.append('number', normalizedPhone);
            formData.append('media', fileBuffer, {
                filename: fileName,
                contentType: mimeType
            });
            
            if (caption) {
                formData.append('caption', caption);
            }

            // Determinar el endpoint según el tipo de media
            const safeName = this.getSafeInstanceName();
            let endpoint = `/message/sendMedia/${safeName}`;
            if (mediaType === 'image') {
                endpoint = `/message/sendMedia/${safeName}`;
            } else if (mediaType === 'video') {
                endpoint = `/message/sendMedia/${safeName}`;
            } else if (mediaType === 'audio') {
                endpoint = `/message/sendMedia/${safeName}`;
            } else if (mediaType === 'document') {
                endpoint = `/message/sendMedia/${safeName}`;
            }

            // Enviar con Content-Type multipart/form-data
            const response = await axios.post<EvolutionSendMessageResponse>(
                `${this.apiUrl}${endpoint}`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'apikey': this.apiKey
                    },
                    timeout: 60000 // 60 segundos para archivos grandes
                }
            );

            // Igual que sendText: algunas respuestas no traen `success`
            const hasExplicitSuccess = typeof (response.data as any)?.success === 'boolean';
            const explicitSuccess = (response.data as any)?.success;
            const hasKeyId = !!(response.data as any)?.key?.id;
            const is2xx = response.status >= 200 && response.status < 300;
            const isOk = is2xx && (!hasExplicitSuccess || explicitSuccess === true || hasKeyId);

            if (!isOk) {
                const msg = (response.data as any)?.message;
                const errorMsg = typeof msg === 'string' ? msg : JSON.stringify(msg ?? response.data ?? 'Unknown error');
                throw new Error(errorMsg);
            }

            logger.info(`✅ Media enviado a ${normalizedPhone}: ${fileName}`);
            return response.data;
        } catch (error: any) {
            logger.error(`❌ Error enviando media a ${phoneNumber}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Obtener MIME type basado en extensión y tipo de media
     */
    private getMimeType(filePath: string, mediaType: string): string {
        const ext = require('path').extname(filePath).toLowerCase();
        
        const mimeTypes: { [key: string]: string } = {
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };

        return mimeTypes[ext] || (mediaType === 'video' ? 'video/mp4' : mediaType === 'audio' ? 'audio/mpeg' : 'image/jpeg');
    }

    /**
     * Normalizar número de teléfono
     * Convierte formatos como "1234567890@c.us" o "1234567890" a formato estándar
     */
    private normalizePhoneNumber(phone: string): string {
        // Remover @c.us o @g.us si existe
        let normalized = phone.replace(/@[cg]\.us$/, '');
        
        // Remover caracteres no numéricos excepto +
        normalized = normalized.replace(/[^\d+]/g, '');
        
        return normalized;
    }
}

