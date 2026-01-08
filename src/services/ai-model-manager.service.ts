/**
 * AIModelManager - Sistema de gestión de modelos de IA con fallback automático
 * 
 * Este servicio maneja un pool de claves y modelos de IA (Gemini, GPT, etc.)
 * y proporciona fallback automático cuando un modelo falla por cuota excedida (429)
 * o errores de servicio (503).
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import logger from "../configs/logger.config";
import EnvConfig from "../configs/env.config";
import { AICacheService } from "./ai-cache.service";

// Tipos de modelos soportados
export type AIModelType = 
    | "gemini-2.0-flash-exp"
    | "gemini-1.5-flash"
    | "gemini-1.5-pro"
    | "gemini-pro";

// Estado de un modelo
export type ModelStatus = "available" | "exhausted" | "error";

// Configuración de un modelo
interface ModelConfig {
    name: AIModelType;
    apiKey: string;
    priority: number; // Menor número = mayor prioridad
    status: ModelStatus;
    lastError?: string;
    lastErrorTime?: Date;
    requestCount: number;
    errorCount: number;
    totalResponseTime: number; // Tiempo acumulado de respuesta en ms
    averageResponseTime: number; // Tiempo promedio de respuesta en ms
}

// Resultado de la generación
export interface AIGenerationResult {
    text: string;
    modelUsed: AIModelType;
    fallbackOccurred: boolean;
    attemptedModels: string[];
}

// Estado del sistema de IA
export interface AISystemStatus {
    models: Array<{
        name: AIModelType;
        status: ModelStatus;
        priority: number;
        requestCount: number;
        errorCount: number;
        lastError?: string;
        lastErrorTime?: string;
        averageResponseTime: number;
    }>;
    activeModel: AIModelType | null;
    totalRequests: number;
    totalErrors: number;
}

export class AIModelManager {
    private static instance: AIModelManager;
    private models: Map<AIModelType, ModelConfig>;
    private currentModelIndex: number = 0;
    private totalRequests: number = 0;
    private totalErrors: number = 0;

    // Tiempo de cooldown para modelos agotados (en milisegundos)
    private readonly COOLDOWN_TIME = 15 * 60 * 1000; // 15 minutos

    // Máximo número de reintentos
    private readonly MAX_RETRIES = 3;

    private constructor() {
        this.models = new Map();
        this.initializeModels();
        logger.info("🤖 AIModelManager inicializado");
    }

    public static getInstance(): AIModelManager {
        if (!AIModelManager.instance) {
            AIModelManager.instance = new AIModelManager();
        }
        return AIModelManager.instance;
    }

    /**
     * Inicializar modelos desde variables de entorno
     */
    private initializeModels(): void {
        // Modelo principal: Gemini 2.0 Flash
        if (EnvConfig.GEMINI_API_KEY) {
            this.addModel({
                name: "gemini-2.0-flash-exp",
                apiKey: EnvConfig.GEMINI_API_KEY,
                priority: 1,
                status: "available",
                requestCount: 0,
                errorCount: 0,
                totalResponseTime: 0,
                averageResponseTime: 0
            });
        }

        // Modelos de respaldo - usando la misma clave pero diferentes versiones
        if (EnvConfig.GEMINI_API_KEY) {
            this.addModel({
                name: "gemini-1.5-flash",
                apiKey: EnvConfig.GEMINI_API_KEY,
                priority: 2,
                status: "available",
                requestCount: 0,
                errorCount: 0,
                totalResponseTime: 0,
                averageResponseTime: 0
            });

            this.addModel({
                name: "gemini-1.5-pro",
                apiKey: EnvConfig.GEMINI_API_KEY,
                priority: 3,
                status: "available",
                requestCount: 0,
                errorCount: 0,
                totalResponseTime: 0,
                averageResponseTime: 0
            });
        }

        // Si hay claves adicionales en el futuro, se pueden agregar aquí
        // Ejemplo: GEMINI_API_KEY_2, GEMINI_API_KEY_3, etc.
        
        const modelCount = this.models.size;
        if (modelCount === 0) {
            throw new Error("No se configuraron modelos de IA. Verifica las variables de entorno.");
        }

        logger.info(`✅ ${modelCount} modelos de IA configurados`);
    }

    /**
     * Agregar un modelo al pool
     */
    private addModel(config: ModelConfig): void {
        this.models.set(config.name, config);
        logger.info(`➕ Modelo agregado: ${config.name} (prioridad: ${config.priority})`);
    }

    /**
     * Obtener modelo disponible con mayor prioridad
     */
    private getNextAvailableModel(): ModelConfig | null {
        // Ordenar modelos por prioridad
        const sortedModels = Array.from(this.models.values())
            .sort((a, b) => a.priority - b.priority);

        // Buscar primer modelo disponible
        for (const model of sortedModels) {
            if (model.status === "available") {
                return model;
            }

            // Si está exhausted, verificar si ya pasó el cooldown
            if (model.status === "exhausted" && model.lastErrorTime) {
                const timeSinceError = Date.now() - model.lastErrorTime.getTime();
                if (timeSinceError >= this.COOLDOWN_TIME) {
                    // Cooldown completado, reactivar modelo
                    model.status = "available";
                    model.lastError = undefined;
                    logger.info(`🔄 Modelo ${model.name} reactivado después del cooldown`);
                    return model;
                }
            }
        }

        return null;
    }

    /**
     * Marcar modelo como agotado
     */
    private markModelAsExhausted(modelName: AIModelType, error: string): void {
        const model = this.models.get(modelName);
        if (model) {
            model.status = "exhausted";
            model.lastError = error;
            model.lastErrorTime = new Date();
            model.errorCount++;
            logger.warn(`⚠️ Modelo ${modelName} marcado como agotado: ${error}`);
        }
    }

    /**
     * Marcar modelo como con error
     */
    private markModelAsError(modelName: AIModelType, error: string): void {
        const model = this.models.get(modelName);
        if (model) {
            model.status = "error";
            model.lastError = error;
            model.lastErrorTime = new Date();
            model.errorCount++;
            logger.error(`❌ Modelo ${modelName} con error: ${error}`);
        }
    }

    /**
     * Verificar si un error es de cuota excedida (429) o servicio no disponible (503)
     */
    private isRetryableError(error: any): boolean {
        const errorMessage = error.message?.toLowerCase() || '';
        const errorString = error.toString().toLowerCase();

        // Errores 429 (Too Many Requests / Quota Exceeded)
        if (errorMessage.includes('429') || 
            errorMessage.includes('quota') || 
            errorMessage.includes('rate limit') ||
            errorMessage.includes('too many requests')) {
            return true;
        }

        // Errores 503 (Service Unavailable)
        if (errorMessage.includes('503') || 
            errorMessage.includes('service unavailable') ||
            errorMessage.includes('temporarily unavailable')) {
            return true;
        }

        // Errores de red temporales
        if (errorString.includes('econnreset') || 
            errorString.includes('etimedout') ||
            errorString.includes('enotfound')) {
            return true;
        }

        return false;
    }

    /**
     * Generar contenido con fallback automático
     */
    public async generateContent(
        prompt: string,
        systemPrompt?: string
    ): Promise<AIGenerationResult> {
        this.totalRequests++;
        
        // 1. Intentar obtener desde caché primero
        const cache = AICacheService.getInstance();
        const cacheKey = systemPrompt ? `${systemPrompt}:${prompt}` : prompt;
        const cachedResponse = await cache.get(cacheKey);
        
        if (cachedResponse) {
            logger.info(`✨ Respuesta obtenida desde caché`);
            return {
                text: cachedResponse,
                modelUsed: "cache" as AIModelType,
                fallbackOccurred: false,
                attemptedModels: ["cache"]
            };
        }
        
        // 2. Si no está en caché, generar con IA
        const attemptedModels: string[] = [];
        let lastError: any = null;

        // Intentar con cada modelo disponible
        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            const modelConfig = this.getNextAvailableModel();

            if (!modelConfig) {
                logger.error("❌ No hay modelos disponibles. Todos están agotados o con error.");
                throw new Error(
                    "Todos los modelos de IA están temporalmente no disponibles. " +
                    "Por favor, intenta de nuevo en unos minutos."
                );
            }

            attemptedModels.push(modelConfig.name);
            logger.info(`🤖 Intentando generar con modelo: ${modelConfig.name} (intento ${attempt + 1}/${this.MAX_RETRIES})`);

            try {
                // Incrementar contador de requests
                modelConfig.requestCount++;

                // Medir tiempo de respuesta
                const startTime = Date.now();

                // Generar contenido
                const genAI = new GoogleGenerativeAI(modelConfig.apiKey);
                const model = genAI.getGenerativeModel({ model: modelConfig.name });

                const fullPrompt = systemPrompt 
                    ? `${systemPrompt}\n\nUsuario: ${prompt}`
                    : prompt;

                const result = await model.generateContent([fullPrompt]);
                const response = result.response;
                const text = response.text();

                // Registrar tiempo de respuesta
                const responseTime = Date.now() - startTime;
                modelConfig.totalResponseTime += responseTime;
                modelConfig.averageResponseTime = modelConfig.totalResponseTime / modelConfig.requestCount;

                // Éxito
                logger.info(`✅ Generación exitosa con modelo: ${modelConfig.name}`);

                // Guardar en caché para futuras consultas
                cache.set(cacheKey, text, modelConfig.name).catch(err =>
                    logger.error('Error guardando en caché:', err)
                );

                return {
                    text,
                    modelUsed: modelConfig.name,
                    fallbackOccurred: attempt > 0,
                    attemptedModels
                };

            } catch (error: any) {
                lastError = error;
                this.totalErrors++;
                
                logger.error(`❌ Error generando con ${modelConfig.name}: ${error.message}`);

                // Verificar si es un error retriable
                if (this.isRetryableError(error)) {
                    this.markModelAsExhausted(modelConfig.name, error.message);
                    // Continuar con siguiente modelo
                    continue;
                } else {
                    // Error no retriable (ej: contenido bloqueado)
                    this.markModelAsError(modelConfig.name, error.message);
                    throw error;
                }
            }
        }

        // Si llegamos aquí, todos los intentos fallaron
        throw new Error(
            `No se pudo generar respuesta después de ${this.MAX_RETRIES} intentos. ` +
            `Modelos intentados: ${attemptedModels.join(', ')}. ` +
            `Último error: ${lastError?.message || 'Desconocido'}`
        );
    }

    /**
     * Obtener estado del sistema de IA
     */
    public getSystemStatus(): AISystemStatus {
        const models = Array.from(this.models.values()).map(model => ({
            name: model.name,
            status: model.status,
            priority: model.priority,
            requestCount: model.requestCount,
            errorCount: model.errorCount,
            lastError: model.lastError,
            lastErrorTime: model.lastErrorTime?.toISOString(),
            averageResponseTime: Math.round(model.averageResponseTime)
        }));

        // Obtener modelo activo (primer modelo disponible)
        const activeModel = this.getNextAvailableModel();

        return {
            models,
            activeModel: activeModel?.name || null,
            totalRequests: this.totalRequests,
            totalErrors: this.totalErrors
        };
    }

    /**
     * Resetear estadísticas de un modelo
     */
    public resetModelStats(modelName: AIModelType): boolean {
        const model = this.models.get(modelName);
        if (model) {
            model.status = "available";
            model.requestCount = 0;
            model.errorCount = 0;
            model.lastError = undefined;
            model.lastErrorTime = undefined;
            model.totalResponseTime = 0;
            model.averageResponseTime = 0;
            logger.info(`🔄 Estadísticas del modelo ${modelName} reseteadas`);
            return true;
        }
        return false;
    }

    /**
     * Resetear todas las estadísticas
     */
    public resetAllStats(): void {
        this.models.forEach(model => {
            model.status = "available";
            model.requestCount = 0;
            model.errorCount = 0;
            model.lastError = undefined;
            model.lastErrorTime = undefined;
            model.totalResponseTime = 0;
            model.averageResponseTime = 0;
        });
        this.totalRequests = 0;
        this.totalErrors = 0;
        logger.info("🔄 Todas las estadísticas reseteadas");
    }
}

export default AIModelManager;
