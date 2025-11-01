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
app.set("views", path.join(__dirname, "views"));
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