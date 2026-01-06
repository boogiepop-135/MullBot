import { RemoteAuth } from "whatsapp-web.js";
import EnvConfig from "./env.config";
// NOTA: Este archivo ya no se usa con Evolution API, pero se mantiene por compatibilidad
// MongoStore eliminado en migración a PostgreSQL/Prisma

export async function getClientConfig() {
    // DEPRECATED: Este archivo ya no se usa con Evolution API
    // Evolution API maneja las sesiones directamente en PostgreSQL
    throw new Error('getClientConfig is deprecated. Evolution API handles sessions directly.');
    
    // Código legacy (no ejecutado):
    // const store = await getMongoStore();

    return {
        authStrategy: new RemoteAuth({
            clientId: "mullbot-client",
            store: store,
            backupSyncIntervalMs: 300000, // Sincronizar cada 5 minutos
            dataPath: './.wwebjs_auth', // Ruta para datos de autenticación local (backup)
            // La sesión se guarda automáticamente en MongoDB en la colección 'auth_sessions'
            // wwebjs-mongo maneja automáticamente el guardado y restauración de sesiones
        }),
        puppeteer: {
            headless: true,
            // Solo especificar executablePath si está definido
            // Si no está definido, whatsapp-web.js/puppeteer-core intentará encontrarlo automáticamente
            ...(EnvConfig.PUPPETEER_EXECUTABLE_PATH ? {
                executablePath: EnvConfig.PUPPETEER_EXECUTABLE_PATH
            } : {}),
            // Timeout aumentado para conexiones lentas
            timeout: 60000,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-default-apps',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-default-browser-check',
                '--no-pings',
                '--password-store=basic',
                '--use-mock-keychain',
                '--disable-client-side-phishing-detection',
                '--disable-component-update',
                '--disable-offer-store-unmasked-wallet-cards',
                '--disable-offline-load-stale-cache',
                '--disable-popup-blocking',
                '--disable-speech-api',
                '--ignore-certificate-errors',
                '--ignore-ssl-errors',
                '--ignore-certificate-errors-spki-list',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--enable-features=NetworkService,NetworkServiceLogging',
                '--force-color-profile=srgb',
                '--metrics-recording-only',
                '--disable-blink-features=AutomationControlled',
                // Argumentos adicionales para mejor estabilidad
                '--disable-software-rasterizer',
                '--disable-background-downloads',
                '--disable-breakpad',
                '--disable-crash-reporter',
                '--disable-domain-reliability',
                '--disable-features=AudioServiceOutOfProcess',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-site-isolation-trials',
                '--disable-web-resources',
                '--enable-automation',
                '--enable-features=NetworkService,NetworkServiceLogging',
                '--force-color-profile=srgb',
                '--metrics-recording-only',
                '--no-crash-upload',
                '--noerrdialogs',
                '--remote-debugging-port=0',
                '--test-type=webdriver',
                '--use-mock-keychain',
                '--window-size=1920,1080'
            ]
        },
        restartOnAuthFail: true,
        takeoverOnConflict: true,
        takeoverTimeoutMs: 0,
        qrMaxRetries: 10, // Aumentar reintentos de QR
        // Configuración adicional para mejor estabilidad
        webVersionCache: {
            type: 'remote' as const,
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51.html'
        },
        // Forzar regeneración de QR si falla
        authTimeoutMs: 60000 // 60 segundos para autenticación
        // Nota: La sesión se maneja automáticamente a través de RemoteAuth y MongoStore
        // No es necesario especificar 'session' manualmente
    };
}