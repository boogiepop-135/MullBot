/**
 * Análisis de Sentimiento Básico para Mensajes
 * Detecta sentimiento positivo, neutral, negativo o frustrado basado en palabras clave
 * y patrones comunes en español
 */

import logger from '../configs/logger.config';

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'frustrated';

export interface SentimentResult {
    sentiment: Sentiment;
    score: number; // -1.0 (muy negativo) a 1.0 (muy positivo)
    confidence: number; // 0.0 - 1.0
    keywords: string[]; // palabras clave detectadas
}

class SentimentAnalyzer {
    // Palabras positivas con pesos
    private positiveKeywords: Map<string, number> = new Map([
        ['gracias', 0.3],
        ['perfecto', 0.4],
        ['excelente', 0.5],
        ['genial', 0.4],
        ['bueno', 0.2],
        ['me gusta', 0.3],
        ['me encanta', 0.5],
        ['sí', 0.2],
        ['ok', 0.1],
        ['perfecto', 0.4],
        ['bien', 0.2],
        ['interesante', 0.3],
        ['quiero', 0.2],
        ['me interesa', 0.3],
        ['información', 0.1],
        ['buen', 0.2],
        ['buena', 0.2],
        ['súper', 0.3],
        ['increíble', 0.4],
        ['fantástico', 0.4],
        ['maravilloso', 0.4],
        ['estupendo', 0.3],
    ]);

    // Palabras negativas con pesos
    private negativeKeywords: Map<string, number> = new Map([
        ['no', -0.2],
        ['mal', -0.3],
        ['malo', -0.3],
        ['malo', -0.3],
        ['no me gusta', -0.4],
        ['no quiero', -0.3],
        ['problema', -0.3],
        ['error', -0.4],
        ['incorrecto', -0.3],
        ['malo', -0.3],
        ['terrible', -0.5],
        ['horrible', -0.5],
        ['pésimo', -0.4],
    ]);

    // Palabras de frustración con pesos altos
    private frustrationKeywords: Map<string, number> = new Map([
        ['no funciona', -0.6],
        ['no sirve', -0.6],
        ['no entiendo', -0.4],
        ['confundido', -0.4],
        ['frustrado', -0.7],
        ['molesto', -0.6],
        ['enojado', -0.7],
        ['cansado', -0.5],
        ['desesperado', -0.6],
        ['ya no', -0.5],
        ['nunca', -0.4],
        ['siempre', -0.3], // cuando se usa negativamente
        ['demasiado', -0.3], // cuando se usa negativamente
        ['muy lento', -0.5],
        ['muy caro', -0.4],
        ['no puedo', -0.4],
        ['no puedo pagar', -0.5],
        ['no tengo', -0.3],
        ['imposible', -0.5],
        ['difícil', -0.3],
    ]);

    // Palabras de urgencia/compra (positivas para ventas)
    private purchaseIntentKeywords: Map<string, number> = new Map([
        ['comprar', 0.4],
        ['compro', 0.4],
        ['quiero comprar', 0.5],
        ['necesito', 0.3],
        ['urgente', 0.2],
        ['ya', 0.2],
        ['ahora', 0.2],
        ['inmediato', 0.3],
        ['transferencia', 0.3],
        ['pago', 0.3],
        ['precio', 0.2],
        ['cuánto', 0.2],
        ['cuesta', 0.2],
    ]);

    /**
     * Analiza el sentimiento de un mensaje
     */
    analyze(message: string): SentimentResult {
        if (!message || message.trim().length === 0) {
            return {
                sentiment: 'neutral',
                score: 0.0,
                confidence: 0.0,
                keywords: []
            };
        }

        const normalizedMessage = message.toLowerCase().trim();
        let score = 0.0;
        const detectedKeywords: string[] = [];

        // Analizar palabras positivas
        for (const [keyword, weight] of this.positiveKeywords.entries()) {
            if (normalizedMessage.includes(keyword)) {
                score += weight;
                detectedKeywords.push(keyword);
            }
        }

        // Analizar palabras negativas
        for (const [keyword, weight] of this.negativeKeywords.entries()) {
            if (normalizedMessage.includes(keyword)) {
                score += weight;
                detectedKeywords.push(keyword);
            }
        }

        // Analizar frustración (tiene prioridad sobre negativo)
        let frustrationDetected = false;
        for (const [keyword, weight] of this.frustrationKeywords.entries()) {
            if (normalizedMessage.includes(keyword)) {
                score += weight;
                detectedKeywords.push(keyword);
                frustrationDetected = true;
            }
        }

        // Analizar intención de compra (aumenta positividad)
        for (const [keyword, weight] of this.purchaseIntentKeywords.entries()) {
            if (normalizedMessage.includes(keyword)) {
                score += weight;
                detectedKeywords.push(keyword);
            }
        }

        // Normalizar score entre -1.0 y 1.0
        score = Math.max(-1.0, Math.min(1.0, score));

        // Determinar sentimiento
        let sentiment: Sentiment;
        if (frustrationDetected && score < -0.3) {
            sentiment = 'frustrated';
        } else if (score > 0.2) {
            sentiment = 'positive';
        } else if (score < -0.2) {
            sentiment = 'negative';
        } else {
            sentiment = 'neutral';
        }

        // Calcular confianza basada en número de keywords detectadas
        const keywordCount = detectedKeywords.length;
        const confidence = Math.min(1.0, keywordCount * 0.2 + (Math.abs(score) * 0.5));

        return {
            sentiment,
            score,
            confidence,
            keywords: detectedKeywords
        };
    }

    /**
     * Analiza múltiples mensajes y retorna el sentimiento promedio
     */
    analyzeConversation(messages: string[]): SentimentResult {
        if (!messages || messages.length === 0) {
            return {
                sentiment: 'neutral',
                score: 0.0,
                confidence: 0.0,
                keywords: []
            };
        }

        const results = messages.map(msg => this.analyze(msg));
        const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
        const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
        const allKeywords = [...new Set(results.flatMap(r => r.keywords))];

        // Determinar sentimiento basado en score promedio
        let sentiment: Sentiment;
        if (avgScore > 0.2) {
            sentiment = 'positive';
        } else if (avgScore < -0.2) {
            // Verificar si hay frustración en algún mensaje
            const hasFrustration = results.some(r => r.sentiment === 'frustrated');
            sentiment = hasFrustration ? 'frustrated' : 'negative';
        } else {
            sentiment = 'neutral';
        }

        return {
            sentiment,
            score: avgScore,
            confidence: avgConfidence,
            keywords: allKeywords
        };
    }
}

// Singleton instance
const analyzer = new SentimentAnalyzer();

export default analyzer;
