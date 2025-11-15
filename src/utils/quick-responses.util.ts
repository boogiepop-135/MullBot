/**
 * Respuestas rápidas predefinidas para opciones del menú
 * Esto ahorra tokens evitando llamadas a APIs de IA para consultas simples
 */

import logger from "../configs/logger.config";

export interface QuickResponse {
    message: string;
    mediaPath?: string;
    intent?: 'info' | 'price' | 'payment' | 'product' | 'purchase';
}

/**
 * Exportar función para obtener el menú principal
 */
export const getMainMenu = (): QuickResponse => {
    return getMainMenuResponse();
};

export const getQuickResponse = (query: string): QuickResponse | null => {
    if (!query) return null;
    
    const normalizedQuery = query.toLowerCase().trim();
    
    // PRIORIDAD 1: Detectar números exactos (1-8) - más específico
    // Captura: "1", "1.", "1)", "1 ", "1-", etc.
    const exactNumberMatch = normalizedQuery.match(/^(\d{1,2})[\s\.\)\-]*$/);
    if (exactNumberMatch) {
        const option = parseInt(exactNumberMatch[1]);
        if (option >= 1 && option <= 8) {
            logger.info(`✅ Quick response match: número "${option}" para query "${query}"`);
            return getOptionResponse(option);
        }
    }
    
    // PRIORIDAD 2: Detectar números al inicio con posibles caracteres después
    const numberMatch = normalizedQuery.match(/^(\d{1,2})[\s\.\)\-]/);
    if (numberMatch) {
        const option = parseInt(numberMatch[1]);
        if (option >= 1 && option <= 8) {
            logger.info(`✅ Quick response match: número "${option}" para query "${query}"`);
            return getOptionResponse(option);
        }
    }
    
    // PRIORIDAD 3: Si el query es solo dígitos (limpio), usarlo directamente
    const cleanNumber = normalizedQuery.replace(/[^\d]/g, '');
    if (cleanNumber && /^[1-8]$/.test(cleanNumber)) {
        const option = parseInt(cleanNumber);
        logger.info(`✅ Quick response match: número limpio "${option}" para query "${query}"`);
        return getOptionResponse(option);
    }
    
    // Tercero: detectar palabras clave (solo si es muy específico para evitar falsos positivos)
    const keywords = normalizedQuery.split(/\s+/);
    
    // Opción 1: proceso de compostaje
    if (keywords.some(k => k === 'proceso') || 
        (keywords.some(k => k.includes('compost')) && keywords.some(k => k.includes('ferment')))) {
        return getOptionResponse(1);
    }
    
    // Opción 2: precios
    if (keywords.some(k => k === 'precio' || k === 'precios' || k === 'costo' || k === 'costos' || 
        k === 'cuanto' || k === 'cuánto' || k.includes('vale') || k.includes('cuesta'))) {
        return getOptionResponse(2);
    }
    
    // Opción 3: métodos de pago
    if ((keywords.some(k => k === 'pago' || k === 'pagos')) && 
        (keywords.some(k => k === 'metodo' || k === 'método' || k === 'forma'))) {
        return getOptionResponse(3);
    }
    if (keywords.some(k => k === 'transferencia' || k === 'tarjeta' || k === 'tarjetas')) {
        return getOptionResponse(3);
    }
    
    // Opción 4: qué incluye / kit
    if (keywords.some(k => k === 'incluye' || k === 'incluye' || k === 'kit' || 
        (k.includes('contiene') && keywords.some(k2 => k2 === 'kit')))) {
        return getOptionResponse(4);
    }
    
    // Opción 5: dimensiones
    if (keywords.some(k => k === 'dimension' || k === 'dimensión' || k === 'dimensiones' || 
        k === 'tamaño' || k === 'tamaños' || k === 'espacio' || k === 'medidas')) {
        return getOptionResponse(5);
    }
    
    // Opción 6: envío
    if (keywords.some(k => k === 'envio' || k === 'envío' || k === 'entrega' || 
        k === 'shipping' || k === 'delivery')) {
        return getOptionResponse(6);
    }
    
    // Opción 7: preguntas frecuentes
    if (keywords.some(k => k === 'pregunta' || k === 'preguntas' || k === 'frecuente' || 
        k === 'faq' || k === 'frecuentes')) {
        return getOptionResponse(7);
    }
    
    // Opción 8: agente humano
    if (keywords.some(k => k === 'agente' || k === 'humano' || k === 'persona' || 
        k === 'representante' || k === 'atencion' || k === 'atención')) {
        return getOptionResponse(8);
    }
    
    // Opción especial: Volver al menú / Menu / Inicio
    if (keywords.some(k => k === 'menu' || k === 'menú' || k === 'volver' || 
        k === 'regresar' || k === 'inicio' || k === 'opciones' || 
        (k === 'ver' && keywords.some(k2 => k2 === 'menu' || k2 === 'menú')))) {
        return getMainMenuResponse();
    }
    
    return null; // No hay respuesta rápida, usar IA
};

