/**
 * Command Adapter - Adaptador para comandos legacy de whatsapp-web.js a Evolution API
 * 
 * Este adaptador permite que los comandos existentes funcionen con Evolution API
 * sin necesidad de reescribirlos completamente.
 */

import { EvolutionAPIv2Service } from '../services/evolution-api-v2.service';
import { UserI18n } from '../utils/i18n.util';
import logger from '../configs/logger.config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interfaz para comandos legacy (whatsapp-web.js)
 */
interface LegacyCommand {
    run: (message: any, args: string[], userI18n: UserI18n) => Promise<void> | void;
}

/**
 * Interfaz para comandos modernos (Evolution API)
 */
interface ModernCommand {
    execute: (evolutionAPI: EvolutionAPIv2Service, phoneNumber: string, args: string, userI18n: UserI18n) => Promise<void>;
}

/**
 * Mock MessageMedia para compatibilidad con comandos legacy
 * Compatible con MessageMedia de whatsapp-web.js
 */
class MockMessageMedia {
    private filePath: string;
    private data: Buffer | null = null;
    private mimetype: string = 'image/png';

    constructor(filePath: string) {
        this.filePath = filePath;
        try {
            if (fs.existsSync(filePath)) {
                this.data = fs.readFileSync(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const mimeTypes: { [key: string]: string } = {
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                    '.mp4': 'video/mp4',
                    '.avi': 'video/x-msvideo',
                    '.mov': 'video/quicktime',
                    '.webm': 'video/webm',
                    '.mp3': 'audio/mpeg',
                    '.wav': 'audio/wav',
                    '.ogg': 'audio/ogg',
                    '.m4a': 'audio/mp4',
                    '.pdf': 'application/pdf'
                };
                this.mimetype = mimeTypes[ext] || 'image/png';
            }
        } catch (error) {
            logger.warn(`Error leyendo archivo ${filePath}:`, error);
        }
    }

    get _data(): any {
        return {
            filePath: this.filePath,
            path: this.filePath,
            data: this.data,
            mimetype: this.mimetype
        };
    }

    get path(): string {
        return this.filePath;
    }

    static fromFilePath(filePath: string): MockMessageMedia {
        return new MockMessageMedia(filePath);
    }

    static async fromUrl(url: string): Promise<MockMessageMedia> {
        // Por ahora, crear un mock con URL
        const media = new MockMessageMedia('');
        (media as any).url = url;
        return media;
    }
}

/**
 * Mock Message object para compatibilidad con comandos legacy
 */
class MockMessage {
    private evolutionAPI: EvolutionAPIv2Service;
    private phoneNumber: string;
    private content: string;
    private userI18n: UserI18n;

    constructor(
        evolutionAPI: EvolutionAPIv2Service,
        phoneNumber: string,
        content: string,
        userI18n: UserI18n
    ) {
        this.evolutionAPI = evolutionAPI;
        this.phoneNumber = phoneNumber;
        this.content = content;
        this.userI18n = userI18n;
    }

