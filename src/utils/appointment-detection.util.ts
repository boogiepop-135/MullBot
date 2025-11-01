import { Message } from "whatsapp-web.js";
import { ContactModel } from "../crm/models/contact.model";
import { NotificationModel } from "../crm/models/notification.model";
import logger from "../configs/logger.config";

/**
 * Detecta si un mensaje contiene una propuesta de horario/cita
 */
export async function detectAppointmentProposal(message: Message): Promise<{ isAppointmentProposal: boolean; proposedDates?: string[] }> {
    const content = message.body?.toLowerCase() || '';
    
    if (!content) {
        return { isAppointmentProposal: false };
    }

    // Palabras clave relacionadas con citas/horarios
    const appointmentKeywords = [
        'cita', 'disponible', 'horario', 'fecha', 'día', 'dias', 'días',
        'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo',
        'mañana', 'tarde', 'noche', 'morning', 'afternoon', 'evening',
        'lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado', 'domingo',
        'appointment', 'schedule', 'available', 'time', 'date'
    ];

    const hasAppointmentKeyword = appointmentKeywords.some(keyword => content.includes(keyword));

    if (!hasAppointmentKeyword) {
        return { isAppointmentProposal: false };
    }

    // Detectar fechas/horarios mencionados
    // Patrones comunes de fechas: "lunes 15", "mañana", "el día 20", etc.
    const datePatterns = [
        /(?:lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)\s+\d+/i,
        /(?:el\s+)?(?:d[íi]a\s+)?\d{1,2}(?:\s+de\s+\w+)?/i,
        /ma[ñn]ana|tarde|noche/i,
        /\d{1,2}:\d{2}/, // Horarios
        /\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/ // Fechas formato dd/mm/yyyy
    ];

    const proposedDates: string[] = [];
    datePatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
            proposedDates.push(...matches);
        }
    });

    // Verificar si el contacto está en un estado relevante para citas
    const user = await message.getContact();
    const contact = await ContactModel.findOne({ phoneNumber: user.number });
    
    // Solo considerar propuestas de cita si el contacto está en payment_pending o appointment_scheduled
    if (contact && (contact.saleStatus === 'payment_pending' || contact.saleStatus === 'appointment_scheduled')) {
        return {
            isAppointmentProposal: true,
            proposedDates: proposedDates.length > 0 ? proposedDates : undefined
        };
    }

    return { isAppointmentProposal: false };
}

/**
 * Crea una notificación cuando un cliente propone un horario
 */
export async function handleAppointmentProposal(message: Message, proposedDates?: string[]): Promise<void> {
    try {
        const user = await message.getContact();
        const contact = await ContactModel.findOne({ phoneNumber: user.number });

        if (!contact) {
            return;
        }

        // Crear notificación para el admin
        await NotificationModel.create({
            type: 'appointment_proposed',
            contactId: contact._id.toString(),
            phoneNumber: contact.phoneNumber,
            contactName: contact.name || contact.pushName || 'Unknown',
            message: message.body,
            metadata: {
                proposedDates: proposedDates || [],
                saleStatus: contact.saleStatus
            },
            read: false
        });

        logger.info(`Appointment proposal notification created for ${user.number}`);
    } catch (error) {
        logger.error(`Error handling appointment proposal: ${error}`);
    }
}

/**
 * Crea una notificación cuando se recibe un comprobante de pago
 */
export async function createPaymentReceiptNotification(contactId: string, phoneNumber: string, contactName?: string, message?: string): Promise<void> {
    try {
        await NotificationModel.create({
            type: 'payment_receipt',
            contactId,
            phoneNumber,
            contactName: contactName || 'Unknown',
            message: message || 'Comprobante de pago recibido',
            metadata: {
                receivedAt: new Date()
            },
            read: false
        });

        logger.info(`Payment receipt notification created for ${phoneNumber}`);
    } catch (error) {
        logger.error(`Error creating payment receipt notification: ${error}`);
    }
}

