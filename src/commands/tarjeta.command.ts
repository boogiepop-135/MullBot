import { Message, MessageMedia } from "whatsapp-web.js";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";
import prisma from "../database/prisma";
import logger from "../configs/logger.config";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
    const chat = await message.getChat();
    
    // Obtener precio desde la base de datos (producto más caro disponible o kit completo)
    let precio = 1490; // Fallback por defecto
    try {
        const products = await prisma.product.findMany({
            where: { inStock: true },
            orderBy: { price: 'desc' },
            take: 1
        });
        
        if (products && products.length > 0) {
            precio = Math.round(products[0].price);
            logger.info(`✅ Precio obtenido desde BD para comando /tarjeta: $${precio}`);
        } else {
            logger.warn('⚠️ No hay productos en BD para /tarjeta, usando precio por defecto');
        }
    } catch (error) {
        logger.error('Error obteniendo precio para /tarjeta:', error);
    }
    
    const tarjeta = `
💳 *PAGO CON TARJETA DE CRÉDITO* 💳

*INFORMACIÓN DEL PAGO* 💰
💵 *Monto:* $${precio} MXN
💳 *A 3 meses sin intereses*
🔒 *Pago 100% seguro*
📱 *Procesado por Mercado Pago*

*¡HAZ CLIC AQUÍ PARA PAGAR!* 👆
https://mpago.li/1W2JhS5

*PROCESO DE PAGO* 📋
1️⃣ Haz clic en el enlace de arriba
2️⃣ Completa tus datos de tarjeta
3️⃣ Confirma el pago
4️⃣ Recibe confirmación inmediata
5️⃣ Envía comprobante por WhatsApp

*BENEFICIOS* ✅
✅ Pago seguro y protegido
✅ Confirmación inmediata
✅ Envío gratis incluido
✅ Acompañamiento personalizado

*CONTACTO POST-PAGO* 📱
📞 WhatsApp: +52 56 6453 1621
📧 Email: mullblue.residuos@gmail.com

¿Tienes alguna duda sobre el proceso de pago? ¿Necesitas ayuda con algún paso? 🌱
`;

    const media = MessageMedia.fromFilePath("public/como-comprar.png");
    await message.reply(
        media,
        null,
        { caption: AppConfig.instance.printMessage(tarjeta) },
    );
};
