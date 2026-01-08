/**
 * Tipos TypeScript para Evolution API v2
 * Basado en la documentación oficial de Evolution API
 */

export interface EvolutionWebhookMessage {
    event: 'messages.upsert' | 'messages.update' | 'connection.update' | 'qrcode.updated';
    instance: string;
    data: EvolutionMessageData | EvolutionConnectionData | EvolutionQRData;
}

export interface EvolutionMessageData {
    key: {
        remoteJid: string;
        fromMe: boolean;
        id: string;
    };
    message: {
        conversation?: string;
        extendedTextMessage?: {
            text: string;
        };
        imageMessage?: {
            caption?: string;
            mimetype: string;
            url?: string;
        };
        videoMessage?: {
            caption?: string;
            mimetype: string;
            url?: string;
        };
        audioMessage?: {
            mimetype: string;
            url?: string;
        };
        documentMessage?: {
            fileName?: string;
            mimetype: string;
            url?: string;
        };
    };
    messageTimestamp: number;
    pushName?: string;
    participant?: string;
}

export interface EvolutionConnectionData {
    instance: string;
    state: 'open' | 'close' | 'connecting';
    status: 'connected' | 'disconnected' | 'connecting';
}

export interface EvolutionQRData {
    qrcode: {
        base64: string;
        code: string;
    };
    instance: string;
    status: 'qrcode' | 'connected';
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

export interface EvolutionSendMessageResponse {
    /**
     * Algunas instalaciones de Evolution API v2 NO devuelven `success`.
     * En esos casos, el éxito se infiere por HTTP 2xx y/o la presencia de `key.id`.
     */
    success?: boolean;
    /**
     * Puede ser string o incluso objeto dependiendo del endpoint/configuración.
     */
    message?: any;
    key?: {
        remoteJid: string;
        fromMe: boolean;
        id: string;
    };
    status?: string;
    pushName?: string;
    messageType?: string;
    messageTimestamp?: number;
    instanceId?: string;
    source?: string;
}

export interface EvolutionCreateInstanceResponse {
    instance: {
        instanceName: string;
        status: string;
        qrcode?: {
            base64: string;
            code: string;
        };
    };
}

