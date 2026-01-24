import { Message, MessageMedia } from "whatsapp-web.js";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";
import prisma from "../database/prisma";
import logger from "../configs/logger.config";
import { formatProductsForWhatsApp } from "../utils/product-formatter.util";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
   try {
      // SIEMPRE obtener productos frescos desde la BD (sin caché)
      logger.info('📊 Comando /precios - Obteniendo catálogo desde la base de datos (datos frescos)...');
      
      const products = await prisma.product.findMany({
         where: { inStock: true },
         orderBy: { createdAt: 'desc' }
      });
      
      // Log detallado de productos obtenidos
      if (products && products.length > 0) {
         const productNames = products.map(p => `${p.name} ($${p.price})`).join(', ');
         logger.info(`📊 Productos obtenidos desde BD (${products.length}): ${productNames}`);
      }
      
      if (products && products.length > 0) {
         // Formatear catálogo para WhatsApp
         const catalogMessage = formatProductsForWhatsApp(products);
         
         // Enviar con imagen de precios
         const media = MessageMedia.fromFilePath("public/precio.png");
         await message.reply(media, null, { caption: catalogMessage });
         
         logger.info(`✅ Catálogo de productos enviado (${products.length} productos) - Datos frescos desde BD`);
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
