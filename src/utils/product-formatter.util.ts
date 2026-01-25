/**
 * Utility para formatear productos de la base de datos para WhatsApp
 */

import { Product } from '@prisma/client';
import logger from '../configs/logger.config';

export interface FormatCatalogOptions {
    title?: string;
}

/**
 * Formatea el catálogo de productos de la base de datos para WhatsApp
 */
export function formatProductsForWhatsApp(products: Product[], options?: FormatCatalogOptions): string {
    if (products.length === 0) {
        return '❌ No hay productos disponibles en el catálogo en este momento.';
    }

    const title = options?.title ?? 'CATÁLOGO DE PRODUCTOS MÜLLBLUE';
    let message = `🌱 *${title}*\n\n`;

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

/**
 * Formatea información detallada de un producto específico
 */
export function formatProductDetails(product: Product): string {
    let message = `🌱 *${product.name}*\n\n`;
    
    if (product.description && product.description.trim()) {
        let descripcion = product.description
            .replace(/^["']|["']$/g, '')
            .replace(/\n+/g, '\n')
            .trim();
        message += `${descripcion}\n\n`;
    }

    const precio = Math.round(product.price * 100) / 100;
    message += `💰 *Precio:* $${precio.toFixed(2)}\n`;

    if (product.sizes && product.sizes.length > 0) {
        message += `📏 *Tamaños disponibles:* ${product.sizes.join(', ')}\n`;
    }

    if (product.category) {
        message += `📂 *Categoría:* ${product.category}\n`;
    }

    if (product.promotions && product.promotions.trim()) {
        message += `\n✨ *Promociones:*\n${product.promotions}\n`;
    }

    if (product.imageUrl && product.imageUrl.trim()) {
        message += `\n🖼️ [Ver imagen del producto](${product.imageUrl})\n`;
    }

    message += `\n*Estado:* ${product.inStock ? '✅ Disponible' : '❌ Agotado'}\n`;

    message += '\n¿Te interesa este producto? 😊\n\n';
    message += '*1.* 💰 Ver métodos de pago\n';
    message += '*2.* 📦 Información de envío\n';
    message += '*3.* 💬 Hablar con un asesor\n';
    message += '*4.* 📋 Ver otros productos';

    return message;
}

/**
 * Busca un producto por nombre (búsqueda flexible)
 * Si busca "kit" o "kits", prioriza productos con categoría "Kit"
 */
export function findProductByName(products: Product[], searchTerm: string): Product | null {
    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    // Si busca "kit" o "kits", buscar primero por categoría
    if (normalizedSearch === 'kit' || normalizedSearch === 'kits' || normalizedSearch.includes('kit')) {
        // Buscar productos con categoría "Kit" o que tengan "kit" en el nombre
        let kitProduct = products.find(p => 
            p.category?.toLowerCase() === 'kit' ||
            p.name.toLowerCase().includes('kit')
        );
        if (kitProduct) return kitProduct;
    }
    
    // Buscar coincidencia exacta primero
    let product = products.find(p => 
        p.name.toLowerCase() === normalizedSearch ||
        p.name.toLowerCase().includes(normalizedSearch) ||
        normalizedSearch.includes(p.name.toLowerCase())
    );
    
    if (product) return product;
    
    // Buscar por palabras clave en el nombre
    const searchWords = normalizedSearch.split(/\s+/);
    product = products.find(p => {
        const productName = p.name.toLowerCase();
        return searchWords.some(word => productName.includes(word));
    });
    
    return product || null;
}
