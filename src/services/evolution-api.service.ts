/**
 * Servicio para Evolution API
 * Alternativa más robusta a whatsapp-web.js
 * 
 * Para usar Evolution API:
 * 1. Agrega Evolution API a docker-compose.yml (ver EVOLUTION_API_SIMPLE.md)
 * 2. Configura EVOLUTION_API_URL y EVOLUTION_API_KEY en .env
 * 3. Cambia USE_EVOLUTION_API=true en .env
 */

import axios, { AxiosInstance } from 'axios';
import logger from '../configs/logger.config';
import EnvConfig from '../configs/env.config';

export interface EvolutionQRResponse {
    qrcode: {
        base64: string;
        code: string;
    };
    instance: {
        instanceName: string;
        status: string;
    };
}

export interface EvolutionInstanceStatus {
    instance: {
        instanceName: string;
        status: 'open' | 'close' | 'connecting';
        qrcode?: {
            base64: string;
            code: string;
        };
    };
}

export class EvolutionAPIService {
    private apiUrl: string;
    private apiKey: string;
    private instanceName: string;
    private axiosInstance: AxiosInstance;

    constructor() {
        this.apiUrl = EnvConfig.EVOLUTION_API_URL || 'http://localhost:8080';
        this.apiKey = EnvConfig.EVOLUTION_API_KEY || 'mullbot-evolution-key-2025';
        this.instanceName = EnvConfig.EVOLUTION_INSTANCE_NAME || 'mullbot';

        this.axiosInstance = axios.create({
            baseURL: this.apiUrl,
            headers: {
                'apikey': this.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        logger.info(`Evolution API Service initialized - URL: ${this.apiUrl}, Instance: ${this.instanceName}`);
    }

    /**
     * Crear instancia de WhatsApp en Evolution API
     */
    async createInstance(): Promise<void> {
        try {
            logger.info(`Creating Evolution API instance: ${this.instanceName}`);
            
            const response = await this.axiosInstance.post('/instance/create', {
                instanceName: this.instanceName,
                token: this.apiKey,
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS'
            });

            if (response.data && response.data.instance) {
                logger.info(`✅ Evolution API instance created: ${this.instanceName}`);
            } else {
                throw new Error('Failed to create instance - invalid response');
            }
        } catch (error: any) {
            if (error.response?.status === 409) {
                logger.info(`Instance ${this.instanceName} already exists`);
            } else {
                logger.error('Error creating Evolution API instance:', error.response?.data || error.message);
                throw error;
            }
        }
    }

    /**
     * Obtener código QR para vincular WhatsApp
     */
    async getQR(): Promise<string | null> {
        try {
            logger.info(`Getting QR code for instance: ${this.instanceName}`);
            
            const response = await this.axiosInstance.get(`/instance/connect/${this.instanceName}`);
            
            if (response.data?.qrcode?.base64) {
                logger.info('✅ QR code obtained from Evolution API');
                return response.data.qrcode.base64;
            }
            
            return null;
        } catch (error: any) {
            logger.error('Error getting QR from Evolution API:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Verificar si la instancia está conectada
     */
    async isConnected(): Promise<boolean> {
        try {
            const response = await this.axiosInstance.get('/instance/fetchInstances');
            
            if (response.data && Array.isArray(response.data)) {
                const instance = response.data.find(
                    (i: EvolutionInstanceStatus) => i.instance.instanceName === this.instanceName
                );
                
                return instance?.instance?.status === 'open';
            }
            
            return false;
        } catch (error: any) {
            logger.error('Error checking Evolution API connection:', error.response?.data || error.message);
            return false;
        }
    }

    /**
     * Enviar mensaje de texto
     */
    async sendMessage(phoneNumber: string, message: string): Promise<void> {
        try {
            const response = await this.axiosInstance.post(
                `/message/sendText/${this.instanceName}`,
                {
                    number: phoneNumber,
                    text: message
                }
            );

            if (!response.data?.success) {
                throw new Error(response.data?.message || 'Failed to send message');
            }

            logger.info(`✅ Message sent via Evolution API to ${phoneNumber}`);
        } catch (error: any) {
            logger.error('Error sending message via Evolution API:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Desvincular y eliminar instancia
     */
    async logout(): Promise<void> {
        try {
            logger.info(`Logging out Evolution API instance: ${this.instanceName}`);
            
            await this.axiosInstance.delete(`/instance/delete/${this.instanceName}`);
            
            logger.info(`✅ Evolution API instance deleted: ${this.instanceName}`);
        } catch (error: any) {
            if (error.response?.status === 404) {
                logger.info(`Instance ${this.instanceName} not found (may already be deleted)`);
            } else {
                logger.error('Error deleting Evolution API instance:', error.response?.data || error.message);
                throw error;
            }
        }
    }

    /**
     * Obtener estado de la instancia
     */
    async getStatus(): Promise<EvolutionInstanceStatus | null> {
        try {
            const response = await this.axiosInstance.get('/instance/fetchInstances');
            
            if (response.data && Array.isArray(response.data)) {
                const instance = response.data.find(
                    (i: EvolutionInstanceStatus) => i.instance.instanceName === this.instanceName
                );
                
                return instance || null;
            }
            
            return null;
        } catch (error: any) {
            logger.error('Error getting Evolution API status:', error.response?.data || error.message);
            return null;
        }
    }
}

