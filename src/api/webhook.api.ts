/**
 * Webhook Handler para Evolution API v2
 * 
 * Este módulo maneja los webhooks recibidos de Evolution API
 * cuando llegan mensajes, actualizaciones de conexión, etc.
 */

import express from "express";
import logger from "../configs/logger.config";
import { BotManager } from "../bot.manager";
import {
    EvolutionWebhookMessage,
    EvolutionMessageData,
    EvolutionConnectionData,
    EvolutionQRData
} from "../types/evolution-api.types";

const router = express.Router();

export default function (botManager: BotManager) {
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
            const webhookData: EvolutionWebhookMessage = req.body;

            // Validar que el evento sea de nuestra instancia
            if (webhookData.instance !== process.env.EVOLUTION_INSTANCE_NAME) {
                logger.warn(`⚠️ Webhook recibido de instancia diferente: ${webhookData.instance}`);
                return res.status(200).json({ received: true }); // Responder 200 para evitar reintentos
            }

            logger.info(`📥 Webhook recibido: ${webhookData.event}`);

            // Procesar según el tipo de evento
            switch (webhookData.event) {
                case 'messages.upsert':
                    // Mensaje entrante
                    const messageData = webhookData.data as EvolutionMessageData;
                    if (messageData && !messageData.key.fromMe) {
                        // Procesar mensaje en background (no bloquear respuesta)
                        botManager.handleIncomingMessage(messageData).catch(error => {
                            logger.error('Error procesando mensaje desde webhook:', error);
                        });
                    }
                    break;

                case 'connection.update':
                    // Actualización de conexión
                    const connectionData = webhookData.data as EvolutionConnectionData;
                    if (connectionData.state === 'open') {
                        botManager.qrData.qrScanned = true;
                        botManager.qrData.qrCodeData = "";
                        logger.info("✅ WhatsApp conectado (webhook)");
                    } else if (connectionData.state === 'close') {
                        botManager.qrData.qrScanned = false;
                        logger.warn("⚠️ WhatsApp desconectado (webhook)");
                    }
                    break;

                case 'qrcode.updated':
                    // QR actualizado
                    const qrData = webhookData.data as EvolutionQRData;
                    if (qrData.qrcode?.base64) {
                        botManager.qrData.qrCodeData = qrData.qrcode.base64;
                        botManager.qrData.qrScanned = false;
                        logger.info("📱 QR actualizado (webhook)");
                    }
                    break;

                default:
                    logger.debug(`Evento no manejado: ${webhookData.event}`);
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

