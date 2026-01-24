import { Message, MessageMedia } from "whatsapp-web.js";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";
import SalesTracker from "../utils/sales-tracker.util";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
    const chat = await message.getChat();
    
    // Obtener estadísticas de ventas (ahora es asíncrono)
    const stats = await SalesTracker.getSalesStats();
    
    const estadisticas = `
📊 *ESTADÍSTICAS DE VENTAS MÜLLBLUE*

*RESUMEN GENERAL* 📈
👥 Contactos únicos: ${stats.uniqueContacts}
💬 Total de interacciones: ${stats.totalInteractions}
📱 Promedio por contacto: ${stats.uniqueContacts > 0 ? Math.round(stats.totalInteractions / stats.uniqueContacts) : 0}

*INTENCIONES DETECTADAS* 🎯
${Object.entries(stats.intentCounts)
    .map(([intent, count]) => {
        const emoji = {
            'info': 'ℹ️',
            'price': '💰',
            'product': '📦',
            'payment': '💳',
            'purchase': '🛒',
            'objection': '❓',
            'other': '💬'
        }[intent] || '💬';
        return `${emoji} ${intent}: ${count}`;
    })
    .join('\n')}

*TOP LEADS* 🏆
${stats.topLeads.map((lead, index) => 
    `${index + 1}. ${lead.name || lead.phoneNumber.slice(-4)} - Score: ${lead.leadScore} | Engagement: ${(lead.engagementScore * 100).toFixed(0)}% | Conversión: ${(lead.conversionProbability * 100).toFixed(0)}%`
).join('\n')}

*ANÁLISIS DE CONVERSIÓN* 📊
💰 Consultas de precio: ${stats.intentCounts.price || 0}
🛒 Intenciones de compra: ${stats.intentCounts.purchase || 0}
💳 Consultas de pago: ${stats.intentCounts.payment || 0}

*ÚLTIMA ACTUALIZACIÓN* ⏰
${new Date().toLocaleString('es-MX')}

¿Te gustaría ver más detalles sobre algún lead específico? 🌱
`;

    const media = MessageMedia.fromFilePath(AppConfig.instance.getBotAvatar("excited"));
    await message.reply(
        media,
        null,
        { sendVideoAsGif: true, caption: AppConfig.instance.printMessage(estadisticas) },
    );
};
