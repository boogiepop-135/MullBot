import { google } from 'googleapis';
import logger from '../configs/logger.config';
import EnvConfig from '../configs/env.config';

export interface ProductFromSheet {
    producto: string;
    descripcion: string;
    precio: number;
    precioConDescuento?: number;
    imagenLink?: string;
    disponibilidad: boolean;
}

/**
 * Servicio para leer el catálogo de productos desde Google Sheets
 * 
 * Configuración necesaria:
 * 1. GOOGLE_SHEETS_API_KEY - API Key de Google Cloud Console
 * 2. GOOGLE_SHEETS_SPREADSHEET_ID - ID de la hoja de cálculo (se obtiene de la URL)
 * 3. GOOGLE_SHEETS_RANGE - Rango de celdas (ej: "CatálogoProductosWhatsapp!A1:F100")
 * 
 * La hoja debe tener las siguientes columnas:
 * - Producto
 * - Descripción
 * - Precio
 * - Precio con descuento (opcional)
 * - Imagen Link (opcional)
 * - Disponibilidad (debe decir "Sí", "Si", "true", "1" para estar disponible)
 */
class GoogleSheetsService {
    private sheets: any;
    private isConfigured: boolean = false;

    constructor() {
        this.initialize();
    }

    private initialize() {
        const apiKey = EnvConfig.GOOGLE_SHEETS_API_KEY;
        
        if (!apiKey) {
            logger.warn('⚠️ Google Sheets API Key no configurada. El catálogo de productos no estará disponible desde Google Sheets.');
            logger.warn('Para habilitarlo, configura GOOGLE_SHEETS_API_KEY en tu archivo .env');
            this.isConfigured = false;
            return;
        }

        try {
            this.sheets = google.sheets({
                version: 'v4',
                auth: apiKey
            });
            this.isConfigured = true;
            logger.info('✅ Google Sheets API inicializada correctamente');
        } catch (error) {
            logger.error('❌ Error inicializando Google Sheets API:', error);
            this.isConfigured = false;
        }
    }

    /**
     * Lee el catálogo de productos desde Google Sheets
     * @returns Array de productos con su información
     */
    async getProductCatalog(): Promise<ProductFromSheet[]> {
        if (!this.isConfigured) {
            logger.warn('Google Sheets no está configurado. Retornando catálogo vacío.');
            return [];
        }

        const spreadsheetId = EnvConfig.GOOGLE_SHEETS_SPREADSHEET_ID;
        const range = EnvConfig.GOOGLE_SHEETS_RANGE || 'CatálogoProductosWhatsapp!A:F';

        if (!spreadsheetId) {
            logger.error('❌ GOOGLE_SHEETS_SPREADSHEET_ID no configurado');
            return [];
        }

        try {
            logger.info(`📊 Obteniendo catálogo de productos desde Google Sheets...`);
            logger.debug(`Spreadsheet ID: ${spreadsheetId}, Range: ${range}`);

            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range,
            });

            const rows = response.data.values;
            
            if (!rows || rows.length === 0) {
                logger.warn('⚠️ No se encontraron datos en la hoja de Google Sheets');
                return [];
            }

            // Primera fila son los encabezados
            const headers = rows[0].map((h: string) => {
                // Normalizar: convertir a minúsculas, eliminar espacios extra y caracteres especiales
                return h.toString().toLowerCase().trim().replace(/\s+/g, ' ');
            });
            logger.info(`📊 Encabezados encontrados en Google Sheets: ${headers.join(', ')}`);

            // Encontrar índices de columnas (flexible para diferentes nombres)
            const productoIdx = this.findColumnIndex(headers, [
                'producto', 'product', 'nombre', 'nombre del producto', 'nombre producto', 
                'product name', 'name', 'producto nombre'
            ]);
            const descripcionIdx = this.findColumnIndex(headers, [
                'descripcion', 'descripción', 'description', 'descrip', 'detalle', 'details'
            ]);
            const precioIdx = this.findColumnIndex(headers, [
                'precio', 'price', 'cost', 'costo', 'precio unitario'
            ]);
            const precioDescuentoIdx = this.findColumnIndex(headers, [
                'precio con descuento', 'precio descuento', 'descuento', 'sale price', 
                'precio final', 'precio oferta'
            ]);
            const imagenIdx = this.findColumnIndex(headers, [
                'imagen link', 'imagen', 'image', 'image link', 'url imagen', 'url image',
                'url', 'imagen url', 'image url', 'link', 'link imagen'
            ]);
            const disponibilidadIdx = this.findColumnIndex(headers, [
                'disponibilidad', 'disponible', 'availability', 'stock', 'en stock', 
                'in stock', 'inventario'
            ]);

