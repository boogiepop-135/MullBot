/**
 * QA Tester de Alto Nivel para el Bot Müllblue
 * Simula conversaciones y valida respuestas sin enviar mensajes reales.
 */

import { BotManager } from '../bot.manager';
import prisma from '../database/prisma';
import logger from '../configs/logger.config';
import type { EvolutionMessageData } from '../types/evolution-api.types';

const QA_TEST_PHONE = '5215550000999';
const QA_REMOTE_JID = `${QA_TEST_PHONE}@s.whatsapp.net`;

export interface QATestCase {
    id: string;
    name: string;
    userMessage: string;
    expectedContains: string[];  // La respuesta debe contener al menos uno
    expectedNotContains?: string[];
    setupPreviousMessages?: Array<{ fromBot: boolean; content: string }>;
}

export interface QATestResult {
    id: string;
    name: string;
    passed: boolean;
    userMessage: string;
    botResponses: string[];
    expectedContains: string[];
    error?: string;
}

export interface QAReport {
    total: number;
    passed: number;
    failed: number;
    results: QATestResult[];
    durationMs: number;
}

function buildMockMessageData(phoneNumber: string, content: string, pushName = 'QA-Tester'): EvolutionMessageData {
    return {
        key: {
            remoteJid: phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`,
            fromMe: false,
            id: `qa-${Date.now()}-${Math.random().toString(36).slice(2)}`
        },
        message: {
            conversation: content
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName
    };
}

/**
 * Crea un mock de EvolutionAPI que captura mensajes enviados
 */
function createCaptureMock(responses: string[]) {
    return {
        sendMessage: async (_phone: string, msg: string) => {
            responses.push(msg);
        },
        sendMedia: async (_phone: string, _pathOrUrl: string, caption?: string) => {
            responses.push(caption || '[MEDIA sin caption]');
        },
        isConnected: async () => true,
        getQR: async () => null
    } as any;
}

/**
 * Ejecuta un solo mensaje y devuelve las respuestas capturadas
 */
export async function runSingleQATest(
    botManager: BotManager,
    phoneNumber: string,
    userMessage: string,
    previousBotMessage?: string
): Promise<string[]> {
    const responses: string[] = [];
    const api = (botManager as any).evolutionAPI;
    const originalAPI = api;
    (botManager as any).evolutionAPI = createCaptureMock(responses);

    try {
        // Si hay mensaje previo del bot, simularlo en DB para contexto
        if (previousBotMessage) {
            await prisma.message.create({
                data: {
                    messageId: `qa-setup-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    phoneNumber: phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`,
                    from: 'bot',
                    to: phoneNumber,
                    body: previousBotMessage,
                    isFromBot: true,
                    type: 'TEXT'
                }
            }).catch(() => {});
        }

        const messageData = buildMockMessageData(phoneNumber, userMessage);
        await (botManager as any).handleIncomingMessage(messageData);
        return [...responses];
    } finally {
        (botManager as any).evolutionAPI = originalAPI;
    }
}

/**
 * Limpia mensajes de prueba para el número QA
 */
async function cleanupQAMessages(phoneNumber: string): Promise<void> {
    try {
        await prisma.message.deleteMany({
            where: {
                OR: [
                    { phoneNumber },
                    { phoneNumber: `${phoneNumber}@s.whatsapp.net` }
                ]
            }
        });
        logger.debug(`QA: Limpieza de mensajes para ${phoneNumber}`);
    } catch (e) {
        logger.warn('QA: Error limpiando mensajes:', e);
    }
}

/**
 * Suite de tests de alto nivel
 */
export const QA_TEST_CASES: QATestCase[] = [
    {
        id: 'greeting',
        name: 'Saludo → Menú principal',
        userMessage: 'hola',
        expectedContains: ['MENÚ', 'opción', 'Conocer el proceso']
    },
    {
        id: 'menu-1',
        name: 'Opción 1 → Proceso de compostaje',
        userMessage: '1',
        setupPreviousMessages: [{ fromBot: true, content: '👋 MENÚ PRINCIPAL\n1. Conocer el proceso\n2. Dudas sobre precios\n... Escribe el número' }],
        expectedContains: ['proceso', 'compostaje', 'fermentador']
    },
    {
        id: 'menu-2',
        name: 'Opción 2 → Precios o catálogo',
        userMessage: '2',
        setupPreviousMessages: [{ fromBot: true, content: 'MENÚ PRINCIPAL\n1. Proceso\n2. Precios\n... Escribe el número' }],
        expectedContains: ['precio', 'CATÁLOGO', 'producto', 'Precio']
    },
    {
        id: 'keyword-precios',
        name: 'Keyword "precios" → Contenido precios',
        userMessage: 'que precios y promociones tiene?',
        expectedContains: ['precio', 'CATÁLOGO', 'producto']
    },
    {
        id: 'keyword-proceso',
        name: 'Keyword "proceso" → Info proceso',
        userMessage: 'me interesa conocer el proceso de compostaje',
        expectedContains: ['proceso', 'compostaje']
    },
    {
        id: 'keyword-pago',
        name: 'Keyword "métodos de pago" → Info pago',
        userMessage: 'cuales son los metodos de pago',
        expectedContains: ['pago', 'transferencia', 'Transferencia']
    },
    {
        id: 'catalog-request',
        name: 'Solicitud catálogo → Lista productos',
        userMessage: 'que productos tienen',
        expectedContains: ['CATÁLOGO', 'Precio', 'producto']
    },
    {
        id: 'agent-request',
        name: 'Solicitud asesor → Mensaje asesoría',
        userMessage: 'quiero hablar con un asesor',
        expectedContains: ['asesor', 'registrada', 'personalizada', 'cola']
    },
    {
        id: 'thanks',
        name: 'Agradecimiento → Respuesta corta',
        userMessage: 'gracias',
        expectedContains: ['gusto', 'ayudarte']
    }
];

/**
 * Ejecuta la suite completa de QA
 */
export async function runFullQASuite(botManager: BotManager): Promise<QAReport> {
    const start = Date.now();
    const results: QATestResult[] = [];
    const phoneNumber = QA_TEST_PHONE;

    // Limpiar estado previo
    await cleanupQAMessages(phoneNumber);

    for (const tc of QA_TEST_CASES) {
        const responses: string[] = [];
        const api = (botManager as any).evolutionAPI;
        const originalAPI = api;
        (botManager as any).evolutionAPI = createCaptureMock(responses);

        let error: string | undefined;
        try {
            // Setup: mensaje previo del bot si aplica
            if (tc.setupPreviousMessages?.length) {
                for (let i = 0; i < tc.setupPreviousMessages.length; i++) {
                    const m = tc.setupPreviousMessages[i];
                    if (m.fromBot) {
                        await prisma.message.create({
                            data: {
                                messageId: `qa-${tc.id}-prev-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
                                phoneNumber,
                                from: 'bot',
                                to: phoneNumber,
                                body: m.content,
                                isFromBot: true,
                                type: 'TEXT'
                            }
                        }).catch(() => {});
                    }
                }
            }

            const messageData = buildMockMessageData(phoneNumber, tc.userMessage);
            await (botManager as any).handleIncomingMessage(messageData);
        } catch (e: any) {
            error = e?.message || String(e);
        } finally {
            (botManager as any).evolutionAPI = originalAPI;
        }

        const allText = responses.join(' ').toLowerCase();
        const passed = !error && tc.expectedContains.some(exp => allText.includes(exp.toLowerCase()));
        const failedByNotContains = tc.expectedNotContains?.some(exp => allText.includes(exp.toLowerCase()));

        results.push({
            id: tc.id,
            name: tc.name,
            passed: passed && !failedByNotContains,
            userMessage: tc.userMessage,
            botResponses: responses,
            expectedContains: tc.expectedContains,
            error
        });
    }

    const durationMs = Date.now() - start;
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;

    return {
        total: results.length,
        passed,
        failed,
        results,
        durationMs
    };
}
