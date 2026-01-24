/**
 * Sales Tracker Avanzado con Persistencia en BD
 * Implementa lead scoring avanzado con múltiples factores:
 * - Intent detection con confidence scoring
 * - Engagement scoring basado en frecuencia y tiempo
 * - Sentiment analysis
 * - BANT framework tracking
 * - Métricas de calidad de conversación
 */

import prisma from '../database/prisma';
import logger from '../configs/logger.config';
import sentimentAnalyzer, { Sentiment } from './sentiment-analysis.util';

export type SalesIntent = 'info' | 'price' | 'product' | 'payment' | 'objection' | 'purchase' | 'other';

export interface IntentDetectionResult {
    intent: SalesIntent;
    confidence: number; // 0.0 - 1.0
    keywords: string[];
}

export interface InteractionTrackingData {
    phoneNumber: string;
    userMessage: string;
    botResponse?: string;
    intent?: SalesIntent;
    intentConfidence?: number;
    responseTime?: number; // en milisegundos
    sentiment?: Sentiment;
    sentimentScore?: number;
}

class AdvancedSalesTracker {
    // Pesos para diferentes intents en el lead scoring
    private intentWeights: Map<SalesIntent, number> = new Map([
        ['info', 1],
        ['product', 2],
        ['price', 3],
        ['objection', 2], // Las objeciones resueltas son positivas
        ['payment', 5],
        ['purchase', 10],
        ['other', 0]
    ]);

    // Keywords mejorados para detección de intents con pesos
    private intentKeywords: Map<SalesIntent, Array<{ keyword: string; weight: number }>> = new Map([
        ['price', [
            { keyword: 'precio', weight: 0.8 },
            { keyword: 'precios', weight: 0.8 },
            { keyword: 'cuesta', weight: 0.7 },
            { keyword: 'vale', weight: 0.6 },
            { keyword: 'cuánto', weight: 0.7 },
            { keyword: 'costo', weight: 0.7 },
            { keyword: 'pagar', weight: 0.5 },
            { keyword: 'tarifa', weight: 0.6 }
        ]],
        ['product', [
            { keyword: 'producto', weight: 0.8 },
            { keyword: 'productos', weight: 0.8 },
            { keyword: 'compostero', weight: 0.9 },
            { keyword: 'kit', weight: 0.7 },
            { keyword: 'bio-catalizador', weight: 0.9 },
            { keyword: 'biocatalizador', weight: 0.9 },
            { keyword: 'activador', weight: 0.8 },
            { keyword: 'fermentador', weight: 0.8 }
        ]],
        ['payment', [
            { keyword: 'pago', weight: 0.8 },
            { keyword: 'transferencia', weight: 0.9 },
            { keyword: 'depósito', weight: 0.8 },
            { keyword: 'comprobante', weight: 0.9 },
            { keyword: 'tarjeta', weight: 0.7 },
            { keyword: 'paypal', weight: 0.7 },
            { keyword: 'método de pago', weight: 0.8 }
        ]],
        ['purchase', [
            { keyword: 'comprar', weight: 0.9 },
            { keyword: 'compro', weight: 0.9 },
            { keyword: 'quiero comprar', weight: 1.0 },
            { keyword: 'me interesa', weight: 0.7 },
            { keyword: 'quiero', weight: 0.6 },
            { keyword: 'necesito', weight: 0.7 },
            { keyword: 'dame', weight: 0.6 },
            { keyword: 'envíame', weight: 0.7 }
        ]],
        ['objection', [
            { keyword: 'caro', weight: 0.8 },
            { keyword: 'costoso', weight: 0.8 },
            { keyword: 'no puedo', weight: 0.7 },
            { keyword: 'muy caro', weight: 0.9 },
            { keyword: 'no tengo', weight: 0.6 },
            { keyword: 'no me alcanza', weight: 0.8 },
            { keyword: 'demasiado', weight: 0.6 }
        ]],
        ['info', [
            { keyword: 'info', weight: 0.7 },
            { keyword: 'información', weight: 0.8 },
            { keyword: 'cómo', weight: 0.6 },
            { keyword: 'qué es', weight: 0.7 },
            { keyword: 'explicar', weight: 0.6 },
            { keyword: 'detalles', weight: 0.7 }
        ]]
    ]);

