/**
 * Product Service - Servicio centralizado para operaciones con productos
 * 
 * Centraliza la lógica de obtención y formateo de productos para evitar duplicación
 */

import prisma from '../database/prisma';
import logger from '../configs/logger.config';
import { formatProductsForWhatsApp, findProductByName, formatProductDetails } from '../utils/product-formatter.util';

export class ProductService {
    /**
     * Obtener todos los productos disponibles (en stock)
     */
    static async getAvailableProducts() {
        try {
            const products = await prisma.product.findMany({
                where: { inStock: true },
                orderBy: { createdAt: 'desc' }
            });
            
            if (products && products.length > 0) {
                const productNames = products.map(p => `${p.name} ($${p.price})`).join(', ');
                logger.debug(`📊 Productos obtenidos desde BD (${products.length}): ${productNames}`);
            }
            
            return products;
        } catch (error) {
            logger.error('Error obteniendo productos disponibles:', error);
            return [];
        }
    }

    /**
     * Obtener catálogo formateado para WhatsApp
     */
    static async getCatalogMessage(): Promise<{ message: string; hasProducts: boolean }> {
        try {
            const products = await this.getAvailableProducts();
            
            if (products.length > 0) {
                const catalogMessage = formatProductsForWhatsApp(products);
                return { message: catalogMessage, hasProducts: true };
            }
            
            return { message: '', hasProducts: false };
        } catch (error) {
            logger.error('Error obteniendo catálogo:', error);
            return { message: '', hasProducts: false };
        }
    }

    /**
     * Buscar producto por nombre (fuzzy match)
     */
    static async findProductByName(productName: string) {
        try {
            const products = await this.getAvailableProducts();
            return findProductByName(products, productName);
        } catch (error) {
            logger.error('Error buscando producto por nombre:', error);
            return null;
        }
    }

    /**
     * Obtener detalles formateados de un producto
     */
    static formatProductDetails(product: any): string {
        return formatProductDetails(product);
    }
}
