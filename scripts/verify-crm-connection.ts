/**
 * Script de verificación de conexión entre el Bot y el CRM
 * Verifica que el bot esté correctamente conectado a:
 * - Productos de la base de datos
 * - Contenidos personalizados (BotContent)
 */

import prisma from '../src/database/prisma';
import logger from '../src/configs/logger.config';

interface VerificationResult {
    name: string;
    status: 'OK' | 'WARNING' | 'ERROR';
    message: string;
    details?: any;
}

async function verifyProductsConnection(): Promise<VerificationResult> {
    try {
        const products = await prisma.product.findMany();
        const availableProducts = products.filter(p => p.inStock);
        
        if (products.length === 0) {
            return {
                name: 'Productos en Base de Datos',
                status: 'WARNING',
                message: 'No hay productos registrados en la base de datos',
                details: { total: 0, available: 0 }
            };
        }
        
        return {
            name: 'Productos en Base de Datos',
            status: 'OK',
            message: `${products.length} productos encontrados (${availableProducts.length} disponibles)`,
            details: {
                total: products.length,
                available: availableProducts.length,
                products: products.map(p => ({ name: p.name, inStock: p.inStock, price: p.price }))
            }
        };
    } catch (error) {
        return {
            name: 'Productos en Base de Datos',
            status: 'ERROR',
            message: `Error al consultar productos: ${error.message}`,
            details: { error: error.toString() }
        };
    }
}

