/**
 * Script de Health Check Simplificado para MullBot
 * Verifica que todas las funcionalidades estén operativas
 * Versión JavaScript para ejecutar directamente con Node.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const results = [];

function addResult(name, status, message, details = null) {
    results.push({ name, status, message, details });
}

async function checkDatabase() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        addResult('Base de Datos (PostgreSQL)', 'ok', '✅ Conexión exitosa a PostgreSQL');
    } catch (error) {
        addResult('Base de Datos (PostgreSQL)', 'error', `❌ Error: ${error.message}`, error);
    }
}

async function checkEnvironmentVariables() {
    const required = [
        'DATABASE_URL',
        'JWT_SECRET',
        'GEMINI_API_KEY',
        'EVOLUTION_URL',
        'EVOLUTION_APIKEY',
        'EVOLUTION_INSTANCE_NAME'
    ];

    const missing = [];
    const present = [];

    for (const key of required) {
        if (process.env[key]) {
            present.push(key);
        } else {
            missing.push(key);
        }
    }

    if (missing.length > 0) {
        addResult('Variables de Entorno', 'error', `❌ Faltantes: ${missing.join(', ')}`, { missing, present });
    } else {
        addResult('Variables de Entorno', 'ok', `✅ Todas configuradas (${present.length})`, { configured: present });
    }
}

async function checkAIKeys() {
    const available = [];
    const missing = [];

    if (process.env.GEMINI_API_KEY) {
        available.push('Gemini');
    } else {
        missing.push('Gemini');
    }

    if (process.env.ANTHROPIC_API_KEY) {
        available.push('Anthropic');
    }

    if (available.length === 0) {
        addResult('API Keys de IA', 'error', '❌ No hay API Keys configuradas', { missing });
    } else {
        addResult('API Keys de IA', 'ok', `✅ Disponibles: ${available.join(', ')}`, { available, missing });
    }
}

async function checkGoogleSheets() {
    if (!process.env.GOOGLE_SHEETS_API_KEY || !process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
        addResult('Google Sheets', 'warning', '⚠️ No configurado (opcional)');
        return;
    }

    try {
        // Intentar importar el servicio (primero desde dist, luego desde src si no existe dist)
        let googleSheetsService;
        try {
            googleSheetsService = require('../dist/utils/google-sheets.util').googleSheetsService;
        } catch (e) {
            // Si no está compilado, intentar desde src (requiere ts-node)
            googleSheetsService = require('../src/utils/google-sheets.util').googleSheetsService;
        }
        
        if (!googleSheetsService) {
            addResult('Google Sheets', 'warning', '⚠️ Servicio no disponible (requiere compilación)');
            return;
        }
        
        const products = await googleSheetsService.getProductCatalog();
        addResult('Google Sheets', 'ok', `✅ Conectado (${products.length} productos)`, {
            productsCount: products.length
        });
    } catch (error) {
        addResult('Google Sheets', 'error', `❌ Error: ${error.message}`, error);
    }
}

async function checkAdvisorySystem() {
    try {
        const count = await prisma.advisory.count();
        addResult('Sistema de Asesorías', 'ok', `✅ Operativo (${count} asesorías)`, { count });
    } catch (error) {
        addResult('Sistema de Asesorías', 'error', `❌ Error: ${error.message}`, error);
    }
}

async function checkProductsSystem() {
    try {
        const count = await prisma.product.count();
        const products = await prisma.product.findMany({ take: 5 });
        
        // Verificar que los productos tengan información básica
        const productsWithInfo = products.filter(p => p.name && p.price > 0);
        const productsWithoutInfo = count - productsWithInfo.length;
        
        let message = `✅ Operativo (${count} productos)`;
        if (productsWithoutInfo > 0) {
            message += ` - ⚠️ ${productsWithoutInfo} sin información completa`;
        }
        
        addResult('Sistema de Productos', productsWithoutInfo > 0 ? 'warning' : 'ok', message, { 
            total: count,
            withInfo: productsWithInfo.length,
            withoutInfo: productsWithoutInfo
        });
    } catch (error) {
        addResult('Sistema de Productos', 'error', `❌ Error: ${error.message}`, error);
    }
}

async function checkCampaignsSystem() {
    try {
        const total = await prisma.campaign.count();
        const active = await prisma.campaign.count({ 
            where: { status: 'SCHEDULED' } 
        });
        const sent = await prisma.campaign.count({ 
            where: { status: 'SENT' } 
        });
        const failed = await prisma.campaign.count({ 
            where: { status: 'FAILED' } 
        });
        
        addResult('Sistema de Campañas', 'ok', 
            `✅ Operativo (${total} total, ${active} programadas, ${sent} enviadas, ${failed} fallidas)`, 
            { total, active, sent, failed });
    } catch (error) {
        addResult('Sistema de Campañas', 'error', `❌ Error: ${error.message}`, error);
    }
}

async function checkProductsIntegration() {
    try {
        // Verificar que el bot pueda obtener productos de Google Sheets
        if (!process.env.GOOGLE_SHEETS_API_KEY || !process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
            addResult('Integración Productos-Bot', 'warning', 
                '⚠️ Google Sheets no configurado, bot usará productos de BD', { source: 'database' });
            return;
        }

        let googleSheetsService;
        try {
            googleSheetsService = require('../dist/utils/google-sheets.util').googleSheetsService;
        } catch (e) {
            try {
                googleSheetsService = require('../src/utils/google-sheets.util').googleSheetsService;
            } catch (e2) {
                addResult('Integración Productos-Bot', 'warning', 
                    '⚠️ No se pudo cargar servicio de Google Sheets', { error: e2.message });
                return;
            }
        }

        const products = await googleSheetsService.getProductCatalog();
        
        if (products.length === 0) {
            addResult('Integración Productos-Bot', 'warning', 
                '⚠️ Google Sheets conectado pero no hay productos en la hoja', { source: 'sheets', count: 0 });
        } else {
            // Verificar que los productos tengan información básica
            const validProducts = products.filter(p => p.producto && p.precio > 0);
            const invalidProducts = products.length - validProducts.length;
            
            let message = `✅ Integración OK (${products.length} productos en Google Sheets)`;
            if (invalidProducts > 0) {
                message += ` - ⚠️ ${invalidProducts} productos con información incompleta`;
            }
            
            addResult('Integración Productos-Bot', invalidProducts > 0 ? 'warning' : 'ok', 
                message, { 
                    source: 'sheets',
                    total: products.length,
                    valid: validProducts.length,
                    invalid: invalidProducts
                });
        }
    } catch (error) {
        addResult('Integración Productos-Bot', 'error', 
            `❌ Error verificando integración: ${error.message}`, error);
    }
}

async function checkEvolutionAPI() {
    try {
        const axios = require('axios');
        const evolutionUrl = process.env.EVOLUTION_URL;
        const apiKey = process.env.EVOLUTION_APIKEY;

        if (!evolutionUrl || !apiKey) {
            addResult('Evolution API', 'error', '❌ Variables de entorno no configuradas');
            return;
        }

        const response = await axios.get(`${evolutionUrl}/instance/fetchInstances`, {
            headers: { apikey: apiKey }
        });

        const instances = response.data || [];
        if (instances.length === 0) {
            addResult('Evolution API', 'warning', '⚠️ No hay instancias configuradas');
        } else {
            const instance = instances[0];
            const status = instance.connectionStatus || 'unknown';
            addResult('Evolution API', status === 'open' ? 'ok' : 'warning', 
                `✅ ${instances.length} instancia(s) encontrada(s) (${status})`, 
                { instances: instances.length, status });
        }
    } catch (error) {
        addResult('Evolution API', 'error', `❌ Error: ${error.message}`, error);
    }
}

async function runHealthCheck() {
    console.log('\n🔍 Iniciando Health Check de MullBot...\n');
    console.log('='.repeat(60));

    await checkEnvironmentVariables();
    await checkDatabase();
    await checkEvolutionAPI();
    await checkAIKeys();
    await checkGoogleSheets();
    await checkAdvisorySystem();
    await checkProductsSystem();
    await checkCampaignsSystem();
    await checkProductsIntegration();

    console.log('\n📊 RESULTADOS:\n');

    let okCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.message}`);
        if (result.details && process.env.DEBUG) {
            console.log(`   Detalles:`, JSON.stringify(result.details, null, 2));
        }
        console.log('');

        if (result.status === 'ok') okCount++;
        else if (result.status === 'warning') warningCount++;
        else errorCount++;
    });

    console.log('='.repeat(60));
    console.log('\n📈 RESUMEN:\n');
    console.log(`✅ OK: ${okCount}`);
    console.log(`⚠️  Warnings: ${warningCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📊 Total: ${results.length}\n`);

    if (errorCount === 0 && warningCount === 0) {
        console.log('🎉 ¡Todas las funciones están operativas!\n');
        process.exit(0);
    } else if (errorCount === 0) {
        console.log('⚠️  Hay advertencias, pero el sistema está operativo.\n');
        process.exit(0);
    } else {
        console.log('❌ Hay errores críticos que deben resolverse.\n');
        process.exit(1);
    }
}

runHealthCheck()
    .catch((error) => {
        console.error('❌ Error ejecutando health check:', error);
        process.exit(1);
    })
    .finally(async () => {
        try {
            await prisma.$disconnect();
        } catch (error) {
            // Ignorar
        }
    });
