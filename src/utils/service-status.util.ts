/**
 * Utilidad para validar estado de servicios y detectar consultas sobre estado
 */

import logger from '../configs/logger.config';
import { EvolutionAPIv2Service } from '../services/evolution-api-v2.service';
import { BotManager } from '../bot.manager';

/**
 * Detectar si el usuario pregunta por el estado de servicios
 */
export function isServiceStatusQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase().trim();
    
    const statusKeywords = [
        'está funcionando',
        'está la api',
        'api funcionando',
        'estado del servicio',
        'estado de la api',
        'está el servicio',
        'servicio funcionando',
        'está on',
        'está off',
        'api on',
        'api off',
        'estado servicios',
        'status api',
        'servicios activos',
        'infraestructura',
        'conexión'
    ];

    return statusKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Obtener información del estado de la API
 */
export async function getAPIStatus(): Promise<{
    isConnected: boolean;
    status: string;
    details?: string;
}> {
    try {
        const botManager = BotManager.getInstance();
        const evolutionAPI = botManager.getEvolutionAPI();
        
        const isConnected = await evolutionAPI.isConnected();
        const status = await evolutionAPI.getStatus();
        
        return {
            isConnected,
            status: isConnected ? 'ONLINE' : 'OFFLINE',
            details: status ? `Instancia: ${status.instance?.instanceName || 'N/A'}, Estado: ${status.instance?.status || 'N/A'}` : 'No se pudo obtener estado'
        };
    } catch (error: any) {
        logger.error('Error obteniendo estado de API:', error);
        return {
            isConnected: false,
            status: 'ERROR',
            details: `Error al verificar estado: ${error.message || 'Desconocido'}`
        };
    }
}

/**
 * Generar respuesta sobre el estado de servicios
 */
export async function generateServiceStatusResponse(query: string): Promise<string> {
    const apiStatus = await getAPIStatus();
    
    let response = `🔍 **Estado de Servicios:**\n\n`;
    
    if (apiStatus.isConnected) {
        response += `✅ **Evolution API: ONLINE**\n`;
        response += `📡 La API está funcionando correctamente.\n`;
        if (apiStatus.details) {
            response += `\n📋 Detalles: ${apiStatus.details}\n`;
        }
    } else {
        response += `❌ **Evolution API: OFFLINE**\n`;
        response += `⚠️ La API no está disponible en este momento.\n`;
        if (apiStatus.details) {
            response += `\n🔧 Detalles: ${apiStatus.details}\n`;
        }
        response += `\n💡 Si el problema persiste, contacta al soporte técnico.`;
    }
    
    response += `\n\n🔄 **Infraestructura:** Evolution API + PostgreSQL\n`;
    
    return response;
}

