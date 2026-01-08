import { config } from "dotenv";
import logger from "./logger.config";

const fs = require('fs');

config();

class EnvConfig {

    // AI API Keys - Primary
    static GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    static ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    
    // AI API Keys - Fallback (para futuras expansiones con múltiples claves)
    // Puedes agregar GEMINI_API_KEY_2, GEMINI_API_KEY_3, etc. para rotación de claves
    // El AIModelManager las detectará automáticamente si las agregas aquí
    static GEMINI_API_KEY_2 = process.env.GEMINI_API_KEY_2;
    static GEMINI_API_KEY_3 = process.env.GEMINI_API_KEY_3;
    static PUPPETEER_EXECUTABLE_PATH: string | undefined = undefined;
    static OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
    static SPEECHIFY_API_KEY = process.env.SPEECHIFY_API_KEY;
    static ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
    static ENV = process.env.ENV;
    static PORT = process.env.PORT;
    // Evolution API v2 - Configuración principal
    static EVOLUTION_URL = process.env.EVOLUTION_URL || process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
    static EVOLUTION_APIKEY = process.env.EVOLUTION_APIKEY || process.env.EVOLUTION_API_KEY || '';
    static EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'mullbot-principal';
    // Legacy support (deprecated)
    static USE_EVOLUTION_API = process.env.USE_EVOLUTION_API === 'true';
    static EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    static EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
    // PostgreSQL Database URL
    static DATABASE_URL: string | undefined = process.env.DATABASE_URL;
    static JWT_SECRET = process.env.JWT_SECRET;
    static API_BASE_URL = process.env.API_BASE_URL || "https://mullbot-production.up.railway.app";
    

    // Método para inicializar la ruta de Puppeteer
    private static initializePuppeteerPath(): void {
        // Si está configurado manualmente, usarlo
        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            this.PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH;
            logger.info(`Using PUPPETEER_EXECUTABLE_PATH from environment: ${this.PUPPETEER_EXECUTABLE_PATH}`);
            return;
        }

        // En Railway, intentar encontrar Chrome en rutas comunes
        // Railway puede instalar Chrome en diferentes ubicaciones
        // Priorizar google-chrome sobre chromium para evitar problemas con snap
        const possiblePaths = [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome-beta',
            '/usr/bin/chromium',
            '/usr/bin/chrome',
            '/usr/local/bin/google-chrome',
            '/usr/local/bin/google-chrome-stable',
            '/app/.apt/usr/bin/google-chrome-stable'
            // NO incluir chromium-browser porque requiere snap y no funciona en Railway
        ];

        // Verificar si algún archivo existe y es ejecutable
        for (const path of possiblePaths) {
            try {
                if (fs.existsSync(path)) {
                    // Verificar si es un archivo ejecutable (no un script que requiere snap)
                    const stats = fs.statSync(path);
                    if (stats.isFile()) {
                        // Verificar que no sea un script que requiere snap
                        try {
                            const content = fs.readFileSync(path, 'utf8', { flag: 'r' });
                            // Si contiene 'snap' o 'chromium-browser', evitarlo
                            if (content.includes('snap') || content.includes('chromium-browser')) {
                                logger.warn(`Skipping ${path} - appears to require snap`);
                                continue;
                            }
                        } catch (e) {
                            // Si no podemos leer el archivo, asumir que es binario y está bien
                        }
                        
                        this.PUPPETEER_EXECUTABLE_PATH = path;
                        logger.info(`Found Chrome at: ${path}`);
                        return;
                    }
                }
            } catch (error) {
                // Continuar buscando
            }
        }

        // Si no se encuentra, intentar usar el Chrome que Puppeteer puede tener descargado
        // o intentar ejecutar 'which google-chrome' para encontrarlo
        try {
            const { execSync } = require('child_process');
            try {
                const chromePath = execSync('which google-chrome', { encoding: 'utf8' }).trim();
                if (chromePath && fs.existsSync(chromePath)) {
                    this.PUPPETEER_EXECUTABLE_PATH = chromePath;
                    logger.info(`Found Chrome via 'which' command: ${chromePath}`);
                    return;
                }
            } catch (error) {
                // Continuar
            }
            
            // Intentar con chromium (pero no chromium-browser que requiere snap)
            try {
                const chromiumPath = execSync('which chromium', { encoding: 'utf8' }).trim();
                if (chromiumPath && fs.existsSync(chromiumPath)) {
                    // Verificar que no sea chromium-browser (que requiere snap)
                    if (!chromiumPath.includes('chromium-browser')) {
                        this.PUPPETEER_EXECUTABLE_PATH = chromiumPath;
                        logger.info(`Found Chromium via 'which' command: ${chromiumPath}`);
                        return;
                    }
                }
            } catch (error) {
                // Continuar
            }
        } catch (error) {
            // Ignorar errores de execSync
        }
        
        // Si aún no se encuentra, dejar undefined - Puppeteer intentará usar su Chrome embebido
        // o el usuario puede configurar PUPPETEER_EXECUTABLE_PATH manualmente
        logger.warn("Chrome executable not found in system paths. Puppeteer will attempt to use its bundled Chrome.");
        logger.warn("In Railway, if Chrome is not available, Puppeteer should download it automatically.");
        this.PUPPETEER_EXECUTABLE_PATH = undefined;
    }

    static validate() {
        // Inicializar PUPPETEER_EXECUTABLE_PATH con detección automática
        this.initializePuppeteerPath();
        
        // En producción (Railway), las variables de entorno vienen del entorno, no del archivo .env
        const isProduction = process.env.NODE_ENV === 'production' || process.env.ENV === 'production';
        
        if (!isProduction && !fs.existsSync(".env")) {
            throw new Error(".env file is missing. Please create a .env file at the root directory out of the env.example file.");
        }

        // Variables obligatorias para el funcionamiento básico
        if (!this.GEMINI_API_KEY) {
            throw new Error("Environment variable GEMINI_API_KEY is missing. Please provide a valid Gemini API key.");
        }
        if (!this.ENV) {
            throw new Error("Environment variable ENV is missing. Please provide a valid ENV.");
        }
        if (!this.PORT) {
            throw new Error("Environment variable PORT is missing. Please provide a valid PORT.");
        }
        if (!this.DATABASE_URL) {
            // Log de diagnóstico para ayudar a debuggear
            logger.error("Database URL Configuration Debug:");
            logger.error(`- DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
            logger.error(`- Available env vars starting with DATABASE: ${Object.keys(process.env).filter(k => k.startsWith('DATABASE')).join(', ') || 'NONE'}`);
            
            throw new Error("Environment variable DATABASE_URL is missing. Please provide a valid PostgreSQL connection string. Example: postgresql://user:password@host:5432/database?schema=public");
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