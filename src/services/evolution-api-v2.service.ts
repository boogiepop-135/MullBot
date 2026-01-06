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
        this.apiUrl = EnvConfig.EVOLUTION_URL;
        this.apiKey = EnvConfig.EVOLUTION_APIKEY;
        this.instanceName = EnvConfig.EVOLUTION_INSTANCE_NAME;

        if (!this.apiKey) {
            logger.warn('⚠️ EVOLUTION_APIKEY no configurada. Algunas funciones pueden fallar.');
        }

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
     * Inicializar instancia de Evolution API
     * Verifica si existe, si no la crea automáticamente
     */
    async initInstance(): Promise<void> {
        try {
            logger.info(`🔍 Verificando instancia: ${this.instanceName}`);

            // Verificar si la instancia existe
            const instances = await this.fetchInstances();
            const instanceExists = instances.some(
                (inst: EvolutionInstanceStatus) => inst.instance.instanceName === this.instanceName
            );

            if (instanceExists) {
                logger.info(`✅ Instancia '${this.instanceName}' ya existe`);
                return;
            }

            // Crear instancia si no existe
            logger.info(`📦 Creando nueva instancia: ${this.instanceName}`);
            await this.createInstance();
            logger.info(`✅ Instancia '${this.instanceName}' creada exitosamente`);

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
            const response = await this.axiosInstance.post<EvolutionCreateInstanceResponse>(
                '/instance/create',
                {
                    instanceName: this.instanceName,
                    token: this.apiKey,
                    qrcode: true,
                    integration: 'WHATSAPP-BAILEYS'
                }
            );

            return response.data;
        } catch (error: any) {
            if (error.response?.status === 409) {
                logger.info(`ℹ️ Instancia '${this.instanceName}' ya existe`);
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
            const response = await this.axiosInstance.get<EvolutionQRData>(
                `/instance/connect/${this.instanceName}`
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
     * Verificar si la instancia está conectada
     */
    async isConnected(): Promise<boolean> {
        try {
            const instances = await this.fetchInstances();
            const instance = instances.find(
                (inst: EvolutionInstanceStatus) => inst.instance.instanceName === this.instanceName
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

            const response = await this.axiosInstance.post<EvolutionSendMessageResponse>(
                `/message/sendText/${this.instanceName}`,
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
            logger.info(`🔌 Desvinculando instancia: ${this.instanceName}`);
            await this.axiosInstance.delete(`/instance/delete/${this.instanceName}`);
            logger.info(`✅ Instancia '${this.instanceName}' eliminada`);
        } catch (error: any) {
            if (error.response?.status === 404) {
                logger.info(`ℹ️ Instancia '${this.instanceName}' no encontrada (puede estar ya eliminada)`);
            } else {
                logger.error('Error deleting instance:', error.response?.data || error.message);
                throw error;
            }
        }
    }

    /**
     * Obtener estado de la instancia
     */
    async getStatus(): Promise<EvolutionInstanceStatus | null> {
        try {
            const instances = await this.fetchInstances();
            const instance = instances.find(
                (inst: EvolutionInstanceStatus) => inst.instance.instanceName === this.instanceName
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
            let endpoint = `/message/sendMedia/${this.instanceName}`;
            if (mediaType === 'image') {
                endpoint = `/message/sendMedia/${this.instanceName}`;
            } else if (mediaType === 'video') {
                endpoint = `/message/sendMedia/${this.instanceName}`;
            } else if (mediaType === 'audio') {
                endpoint = `/message/sendMedia/${this.instanceName}`;
            } else if (mediaType === 'document') {
                endpoint = `/message/sendMedia/${this.instanceName}`;
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

