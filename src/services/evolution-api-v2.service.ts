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
            // Protección adicional para instanceName
            const safeName = this.instanceName || 'mullbot-principal';
            logger.info(`🔍 Verificando instancia: ${safeName}`);

            // Verificar si la instancia existe
            const instances = await this.fetchInstances();
            const instanceExists = instances.some(
                (inst: EvolutionInstanceStatus) => inst?.instance?.instanceName === safeName
            );

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
     * Crear instancia de WhatsApp en Evolution API
     */
    private async createInstance(): Promise<EvolutionCreateInstanceResponse> {
        try {
            const safeName = this.getSafeInstanceName();
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
            const response = await this.axiosInstance.get<EvolutionInstanceStatus[]>('/instance/fetchInstances');
            return response.data || [];
        } catch (error: any) {
            logger.error('Error fetching instances:', error.response?.data || error.message);
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

            // Llamar a Evolution API para obtener pairing code
            // El endpoint exacto puede variar según la versión de Evolution API
            // Documentación: https://doc.evolution-api.com/v2/pt/get-started/authentication
            const safeName = this.getSafeInstanceName();
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
            const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
            logger.error(`❌ Error obteniendo pairing code: ${errorMessage}`);
            logger.error('Error details:', error.response?.data || error);

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
            // Protección adicional para instanceName
            const safeName = this.instanceName || 'mullbot-principal';
            
            const instances = await this.fetchInstances();
            const instance = instances.find(
                (inst: EvolutionInstanceStatus) => inst?.instance?.instanceName === safeName
            );

            return instance?.instance?.status === 'open';
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

            const response = await this.axiosInstance.post<EvolutionSendMessageResponse>(
                `/message/sendText/${safeName}`,
                {
                    number: normalizedPhone,
                    text: message
                }
            );

            if (!response.data?.success) {
                throw new Error(response.data?.message || 'Failed to send message');
            }

            logger.info(`✅ Mensaje enviado a ${normalizedPhone}`);
            return response.data;
        } catch (error: any) {
            logger.error(`❌ Error enviando mensaje a ${phoneNumber}:`, error.response?.data || error.message);
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
            // Protección adicional para instanceName
            const safeName = this.instanceName || 'mullbot-principal';
            
            const instances = await this.fetchInstances();
            const instance = instances.find(
                (inst: EvolutionInstanceStatus) => inst?.instance?.instanceName === safeName
            );

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

            if (!response.data?.success) {
                throw new Error(response.data?.message || 'Failed to send media');
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

