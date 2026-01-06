import express from "express";
import logger from "../configs/logger.config";
import { BotManager } from "../bot.manager";
import crmRouter from "../crm/api/crm.api";

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
            // Asegurar que el cliente esté inicializado
            if (!botManager.client) {
                await botManager.initializeClient();
            }

            const client = botManager.client;
            const isClientReady = client && client.info ? true : false;
            
            // Si el cliente tiene info, está conectado (aunque qrScanned pueda ser false después de un reinicio)
            // Actualizar qrScanned si el cliente está realmente conectado
            if (isClientReady && !qrData.qrScanned) {
                logger.info("Client is ready but qrScanned is false, updating status");
                qrData.qrScanned = true;
            }

            const healthStatus = {
                status: isClientReady ? "healthy" : "unhealthy",
                clientReady: isClientReady,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                qrScanned: isClientReady ? true : qrData.qrScanned, // Si está conectado, considerar qrScanned como true
                botContact: client && client.info ? `<a target="_blank" href="https://wa.me/${client.info.wid.user}">wa.me/${client.info.wid.user}</a>` : null,
                botPushName: client && client.info ? client.info.pushname : null,
                botPlatform: client && client.info ? client.info.platform : null,
                version: process.version,
            };

            logger.info(`GET /health - clientReady: ${isClientReady}, qrScanned: ${healthStatus.qrScanned}`);
            res.status(200).json(healthStatus);
        } catch (error) {
            logger.error("Health check failed", error);
            res.status(500).json({ status: "unhealthy", error: "Internal Server Error" });
        }
    });

    // QR Code endpoint para API (JSON) - Mejorado con mejor manejo de errores
    router.get("/qr", async (_req, res) => {
        try {
            // Verificar si el cliente está listo (conectado)
            const isClientReady = botManager.client?.info ? true : false;
            
            // Si el cliente está listo, no hay QR disponible
            if (isClientReady && qrData.qrScanned) {
                logger.info("GET /qr - Client already connected");
                return res.json({
                    qr: null,
                    qrScanned: true,
                    message: "Client is already connected"
                });
            }
            
            const qr = qrData.qrCodeData;
            logger.info(`GET /qr - QR data check: hasQR=${!!qr}, length=${qr?.length || 0}, clientReady=${isClientReady}, qrScanned=${qrData.qrScanned}`);
            
            if (!qr || qr.trim().length === 0) {
                // Si no hay QR pero el cliente existe, puede estar inicializándose
                if (botManager.client && !isClientReady) {
                    logger.info("QR no disponible aún, cliente puede estar inicializándose...");
                    return res.status(202).json({ 
                        qr: null,
                        qrScanned: false,
                        message: "QR code is being generated, please wait...",
                        retryAfter: 5
                    });
                }
                
                // Si no hay cliente, intentar inicializarlo
                if (!botManager.client) {
                    logger.info("Cliente no existe, inicializando...");
                    try {
                        await botManager.initializeClient();
                        await botManager.initialize();
                        // Esperar un momento para que se genere el QR
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    } catch (error) {
                        logger.error(`Error inicializando cliente: ${error}`);
                    }
                }
                
                // En lugar de 404, devolver 200 con información útil
                // Esto evita errores en el frontend y permite mejor manejo
                return res.json({ 
                    qr: null,
                    qrScanned: qrData.qrScanned,
                    error: "QR code not available",
                    message: "No QR code available. The client may need to be reinitialized. Try logging out and reconnecting.",
                    needsReconnect: true
                });
            }

            // Validar que el QR tenga el formato correcto
            if (qr.length < 50) {
                logger.warn(`QR code seems invalid (length: ${qr.length})`);
                return res.status(500).json({ 
                    error: "Invalid QR code format",
                    message: "The QR code generated seems invalid. Please try regenerating."
                });
            }

            // Generar imagen QR en base64
            const QRCode = require('qrcode');
            let qrImage;
            try {
                qrImage = await QRCode.toDataURL(qr, {
                    errorCorrectionLevel: 'M',
                    type: 'image/png',
                    quality: 0.92,
                    margin: 1,
                    width: 512
                });
            } catch (qrError) {
                logger.error("Error generating QR image:", qrError);
                return res.status(500).json({ 
                    error: "Failed to generate QR image",
                    message: "Error converting QR code to image format"
                });
            }

            // Extraer solo el base64 sin el prefijo data:image/png;base64,
            const base64Image = qrImage.split(',')[1];
            
            if (!base64Image) {
                logger.error("Failed to extract base64 from QR image");
                return res.status(500).json({ 
                    error: "Failed to process QR code",
                    message: "Error processing QR code image"
                });
            }

            logger.info("QR code image generated successfully");
            res.json({
                qr: base64Image,
                qrScanned: qrData.qrScanned,
                timestamp: new Date().toISOString()
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
                // Destruir cliente actual si existe
                if (botManager.client) {
                    try {
                        await botManager.client.destroy();
                    } catch (error) {
                        logger.warn("Error destroying client during regeneration:", error);
                    }
                }

                // Resetear qrData
                qrData.qrCodeData = "";
                qrData.qrScanned = false;

                // Inicializar nuevo cliente (esto generará un nuevo QR)
                await botManager.initializeClient(true);
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

    return router;
}
