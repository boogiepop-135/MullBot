#!/usr/bin/env ts-node
/**
 * QA Tester - Ejecuta la suite completa de tests del bot
 * Uso: npm run qa  o  npx ts-node scripts/bot-qa.ts
 */

import 'dotenv/config';
import { connectDB } from '../src/configs/db.config';
import { BotManager } from '../src/bot.manager';
import { runFullQASuite, QA_TEST_CASES } from '../src/qa/bot-qa.service';

async function main() {
    console.log('\n🧪 QA Tester - Müllblue Bot\n');
    console.log('='.repeat(60));

    try {
        await connectDB();
        console.log('✅ Base de datos conectada\n');

        const botManager = BotManager.getInstance();
        // No inicializar Evolution API - usamos mock interno

        console.log(`Ejecutando ${QA_TEST_CASES.length} tests...\n`);

        const report = await runFullQASuite(botManager);

        // Imprimir resultados
        console.log('\n' + '='.repeat(60));
        console.log('RESULTADOS');
        console.log('='.repeat(60));
        console.log(`Total: ${report.total} | ✅ Passed: ${report.passed} | ❌ Failed: ${report.failed}`);
        console.log(`Duración: ${report.durationMs}ms\n`);

        for (const r of report.results) {
            const icon = r.passed ? '✅' : '❌';
            console.log(`${icon} ${r.name}`);
            console.log(`   Mensaje: "${r.userMessage}"`);
            if (!r.passed) {
                if (r.error) console.log(`   Error: ${r.error}`);
                console.log(`   Esperaba contener: ${r.expectedContains.join(' o ')}`);
                if (r.botResponses.length > 0) {
                    const preview = r.botResponses[0].slice(0, 80) + (r.botResponses[0].length > 80 ? '...' : '');
                    console.log(`   Recibió: "${preview}"`);
                } else {
                    console.log(`   Recibió: (sin respuesta)`);
                }
            }
            console.log('');
        }

        console.log('='.repeat(60));
        process.exit(report.failed > 0 ? 1 : 0);
    } catch (error: any) {
        console.error('\n❌ Error ejecutando QA:', error?.message || error);
        process.exit(1);
    }
}

main();
