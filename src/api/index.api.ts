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

    // QR Code endpoint para API (JSON) - Con máquina de estados estricta
    router.get("/qr", async (_req, res) => {
        try {
            const sessionManager = botManager.getSessionManager();
            const sessionData = sessionManager.getSessionData();

            // Caso 1: Ya autenticado - 200 OK (sin QR)
            if (sessionData.state === 'AUTHENTICATED') {
                qrData.qrScanned = true;
                return res.status(200).json({
                    qr: null,
                    qrScanned: true,
                    state: 'AUTHENTICATED',
                    message: "Client is already connected"
                });
            }

            // Caso 2: QR listo y válido - 200 OK (con QR)
            if (sessionData.state === 'QR_READY' && sessionData.qrCode) {
                qrData.qrCodeData = sessionData.qrCode;
                qrData.qrScanned = false;
                logger.info("GET /qr - Returning QR (state: QR_READY)");
                return res.status(200).json({
                    qr: sessionData.qrCode,
                    qrScanned: false,
                    state: 'QR_READY',
                    timestamp: new Date().toISOString()
                });
            }

            // Caso 3: Inicializando - 202 Accepted (con timeout protection)
            if (sessionData.state === 'INITIALIZING') {
                // Verificar si está atascado (timeout)
                const now = Date.now();
                const initTime = (sessionData as any).initializedAt || 0;
                const timeElapsed = now - initTime;
                const timeoutMs = 60000; // 60 segundos

                if (timeElapsed > timeoutMs) {
                    // Timeout: forzar reset y error
                    logger.warn(`⏰ Timeout en inicialización (${timeElapsed}ms), forzando reset`);
                    sessionManager.forceReset();
                    return res.status(500).json({
                        qr: null,
                        qrScanned: false,
                        state: 'ERROR',
                        error: 'Initialization timeout',
                        message: "QR generation timed out. Please try disconnecting and reconnecting."
                    });
                }

                // Aún inicializando: 202 Accepted
                logger.debug(`GET /qr - Still initializing (${timeElapsed}ms elapsed)`);
                return res.status(202).json({
                    qr: null,
                    qrScanned: false,
                    state: 'INITIALIZING',
                    message: "QR code is being generated, please wait...",
                    retryAfter: 3, // 3 segundos
                    progress: {
                        elapsedMs: timeElapsed,
                        timeoutMs: timeoutMs
                    }
                });
            }

            // Caso 4: Error - 500 Internal Server Error
            if (sessionData.state === 'ERROR') {
                const errorMsg = (sessionData as any).errorMessage || 'Unknown error';
                logger.error(`GET /qr - Error state: ${errorMsg}`);
                return res.status(500).json({
                    qr: null,
                    qrScanned: false,
                    state: 'ERROR',
                    error: errorMsg,
                    message: `Failed to generate QR: ${errorMsg}. Please try disconnecting and reconnecting.`
                });
            }

            // Caso 5: Estado IDLE o desconocido - Intentar inicializar
            logger.info(`GET /qr - State is ${sessionData.state}, initializing...`);
            
            try {
                // Intentar obtener QR (esto iniciará la inicialización si es necesario)
                const qrResult = await sessionManager.getQR();
                
                if (qrResult.qr && qrResult.state === 'QR_READY') {
                    // QR obtenido exitosamente
                    qrData.qrCodeData = qrResult.qr;
                    qrData.qrScanned = false;
                    return res.status(200).json({
                        qr: qrResult.qr,
                        qrScanned: false,
                        state: 'QR_READY',
                        timestamp: new Date().toISOString()
                    });
                }

                if (qrResult.error) {
                    // Error durante la obtención
                    return res.status(500).json({
                        qr: null,
                        qrScanned: false,
                        state: qrResult.state,
                        error: qrResult.error,
                        message: qrResult.error
                    });
                }

                // Estado INITIALIZING después de intentar obtener
                return res.status(202).json({
                    qr: null,
                    qrScanned: false,
                    state: 'INITIALIZING',
                    message: "QR code is being generated, please wait...",
                    retryAfter: 3
                });

            } catch (error: any) {
                logger.error("Failed to get QR:", error);
                return res.status(500).json({
                    qr: null,
                    qrScanned: false,
                    state: 'ERROR',
                    error: error.message || 'Unknown error',
                    message: "Failed to initialize QR generation"
                });
            }
            
        } catch (error) {
            logger.error("Failed to generate QR code:", error);
            return res.status(500).json({ 
                qr: null,
                qrScanned: false,
                state: 'ERROR',
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

    // Endpoint para obtener Pairing Code
    router.post("/pairing-code", async (req, res) => {
        try {
            const { phoneNumber } = req.body;

            if (!phoneNumber) {
                return res.status(400).json({
                    success: false,
                    error: "Se requiere el número de teléfono"
                });
            }

            logger.info(`POST /pairing-code - Requesting pairing code for: ${phoneNumber}`);

            const evolutionAPI = botManager.getEvolutionAPI();
            const result = await evolutionAPI.connectWithPairingCode(phoneNumber);

            if (result.success && result.code) {
                return res.status(200).json({
                    success: true,
                    code: result.code,
                    message: "Código de vinculación generado exitosamente"
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: result.error || "No se pudo generar el código"
                });
            }
        } catch (error) {
            logger.error("Failed to get pairing code:", error);
            return res.status(500).json({
                success: false,
                error: "Error al generar código de vinculación",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    });

    // Endpoint para estado del sistema de IA
    router.get("/ai-status", (_req, res) => {
        try {
            const { AIModelManager } = require("../services/ai-model-manager.service");
            const aiManager = AIModelManager.getInstance();
            const status = aiManager.getSystemStatus();
            
            logger.info("GET /ai-status - Returning AI system status");
            res.status(200).json(status);
        } catch (error) {
            logger.error("Failed to get AI status:", error);
            res.status(500).json({ 
                error: "Failed to retrieve AI system status",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    });

    // Endpoint para resetear todas las estadísticas de IA
    router.post("/ai-reset", (_req, res) => {
        try {
            const { AIModelManager } = require("../services/ai-model-manager.service");
            const aiManager = AIModelManager.getInstance();
            aiManager.resetAllStats();
            
            logger.info("POST /ai-reset - All AI stats reset");
            res.status(200).json({ 
                success: true,
                message: "Todas las estadísticas han sido reseteadas" 
            });
        } catch (error) {
            logger.error("Failed to reset AI stats:", error);
            res.status(500).json({ 
                success: false,
                error: "Failed to reset AI statistics",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    });

    // Endpoint para resetear estadísticas de un modelo específico
    router.post("/ai-reset-model", (req, res) => {
        try {
            const { modelName } = req.body;
            
            if (!modelName) {
                return res.status(400).json({
                    success: false,
                    error: "Se requiere el nombre del modelo"
                });
            }

            const { AIModelManager } = require("../services/ai-model-manager.service");
            const aiManager = AIModelManager.getInstance();
            const result = aiManager.resetModelStats(modelName);
            
            if (result) {
                logger.info(`POST /ai-reset-model - Model ${modelName} stats reset`);
                res.status(200).json({ 
                    success: true,
                    message: `Estadísticas de ${modelName} reseteadas` 
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: `Modelo ${modelName} no encontrado`
                });
            }
        } catch (error) {
            logger.error("Failed to reset model stats:", error);
            res.status(500).json({ 
                success: false,
                error: "Failed to reset model statistics",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    });

    // Endpoint para obtener estadísticas del caché
    router.get("/ai-cache-stats", async (_req, res) => {
        try {
            const { AICacheService } = require("../services/ai-cache.service");
            const cache = AICacheService.getInstance();
            const stats = await cache.getStats();
            
            logger.info("GET /ai-cache-stats - Returning cache statistics");
            res.status(200).json(stats);
        } catch (error) {
            logger.error("Failed to get cache stats:", error);
            res.status(500).json({ 
                error: "Failed to retrieve cache statistics",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    });

    // Endpoint para limpiar caché
    router.post("/ai-cache-clear", async (_req, res) => {
        try {
            const { AICacheService } = require("../services/ai-cache.service");
            const cache = AICacheService.getInstance();
            await cache.clearAll();
            
            logger.info("POST /ai-cache-clear - Cache cleared");
            res.status(200).json({ 
                success: true,
                message: "Caché limpiado exitosamente" 
            });
        } catch (error) {
            logger.error("Failed to clear cache:", error);
            res.status(500).json({ 
                success: false,
                error: "Failed to clear cache",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    });

    // Endpoint para obtener top queries del caché
    router.get("/ai-cache-top", async (req, res) => {
        try {
            const limit = parseInt(req.query.limit as string) || 10;
            const { AICacheService } = require("../services/ai-cache.service");
            const cache = AICacheService.getInstance();
            const topQueries = await cache.getTopQueries(limit);
            
            logger.info(`GET /ai-cache-top - Returning top ${limit} queries`);
            res.status(200).json(topQueries);
        } catch (error) {
            logger.error("Failed to get top queries:", error);
            res.status(500).json({ 
                error: "Failed to retrieve top queries",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    });

    // Endpoint para probar conexión con IA
    router.post("/ai-test", async (req, res) => {
        try {
            const { query } = req.body;
            const testQuery = query || "Hola, esto es una prueba del sistema de IA";

            logger.info("POST /ai-test - Testing AI connection");

            const { AIModelManager } = require("../services/ai-model-manager.service");
            const aiManager = AIModelManager.getInstance();

            const startTime = Date.now();
            const result = await aiManager.generateContent(testQuery, "Responde brevemente a esta prueba del sistema.");
            const duration = Date.now() - startTime;

            logger.info(`AI test completed in ${duration}ms with model ${result.modelUsed}`);

            res.status(200).json({
                success: true,
                modelUsed: result.modelUsed,
                fallbackOccurred: result.fallbackOccurred,
                attemptedModels: result.attemptedModels,
                duration,
                response: result.text.substring(0, 100) + (result.text.length > 100 ? '...' : '')
            });

        } catch (error) {
            logger.error("AI test failed:", error);
            res.status(500).json({
                success: false,
                error: "AI test failed",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    });

    router.use("/crm", crmRouter(botManager));
    
    // Webhook handler para Evolution API v2
    router.use("/webhook", webhookRouter(botManager));

    return router;
}