    /**
     * Detecta el intent de un mensaje con confidence scoring
     */
    detectIntent(message: string): IntentDetectionResult {
        if (!message || message.trim().length === 0) {
            return {
                intent: 'other',
                confidence: 0.0,
                keywords: []
            };
        }

        const normalizedMessage = message.toLowerCase().trim();
        const intentScores = new Map<SalesIntent, number>();
        const detectedKeywords: string[] = [];

        // Calcular score para cada intent
        for (const [intent, keywords] of this.intentKeywords.entries()) {
            let score = 0.0;
            for (const { keyword, weight } of keywords) {
                if (normalizedMessage.includes(keyword)) {
                    score += weight;
                    detectedKeywords.push(keyword);
                }
            }
            if (score > 0) {
                intentScores.set(intent, score);
            }
        }

        // Determinar el intent con mayor score
        if (intentScores.size === 0) {
            return {
                intent: 'other',
                confidence: 0.0,
                keywords: []
            };
        }

        const sortedIntents = Array.from(intentScores.entries())
            .sort((a, b) => b[1] - a[1]);

        const [topIntent, topScore] = sortedIntents[0];
        
        // Calcular confidence: normalizar el score máximo (asumiendo máximo teórico de ~2.0)
        const confidence = Math.min(1.0, topScore / 2.0);

        return {
            intent: topIntent,
            confidence,
            keywords: detectedKeywords
        };
    }

    /**
     * Calcula el engagement score basado en frecuencia y tiempo de interacción
     */
    private calculateEngagementScore(
        interactionsCount: number,
        lastInteraction: Date,
        averageResponseTime?: number
    ): number {
        // Factor de frecuencia (más interacciones = mayor engagement)
        const frequencyFactor = Math.min(1.0, interactionsCount / 20); // Normalizado a 20 interacciones

        // Factor de recencia (más reciente = mayor engagement)
        const hoursSinceLastInteraction = (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60);
        const recencyFactor = Math.max(0, 1.0 - (hoursSinceLastInteraction / 168)); // Decae en 7 días

        // Factor de velocidad de respuesta (respuestas rápidas = mejor engagement)
        let responseTimeFactor = 0.5; // Default neutral
        if (averageResponseTime !== undefined && averageResponseTime > 0) {
            // Respuestas bajo 2 segundos = 1.0, sobre 10 segundos = 0.0
            responseTimeFactor = Math.max(0, Math.min(1.0, 1.0 - ((averageResponseTime - 2000) / 8000)));
        }

        // Ponderación: frecuencia 40%, recencia 40%, velocidad 20%
        const engagementScore = (
            frequencyFactor * 0.4 +
            recencyFactor * 0.4 +
            responseTimeFactor * 0.2
        );

        return Math.max(0.0, Math.min(1.0, engagementScore));
    }

    /**
     * Calcula la probabilidad de conversión basada en múltiples factores
     */
    private calculateConversionProbability(
        leadScore: number,
        engagementScore: number,
        sentimentScore: number,
        bantQualified: boolean
    ): number {
        // Normalizar lead score (0-100) a 0-1
        const normalizedLeadScore = leadScore / 100;

        // Ponderación:
        // - Lead Score: 30%
        // - Engagement: 25%
        // - Sentiment: 20%
        // - BANT Qualified: 25% (bonus significativo)
        const baseProbability = (
            normalizedLeadScore * 0.3 +
            engagementScore * 0.25 +
            (sentimentScore + 1) / 2 * 0.2 + // Normalizar sentiment de -1,1 a 0,1
            (bantQualified ? 1.0 : 0.0) * 0.25
        );

        return Math.max(0.0, Math.min(1.0, baseProbability));
    }

