import { config } from "dotenv";
import logger from "./logger.config";

const fs = require('fs');

config();

class EnvConfig {

    static GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    static ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    static PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH;
    static OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
    static SPEECHIFY_API_KEY = process.env.SPEECHIFY_API_KEY;
    static ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
    static ENV = process.env.ENV;
    static PORT = process.env.PORT;
    // En Railway, preferir usar el endpoint privado para evitar costos de egress
    // Railway puede crear variables como MONGO_URL, MONGO_PUBLIC_URL, etc.
    static MONGODB_URI: string | undefined = undefined;
    static JWT_SECRET = process.env.JWT_SECRET;
    static API_BASE_URL = process.env.API_BASE_URL || "https://mullbot-production.up.railway.app";
    
    // Método para inicializar MONGODB_URI (llamar desde validate)
    private static initializeMongoUri(): void {
        // Intentar múltiples nombres de variables que Railway puede usar
        // Preferir endpoints privados para evitar costos de egress
        if (process.env.MONGODB_URI) {
            this.MONGODB_URI = process.env.MONGODB_URI;
            logger.info("Using MONGODB_URI from environment");
        } else if (process.env.MONGO_PRIVATE_URL) {
            this.MONGODB_URI = process.env.MONGO_PRIVATE_URL;
            logger.info("Using MONGO_PRIVATE_URL (private endpoint - no egress fees)");
        } else if (process.env.MONGO_URL) {
            this.MONGODB_URI = process.env.MONGO_URL;
            logger.warn("Using MONGO_URL - verify if this is a private endpoint to avoid egress fees");
        } else if (process.env.MONGODB_URL) {
            this.MONGODB_URI = process.env.MONGODB_URL;
            logger.info("Using MONGODB_URL from environment");
        } else {
            const builtUri = this.buildMongoUriFromRailwayVars();
            if (builtUri) {
                this.MONGODB_URI = builtUri;
                logger.info("Built MongoDB URI from Railway variables");
            }
        }
    }
    
    // Método auxiliar para construir MongoDB URI desde variables de Railway
    private static buildMongoUriFromRailwayVars(): string | undefined {
        // Railway puede proporcionar estas variables cuando conectas MongoDB
        const mongoHost = process.env.MONGO_HOST || process.env.RAILWAY_PRIVATE_DOMAIN;
        const mongoPort = process.env.MONGO_PORT || '27017';
        const mongoUser = process.env.MONGO_USER || process.env.MONGO_ROOT_USER;
        const mongoPass = process.env.MONGO_PASSWORD || process.env.MONGO_ROOT_PASSWORD;
        const mongoDatabase = process.env.MONGO_DATABASE || 'mullbot';
        
        if (mongoHost && mongoUser && mongoPass) {
            // Construir URI MongoDB estándar
            return `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:${mongoPort}/${mongoDatabase}?authSource=admin`;
        }
        
        return undefined;
    }

    static validate() {
        // Inicializar MONGODB_URI primero para que pueda usar múltiples fuentes
        this.initializeMongoUri();
        
        // En producción (Railway), las variables de entorno vienen del entorno, no del archivo .env
        const isProduction = process.env.NODE_ENV === 'production' || process.env.ENV === 'production';
        
        if (!isProduction && !fs.existsSync(".env")) {
            throw new Error(".env file is missing. Please create a .env file at the root directory out of the env.example file.");
        }

        // Variables obligatorias para el funcionamiento básico
        if (!this.GEMINI_API_KEY) {
            throw new Error("Environment variable GEMINI_API_KEY is missing. Please provide a valid Gemini API key.");
        }
        if (!this.PUPPETEER_EXECUTABLE_PATH) {
            // En Railway, Puppeteer puede usar el Chrome instalado automáticamente
            // Usar el ejecutable por defecto si no está configurado
            const defaultChromePath = '/usr/bin/google-chrome-stable';
            logger.warn(`PUPPETEER_EXECUTABLE_PATH not set, using default: ${defaultChromePath}`);
            // No lanzar error, usar el valor por defecto para Railway
            process.env.PUPPETEER_EXECUTABLE_PATH = defaultChromePath;
            this.PUPPETEER_EXECUTABLE_PATH = defaultChromePath;
        }
        if (!this.ENV) {
            throw new Error("Environment variable ENV is missing. Please provide a valid ENV.");
        }
        if (!this.PORT) {
            throw new Error("Environment variable PORT is missing. Please provide a valid PORT.");
        }
        if (!this.MONGODB_URI) {
            // Log de diagnóstico para ayudar a debuggear
            logger.error("MongoDB URI Configuration Debug:");
            logger.error(`- MONGODB_URI: ${process.env.MONGODB_URI ? 'SET' : 'NOT SET'}`);
            logger.error(`- MONGO_URL: ${process.env.MONGO_URL ? 'SET' : 'NOT SET'}`);
            logger.error(`- MONGO_HOST: ${process.env.MONGO_HOST ? 'SET' : 'NOT SET'}`);
            logger.error(`- MONGO_USER: ${process.env.MONGO_USER ? 'SET' : 'NOT SET'}`);
            logger.error(`- RAILWAY_PRIVATE_DOMAIN: ${process.env.RAILWAY_PRIVATE_DOMAIN ? 'SET' : 'NOT SET'}`);
            logger.error(`- Available env vars starting with MONGO: ${Object.keys(process.env).filter(k => k.startsWith('MONGO')).join(', ') || 'NONE'}`);
            
            throw new Error("Environment variable MONGODB_URI is missing. Please provide a valid MONGODB_URI. Railway provides MONGO_URL or you can set MONGODB_URI manually.");
        }
        if (!this.JWT_SECRET) {
            throw new Error("Environment variable JWT_SECRET is missing. Please provide a valid JWT_SECRET.");
        }

        // Variables opcionales - solo mostrar advertencias si están configuradas pero vacías
        if (this.ANTHROPIC_API_KEY === '') {
            logger.warn("ANTHROPIC_API_KEY is empty. Claude AI fallback will not work.");
        }
        if (this.OPENWEATHERMAP_API_KEY === '') {
            logger.warn("OPENWEATHERMAP_API_KEY is empty. Weather commands will not work.");
        }
        if (this.SPEECHIFY_API_KEY === '') {
            logger.warn("SPEECHIFY_API_KEY is empty. Text-to-speech features will not work.");
        }
        if (this.ASSEMBLYAI_API_KEY === '') {
            logger.warn("ASSEMBLYAI_API_KEY is empty. Speech-to-text features will not work.");
        }
    }
}

try {
    EnvConfig.validate();
} catch (error) {
    logger.error(error);
    process.exit(1);
}

export default EnvConfig;