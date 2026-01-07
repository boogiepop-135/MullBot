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
// Agregar headers no-cache para archivos JS para evitar problemas de caché durante desarrollo
app.use("/public", express.static(path.join(__dirname, "../public"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));
app.use("/public", express.static(path.join(__dirname, "public"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));
app.use("/public", express.static("public", {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/admin', (req, res) => {
    res.render('admin');
});

app.get('/admin/login', (req, res) => {
    res.render('admin-login');
});

const botManager = BotManager.getInstance();

// Conectar a PostgreSQL primero, luego inicializar el bot
connectDB().then(async () => {
    // Configurar rutas PRIMERO (para que el webhook esté disponible)
    app.use("/", apiRoutes(botManager));
    
    // Iniciar servidor Express
    app.listen(port, async () => {
        logger.info(readAsciiArt());
        logger.info(`Server running on port ${port}`);
        logger.info(`Access: http://localhost:${port}/`);
        logger.info(`Webhook endpoint: http://localhost:${port}/webhook/evolution`);
        
        // Inicializar Evolution API v2 (crea instancia si no existe)
        try {
            await botManager.initializeClient();
            logger.info("✅ Bot inicializado correctamente");
        } catch (error) {
            logger.error("❌ Error inicializando bot:", error);
        }
        
        // Inicializar crons
        initCrons(botManager);
    });
}).catch((error) => {
    logger.error("Failed to start application:", error);
    process.exit(1);
});