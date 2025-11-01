import { BotConfigModel } from '../crm/models/bot-config.model';
import logger from '../configs/logger.config';

let cachedDelay: number | null = null;
let lastFetch: number = 0;
const CACHE_DURATION = 60000; // 1 minuto

export async function getBotDelay(): Promise<number> {
    const now = Date.now();
    
    // Usar caché si está disponible y no ha expirado
    if (cachedDelay !== null && (now - lastFetch) < CACHE_DURATION) {
        return cachedDelay;
    }
    
    try {
        let config = await BotConfigModel.findOne();
        if (!config) {
            config = await BotConfigModel.create({ botDelay: 10000 });
        }
        
        cachedDelay = config.botDelay;
        lastFetch = now;
        
        return cachedDelay;
    } catch (error) {
        logger.error('Error fetching bot delay:', error);
        // Retornar delay por defecto si hay error
        return 10000;
    }
}

export function clearBotDelayCache() {
    cachedDelay = null;
    lastFetch = 0;
}