const getOptionResponse = (option: number): QuickResponse => {
    switch (option) {
        case 1:
            return {
                message: addMenuFooter(`🌱 *PROCESO DE COMPOSTAJE FERMENTATIVO MÜLLBLUE*

*PASOS SIMPLES:*
1️⃣ *Depositar* residuos orgánicos
2️⃣ *Espolvorear* biocatalizador (50g por kg)
3️⃣ *Compactar* para eliminar aire
4️⃣ *Tapar* herméticamente
5️⃣ *Repetir* hasta llenar

*TIEMPO:*
⏰ Llenado: 4-6 semanas
⏰ Fermentación: 2 semanas adicionales
⏰ Resultado: Tierra fértil lista

*BENEFICIOS:*
✅ Reduce residuos 2.5x
✅ Sin olores ni plagas
✅ Genera biofertilizante líquido

¿Quieres más detalles sobre algún paso específico o te gustaría conocer otra opción? 🌱`),
                mediaPath: 'public/info.png',
                intent: 'info'
            };
            
        case 2:
            return {
                message: addMenuFooter(`💰 *PRECIO Y PROMOCIÓN MÜLLBLUE*

*PRECIO ESPECIAL:*
💵 *$1,490 MXN* (antes $1,890)
🎁 *Ahorro: $400 MXN*

*QUÉ INCLUYE:*
📦 Compostero fementador 12.5L
🌿 Biocatalizador 1kg
🚚 Envío gratis
📞 Acompañamiento personalizado

*PROMOCIÓN VIGENTE:*
⏰ Precio promocional limitado
✨ Disponibilidad limitada

¿Te gustaría conocer más sobre los métodos de pago disponibles o tienes alguna pregunta sobre el producto? 🌱`),
                mediaPath: 'public/precio.png',
                intent: 'price'
            };
            
        case 3:
            return {
                message: addMenuFooter(`💳 *MÉTODOS DE PAGO MÜLLBLUE*

*OPCIÓN 1 - TRANSFERENCIA:*
🏦 Banco Azteca
📝 Cuenta: 127180013756372173
👤 Titular: Aldair Eduardo Rivera García
💵 Monto: $1,490 MXN

*OPCIÓN 2 - TARJETAS:*
💳 Tarjetas de crédito/débito
🔄 Hasta 3 meses sin intereses (3MSI)
🔗 Link de pago: https://mpago.li/1W2JhS5

*VENTAJAS:*
✅ Pago seguro y rápido
✅ Confirmación inmediata
✅ Envío en 2-3 días hábiles

¿Prefieres transferencia o tarjeta? Si tienes más dudas sobre el producto, puedo ayudarte 🌱`),
                mediaPath: 'public/pago.png',
                intent: 'payment'
            };
            
        case 4:
            return {
                message: addMenuFooter(`📦 *CONTENIDO DEL KIT MÜLLBLUE*

*INCLUYE:*
✅ Compostero fermentador 12.5L
✅ Biocatalizador 1kg (equivalente a 2-3 meses)
✅ Envío gratis a toda la República
✅ Guía de uso digital
✅ Acompañamiento personalizado por WhatsApp
✅ Soporte post-venta

*ESPECIFICACIONES:*
📏 Dimensiones: 30x30x40 cm
💧 Capacidad: 12.5 litros máximo
🌿 Material: Plástico de alta calidad
🔒 Tapa hermética anti-olores

¿Tienes alguna pregunta sobre el kit o te gustaría conocer más sobre dimensiones, envío u otra opción? 🌱`),
                mediaPath: 'public/info.png',
                intent: 'product'
            };
            
        case 5:
            return {
                message: addMenuFooter(`📏 *DIMENSIONES Y ESPACIO MÜLLBLUE*

*ESPECIFICACIONES:*
📐 Dimensiones: 30 x 30 x 40 cm (alto)
💧 Capacidad: 12.5 litros máximo
📦 Peso: ~2.5 kg (vacío)
✨ Material: Plástico reciclable

*ESPACIO NECESARIO:*
🏠 Ideal para patios, jardines o terrazas
🏢 También funciona en interiores (cocina/balcón)
📍 Área mínima: 30x30 cm
📌 Superficie: Debe estar nivelada

*VENTAJAS:*
✅ Compacto y práctico
✅ No requiere mucho espacio
✅ Fácil de mover si es necesario

¿Tienes un espacio adecuado o te gustaría conocer más sobre el proceso de uso? 🌱`),
                mediaPath: 'public/info.png',
                intent: 'info'
            };
            
        case 6:
            return {
                message: addMenuFooter(`🚚 *ENVÍO Y ENTREGA MÜLLBLUE*

*ENVÍO GRATIS:*
🚚 A toda la República Mexicana
📦 Empaque seguro y protegido
⏰ Entrega en 2-3 días hábiles
📍 Llega a tu domicilio

*PROCESO:*
1️⃣ Realizas el pago
2️⃣ Confirmamos tu compra
3️⃣ Preparamos tu kit
4️⃣ Te enviamos guía de rastreo
5️⃣ Recibes en tu domicilio

*SEGUIMIENTO:*
📱 Te notificamos cada paso
📧 Recibes número de rastreo
✅ Confirmación de entrega

¿Tienes alguna pregunta sobre el proceso de envío o quieres conocer más sobre métodos de pago? 🌱`),
                mediaPath: 'public/info.png',
                intent: 'info'
            };
            
        case 7:
            return {
                message: addMenuFooter(`❓ *PREGUNTAS FRECUENTES MÜLLBLUE*

*P: ¿Qué puedo agregar?*
R: Cáscaras, restos de comida, carnes, lácteos (poca cantidad), pan, arroz, café molido.

*P: ¿Qué NO puedo agregar?*
R: Estampas de frutas, huesos grandes, semillas grandes, aceite, líquidos excesivos, plásticos, metales.

*P: ¿Cuánto biocatalizador usar?*
R: 50g por cada kg de residuos (equivale a 2 palas por cubeta de 5 litros).

*P: ¿Genera mal olor?*
R: No, el proceso anaeróbico y el biocatalizador eliminan olores completamente.

*P: ¿Atrae plagas?*
R: No, al estar herméticamente cerrado no atrae insectos ni animales.

¿Tienes alguna otra pregunta específica o te gustaría conocer más sobre precios o métodos de pago? 🌱`),
                mediaPath: 'public/info.png',
                intent: 'info'
            };
            
        case 8:
            return {
                message: addMenuFooter(`👤 *HABLAR CON UN AGENTE*

Para hablar directamente con un agente de Müllblue:

📞 Puedes escribir "agente" o "humano" en cualquier momento
⏰ Horario de atención: Lunes a Viernes 9am - 7pm
📱 También puedes llamarnos directamente

*MIENTRAS TANTO:*
Puedo ayudarte con:
✅ Información del producto
✅ Proceso de compra
✅ Métodos de pago
✅ Preguntas técnicas

¿En qué más puedo ayudarte? Puedo resolver la mayoría de tus dudas aquí mismo 🌱`),
                mediaPath: 'public/info.png',
                intent: 'info'
            };
            
        default:
            return null;
    }
};

/**
 * Respuesta del menú principal
 */
const getMainMenuResponse = (): QuickResponse => {
    return {
        message: `👋 *MENÚ PRINCIPAL MÜLLBLUE*

¡Hola! ¿En qué puedo ayudarte hoy? 🤔

*Opciones disponibles:*

*1.* Conocer el proceso de compostaje fermentativo
*2.* Dudas sobre precios y promociones
*3.* Métodos de pago disponibles
*4.* ¿Qué incluye el kit?
*5.* Dimensiones y espacio necesario
*6.* Información sobre envío y entrega
*7.* Preguntas frecuentes
*8.* Hablar con un agente

Escribe el *número* de la opción que te interesa o pregunta lo que necesites 🌱

*💡 Tip:* Puedes escribir *menú* o *volver* en cualquier momento para ver estas opciones nuevamente`,
        mediaPath: 'public/info.png',
        intent: 'info'
    };
};

/**
 * Función para agregar footer de volver al menú a las respuestas
 */
export const addMenuFooter = (message: string): string => {
    return `${message}

---
*💡 Tip:* Escribe *menú* o *volver* para ver todas las opciones disponibles 🌱`;
};

