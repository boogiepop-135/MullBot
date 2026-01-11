/**
 * Utility para formatear productos de la base de datos para WhatsApp
 */

import { Product } from '@prisma/client';
import logger from '../configs/logger.config';

/**
 * Formatea el catálogo de productos de la base de datos para WhatsApp
 */
export function formatProductsForWhatsApp(products: Product[]): string {
    if (products.length === 0) {
        return '❌ No hay productos disponibles en el catálogo en este momento.';
    }

    let message = '🌱 *CATÁLOGO DE PRODUCTOS MÜLLBLUE*\n\n';

    // Filtrar solo productos disponibles
    const availableProducts = products.filter(p => p.inStock);

    availableProducts.forEach((product, index) => {
        message += `*${index + 1}. ${product.name}*\n`;
        
        if (product.description && product.description.trim()) {
            // Limpiar la descripción (remover comillas y caracteres especiales)
            let descripcion = product.description
                .replace(/^["']|["']$/g, '') // Remover comillas al inicio/fin
                .replace(/\n+/g, '\n') // Normalizar saltos de línea
                .trim();
            message += `${descripcion}\n`;
        }

        // Mostrar precio formateado correctamente
        const precio = Math.round(product.price * 100) / 100;
        message += `💰 Precio: *$${precio.toFixed(2)}*\n`;

        // Agregar tamaños si están disponibles
        if (product.sizes && product.sizes.length > 0) {
            message += `📏 Tamaños: ${product.sizes.join(', ')}\n`;
        }

        // Agregar promociones si están disponibles
        if (product.promotions && product.promotions.trim()) {
            message += `✨ ${product.promotions}\n`;
        }

        // Agregar URL de imagen si está disponible
        if (product.imageUrl && product.imageUrl.trim()) {
            message += `🖼️ [Ver imagen](${product.imageUrl})\n`;
        }

        message += '\n';
    });

    message += '¿Te gustaría más información sobre algún producto? 😊\n\n';
    message += '*Opciones:*\n';
    message += '*1.* Información detallada de un producto\n';
    message += '*2.* Métodos de pago\n';
    message += '*3.* Hablar con un asesor';

    return message;
}
