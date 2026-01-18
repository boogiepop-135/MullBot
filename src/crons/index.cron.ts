import { checkScheduledCampaigns } from "./campaign.cron";
import { initProductSyncCron } from "./product-sync.cron";
import { BotManager } from "../bot.manager";
import { CronJob } from "cron";
import logger from "../configs/logger.config";

export function initCrons(botManager: BotManager) {
    // Check scheduled campaigns every minute
    // Usar zona horaria de México Central (America/Mexico_City)
    new CronJob(
        "* * * * *",
        () => checkScheduledCampaigns(botManager),
        null,
        true,
        "America/Mexico_City"
    );
    
    // Inicializar sincronización automática de productos
    initProductSyncCron();
    
    logger.info("Cron jobs initialized (timezone: America/Mexico_City)");
}