            logger.info(`📊 Índices de columnas encontrados:`);
            logger.info(`   - Producto: ${productoIdx >= 0 ? `índice ${productoIdx} (${headers[productoIdx]})` : 'NO ENCONTRADO'}`);
            logger.info(`   - Descripción: ${descripcionIdx >= 0 ? `índice ${descripcionIdx} (${headers[descripcionIdx]})` : 'NO ENCONTRADO'}`);
            logger.info(`   - Precio: ${precioIdx >= 0 ? `índice ${precioIdx} (${headers[precioIdx]})` : 'NO ENCONTRADO'}`);
            logger.info(`   - Precio con descuento: ${precioDescuentoIdx >= 0 ? `índice ${precioDescuentoIdx} (${headers[precioDescuentoIdx]})` : 'NO ENCONTRADO (opcional)'}`);
            logger.info(`   - URL Imagen: ${imagenIdx >= 0 ? `índice ${imagenIdx} (${headers[imagenIdx]})` : 'NO ENCONTRADO (opcional)'}`);
            logger.info(`   - Disponibilidad: ${disponibilidadIdx >= 0 ? `índice ${disponibilidadIdx} (${headers[disponibilidadIdx]})` : 'NO ENCONTRADO (opcional)'}`);

            if (productoIdx === -1 || descripcionIdx === -1 || precioIdx === -1) {
                logger.error('❌ No se encontraron las columnas requeridas (Producto, Descripción, Precio)');
                logger.error(`Columnas encontradas en Google Sheets: ${headers.join(', ')}`);
                logger.error('Verifica que las columnas se llamen: "Nombre del producto" o "Producto", "DESCRIPCIÓN" o "Descripción", y "PRECIO" o "Precio"');
                return [];
            }

            // Procesar filas (saltando el encabezado)
            const products: ProductFromSheet[] = [];
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                
                // Validar que la fila tenga datos
                if (!row || row.length === 0 || !row[productoIdx]) {
                    continue;
                }

