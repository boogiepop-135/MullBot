import express from "express";
import logger from "../configs/logger.config";
import { BotManager } from "../bot.manager";
import crmRouter from "../crm/api/crm.api";
import webhookRouter from "./webhook.api";

const router = express.Router();

export default function (botManager: BotManager) {

    const qrData = botManager.qrData;

    router.get("/", (_req, res) => {
        logger.info("GET / - Redirecting to /admin");
        res.redirect("/admin");
    });

    router.get("/qr-status", (_req, res) => {
        res.json({ qrScanned: qrData.qrScanned, qrCodeData: qrData.qrCodeData });
    });

    router.get("/health", async (_req, res) => {
        try {
            // Verificar conexión con Evolution API
            const evolutionAPI = botManager.getEvolutionAPI();
            const isConnected = await evolutionAPI.isConnected();
            
            // Actualizar qrScanned según el estado de conexión
            if (isConnected && !qrData.qrScanned) {
                logger.info("Evolution API connected but qrScanned is false, updating status");
                qrData.qrScanned = true;
            }

            const healthStatus = {
                status: isConnected ? "healthy" : "unhealthy",
                connected: isConnected,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                qrScanned: isConnected ? true : qrData.qrScanned,
                version: process.version,
            };

            logger.info(`GET /health - connected: ${isConnected}, qrScanned: ${healthStatus.qrScanned}`);
            res.status(200).json(healthStatus);
        } catch (error) {
            logger.error("Health check failed", error);
            res.status(500).json({ status: "unhealthy", error: "Internal Server Error" });
        }
    });

    // QR Code endpoint para API (JSON) - Usa Evolution API
    router.get("/qr", async (_req, res) => {
        try {
            // Siempre usar Evolution API (ya no hay whatsapp-web.js)
            const evolutionAPI = botManager.getEvolutionAPI();
            
            // Verificar si ya está conectado
            const isConnected = await evolutionAPI.isConnected();
            if (isConnected) {
                qrData.qrScanned = true;
                return res.json({
                    qr: null,
                    qrScanned: true,
                    message: "Client is already connected"
                });
            }
            
            // Intentar obtener QR de los datos en memoria (actualizado por webhook)
            if (qrData.qrCodeData && qrData.qrCodeData.length > 0) {
                logger.info("GET /qr - Returning QR from memory (webhook data)");
                return res.json({
                    qr: qrData.qrCodeData,
                    qrScanned: false,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Si no hay QR en memoria, solicitarlo directamente a Evolution API
            const qr = await evolutionAPI.getQR();
            if (qr) {
                qrData.qrCodeData = qr;
                logger.info("GET /qr - Returning QR from Evolution API");
                return res.json({
                    qr: qr,
                    qrScanned: false,
                    timestamp: new Date().toISOString()
                });
            }
            
            // QR no disponible aún
            return res.status(202).json({ 
                qr: null,
                qrScanned: false,
                message: "QR code is being generated, please wait...",
                retryAfter: 5
            });
            
        } catch (error) {
            logger.error("Failed to generate QR code:", error);
            res.status(500).json({ 
                error: "Failed to generate QR code",
                message: error instanceof Error ? error.message : "Unknown error occurred"
            });
        }
    });

    // QR Code endpoint para renderizar vista (EJS)
    router.get("/qr-view", (_req, res) => {
        logger.info("GET /qr-view");

        if (qrData.qrScanned) {
            return res.redirect("/");
        }

        res.render("qr", {
            qrCodeData: qrData.qrCodeData,
        });
    });

    // Endpoint para regenerar QR manualmente
    router.post("/qr/regenerate", async (_req, res) => {
        try {
            logger.info("POST /qr/regenerate - Manual QR regeneration requested");

            // Si el cliente no está autenticado, intentar regenerar
            if (!qrData.qrScanned) {
                // Resetear qrData
                qrData.qrCodeData = "";
                qrData.qrScanned = false;

                // Desvincular y crear nueva instancia (esto generará un nuevo QR)
                try {
                    await botManager.logout();
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    logger.warn("Error during logout for QR regeneration:", error);
                }

                // Inicializar nueva instancia (esto generará un nuevo QR)
                await botManager.initializeClient();
                await botManager.initialize();

                res.json({
                    success: true,
                    message: "QR regeneration initiated. Please wait for new QR code."
                });
            } else {
                res.json({
                    success: false,
                    message: "Client is already authenticated. No need to regenerate QR."
                });
            }
        } catch (error) {
            logger.error("Failed to regenerate QR:", error);
            res.status(500).json({
                success: false,
                error: "Failed to regenerate QR code. Please try logging out and reconnecting."
            });
        }
    });

    router.use("/crm", crmRouter(botManager));
    
    // Webhook handler para Evolution API v2
    router.use("/webhook", webhookRouter(botManager));

    return router;
}
