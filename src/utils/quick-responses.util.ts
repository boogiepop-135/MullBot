import prisma from '../database/prisma';

/**
 * Respuestas rápidas predefinidas para opciones del menú
 */

// Función para obtener respuesta del menú principal
export const getMainMenuResponse = async (): Promise<string> => {
    try {
        const content = await prisma.botContent.findUnique({ where: { key: 'main_menu' } });
        if (content) {
            return content.content;
        }
    } catch (error) {
        console.error('Error fetching main menu:', error);
    }

    // Fallback si no se encuentra en la base de datos
    return `👋 *MENÚ PRINCIPAL MÜLLBLUE*

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

*💡 Tip:* Puedes escribir *menú* o *volver* en cualquier momento para ver estas opciones nuevamente`;
};

// Función para obtener respuesta de una opción específica
export const getOptionResponse = async (optionNumber: number): Promise<string | null> => {
    try {
        const key = `option_${optionNumber}_${getOptionKey(optionNumber)}`;
        const content = await prisma.botContent.findUnique({ where: { key } });
        if (content) {
            return content.content;
        }
    } catch (error) {
        console.error(`Error fetching option ${optionNumber}:`, error);
    }
    return null;
};

// Helper para obtener la clave de cada opción
function getOptionKey(optionNumber: number): string {
    const keys: { [key: number]: string } = {
        1: 'process',
        2: 'price',
        3: 'payment',
        4: 'kit',
        5: 'dimensions',
        6: 'shipping',
        7: 'faq',
        8: 'agent'
    };
    return keys[optionNumber] || '';
}

// Función para agregar el footer a cualquier mensaje
export const addMenuFooter = (message: string): string => {
    return `${message}

---
*💡 Tip:* Escribe *menú* o *volver* para ver todas las opciones disponibles 🌱`;
};
