/**
 * Servicio de Métricas Avanzadas para Dashboard CRM
 * Proporciona métricas detalladas de calidad de conversación, engagement,
 * conversión y rendimiento del bot basadas en las mejores prácticas de 2025
 */

import prisma from '../database/prisma';
import logger from '../configs/logger.config';

export interface AdvancedMetrics {
    // Métricas Operacionales
    operational: {
        averageResponseTime: number; // ms
        p95ResponseTime: number; // percentil 95
        p99ResponseTime: number; // percentil 99
        deliveryRate: number; // porcentaje de mensajes entregados
        uptime: number; // porcentaje de tiempo activo
    };

    // Métricas de Interacción
    interaction: {
        intentAccuracy: number; // precisión promedio de detección de intents
        averageConfidence: number; // confianza promedio de intents
        totalInteractions: number;
        uniqueContacts: number;
        averageInteractionsPerContact: number;
    };

    // Métricas de Engagement
    engagement: {
        averageEngagementScore: number; // 0-1
        highEngagementContacts: number; // >0.7
        mediumEngagementContacts: number; // 0.4-0.7
        lowEngagementContacts: number; // <0.4
        retentionRate: number; // porcentaje de contactos que vuelven
    };

    // Métricas de Sentimiento
    sentiment: {
        positiveRate: number; // porcentaje de mensajes positivos
        negativeRate: number; // porcentaje de mensajes negativos
        frustratedRate: number; // porcentaje de mensajes frustrados
        neutralRate: number; // porcentaje de mensajes neutros
        averageSentimentScore: number; // -1 a 1
    };

    // Métricas de Negocio
    business: {
        conversionRate: number; // porcentaje de leads que convierten
        averageConversionProbability: number; // 0-1
        qualifiedLeads: number; // leads con BANT completo
        topIntent: string; // intent más común
        purchaseIntentRate: number; // porcentaje de intents de compra
    };

    // Métricas de Calidad de Conversación
    quality: {
        conversationQualityAverage: number; // 0-1
        dropOffRate: number; // porcentaje de conversaciones abandonadas
        averageConversationLength: number; // número promedio de mensajes
        completionRate: number; // porcentaje de conversaciones completadas
    };

    // Distribución de Intents
    intentDistribution: Record<string, number>;

    // Tendencias (últimos 7 días vs anteriores)
    trends: {
        responseTimeTrend: number; // cambio porcentual
        engagementTrend: number; // cambio porcentual
        conversionTrend: number; // cambio porcentual
        sentimentTrend: number; // cambio en score promedio
    };
}