    /**
     * Trackea una interacción y actualiza métricas del contacto
     */
    async trackInteraction(data: InteractionTrackingData): Promise<void> {
        try {
            const {
                phoneNumber,
                userMessage,
                botResponse,
                intent: providedIntent,
                intentConfidence: providedConfidence,
                responseTime,
                sentiment: providedSentiment,
                sentimentScore: providedSentimentScore
            } = data;

            // Detectar intent si no se proporciona
            let intent: SalesIntent;
            let intentConfidence: number;
            if (providedIntent && providedConfidence !== undefined) {
                intent = providedIntent;
                intentConfidence = providedConfidence;
            } else {
                const detection = this.detectIntent(userMessage);
                intent = detection.intent;
                intentConfidence = detection.confidence;
            }

            // Analizar sentimiento si no se proporciona
            let sentiment: Sentiment;
            let sentimentScore: number;
            if (providedSentiment && providedSentimentScore !== undefined) {
                sentiment = providedSentiment;
                sentimentScore = providedSentimentScore;
            } else {
                const sentimentResult = sentimentAnalyzer.analyze(userMessage);
                sentiment = sentimentResult.sentiment;
                sentimentScore = sentimentResult.score;
            }

            // Obtener o crear contacto
            const contact = await prisma.contact.upsert({
                where: { phoneNumber },
                update: {
                    lastInteraction: new Date(),
                    interactionsCount: { increment: 1 },
                    lastIntent: intent,
                    intentConfidence,
                    lastSentiment: sentiment,
                    sentimentScore
                },
                create: {
                    phoneNumber,
                    lastInteraction: new Date(),
                    interactionsCount: 1,
                    lastIntent: intent,
                    intentConfidence,
                    lastSentiment: sentiment,
                    sentimentScore
                }
            });

            // Calcular score increase basado en intent
            const intentWeight = this.intentWeights.get(intent) || 0;
            const scoreIncrease = intentWeight;

            // Actualizar lead score
            const newLeadScore = Math.min(100, contact.leadScore + scoreIncrease);

            // Actualizar métricas de respuesta
            let newAverageResponseTime = contact.averageResponseTime;
            let newTotalResponseTime = contact.totalResponseTime;
            let newResponseCount = contact.responseCount;

            if (responseTime !== undefined && responseTime > 0) {
                newResponseCount = contact.responseCount + 1;
                newTotalResponseTime = contact.totalResponseTime + responseTime;
                newAverageResponseTime = Math.round(newTotalResponseTime / newResponseCount);
            }

            // Calcular engagement score
            const engagementScore = this.calculateEngagementScore(
                contact.interactionsCount + 1,
                new Date(),
                newAverageResponseTime || undefined
            );

            // Calcular probabilidad de conversión
            const conversionProbability = this.calculateConversionProbability(
                newLeadScore,
                engagementScore,
                sentimentScore,
                contact.bantQualified
            );

            // Guardar interacción en BD
            await prisma.salesInteraction.create({
                data: {
                    contactId: contact.id,
                    phoneNumber,
                    intent,
                    intentConfidence,
                    userMessage,
                    botResponse,
                    sentiment,
                    sentimentScore,
                    responseTime,
                    scoreIncrease
                }
            });

            // Actualizar contacto con todas las métricas
            await prisma.contact.update({
                where: { id: contact.id },
                data: {
                    leadScore: newLeadScore,
                    engagementScore,
                    conversionProbability,
                    averageResponseTime: newAverageResponseTime,
                    totalResponseTime: newTotalResponseTime,
                    responseCount: newResponseCount,
                    lastInteraction: new Date(),
                    lastIntent: intent,
                    intentConfidence,
                    lastSentiment: sentiment,
                    sentimentScore
                }
            });

            logger.info(`✅ Interacción trackeada: ${intent} (conf: ${intentConfidence.toFixed(2)}) | Sentiment: ${sentiment} (${sentimentScore.toFixed(2)}) | Lead Score: ${newLeadScore} | Engagement: ${(engagementScore * 100).toFixed(1)}%`);

        } catch (error) {
            logger.error('❌ Error trackeando interacción:', error);
            throw error;
        }
    }