async function verifyBotContentConnection(): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];
    
    // Verificar contenidos clave que el bot debe usar
    const requiredKeys = [
        'main_menu',
        'option_1_process',
        'option_2_price',
        'option_8_agent',
        'catalogo_mullblue' // Opcional pero recomendado
    ];
    
    for (const key of requiredKeys) {
        try {
            const content = await prisma.botContent.findUnique({ where: { key } });
            
            if (content) {
                results.push({
                    name: `BotContent: ${key}`,
                    status: 'OK',
                    message: `Contenido encontrado (${content.content.length} caracteres)`,
                    details: {
                        key: content.key,
                        description: content.description,
                        category: content.category,
                        hasMedia: !!content.mediaPath,
                        contentPreview: content.content.substring(0, 100) + '...'
                    }
                });
            } else {
                const isRequired = key !== 'catalogo_mullblue';
                results.push({
                    name: `BotContent: ${key}`,
                    status: isRequired ? 'WARNING' : 'OK',
                    message: isRequired 
                        ? `⚠️ Contenido no encontrado - el bot usará fallback`
                        : `ℹ️ Contenido opcional no encontrado`,
                    details: { key, isRequired }
                });
            }
        } catch (error) {
            results.push({
                name: `BotContent: ${key}`,
                status: 'ERROR',
                message: `Error al consultar: ${error.message}`,
                details: { key, error: error.toString() }
            });
        }
    }
    
    // Verificar todos los contenidos disponibles
    try {
        const allContents = await prisma.botContent.findMany();
        results.push({
            name: 'Total BotContent',
            status: 'OK',
            message: `${allContents.length} contenidos personalizados en total`,
            details: {
                total: allContents.length,
                keys: allContents.map(c => c.key),
                categories: allContents.reduce((acc, c) => {
                    acc[c.category] = (acc[c.category] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>)
            }
        });
    } catch (error) {
        results.push({
            name: 'Total BotContent',
            status: 'ERROR',
            message: `Error al consultar todos los contenidos: ${error.message}`,
            details: { error: error.toString() }
        });
    }
    
    return results;
}

async function verifyQuickResponsesUtil(): Promise<VerificationResult> {
    try {
        // Verificar que las funciones de quick-responses puedan acceder a la BD
        const { getMainMenuResponse, getOptionResponse, getAgentResponse, getCatalogResponse } = 
            await import('../src/utils/quick-responses.util');
        
        const mainMenu = await getMainMenuResponse();
        const option1 = await getOptionResponse(1);
        const agentResponse = await getAgentResponse();
        const catalogResponse = await getCatalogResponse();
        
        return {
            name: 'Quick Responses Util',
            status: 'OK',
            message: 'Funciones de quick-responses funcionando correctamente',
            details: {
                mainMenuLength: mainMenu.length,
                option1Found: !!option1,
                agentResponseLength: agentResponse.length,
                catalogResponseFound: !!catalogResponse
            }
        };
    } catch (error) {
        return {
            name: 'Quick Responses Util',
            status: 'ERROR',
            message: `Error al verificar quick-responses: ${error.message}`,
            details: { error: error.toString() }
        };
    }
}

async function verifyProductFormatterUtil(): Promise<VerificationResult> {
    try {
        const { formatProductsForWhatsApp } = await import('../src/utils/product-formatter.util');
        
        // Obtener productos de prueba
        const products = await prisma.product.findMany({ take: 2 });
        
        if (products.length > 0) {
            const formatted = formatProductsForWhatsApp(products);
            return {
                name: 'Product Formatter Util',
                status: 'OK',
                message: 'Función de formateo de productos funcionando',
                details: {
                    productsFormatted: products.length,
                    formattedLength: formatted.length,
                    preview: formatted.substring(0, 150) + '...'
                }
            };
        } else {
            return {
                name: 'Product Formatter Util',
                status: 'WARNING',
                message: 'No hay productos para probar el formateo',
                details: {}
            };
        }
    } catch (error) {
        return {
            name: 'Product Formatter Util',
            status: 'ERROR',
            message: `Error al verificar formateo: ${error.message}`,
            details: { error: error.toString() }
        };
    }
}

async function main() {
    console.log('\n🔍 Verificando conexión Bot-CRM...\n');
    console.log('='.repeat(60));
    
    const allResults: VerificationResult[] = [];
    
    // Verificar productos
    console.log('\n📦 Verificando Productos...');
    const productsResult = await verifyProductsConnection();
    allResults.push(productsResult);
    console.log(`  ${productsResult.status === 'OK' ? '✅' : productsResult.status === 'WARNING' ? '⚠️' : '❌'} ${productsResult.name}: ${productsResult.message}`);
    
    // Verificar BotContent
    console.log('\n📝 Verificando Contenidos Personalizados (BotContent)...');
    const botContentResults = await verifyBotContentConnection();
    allResults.push(...botContentResults);
    botContentResults.forEach(result => {
        console.log(`  ${result.status === 'OK' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌'} ${result.name}: ${result.message}`);
    });
    
    // Verificar utilidades
    console.log('\n🔧 Verificando Utilidades...');
    const quickResponsesResult = await verifyQuickResponsesUtil();
    allResults.push(quickResponsesResult);
    console.log(`  ${quickResponsesResult.status === 'OK' ? '✅' : quickResponsesResult.status === 'WARNING' ? '⚠️' : '❌'} ${quickResponsesResult.name}: ${quickResponsesResult.message}`);
    
    const formatterResult = await verifyProductFormatterUtil();
    allResults.push(formatterResult);
    console.log(`  ${formatterResult.status === 'OK' ? '✅' : formatterResult.status === 'WARNING' ? '⚠️' : '❌'} ${formatterResult.name}: ${formatterResult.message}`);
    
    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RESUMEN:\n');
    
    const okCount = allResults.filter(r => r.status === 'OK').length;
    const warningCount = allResults.filter(r => r.status === 'WARNING').length;
    const errorCount = allResults.filter(r => r.status === 'ERROR').length;
    
    console.log(`✅ OK: ${okCount}`);
    console.log(`⚠️  Warnings: ${warningCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📊 Total: ${allResults.length}`);
    
    if (errorCount === 0 && warningCount === 0) {
        console.log('\n🎉 ¡Todas las conexiones están funcionando correctamente!');
    } else if (errorCount === 0) {
        console.log('\n⚠️  Hay algunas advertencias, pero el sistema puede funcionar.');
    } else {
        console.log('\n❌ Hay errores que deben resolverse antes de usar el bot.');
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Detalles adicionales si se solicita
    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
        console.log('\n📋 DETALLES ADICIONALES:\n');
        allResults.forEach(result => {
            if (result.details) {
                console.log(`\n${result.name}:`);
                console.log(JSON.stringify(result.details, null, 2));
            }
        });
    }
    
    await prisma.$disconnect();
    process.exit(errorCount > 0 ? 1 : 0);
}

main().catch(async (error) => {
    console.error('\n❌ Error fatal en verificación:', error);
    await prisma.$disconnect();
    process.exit(1);
});
