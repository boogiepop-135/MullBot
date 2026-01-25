/**
 * Construye el contexto del CRM para la IA.
 * Toda la información que use el bot debe provenir de aquí.
 */

import prisma from '../database/prisma';
import logger from '../configs/logger.config';

const NO_INFO_MESSAGE = `No cuento con esa información en este momento. ¿Te gustaría que te pase con un asesor para resolver tu duda? Escribe *8* 😊`;

/**
 * Construye el bloque de texto "INFORMACIÓN DEL CRM" para inyectar en el prompt de la IA.
 * Incluye BotConfig, BotContent y lista de productos (nombre/descripción, sin precios).
 */
export async function buildCrmContextForAI(): Promise<string> {
    const sections: string[] = [];

    try {
        const [config, contents, products] = await Promise.all([
            prisma.botConfig.findFirst(),
            prisma.botContent.findMany({ orderBy: { key: 'asc' } }),
            prisma.product.findMany({
                where: { inStock: true },
                orderBy: { createdAt: 'desc' },
                select: { name: true, description: true, category: true }
            })
        ]);

        // --- BotConfig ---
        if (config) {
            const configLines: string[] = [
                `*Negocio:* ${config.businessName || 'Sin nombre'}`,
                `*Descripción:* ${config.businessDescription || 'Sin descripción'}`,
                `*Horario de atención:* ${config.businessHours || 'No especificado'}`,
                `*Teléfono:* ${config.businessPhone || 'No especificado'}`,
                `*Email:* ${config.businessEmail || 'No especificado'}`,
                `*Dirección:* ${config.businessAddress || 'No especificada'}`,
                `*Web:* ${config.businessWebsite || 'No especificada'}`,
                `*Redes:* Facebook ${config.socialFacebook || '-'} | Instagram ${config.socialInstagram || '-'} | TikTok ${config.socialTiktok || '-'}`
            ];
            if (config.bankInfo && config.bankInfo.trim()) {
                configLines.push(`*Información bancaria / pagos:*\n${config.bankInfo.trim()}`);
            }
            sections.push('--- *CONFIGURACIÓN DEL NEGOCIO (BotConfig)* ---\n' + configLines.join('\n'));
        } else {
            sections.push('--- *CONFIGURACIÓN DEL NEGOCIO* ---\nNo hay configuración en el CRM.');
        }

        // --- BotContent ---
        if (contents.length > 0) {
            const contentLines = contents.map(c => `[${c.key}]\n${(c.content || '').trim()}`).join('\n\n');
            sections.push('--- *CONTENIDO DEL BOT (BotContent)* ---\n' + contentLines);
        } else {
            sections.push('--- *CONTENIDO DEL BOT* ---\nNo hay contenidos configurados en el CRM.');
        }

        // --- Productos (solo nombre/descripción; precios se muestran por catálogo) ---
        if (products.length > 0) {
            const productLines = products.map(p => {
                const cat = p.category ? ` [${p.category}]` : '';
                const desc = p.description?.trim() ? ` - ${p.description.replace(/\n/g, ' ').slice(0, 120)}` : '';
                return `- ${p.name}${cat}${desc}`;
            });
            sections.push('--- *PRODUCTOS EN CATÁLOGO (solo referencia; precios en BD)* ---\n' + productLines.join('\n'));
        } else {
            sections.push('--- *PRODUCTOS* ---\nNo hay productos en el catálogo.');
        }

        return sections.join('\n\n');
    } catch (e) {
        logger.error('Error construyendo contexto CRM para IA:', e);
        return '--- *ERROR AL CARGAR CRM* ---\nNo se pudo obtener información del CRM. Solo ofrece pasar con un asesor.';
    }
}

/**
 * Mensaje estándar cuando no se tiene la información solicitada.
 * Usado por la IA y como fallback en código.
 */
export function getNoInfoMessage(): string {
    return NO_INFO_MESSAGE;
}
