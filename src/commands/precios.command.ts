import { Message, MessageMedia } from "whatsapp-web.js";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";
import prisma from "../database/prisma";
import logger from "../configs/logger.config";
import { formatProductsForWhatsApp } from "../utils/product-formatter.util";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
   try {
      // Obtener productos desde la base de datos
      logger.info('📊 Obteniendo catálogo desde la base de datos...');
      
      const products = await prisma.product.findMany({
         where: { inStock: true },
         orderBy: { createdAt: 'desc' }
      });
      
      if (products && products.length > 0) {
         // Formatear catálogo para WhatsApp
         const catalogMessage = formatProductsForWhatsApp(products);
         
         // Enviar con imagen de precios
         const media = MessageMedia.fromFilePath("public/precio.png");
         await message.reply(media, null, { caption: catalogMessage });
         
         logger.info(`✅ Catálogo de productos enviado (${products.length} productos)`);
         return;
      } else {
         logger.warn('⚠️ No hay productos disponibles en la base de datos');
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
