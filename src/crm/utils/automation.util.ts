import { BotManager } from '../../bot.manager';
import logger from '../../configs/logger.config';
import prisma from '../../database/prisma';
import { AutomationTrigger, NotificationType, SaleStatus } from '@prisma/client';

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
      // Obtener todas las automatizaciones activas de tipo status_change y filtrar en memoria
      // Prisma no soporta queries complejas en JSON fields directamente
      const allAutomations = await prisma.automation.findMany({
        where: {
          isActive: true,
          triggerType: AutomationTrigger.STATUS_CHANGE
        }
      });

      // Filtrar manualmente por condiciones JSON
      // Los estados pueden venir como enum o como string, normalizar para comparación
      const automations = allAutomations.filter(automation => {
        const conditions = automation.triggerConditions as any;
        const condToStatus = conditions?.toStatus;
        const condFromStatus = conditions?.fromStatus;
        // Comparar como strings para manejar tanto enums como strings
        const matchesToStatus = condToStatus?.toString() === toStatus.toString();
        const matchesFromAndTo = condFromStatus?.toString() === fromStatus.toString() && condToStatus?.toString() === toStatus.toString();
        return matchesToStatus || matchesFromAndTo;
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
      const automations = await prisma.automation.findMany({
        where: {
          isActive: true,
          triggerType: AutomationTrigger.MESSAGE_RECEIVED
        }
      });

      for (const automation of automations) {
        // Verificar si el mensaje contiene las palabras clave
        const conditions = automation.triggerConditions as any;
        const keywords = conditions?.messageContains || [];
        const messageContainsKeyword = keywords.some((keyword: string) =>
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
      // Obtener todas las automatizaciones activas de tipo tag_added y filtrar en memoria
      const allAutomations = await prisma.automation.findMany({
        where: {
          isActive: true,
          triggerType: AutomationTrigger.TAG_ADDED
        }
      });

      // Filtrar manualmente por tags en JSON
      const automations = allAutomations.filter(automation => {
        const conditions = automation.triggerConditions as any;
        const tags = conditions?.tags || [];
        return Array.isArray(tags) && tags.includes(tag);
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
            await prisma.contact.update({
              where: { phoneNumber },
              data: { saleStatus: action.value.toUpperCase().replace('-', '_') as SaleStatus }
            });
            break;

          case 'add_tag':
            const contact = await prisma.contact.findUnique({ where: { phoneNumber } });
            if (contact && !contact.tags.includes(action.value)) {
              await prisma.contact.update({
                where: { phoneNumber },
                data: { tags: [...contact.tags, action.value] }
              });
            }
            break;

          case 'pause_bot':
            await prisma.contact.update({
              where: { phoneNumber },
              data: { isPaused: true }
            });
            break;

          case 'create_notification':
            const contactForNotif = await prisma.contact.findUnique({ where: { phoneNumber } });
            if (contactForNotif) {
              await prisma.notification.create({
                data: {
                  type: NotificationType.APPOINTMENT_REQUEST,
                  phoneNumber,
                  contactId: contactForNotif.id,
                  message: action.value,
                  read: false
                }
              });
            }
            break;
        }
      }

      // Actualizar estadísticas de la automatización
      await prisma.automation.update({
        where: { id: automation.id },
        data: {
          lastTriggered: new Date(),
          triggerCount: { increment: 1 }
        }
      });

    } catch (error) {
      logger.error(`Error executing automation "${automation.name}":`, error);
    }
  }
}