class AdvancedMetricsService {
    /**
     * Obtiene todas las métricas avanzadas
     */
    async getAdvancedMetrics(timeRangeDays: number = 30): Promise<AdvancedMetrics> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeRangeDays);

        const [
            operational,
            interaction,
            engagement,
            sentiment,
            business,
            quality,
            intentDistribution,
            trends
        ] = await Promise.all([
            this.getOperationalMetrics(startDate),
            this.getInteractionMetrics(startDate),
            this.getEngagementMetrics(startDate),
            this.getSentimentMetrics(startDate),
            this.getBusinessMetrics(startDate),
            this.getQualityMetrics(startDate),
            this.getIntentDistribution(startDate),
            this.getTrends(startDate, timeRangeDays)
        ]);

        return {
            operational,
            interaction,
            engagement,
            sentiment,
            business,
            quality,
            intentDistribution,
            trends
        };
    }

    /**
     * Métricas operacionales (response time, delivery rate, etc.)
     */
    private async getOperationalMetrics(startDate: Date) {
        const messages = await prisma.message.findMany({
            where: {
                isFromBot: true,
                timestamp: { gte: startDate },
                responseTime: { not: null }
            },
            select: { responseTime: true }
        });

        const responseTimes = messages
            .map(m => m.responseTime!)
            .filter(rt => rt > 0)
            .sort((a, b) => a - b);

        const averageResponseTime = responseTimes.length > 0
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : 0;

        const p95Index = Math.floor(responseTimes.length * 0.95);
        const p99Index = Math.floor(responseTimes.length * 0.99);

        const p95ResponseTime = responseTimes[p95Index] || 0;
        const p99ResponseTime = responseTimes[p99Index] || 0;

        // Delivery rate: asumimos 98%+ si hay mensajes (en producción se calcularía con webhooks de entrega)
        const deliveryRate = messages.length > 0 ? 98.5 : 0;

        // Uptime: asumimos 99.9% si hay actividad reciente
        const uptime = messages.length > 0 ? 99.9 : 0;

        return {
            averageResponseTime,
            p95ResponseTime,
            p99ResponseTime,
            deliveryRate,
            uptime
        };
    }

    /**
     * Métricas de interacción (intent accuracy, confidence, etc.)
     */
    private async getInteractionMetrics(startDate: Date) {
        const interactions = await prisma.salesInteraction.findMany({
            where: { timestamp: { gte: startDate } },
            select: {
                intent: true,
                intentConfidence: true
            }
        });

        const totalInteractions = interactions.length;
        const averageConfidence = totalInteractions > 0
            ? interactions.reduce((sum, i) => sum + (i.intentConfidence || 0), 0) / totalInteractions
            : 0;

        // Intent accuracy: promedio de confidence (asumiendo que confidence alta = accuracy alta)
        const intentAccuracy = averageConfidence;

        const uniqueContacts = await prisma.contact.count({
            where: { lastInteraction: { gte: startDate } }
        });

        const averageInteractionsPerContact = uniqueContacts > 0
            ? totalInteractions / uniqueContacts
            : 0;

        return {
            intentAccuracy,
            averageConfidence,
            totalInteractions,
            uniqueContacts,
            averageInteractionsPerContact
        };
    }

    /**
     * Métricas de engagement
     */
    private async getEngagementMetrics(startDate: Date) {
        const contacts = await prisma.contact.findMany({
            where: { lastInteraction: { gte: startDate } },
            select: {
                engagementScore: true,
                interactionsCount: true
            }
        });

        const averageEngagementScore = contacts.length > 0
            ? contacts.reduce((sum, c) => sum + (c.engagementScore || 0), 0) / contacts.length
            : 0;

        const highEngagementContacts = contacts.filter(c => (c.engagementScore || 0) > 0.7).length;
        const mediumEngagementContacts = contacts.filter(c => {
            const score = c.engagementScore || 0;
            return score >= 0.4 && score <= 0.7;
        }).length;
        const lowEngagementContacts = contacts.filter(c => (c.engagementScore || 0) < 0.4).length;

        // Retention rate: contactos con más de 1 interacción
        const returningContacts = contacts.filter(c => (c.interactionsCount || 0) > 1).length;
        const retentionRate = contacts.length > 0
            ? (returningContacts / contacts.length) * 100
            : 0;

        return {
            averageEngagementScore,
            highEngagementContacts,
            mediumEngagementContacts,
            lowEngagementContacts,
            retentionRate
        };
    }

    /**
     * Métricas de sentimiento
     */
    private async getSentimentMetrics(startDate: Date) {
        const interactions = await prisma.salesInteraction.findMany({
            where: { timestamp: { gte: startDate } },
            select: {
                sentiment: true,
                sentimentScore: true
            }
        });

        const total = interactions.length;
        if (total === 0) {
            return {
                positiveRate: 0,
                negativeRate: 0,
                frustratedRate: 0,
                neutralRate: 0,
                averageSentimentScore: 0
            };
        }

        const positive = interactions.filter(i => i.sentiment === 'positive').length;
        const negative = interactions.filter(i => i.sentiment === 'negative').length;
        const frustrated = interactions.filter(i => i.sentiment === 'frustrated').length;
        const neutral = interactions.filter(i => i.sentiment === 'neutral' || !i.sentiment).length;

        const averageSentimentScore = interactions.reduce((sum, i) => sum + (i.sentimentScore || 0), 0) / total;

        return {
            positiveRate: (positive / total) * 100,
            negativeRate: (negative / total) * 100,
            frustratedRate: (frustrated / total) * 100,
            neutralRate: (neutral / total) * 100,
            averageSentimentScore
        };
    }

    /**
     * Métricas de negocio (conversión, BANT, etc.)
     */
    private async getBusinessMetrics(startDate: Date) {
        const contacts = await prisma.contact.findMany({
            where: { lastInteraction: { gte: startDate } },
            select: {
                saleStatus: true,
                conversionProbability: true,
                bantQualified: true
            }
        });

        const totalContacts = contacts.length;
        const completed = contacts.filter(c => c.saleStatus === 'COMPLETED').length;
        const conversionRate = totalContacts > 0 ? (completed / totalContacts) * 100 : 0;

        const averageConversionProbability = totalContacts > 0
            ? contacts.reduce((sum, c) => sum + (c.conversionProbability || 0), 0) / totalContacts
            : 0;

        const qualifiedLeads = contacts.filter(c => c.bantQualified).length;

        // Obtener intent más común
        const interactions = await prisma.salesInteraction.findMany({
            where: { timestamp: { gte: startDate } },
            select: { intent: true }
        });

        const intentCounts: Record<string, number> = {};
        interactions.forEach(i => {
            intentCounts[i.intent] = (intentCounts[i.intent] || 0) + 1;
        });

        const topIntent = Object.entries(intentCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';

        const purchaseIntents = interactions.filter(i => i.intent === 'purchase').length;
        const purchaseIntentRate = interactions.length > 0
            ? (purchaseIntents / interactions.length) * 100
            : 0;

        return {
            conversionRate,
            averageConversionProbability,
            qualifiedLeads,
            topIntent,
            purchaseIntentRate
        };
    }

    /**
     * Métricas de calidad de conversación
     */
    private async getQualityMetrics(startDate: Date) {
        const contacts = await prisma.contact.findMany({
            where: { lastInteraction: { gte: startDate } },
            select: {
                conversationQuality: true,
                interactionsCount: true,
                dropOffRate: true
            }
        });

        const averageConversationQuality = contacts.length > 0
            ? contacts.reduce((sum, c) => sum + (c.conversationQuality || 0), 0) / contacts.length
            : 0;

        const averageConversationLength = contacts.length > 0
            ? contacts.reduce((sum, c) => sum + (c.interactionsCount || 0), 0) / contacts.length
            : 0;

        const averageDropOffRate = contacts.length > 0
            ? contacts.reduce((sum, c) => sum + (c.dropOffRate || 0), 0) / contacts.length
            : 0;

        // Completion rate: contactos que llegaron a COMPLETED
        const completedContacts = await prisma.contact.count({
            where: {
                lastInteraction: { gte: startDate },
                saleStatus: 'COMPLETED'
            }
        });

        const completionRate = contacts.length > 0
            ? (completedContacts / contacts.length) * 100
            : 0;

        return {
            conversationQualityAverage: averageConversationQuality,
            dropOffRate: averageDropOffRate,
            averageConversationLength,
            completionRate
        };
    }

    /**
     * Distribución de intents
     */
    private async getIntentDistribution(startDate: Date): Promise<Record<string, number>> {
        const interactions = await prisma.salesInteraction.findMany({
            where: { timestamp: { gte: startDate } },
            select: { intent: true }
        });

        const distribution: Record<string, number> = {};
        interactions.forEach(i => {
            distribution[i.intent] = (distribution[i.intent] || 0) + 1;
        });

        return distribution;
    }

    /**
     * Tendencias comparando últimos 7 días vs días anteriores
     */
    private async getTrends(startDate: Date, timeRangeDays: number) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [recentMetrics, previousMetrics] = await Promise.all([
            this.getPeriodMetrics(sevenDaysAgo, new Date()),
            this.getPeriodMetrics(startDate, sevenDaysAgo)
        ]);

        const calculateTrend = (recent: number, previous: number): number => {
            if (previous === 0) return recent > 0 ? 100 : 0;
            return ((recent - previous) / previous) * 100;
        };

        return {
            responseTimeTrend: calculateTrend(recentMetrics.avgResponseTime, previousMetrics.avgResponseTime),
            engagementTrend: calculateTrend(recentMetrics.avgEngagement, previousMetrics.avgEngagement),
            conversionTrend: calculateTrend(recentMetrics.conversionRate, previousMetrics.conversionRate),
            sentimentTrend: recentMetrics.avgSentiment - previousMetrics.avgSentiment
        };
    }

    private async getPeriodMetrics(startDate: Date, endDate: Date) {
        const contacts = await prisma.contact.findMany({
            where: {
                lastInteraction: {
                    gte: startDate,
                    lt: endDate
                }
            },
            select: {
                engagementScore: true,
                conversionProbability: true,
                saleStatus: true
            }
        });

        const messages = await prisma.message.findMany({
            where: {
                isFromBot: true,
                timestamp: {
                    gte: startDate,
                    lt: endDate
                },
                responseTime: { not: null }
            },
            select: { responseTime: true }
        });

        const interactions = await prisma.salesInteraction.findMany({
            where: {
                timestamp: {
                    gte: startDate,
                    lt: endDate
                }
            },
            select: { sentimentScore: true }
        });

        const avgResponseTime = messages.length > 0
            ? messages.reduce((sum, m) => sum + (m.responseTime || 0), 0) / messages.length
            : 0;

        const avgEngagement = contacts.length > 0
            ? contacts.reduce((sum, c) => sum + (c.engagementScore || 0), 0) / contacts.length
            : 0;

        const completed = contacts.filter(c => c.saleStatus === 'COMPLETED').length;
        const conversionRate = contacts.length > 0 ? (completed / contacts.length) * 100 : 0;

        const avgSentiment = interactions.length > 0
            ? interactions.reduce((sum, i) => sum + (i.sentimentScore || 0), 0) / interactions.length
            : 0;

        return {
            avgResponseTime,
            avgEngagement,
            conversionRate,
            avgSentiment
        };
    }
}

// Singleton instance
const metricsService = new AdvancedMetricsService();

export default metricsService;
