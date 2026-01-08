/**
 * AICacheService - Sistema de caché para respuestas de IA
 * 
 * Este servicio almacena respuestas frecuentes para reducir:
 * - Costos de API
 * - Tiempo de respuesta
 * - Carga en los modelos de IA
 * 
 * Estrategia de caché:
 * - Memoria (LRU): Para respuestas ultra-rápidas
 * - Base de datos: Para persistencia a largo plazo
 * - TTL (Time To Live): Configurable por tipo de query
 */

import logger from "../configs/logger.config";
import prisma from "../database/prisma";
import crypto from "crypto";

// Configuración del caché
interface CacheConfig {
    maxMemorySize: number;      // Máximo de entradas en memoria
    defaultTTL: number;          // TTL por defecto en segundos
    minQueryLength: number;      // Longitud mínima de query para cachear
    similarityThreshold: number; // Umbral de similitud para considerar queries iguales (0-1)
}

// Entrada de caché
interface CacheEntry {
    key: string;
    query: string;
    response: string;
    modelUsed: string;
    timestamp: Date;
    hits: number;
    lastAccessed: Date;
}

// Estadísticas del caché
export interface CacheStats {
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    memoryEntries: number;
    dbEntries: number;
    savedAPICalls: number;
    estimatedSavings: string;
}

export class AICacheService {
    private static instance: AICacheService;
    
    // Caché en memoria (Map con orden LRU)
    private memoryCache: Map<string, CacheEntry>;
    
    // Configuración
    private config: CacheConfig = {
        maxMemorySize: 100,        // 100 respuestas en memoria
        defaultTTL: 3600,          // 1 hora
        minQueryLength: 10,        // Mínimo 10 caracteres
        similarityThreshold: 0.9   // 90% de similitud
    };
    
    // Estadísticas
    private stats = {
        hits: 0,
        misses: 0,
        savedAPICalls: 0
    };

    private constructor() {
        this.memoryCache = new Map();
        this.initializeCache();
        logger.info("💾 AICacheService inicializado");
    }

    public static getInstance(): AICacheService {
        if (!AICacheService.instance) {
            AICacheService.instance = new AICacheService();
        }
        return AICacheService.instance;
    }

    /**
     * Inicializar caché cargando entradas populares desde la base de datos
     */
    private async initializeCache(): Promise<void> {
        try {
            // Cargar las 50 respuestas más frecuentes desde la DB
            const popularEntries = await prisma.aICache.findMany({
                take: 50,
                orderBy: { hits: 'desc' }
            });

            popularEntries.forEach(entry => {
                const cacheEntry: CacheEntry = {
                    key: entry.queryHash,
                    query: entry.query,
                    response: entry.response,
                    modelUsed: entry.modelUsed || 'unknown',
                    timestamp: entry.createdAt,
                    hits: entry.hits,
                    lastAccessed: entry.lastAccessed
                };
                this.memoryCache.set(entry.queryHash, cacheEntry);
            });

            logger.info(`💾 Caché inicializado con ${popularEntries.length} entradas populares`);
        } catch (error) {
            logger.error('Error inicializando caché:', error);
        }
    }

