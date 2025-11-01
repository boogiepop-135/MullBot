import express from "express";
import logger from "../configs/logger.config";
import { BotManager } from "../bot.manager";
import crmRouter from "../crm/api/crm.api";

const router = express.Router();

export default function (botManager: BotManager) {

    const qrData = botManager.qrData;
    
    router.get("/", (_req, res) => {
        logger.info("GET /");
        res.render("index", {
            qrScanned: qrData.qrScanned,
            qrCodeData: qrData.qrCodeData,
        });
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

                    const healthStatus = {
                        status: isClientReady ? "healthy" : "unhealthy",
                        clientReady: isClientReady,
                        uptime: process.uptime(),
                        memoryUsage: process.memoryUsage(),
                        qrScanned: qrData.qrScanned,
                        botContact: client && client.info ? `<a target="_blank" href="https://wa.me/${client.info.wid.user}">wa.me/${client.info.wid.user}</a>` : null,
                        botPushName: client && client.info ? client.info.pushname : null,
                        botPlatform: client && client.info ? client.info.platform : null,
                        version: process.version,
                    };

                    logger.info("GET /health");
                    res.status(200).json(healthStatus);
                } catch (error) {
                    logger.error("Health check failed", error);
                    res.status(500).json({ status: "unhealthy", error: "Internal Server Error" });
                }
            });

    // QR Code endpoint para API (JSON)
    router.get("/qr", async (_req, res) => {
        try {
            const qr = qrData.qrCodeData;
            if (!qr) {
                return res.status(404).json({ error: "QR code not available" });
            }

            // Generar imagen QR en base64
            const QRCode = require('qrcode');
            const qrImage = await QRCode.toDataURL(qr);
            
            // Extraer solo el base64 sin el prefijo data:image/png;base64,
            const base64Image = qrImage.split(',')[1];

            res.json({ 
                qr: base64Image,
                qrScanned: qrData.qrScanned 
            });
        } catch (error) {
            logger.error("Failed to generate QR code:", error);
            res.status(500).json({ error: "Failed to generate QR code" });
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

    router.use("/crm", crmRouter(botManager));

    return router;
}
