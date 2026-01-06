// src/crons/campaign.cron.ts
import { BotManager } from '../bot.manager';
import logger from '../configs/logger.config';
import { CampaignModel } from '../crm/models/campaign.model';

export async function checkScheduledCampaigns(botManager: BotManager) {
  try {
    const now = new Date();

    // Buscar todas las campañas programadas
    const allScheduledCampaigns = await CampaignModel.find({
      status: 'scheduled'
    });

    // Filtrar campañas que deben ejecutarse ahora
    const campaignsToSend = allScheduledCampaigns.filter(campaign => {
      if (campaign.isBatchCampaign) {
        // Para campañas por lotes, verificar nextBatchAt
        return campaign.nextBatchAt && campaign.nextBatchAt <= now;
      } else {
        // Para campañas normales, verificar scheduledAt
        return campaign.scheduledAt && campaign.scheduledAt <= now;
      }
    });

    if (campaignsToSend.length > 0) {
      logger.info(`Found ${campaignsToSend.length} campaign(s) ready to send`);
    }

    for (const campaign of campaignsToSend) {
      const scheduledTime = campaign.isBatchCampaign 
        ? campaign.nextBatchAt 
        : campaign.scheduledAt;
      
      logger.info(
        `Processing scheduled campaign: ${campaign.name} ` +
        `(type: ${campaign.isBatchCampaign ? 'batch' : 'normal'}, ` +
        `scheduled for: ${scheduledTime?.toISOString()})`
      );
      
      await sendCampaignMessages(botManager, campaign);
    }
  } catch (error) {
    logger.error('Failed to check scheduled campaigns:', error);
  }
}

export async function sendCampaignMessages(botManager: BotManager, campaign: any) {
  try {
    campaign.status = 'sending';
    await campaign.save();

    let sentCount = campaign.sentCount || 0;
    let failedCount = campaign.failedCount || 0;

    // Determinar qué contactos enviar (lote actual o todos)
    let contactsToSend = campaign.contacts;

    if (campaign.isBatchCampaign && campaign.batchSize) {
      const startIndex = campaign.currentBatchIndex * campaign.batchSize;
      const endIndex = startIndex + campaign.batchSize;
      contactsToSend = campaign.contacts.slice(startIndex, endIndex);

      logger.info(
        `Sending batch ${campaign.currentBatchIndex + 1}/${campaign.totalBatches} ` +
        `(${contactsToSend.length} contacts) for campaign: ${campaign.name}`
      );
    }

    // Enviar mensajes del lote actual
    for (const phoneNumber of contactsToSend) {
      try {
        // Normalizar número (remover @ si existe)
        const formattedNumber = phoneNumber.replace(/@[cg]\.us$/, '');

        await botManager.sendMessage(formattedNumber, campaign.message);

        try {
          await botManager.saveSentMessage(phoneNumber, campaign.message, null);
        } catch (err) {
          logger.warn(`Failed to save campaign message for ${phoneNumber}:`, err);
        }
        sentCount++;
      } catch (error) {
        logger.error(`Failed to send message to ${phoneNumber}:`, error);
        failedCount++;
      }
    }

    // Actualizar contadores
    campaign.sentCount = sentCount;
    campaign.failedCount = failedCount;

    // Determinar si hay más lotes por enviar
    if (campaign.isBatchCampaign && campaign.batchSize) {
      const nextBatchIndex = campaign.currentBatchIndex + 1;

      if (nextBatchIndex < campaign.totalBatches) {
        // Hay más lotes, programar el siguiente
        const nextBatchDate = new Date();
        nextBatchDate.setMinutes(nextBatchDate.getMinutes() + (campaign.batchInterval || 0));

        campaign.currentBatchIndex = nextBatchIndex;
        campaign.nextBatchAt = nextBatchDate;
        campaign.status = 'scheduled';

        logger.info(
          `Scheduled next batch ${nextBatchIndex + 1}/${campaign.totalBatches} ` +
          `for ${nextBatchDate.toISOString()} for campaign: ${campaign.name}`
        );
      } else {
        // Todos los lotes enviados
        campaign.status = sentCount > 0 ? 'sent' : 'failed';
        campaign.sentAt = new Date();
        logger.info(`Campaign completed: ${campaign.name}`);
      }
    } else {
      // Campaña normal (no por lotes)
      campaign.status = sentCount > 0 ? 'sent' : 'failed';
      campaign.sentAt = new Date();
    }

    await campaign.save();

  } catch (error) {
    logger.error('Failed to send campaign:', error);
    campaign.status = 'failed';
    await campaign.save();
  }
}