    /**
     * Obtiene el lead score de un contacto
     */
    async getLeadScore(phoneNumber: string): Promise<number> {
        const contact = await prisma.contact.findUnique({
            where: { phoneNumber },
            select: { leadScore: true }
        });
        return contact?.leadScore || 0;
    }

    /**
     * Obtiene los top leads ordenados por score
     */
    async getTopLeads(limit: number = 10): Promise<Array<{
        phoneNumber: string;
        name: string | null;
        leadScore: number;
        engagementScore: number;
        conversionProbability: number;
        interactionsCount: number;
        lastIntent: string | null;
        lastSentiment: string | null;
    }>> {
        const contacts = await prisma.contact.findMany({
            orderBy: [
                { leadScore: 'desc' },
                { engagementScore: 'desc' }
            ],
            take: limit,
            select: {
                phoneNumber: true,
                name: true,
                leadScore: true,
                engagementScore: true,
                conversionProbability: true,
                interactionsCount: true,
                lastIntent: true,
                lastSentiment: true
            }
        });

        return contacts;
    }

    /**
     * Obtiene estadísticas generales de ventas
     */
    async getSalesStats() {
        const totalInteractions = await prisma.salesInteraction.count();
        const uniqueContacts = await prisma.contact.count();
        
        const intentCounts = await prisma.salesInteraction.groupBy({
            by: ['intent'],
            _count: { intent: true }
        });

        const intentCountsMap: Record<string, number> = {};
        intentCounts.forEach(item => {
            intentCountsMap[item.intent] = item._count.intent;
        });

        const topLeads = await this.getTopLeads(5);

        return {
            totalInteractions,
            uniqueContacts,
            intentCounts: intentCountsMap,
            topLeads
        };
    }

    /**
     * Actualiza información BANT de un contacto
     */
    async updateBANT(
        phoneNumber: string,
        bant: {
            budget?: string;
            authority?: string;
            need?: string;
            timeline?: string;
        }
    ): Promise<void> {
        const contact = await prisma.contact.findUnique({
            where: { phoneNumber }
        });

        if (!contact) {
            throw new Error(`Contacto no encontrado: ${phoneNumber}`);
        }

        // Determinar si está calificado BANT (todos los campos deben ser "yes" o valores positivos)
        const isQualified = (
            (bant.budget === 'yes' || bant.budget === 'maybe') &&
            (bant.authority === 'yes' || bant.authority === 'maybe') &&
            (bant.need === 'yes' || bant.need === 'maybe') &&
            (bant.timeline && ['immediate', 'week', 'month'].includes(bant.timeline))
        );

        await prisma.contact.update({
            where: { phoneNumber },
            data: {
                bantBudget: bant.budget || contact.bantBudget,
                bantAuthority: bant.authority || contact.bantAuthority,
                bantNeed: bant.need || contact.bantNeed,
                bantTimeline: bant.timeline || contact.bantTimeline,
                bantQualified: isQualified
            }
        });

        // Recalcular probabilidad de conversión
        const updatedContact = await prisma.contact.findUnique({
            where: { phoneNumber }
        });

        if (updatedContact) {
            const conversionProbability = this.calculateConversionProbability(
                updatedContact.leadScore,
                updatedContact.engagementScore,
                updatedContact.sentimentScore,
                isQualified
            );

            await prisma.contact.update({
                where: { phoneNumber },
                data: { conversionProbability }
            });
        }
    }
}

// Singleton instance
const salesTracker = new AdvancedSalesTracker();

export default salesTracker;
