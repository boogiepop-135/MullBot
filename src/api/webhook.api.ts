/**
 * Webhook Handler para Evolution API v2
 * 
 * Este módulo maneja los webhooks recibidos de Evolution API
 * cuando llegan mensajes, actualizaciones de conexión, etc.
 */

import express from "express";
import logger from "../configs/logger.config";
import { BotManager } from "../bot.manager";
import EnvConfig from "../configs/env.config";
import {
    EvolutionWebhookMessage,
    EvolutionMessageData,
    EvolutionConnectionData,
    EvolutionQRData
} from "../types/evolution-api.types";

const router = express.Router();

export default function (botManager: BotManager) {
    // Healthcheck simple para validar que Evolution puede alcanzar el endpoint
    router.get("/evolution", (_req, res) => {
        return res.status(200).json({ ok: true, message: "Evolution webhook endpoint is up" });
    });

    /**
     * Webhook principal de Evolution API
     * POST /webhook/evolution
     * 
     * Evolution API envía eventos aquí cuando:
     * - Llega un mensaje (messages.upsert)
     * - Se actualiza la conexión (connection.update)
     * - Se actualiza el QR (qrcode.updated)
     */
    router.post("/evolution", async (req, res) => {
        try {
            const rawBody: any = req.body || {};

            // Normalizar posibles formatos de Evolution API v2 (varía según versión/config)
            const event: string | undefined =
                rawBody.event ||
                rawBody.type ||
                rawBody.action ||
                rawBody.eventName;

            const instanceFromBody: string | undefined =
                rawBody.instance ||
                rawBody.instanceName ||
                rawBody.name ||
                rawBody?.data?.instance ||
                rawBody?.data?.instanceName ||
                rawBody?.data?.name;

            // Log mínimo (sin spamear demasiado)
            logger.info(`📥 Webhook Evolution recibido: event=${event || "unknown"} instance=${instanceFromBody || "unknown"}`);
            logger.debug(`📥 Webhook headers: ${JSON.stringify(req.headers)}`);

            const webhookData: EvolutionWebhookMessage = {
                event: (event as any) || 'messages.upsert',
                instance: instanceFromBody || (rawBody.instance as any) || '',
                data: rawBody.data
            };

            // Validar que el evento sea de nuestra instancia
            const expectedInstance = EnvConfig.EVOLUTION_INSTANCE_NAME;
            if (expectedInstance && instanceFromBody && instanceFromBody !== expectedInstance) {
                // En algunos setups Evolution manda "name" o "instance" distinto; no bloqueamos, solo avisamos.
                logger.warn(`⚠️ Webhook de instancia diferente: ${instanceFromBody} (esperado: ${expectedInstance}). Procesando igualmente por compatibilidad.`);
            }

            // Procesar según el tipo de evento
            switch (webhookData.event) {
                case 'messages.upsert':
                    // Mensaje entrante
                    // Algunos webhooks mandan { data: {...} } o arrays; soportar ambos
                    const maybeMessage = (webhookData as any)?.data?.data || webhookData.data;
                    const messageData = Array.isArray(maybeMessage) ? maybeMessage[0] : maybeMessage;

                    if (messageData?.key && messageData?.key?.fromMe !== true) {
                        // Procesar mensaje en background (no bloquear respuesta)
                        botManager.handleIncomingMessage(messageData).catch(error => {
                            logger.error('Error procesando mensaje desde webhook:', error);
                        });
                    } else {
                        logger.debug('Webhook messages.upsert ignorado (fromMe=true o payload inválido)');
                    }
                    break;

                case 'connection.update':
                    // Actualización de conexión
                    const connectionData = ((webhookData as any)?.data?.data || webhookData.data) as EvolutionConnectionData;
                    const sessionManager = botManager.getSessionManager();
                    
                    if (connectionData.state === 'open') {
                        // Marcar como autenticado en Session Manager
                        sessionManager.markAsAuthenticated();
                        
                        // Mantener compatibilidad con qrData
                        botManager.qrData.qrScanned = true;
                        botManager.qrData.qrCodeData = "";
                        logger.info("✅ WhatsApp conectado (webhook)");
                    } else if (connectionData.state === 'close') {
                        // Resetear sesión
                        sessionManager.forceReset();
                        botManager.qrData.qrScanned = false;
                        logger.warn("⚠️ WhatsApp desconectado (webhook)");
                    }
                    break;

                case 'qrcode.updated':
                    // QR actualizado
                    const qrData = ((webhookData as any)?.data?.data || webhookData.data) as EvolutionQRData;
                    if (qrData.qrcode?.base64) {
                        const sessionManager = botManager.getSessionManager();
                        // Actualizar QR en Session Manager
                        sessionManager.updateQRFromWebhook(qrData.qrcode.base64);
                        
                        // Mantener compatibilidad con qrData
                        botManager.qrData.qrCodeData = qrData.qrcode.base64;
                        botManager.qrData.qrScanned = false;
                        logger.info("📱 QR actualizado (webhook)");
                    }
                    break;

                default:
                    logger.debug(`Evento no manejado: ${String(webhookData.event)} - body=${JSON.stringify(rawBody).slice(0, 2000)}`);
            }

            // Responder rápidamente a Evolution API
            res.status(200).json({ received: true });

        } catch (error) {
            logger.error("❌ Error procesando webhook:", error);
            // Responder 200 para evitar que Evolution API reintente
            res.status(200).json({ received: true, error: "Error processing webhook" });
        }
    });

    return router;
}

