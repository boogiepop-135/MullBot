/**
 * MessageMedia Polyfill para Evolution API
 * 
 * Este módulo proporciona compatibilidad con MessageMedia de whatsapp-web.js
 * para que los comandos legacy funcionen con Evolution API.
 */

import * as fs from 'fs';
import * as path from 'path';
import logger from '../configs/logger.config';

export class MessageMedia {
    private filePath: string;
    private data: Buffer | null = null;
    private mimetype: string = 'image/png';
    private url: string | null = null;

    constructor(filePathOrUrl: string, mimetype?: string, data?: Buffer) {
        if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
            this.url = filePathOrUrl;
            this.mimetype = mimetype || 'image/png';
        } else {
            this.filePath = filePathOrUrl;
            try {
                if (fs.existsSync(filePathOrUrl)) {
                    this.data = data || fs.readFileSync(filePathOrUrl);
                    const ext = path.extname(filePathOrUrl).toLowerCase();
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
                    this.mimetype = mimetype || mimeTypes[ext] || 'image/png';
                }
            } catch (error) {
                logger.warn(`Error leyendo archivo ${filePathOrUrl}:`, error);
            }
        }
    }

    static fromFilePath(filePath: string): MessageMedia {
        return new MessageMedia(filePath);
    }

    static async fromUrl(url: string): Promise<MessageMedia> {
        // Por ahora retornar un MessageMedia con URL
        // El adaptador deberá manejar la descarga
        const media = new MessageMedia(url);
        media.url = url;
        return media;
    }

    get _data(): any {
        return {
            filePath: this.filePath,
            path: this.filePath,
            data: this.data,
            mimetype: this.mimetype,
            url: this.url
        };
    }

    get path(): string {
        return this.filePath || '';
    }

    get mimetype(): string {
        return this.mimetype;
    }
}
