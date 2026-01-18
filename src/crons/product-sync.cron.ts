import { CronJob } from "cron";
import logger from "../configs/logger.config";
import prisma from "../database/prisma";
import EnvConfig from "../configs/env.config";

/**
 * Sincroniza productos desde Google Sheets automáticamente
 * Se ejecuta cada hora (configurable)
 */
export async function syncProductsFromSheets() {
    try {
        // Verificar que Google Sheets esté configurado
        if (!EnvConfig.GOOGLE_SHEETS_API_KEY || !EnvConfig.GOOGLE_SHEETS_SPREADSHEET_ID) {
            logger.warn('⚠️ Google Sheets no está configurado. Saltando sincronización automática.');
            return;
        }

        logger.info('📥 Iniciando sincronización automática de productos desde Google Sheets...');

        // Importar servicio de Google Sheets
        const { googleSheetsService } = await import('../utils/google-sheets.util');
        
        // Obtener productos desde Google Sheets
        const productsFromSheets = await googleSheetsService.getProductCatalog();

        if (!productsFromSheets || productsFromSheets.length === 0) {
            logger.warn('⚠️ No se encontraron productos en Google Sheets.');
            return;
        }

        let created = 0;
        let updated = 0;
        let deleted = 0;
        let errors = 0;

        // Obtener todos los productos existentes en la BD
        const existingProducts = await prisma.product.findMany();
        const productNamesFromSheets = new Set(
            productsFromSheets.map(p => p.producto.toLowerCase().trim())
        );

        // Sincronizar cada producto desde Google Sheets
        for (const sheetProduct of productsFromSheets) {
            try {
                // Buscar si ya existe un producto con el mismo nombre
                const existingProduct = await prisma.product.findFirst({
                    where: {
                        name: {
                            equals: sheetProduct.producto,
                            mode: 'insensitive'
                        }
                    }
                });

                const productData = {
                    name: sheetProduct.producto,
                    description: sheetProduct.descripcion || null,
                    price: sheetProduct.precio,
                    inStock: sheetProduct.disponibilidad,
                    imageUrl: sheetProduct.imagenLink || null,
                    category: null
                };

                if (existingProduct) {
                    // Actualizar producto existente
                    await prisma.product.update({
                        where: { id: existingProduct.id },
                        data: productData
                    });
                    updated++;
                } else {
                    // Crear nuevo producto
                    await prisma.product.create({
                        data: productData
                    });
                    created++;
                }
            } catch (error: any) {
                logger.error(`Error sincronizando producto "${sheetProduct.producto}":`, error);
                errors++;
            }
        }

        // Eliminar productos que ya no están en Google Sheets
        for (const existingProduct of existingProducts) {
            const productNameLower = existingProduct.name.toLowerCase().trim();
            if (!productNamesFromSheets.has(productNameLower)) {
                try {
                    await prisma.product.delete({
                        where: { id: existingProduct.id }
                    });
                    deleted++;
                    logger.info(`🗑️ Producto eliminado (no encontrado en Google Sheets): ${existingProduct.name}`);
                } catch (error: any) {
                    logger.error(`Error eliminando producto "${existingProduct.name}":`, error);
                    errors++;
                }
            }
        }

        logger.info(`✅ Sincronización automática completada: ${created} creados, ${updated} actualizados, ${deleted} eliminados, ${errors} errores`);
    } catch (error: any) {
        logger.error('❌ Error en sincronización automática de productos:', error);
    }
}

/**
 * Inicializa el cron job para sincronización automática de productos
 * Se ejecuta cada hora (puede configurarse)
 */
export function initProductSyncCron() {
    // Sincronizar cada hora (minuto 0 de cada hora)
    // Puedes cambiar "0 * * * *" por otra expresión cron según necesites
    new CronJob(
        "0 * * * *", // Cada hora en el minuto 0
        syncProductsFromSheets,
        null,
        true,
        "America/Mexico_City"
    );
    logger.info("📅 Cron job de sincronización de productos inicializado (cada hora)");
}
