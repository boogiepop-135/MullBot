import { BotManager } from '../../bot.manager';
import logger from '../../configs/logger.config';
import { AutomationModel } from '../models/automation.model';
import { ContactModel } from '../models/contact.model';
import { NotificationModel } from '../models/notification.model';

export class AutomationService {
  /**
   * Ejecutar automatizaciones basadas en cambio de estado
   */
  static async triggerStatusChangeAutomations(
    botManager: BotManager,
    phoneNumber: string,
    fromStatus: string,
    toStatus: string
  ) {
    try {
      const automations = await AutomationModel.find({
        isActive: true,
        triggerType: 'status_change',
        $or: [
          { 'triggerConditions.toStatus': toStatus },
          { 'triggerConditions.fromStatus': fromStatus, 'triggerConditions.toStatus': toStatus }
        ]
      });

      for (const automation of automations) {
        await this.executeAutomation(botManager, automation, phoneNumber);
      }
    } catch (error) {
      logger.error('Error triggering status change automations:', error);
    }
  }

  /**
   * Ejecutar automatizaciones basadas en mensaje recibido
   */
  static async triggerMessageReceivedAutomations(
    botManager: BotManager,
    phoneNumber: string,
    message: string
  ) {
    try {
      const automations = await AutomationModel.find({
        isActive: true,
        triggerType: 'message_received'
      });

      for (const automation of automations) {
        // Verificar si el mensaje contiene las palabras clave
        const keywords = automation.triggerConditions.messageContains || [];
        const messageContainsKeyword = keywords.some(keyword =>
          message.toLowerCase().includes(keyword.toLowerCase())
        );

        if (messageContainsKeyword) {
          await this.executeAutomation(botManager, automation, phoneNumber);
        }
      }
    } catch (error) {
      logger.error('Error triggering message received automations:', error);
    }
  }

  /**
   * Ejecutar automatizaciones basadas en tags
   */
  static async triggerTagAddedAutomations(
    botManager: BotManager,
    phoneNumber: string,
    tag: string
  ) {
    try {
      const automations = await AutomationModel.find({
        isActive: true,
        triggerType: 'tag_added',
        'triggerConditions.tags': tag
      });

      for (const automation of automations) {
        await this.executeAutomation(botManager, automation, phoneNumber);
      }
    } catch (error) {
      logger.error('Error triggering tag added automations:', error);
    }
  }

  /**
   * Ejecutar una automatización
   */
  private static async executeAutomation(
    botManager: BotManager,
    automation: any,
    phoneNumber: string
  ) {
    try {
      logger.info(`Executing automation "${automation.name}" for ${phoneNumber}`);

      for (const action of automation.actions) {
        switch (action.type) {
          case 'send_message':
            const formattedNumber = phoneNumber.replace(/@[cg]\.us$/, '');
            await botManager.sendMessage(formattedNumber, action.value);
            break;

          case 'change_status':
            await ContactModel.findOneAndUpdate(
              { phoneNumber },
              { $set: { saleStatus: action.value } }
            );
            break;

          case 'add_tag':
            await ContactModel.findOneAndUpdate(
              { phoneNumber },
              { $addToSet: { tags: action.value } }
            );
            break;

          case 'pause_bot':
            await ContactModel.findOneAndUpdate(
              { phoneNumber },
              { $set: { isPaused: true } }
            );
            break;

          case 'create_notification':
            await NotificationModel.create({
              type: 'automation',
              message: action.value,
              phoneNumber,
              isRead: false
            });
            break;
        }
      }

      // Actualizar estadísticas de la automatización
      automation.lastTriggered = new Date();
      automation.triggerCount += 1;
      await automation.save();

    } catch (error) {
      logger.error(`Error executing automation "${automation.name}":`, error);
    }
  }
}