                try {
                    const producto = row[productoIdx]?.toString().trim();
                    const descripcion = row[descripcionIdx]?.toString().trim() || '';
                    
                    // Parsear precio: remover $, comas, espacios y convertir a número
                    let precioStr = row[precioIdx]?.toString().trim() || '';
                    precioStr = precioStr.replace(/[$,\s]/g, ''); // Remover $, comas y espacios
                    const precio = parseFloat(precioStr);

                    // Validar precio
                    if (isNaN(precio) || precio <= 0) {
                        logger.warn(`⚠️ Fila ${i + 1}: Precio inválido para producto "${producto}" (valor: "${row[precioIdx]}")`);
                        continue;
                    }

                    const product: ProductFromSheet = {
                        producto,
                        descripcion,
                        precio,
                        disponibilidad: true // Por defecto disponible
                    };

                    // Precio con descuento (opcional)
                    if (precioDescuentoIdx !== -1 && row[precioDescuentoIdx]) {
                        let descuentoStr = row[precioDescuentoIdx].toString().trim();
                        descuentoStr = descuentoStr.replace(/[$,\s]/g, ''); // Remover $, comas y espacios
                        const precioConDescuento = parseFloat(descuentoStr);
                        if (!isNaN(precioConDescuento) && precioConDescuento > 0 && precioConDescuento < precio) {
                            product.precioConDescuento = precioConDescuento;
                        }
                    }

                    // Imagen (opcional)
                    if (imagenIdx !== -1 && row[imagenIdx]) {
                        product.imagenLink = row[imagenIdx].toString().trim();
                    }

                    // Disponibilidad (opcional)
                    if (disponibilidadIdx !== -1 && row[disponibilidadIdx]) {
                        const disponible = row[disponibilidadIdx].toString().toLowerCase().trim();
                        product.disponibilidad = ['si', 'sí', 'yes', 'true', '1', 'disponible', 'available'].includes(disponible);
                    }

                    products.push(product);
                } catch (error) {
                    logger.error(`❌ Error procesando fila ${i + 1}:`, error);
                }
            }

            logger.info(`✅ Se obtuvieron ${products.length} productos del catálogo`);
            return products;

        } catch (error: any) {
            if (error.code === 403) {
                logger.error('❌ Error 403: Acceso denegado a Google Sheets. Verifica:');
                logger.error('   1. Que tu API Key sea válida');
                logger.error('   2. Que Google Sheets API esté habilitada en tu proyecto');
                logger.error('   3. Que la hoja de cálculo sea pública o compartida');
            } else if (error.code === 404) {
                logger.error('❌ Error 404: Hoja de cálculo no encontrada. Verifica el SPREADSHEET_ID');
            } else {
                logger.error('❌ Error obteniendo datos de Google Sheets:', error);
            }
            return [];
        }
    }

    /**
     * Busca el índice de una columna por varios nombres posibles
     * Más flexible: busca palabras completas o parciales, ignorando mayúsculas/minúsculas
     */
    private findColumnIndex(headers: string[], possibleNames: string[]): number {
        for (const name of possibleNames) {
            const nameLower = name.toLowerCase().trim();
            
            // Buscar coincidencia exacta
            let index = headers.findIndex(h => h === nameLower);
            if (index !== -1) {
                logger.debug(`✅ Columna encontrada (exacta): "${nameLower}" en índice ${index}`);
                return index;
            }
            
            // Buscar si contiene la palabra (coincidencia parcial)
            index = headers.findIndex(h => {
                // Normalizar ambos strings para comparación más flexible
                const hNormalized = h.replace(/[^\w\s]/g, '').toLowerCase();
                const nameNormalized = nameLower.replace(/[^\w\s]/g, '');
                
                // Buscar si el header contiene todas las palabras del nombre buscado
                const nameWords = nameNormalized.split(/\s+/);
                return nameWords.every(word => hNormalized.includes(word)) || hNormalized.includes(nameNormalized);
            });
            
            if (index !== -1) {
                logger.debug(`✅ Columna encontrada (parcial): "${nameLower}" en índice ${index} (header: "${headers[index]}")`);
                return index;
            }
            
            // Buscar palabras individuales si el nombre tiene múltiples palabras
            if (nameLower.includes(' ')) {
                const words = nameLower.split(/\s+/);
                for (const word of words) {
                    if (word.length > 3) { // Solo buscar palabras de más de 3 caracteres
                        index = headers.findIndex(h => h.includes(word));
                        if (index !== -1) {
                            logger.debug(`✅ Columna encontrada (palabra clave): "${word}" en índice ${index} (header: "${headers[index]}")`);
                            return index;
                        }
                    }
                }
            }
        }
        return -1;
    }

    /**
     * Formatea el catálogo de productos para WhatsApp
     */
    formatCatalogForWhatsApp(products: ProductFromSheet[]): string {
        if (products.length === 0) {
            return '❌ No hay productos disponibles en el catálogo en este momento.';
        }

        let message = '🌱 *CATÁLOGO DE PRODUCTOS MÜLLBLUE*\n\n';

        // Filtrar solo productos disponibles
        const availableProducts = products.filter(p => p.disponibilidad);

        availableProducts.forEach((product, index) => {
            message += `*${index + 1}. ${product.producto}*\n`;
            
            if (product.descripcion && product.descripcion.trim()) {
                // Limpiar la descripción (remover comillas y caracteres especiales)
                let descripcion = product.descripcion
                    .replace(/^["']|["']$/g, '') // Remover comillas al inicio/fin
                    .replace(/\n+/g, '\n') // Normalizar saltos de línea
                    .trim();
                message += `${descripcion}\n`;
            }

            // Mostrar precio formateado correctamente
            if (product.precioConDescuento && product.precioConDescuento < product.precio && product.precioConDescuento > 0) {
                const precioOriginal = Math.round(product.precio * 100) / 100;
                const precioDescuento = Math.round(product.precioConDescuento * 100) / 100;
                message += `💰 Precio: ~$${precioOriginal.toFixed(2)}~ *$${precioDescuento.toFixed(2)}*\n`;
                const ahorro = precioOriginal - precioDescuento;
                const porcentaje = Math.round((ahorro / precioOriginal) * 100);
                message += `✨ ¡Ahorra $${ahorro.toFixed(2)} (${porcentaje}% off)!\n`;
            } else {
                const precio = Math.round(product.precio * 100) / 100;
                message += `💰 Precio: *$${precio.toFixed(2)}*\n`;
            }

            // Agregar URL de imagen si está disponible
            if (product.imagenLink && product.imagenLink.trim()) {
                message += `🖼️ [Ver imagen](${product.imagenLink})\n`;
            }

            message += '\n';
        });

        message += '_Los precios se actualizan en tiempo real desde Google Sheets_ ✨\n\n';
        message += '¿Te gustaría más información sobre algún producto? 😊\n\n';
        message += '*Opciones:*\n';
        message += '*1.* Información detallada de un producto\n';
        message += '*2.* Métodos de pago\n';
        message += '*3.* Hablar con un asesor';

        return message;
    }
}

// Singleton
export const googleSheetsService = new GoogleSheetsService();
