import { Message, MessageMedia } from "whatsapp-web.js";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";
import prisma from "../database/prisma";
import logger from "../configs/logger.config";
import { googleSheetsService } from "../utils/google-sheets.util";
import EnvConfig from "../configs/env.config";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
   try {
      // Intentar obtener catálogo desde Google Sheets si está configurado
      const useGoogleSheets = !!EnvConfig.GOOGLE_SHEETS_API_KEY && !!EnvConfig.GOOGLE_SHEETS_SPREADSHEET_ID;
      
      if (useGoogleSheets) {
         logger.info('📊 Obteniendo catálogo desde Google Sheets...');
         
         try {
            const products = await googleSheetsService.getProductCatalog();
            
            if (products && products.length > 0) {
               // Formatear catálogo para WhatsApp
               const catalogMessage = googleSheetsService.formatCatalogForWhatsApp(products);
               
               // Enviar con imagen de precios
               const media = MessageMedia.fromFilePath("public/precio.png");
               await message.reply(media, null, { caption: catalogMessage });
               
               logger.info(`✅ Catálogo de Google Sheets enviado (${products.length} productos)`);
               return;
            } else {
               logger.warn('⚠️ Google Sheets no retornó productos, usando catálogo estático');
            }
         } catch (error) {
            logger.error('❌ Error obteniendo catálogo de Google Sheets:', error);
            logger.info('Fallback: usando catálogo estático de la base de datos');
         }
      }

      // Fallback: usar catálogo estático de la base de datos
      const contentBlock = await prisma.botContent.findUnique({ where: { key: 'command_precios' } });

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
