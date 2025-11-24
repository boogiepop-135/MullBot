import { Message, MessageMedia } from "whatsapp-web.js";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";
import { BotContentModel } from "../crm/models/bot-content.model";
import logger from "../configs/logger.config";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
   try {
      const contentBlock = await BotContentModel.findOne({ key: 'command_precios' });

      if (!contentBlock) {
         logger.warn('Content block "command_precios" not found');
         await message.reply("Lo siento, no pude obtener la información de precios en este momento. Por favor intenta más tarde.");
         return;
      }

      const media = MessageMedia.fromFilePath(contentBlock.mediaPath || "public/precio.png");

      await message.reply(
         media,
         null,
         { caption: AppConfig.instance.printMessage(contentBlock.content) },
      );
   } catch (error) {
      logger.error('Error in precios command:', error);
      await message.reply("Ocurrió un error al procesar tu solicitud.");
   }
};
