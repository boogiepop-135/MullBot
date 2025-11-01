// Importar polyfills primero para Node.js 18
import "./polyfills";

import express from "express";
import bodyParser from 'body-parser';
import logger from "./configs/logger.config";
import EnvConfig from "./configs/env.config";
import apiRoutes from "./api/index.api";
import { readAsciiArt } from "./utils/ascii-art.util";
import path from "path";
import { BotManager } from "./bot.manager";
import { connectDB } from "./configs/db.config";
import { initCrons } from "./crons/index.cron";

const app = express();
const port = EnvConfig.PORT || 3000;

app.set("view engine", "ejs");
// Intentar múltiples rutas para las vistas con logging para diagnóstico
const viewsPaths = [
    path.join(__dirname, "views"),
    path.join(__dirname, "../src/views"),
    path.join(process.cwd(), "src/views"),
    path.join(process.cwd(), "dist/views")
];
app.set("views", viewsPaths);
// Log de diagnóstico para las rutas de vistas
const fs = require('fs');
logger.info("Views paths configured:");
viewsPaths.forEach(viewPath => {
    const exists = fs.existsSync(viewPath);
    logger.info(`  - ${viewPath}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    if (exists) {
        try {
            const files = fs.readdirSync(viewPath);
            logger.info(`    Files in directory: ${files.join(', ')}`);
        } catch (e) {
            logger.warn(`    Cannot read directory: ${e.message}`);
        }
    }
});
// Configurar archivos estáticos - intentar dist/public primero, luego public como fallback
app.use("/public", express.static(path.join(__dirname, "../public")));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/public", express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/admin', (req, res) => {
    res.render('admin');
});

app.get('/admin/login', (req, res) => {
    res.render('admin-login');
});

const botManager = BotManager.getInstance();

// Conectar a MongoDB primero, luego inicializar el bot
connectDB().then(async () => {
    // Inicializar el cliente de WhatsApp después de conectar MongoDB
    await botManager.initializeClient();
    
    // Inicializar crons
    initCrons(botManager);
    
    // Configurar rutas
    app.use("/", apiRoutes(botManager));
    
    // Iniciar servidor Express
    app.listen(port, async () => {
        logger.info(readAsciiArt());
        logger.info(`Server running on port ${port}`);
        logger.info(`Access: http://localhost:${port}/`);
        
        // Inicializar el bot de WhatsApp
        await botManager.initialize();
    });
}).catch((error) => {
    logger.error("Failed to start application:", error);
    process.exit(1);
});