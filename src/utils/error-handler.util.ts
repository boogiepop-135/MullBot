/**
 * Error Handler Utility - Manejo estandarizado de errores
 * 
 * Proporciona funciones para manejar errores de forma consistente
 * y profesional en toda la aplicación
 */

import logger from '../configs/logger.config';

export interface ErrorContext {
    operation: string;
    userId?: string;
    phoneNumber?: string;
    additionalData?: Record<string, any>;
}

/**
 * Manejar error de forma estandarizada
 */
export function handleError(
    error: any,
    context: ErrorContext,
    userFriendlyMessage?: string
): void {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    const errorStack = error?.stack;
    
    // Log detallado del error
    logger.error(`❌ Error en ${context.operation}:`, {
        error: errorMessage,
        stack: errorStack,
        context: {
            userId: context.userId,
            phoneNumber: context.phoneNumber,
            ...context.additionalData
        }
    });

    // Si hay respuesta HTTP, log adicional
    if (error?.response) {
        logger.error(`   HTTP Status: ${error.response.status}`);
        logger.error(`   Response Data:`, JSON.stringify(error.response.data, null, 2));
    }
}

/**
 * Crear respuesta de error para API
 */
export function createErrorResponse(
    error: any,
    context: ErrorContext,
    userFriendlyMessage?: string
): { error: string; details?: string; code?: string } {
    handleError(error, context, userFriendlyMessage);

    // Determinar código de error
    let errorCode: string | undefined;
    if (error?.response?.status === 404) {
        errorCode = 'NOT_FOUND';
    } else if (error?.response?.status === 403) {
        errorCode = 'FORBIDDEN';
    } else if (error?.response?.status === 401) {
        errorCode = 'UNAUTHORIZED';
    } else if (error?.code === 'P2002') {
        errorCode = 'DUPLICATE_ENTRY';
    }

    return {
        error: userFriendlyMessage || `Error en ${context.operation}`,
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        code: errorCode
    };
}

/**
 * Validar entrada requerida
 */
export function validateRequired(
    value: any,
    fieldName: string
): void {
    if (value === undefined || value === null || value === '') {
        throw new Error(`${fieldName} es requerido`);
    }
}

/**
 * Validar formato de email
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validar formato de teléfono
 */
export function validatePhoneNumber(phone: string): boolean {
    // Remover caracteres especiales
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    // Debe tener entre 10 y 15 dígitos
    return /^\d{10,15}$/.test(cleaned);
}

/**
 * Validar rango numérico
 */
export function validateRange(
    value: number,
    min: number,
    max: number,
    fieldName: string
): void {
    if (value < min || value > max) {
        throw new Error(`${fieldName} debe estar entre ${min} y ${max}`);
    }
}