    async reply(text: string): Promise<void>;
    async reply(media: any, contact: any, options?: { caption?: string; sendVideoAsGif?: boolean }): Promise<void>;
    async reply(...args: any[]): Promise<void> {
        try {
            // Caso 1: Solo texto (string)
            if (typeof args[0] === 'string') {
                await this.evolutionAPI.sendMessage(this.phoneNumber, args[0]);
                return;
            }

            // Caso 2: Media (MessageMedia mock o objeto con _data/path)
            if (args[0] && typeof args[0] === 'object') {
                const mediaObj = args[0];
                const caption = args[2]?.caption || '';
                
                // Extraer filePath de diferentes formatos
                let filePath: string | null = null;
                
                if (mediaObj instanceof MockMessageMedia) {
                    filePath = mediaObj.path;
                } else if (mediaObj._data?.filePath) {
                    filePath = mediaObj._data.filePath;
                } else if (mediaObj._data?.path) {
                    filePath = mediaObj._data.path;
                } else if (mediaObj.path) {
                    filePath = mediaObj.path;
                } else if (mediaObj.url) {
                    // MessageMedia.fromUrl - por ahora solo enviar caption
                    logger.warn('MessageMedia.fromUrl no soportado directamente, necesita descarga');
                    if (caption) {
                        await this.evolutionAPI.sendMessage(this.phoneNumber, caption);
                    }
                    return;
                }

                if (filePath && fs.existsSync(filePath)) {
                    // Determinar tipo de media por extensión
                    const ext = path.extname(filePath).toLowerCase();
                    let mediaType: 'image' | 'video' | 'audio' | 'document' = 'image';
                    
                    if (['.mp4', '.avi', '.mov', '.webm'].includes(ext)) {
                        mediaType = 'video';
                    } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
                        mediaType = 'audio';
                    } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                        mediaType = 'image';
                    } else {
                        mediaType = 'document';
                    }

                    await this.evolutionAPI.sendMedia(this.phoneNumber, filePath, caption, mediaType);
                } else {
                    // Fallback: enviar solo caption o mensaje de error
                    const fallbackMsg = caption || 'No se pudo cargar el archivo multimedia.';
                    await this.evolutionAPI.sendMessage(this.phoneNumber, fallbackMsg);
                }
            } else {
                // Fallback: enviar como texto
                const text = args[0]?.toString() || '';
                await this.evolutionAPI.sendMessage(this.phoneNumber, text);
            }
        } catch (error) {
            logger.error(`Error en MockMessage.reply:`, error);
            // Fallback: intentar enviar como texto
            try {
                const text = typeof args[0] === 'string' ? args[0] : (args[2]?.caption || 'Error al procesar mensaje');
                if (text) {
                    await this.evolutionAPI.sendMessage(this.phoneNumber, text);
                }
            } catch (fallbackError) {
                logger.error(`Error en fallback de MockMessage.reply:`, fallbackError);
            }
        }
    }

    async getChat(): Promise<any> {
        // Mock Chat object - retornar objeto mínimo necesario
        return {
            sendStateTyping: async () => {
                // Evolution API no tiene typing state directo, pero podemos ignorarlo
            },
            clearState: async () => {
                // No-op para Evolution API
            },
            fetchMessages: async () => {
                // Retornar array vacío - los comandos que lo usen deberían migrar
                return [];
            }
        };
    }

    get type(): string {
        return 'text'; // Por defecto texto
    }

    get timestamp(): number {
        return Date.now();
    }
}

/**
 * Polyfill global para MessageMedia que los comandos pueden usar
 * Esto se inyecta en el contexto de ejecución del comando
 */
export const MessageMediaPolyfill = {
    fromFilePath: (filePath: string): MockMessageMedia => {
        return MockMessageMedia.fromFilePath(filePath);
    },
    fromUrl: async (url: string): Promise<MockMessageMedia> => {
        return MockMessageMedia.fromUrl(url);
    }
};

/**
 * Adapta un comando legacy a la interfaz moderna
 */
export function adaptLegacyCommand(
    legacyCommand: LegacyCommand
): ModernCommand {
    return {
        async execute(
            evolutionAPI: EvolutionAPIv2Service,
            phoneNumber: string,
            args: string,
            userI18n: UserI18n
        ): Promise<void> {
            try {
                // Parsear args (viene como string, convertir a array)
                const argsArray = args ? args.split(' ').filter(a => a.trim().length > 0) : [];

                // Crear mock message
                const mockMessage = new MockMessage(evolutionAPI, phoneNumber, args, userI18n);

                // Inyectar MessageMedia polyfill en el contexto del módulo del comando
                // Esto permite que los comandos usen MessageMedia.fromFilePath sin modificar sus imports
                // Nota: Los comandos aún necesitan importar MessageMedia de whatsapp-web.js,
                // pero el adaptador manejará los objetos MessageMedia correctamente

                // Ejecutar comando legacy
                await legacyCommand.run(mockMessage, argsArray, userI18n);
            } catch (error) {
                logger.error(`Error ejecutando comando legacy adaptado:`, error);
                // Enviar mensaje de error al usuario
                try {
                    await evolutionAPI.sendMessage(
                        phoneNumber,
                        'Lo siento, ocurrió un error al procesar tu comando. Por favor intenta de nuevo.'
                    );
                } catch (sendError) {
                    logger.error(`Error enviando mensaje de error:`, sendError);
                }
            }
        }
    };
}