    /**
     * Generar hash único para una query
     */
    private generateHash(query: string): string {
        // Normalizar query (minúsculas, sin espacios extra, sin puntuación)
        const normalized = query
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\sáéíóúñü]/gi, '');
        
        return crypto
            .createHash('sha256')
            .update(normalized)
            .digest('hex');
    }

    /**
     * Buscar respuesta en caché
     */
    public async get(query: string): Promise<string | null> {
        // Validar query
        if (!query || query.length < this.config.minQueryLength) {
            this.stats.misses++;
            return null;
        }

        const hash = this.generateHash(query);

        // 1. Buscar en memoria (más rápido)
        let entry = this.memoryCache.get(hash);
        
        if (entry) {
            // Verificar TTL
            const age = (Date.now() - entry.timestamp.getTime()) / 1000;
            if (age < this.config.defaultTTL) {
                // Cache hit en memoria
                entry.hits++;
                entry.lastAccessed = new Date();
                this.stats.hits++;
                this.stats.savedAPICalls++;
                
                logger.info(`💾 Cache HIT (memoria): "${query.substring(0, 50)}..." (${entry.hits} hits)`);
                
                // Actualizar hits en DB de forma asíncrona
                this.updateHitsInDB(hash, entry.hits).catch(err => 
                    logger.error('Error actualizando hits en DB:', err)
                );
                
                return entry.response;
            } else {
                // Entrada expirada, eliminar
                this.memoryCache.delete(hash);
            }
        }

        // 2. Buscar en base de datos
        try {
            const dbEntry = await prisma.aICache.findUnique({
                where: { queryHash: hash }
            });

            if (dbEntry) {
                const age = (Date.now() - dbEntry.createdAt.getTime()) / 1000;
                
                if (age < this.config.defaultTTL) {
                    // Cache hit en DB
                    this.stats.hits++;
                    this.stats.savedAPICalls++;
                    
                    // Actualizar hits
                    await prisma.aICache.update({
                        where: { queryHash: hash },
                        data: { 
                            hits: { increment: 1 },
                            lastAccessed: new Date()
                        }
                    });

                    // Agregar a memoria si hay espacio
                    if (this.memoryCache.size < this.config.maxMemorySize) {
                        const cacheEntry: CacheEntry = {
                            key: hash,
                            query: dbEntry.query,
                            response: dbEntry.response,
                            modelUsed: dbEntry.modelUsed || 'unknown',
                            timestamp: dbEntry.createdAt,
                            hits: dbEntry.hits + 1,
                            lastAccessed: new Date()
                        };
                        this.memoryCache.set(hash, cacheEntry);
                    }

                    logger.info(`💾 Cache HIT (DB): "${query.substring(0, 50)}..." (${dbEntry.hits + 1} hits)`);
                    return dbEntry.response;
                } else {
                    // Entrada expirada, eliminar de DB
                    await prisma.aICache.delete({ where: { queryHash: hash } });
                }
            }
        } catch (error) {
            logger.error('Error buscando en caché DB:', error);
        }

        // Cache miss
        this.stats.misses++;
        logger.debug(`💾 Cache MISS: "${query.substring(0, 50)}..."`);
        return null;
    }

    /**
     * Guardar respuesta en caché
     */
    public async set(query: string, response: string, modelUsed: string): Promise<void> {
        // Validar entrada
        if (!query || query.length < this.config.minQueryLength) {
            return;
        }

        if (!response || response.length < 10) {
            return;
        }

        const hash = this.generateHash(query);
        const now = new Date();

        const entry: CacheEntry = {
            key: hash,
            query: query.substring(0, 500), // Limitar longitud
            response: response.substring(0, 2000), // Limitar longitud
            modelUsed,
            timestamp: now,
            hits: 1,
            lastAccessed: now
        };

        // 1. Guardar en memoria
        if (this.memoryCache.size >= this.config.maxMemorySize) {
            // Eliminar entrada menos usada (LRU)
            this.evictLRU();
        }
        this.memoryCache.set(hash, entry);

        // 2. Guardar en base de datos (asíncrono)
        try {
            await prisma.aICache.upsert({
                where: { queryHash: hash },
                create: {
                    queryHash: hash,
                    query: entry.query,
                    response: entry.response,
                    modelUsed: entry.modelUsed,
                    hits: 1,
                    lastAccessed: now,
                    createdAt: now
                },
                update: {
                    response: entry.response,
                    modelUsed: entry.modelUsed,
                    lastAccessed: now
                }
            });

            logger.debug(`💾 Cache SET: "${query.substring(0, 50)}..."`);
        } catch (error) {
            logger.error('Error guardando en caché DB:', error);
        }
    }

    /**
     * Eliminar entrada menos recientemente usada (LRU)
     */
    private evictLRU(): void {
        let oldestKey: string | null = null;
        let oldestTime = Date.now();

        this.memoryCache.forEach((entry, key) => {
            const lastAccessTime = entry.lastAccessed.getTime();
            if (lastAccessTime < oldestTime) {
                oldestTime = lastAccessTime;
                oldestKey = key;
            }
        });

        if (oldestKey) {
            this.memoryCache.delete(oldestKey);
            logger.debug(`💾 Cache eviction: ${oldestKey}`);
        }
    }

    /**
     * Actualizar hits en DB de forma asíncrona
     */
    private async updateHitsInDB(hash: string, hits: number): Promise<void> {
        try {
            await prisma.aICache.update({
                where: { queryHash: hash },
                data: { 
                    hits,
                    lastAccessed: new Date()
                }
            });
        } catch (error) {
            // Silencioso, no es crítico
        }
    }

    /**
     * Obtener estadísticas del caché
     */
    public async getStats(): Promise<CacheStats> {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100) : 0;

        // Contar entradas en DB
        let dbEntries = 0;
        try {
            dbEntries = await prisma.aICache.count();
        } catch (error) {
            logger.error('Error contando entradas en DB:', error);
        }

        // Estimar ahorro (asumiendo $0.000002 por token, ~100 tokens por request)
        const estimatedCostPerRequest = 0.0002; // $0.0002 USD
        const estimatedSavings = (this.stats.savedAPICalls * estimatedCostPerRequest).toFixed(4);

        return {
            totalHits: this.stats.hits,
            totalMisses: this.stats.misses,
            hitRate: parseFloat(hitRate.toFixed(2)),
            memoryEntries: this.memoryCache.size,
            dbEntries,
            savedAPICalls: this.stats.savedAPICalls,
            estimatedSavings: `$${estimatedSavings} USD`
        };
    }

    /**
     * Limpiar caché completo
     */
    public async clearAll(): Promise<void> {
        this.memoryCache.clear();
        
        try {
            await prisma.aICache.deleteMany({});
            logger.info('💾 Caché limpiado completamente');
        } catch (error) {
            logger.error('Error limpiando caché:', error);
        }

        // Resetear estadísticas
        this.stats = {
            hits: 0,
            misses: 0,
            savedAPICalls: 0
        };
    }

    /**
     * Limpiar entradas antiguas
     */
    public async cleanExpired(): Promise<number> {
        const expirationDate = new Date(Date.now() - this.config.defaultTTL * 1000);
        
        try {
            const result = await prisma.aICache.deleteMany({
                where: {
                    createdAt: {
                        lt: expirationDate
                    }
                }
            });

            logger.info(`💾 Limpieza de caché: ${result.count} entradas expiradas eliminadas`);
            return result.count;
        } catch (error) {
            logger.error('Error limpiando entradas expiradas:', error);
            return 0;
        }
    }

    /**
     * Obtener top queries cacheadas
     */
    public async getTopQueries(limit: number = 10): Promise<Array<{query: string, hits: number}>> {
        try {
            const topQueries = await prisma.aICache.findMany({
                take: limit,
                orderBy: { hits: 'desc' },
                select: {
                    query: true,
                    hits: true
                }
            });

            return topQueries;
        } catch (error) {
            logger.error('Error obteniendo top queries:', error);
            return [];
        }
    }
}

export default AICacheService;
