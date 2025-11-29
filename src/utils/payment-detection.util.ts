import { Message, MessageTypes } from "whatsapp-web.js";
import { ContactModel } from "../crm/models/contact.model";
import logger from "../configs/logger.config";

/**
 * Detecta si un mensaje contiene un comprobante de pago
 */
export async function detectPaymentReceipt(message: Message): Promise<boolean> {
    // Verificar si el mensaje tiene media (imagen, documento, etc.)
    if (!message.hasMedia) {
        return false;
    }

    // Verificar el tipo de mensaje
    const mediaTypes = [MessageTypes.IMAGE, MessageTypes.DOCUMENT];
    if (!mediaTypes.includes(message.type)) {
        return false;
    }

    // Verificar si el mensaje tiene texto que menciona pago/comprobante
    const content = message.body?.toLowerCase() || '';
    const paymentKeywords = [
        'pago', 'pague', 'pagado', 'comprobante', 'recibo', 'transferencia',
        'deposito', 'transfer', 'payment', 'receipt', 'paid', 'proof',
        'captura', 'screenshot', 'comprobante de pago', 'voucher'
    ];

    const hasPaymentKeyword = paymentKeywords.some(keyword => content.includes(keyword));

    // Si tiene media y menciona pago, probablemente es un comprobante
    if (hasPaymentKeyword) {
        return true;
    }

    // También considerar imágenes/documents sin texto si el contacto está en un estado que sugiere pago
    // Extraer número del mensaje sin usar getContact (para evitar errores)
    const phoneNumber = message.from.split('@')[0];
    const contact = await ContactModel.findOne({ phoneNumber });
    
    // Si el contacto está en estado "interested" o "info_requested", probablemente quiere pagar
    if (contact && (contact.saleStatus === 'interested' || contact.saleStatus === 'info_requested')) {
        // Si envía una imagen/documento sin texto claro, pero está en estado de interés, puede ser comprobante
        if (message.type === MessageTypes.IMAGE || message.type === MessageTypes.DOCUMENT) {
            return true;
        }
    }

    // Si el contacto ya tiene appointment_confirmed y envía media, puede ser comprobante adicional
    if (contact && contact.saleStatus === 'appointment_confirmed') {
        if (message.type === MessageTypes.IMAGE || message.type === MessageTypes.DOCUMENT) {
            return true;
        }
    }

    return false;
}

/**
 * Actualiza el estado del contacto cuando se detecta un comprobante de pago
 */
export async function handlePaymentReceipt(message: Message): Promise<void> {
    try {
        // Extraer número del mensaje sin usar getContact (para evitar errores)
        const phoneNumber = message.from.split('@')[0];
        const contact = await ContactModel.findOne({ phoneNumber });

        if (!contact) {
            return;
        }

        let newStatus = contact.saleStatus;
        const updateData: any = {
            paidAt: new Date()
        };

        // Actualizar estado según el estado actual del contacto
        if (contact.saleStatus === 'lead' || contact.saleStatus === 'interested' || contact.saleStatus === 'info_requested') {
            // Si es un lead, interesado o pidió info, actualizar a payment_pending
            newStatus = 'payment_pending';
            updateData.saleStatus = 'payment_pending';
            updateData.saleStatusNotes = `Comprobante recibido el ${new Date().toLocaleString('es-ES')}`;
        } else if (contact.saleStatus === 'appointment_confirmed') {
            // Si ya tiene cita confirmada y envía otro comprobante, mantener el estado pero actualizar notas
            // No cambiar el estado porque ya tienen cita confirmada
            updateData.saleStatusNotes = `${contact.saleStatusNotes || ''}\nNuevo comprobante recibido el ${new Date().toLocaleString('es-ES')}`;
        } else if (contact.saleStatus === 'payment_pending') {
            // Si ya está en payment_pending, mantener el estado pero actualizar notas
            updateData.saleStatusNotes = `${contact.saleStatusNotes || ''}\nNuevo comprobante recibido el ${new Date().toLocaleString('es-ES')}`;
        } else if (contact.saleStatus === 'appointment_scheduled') {
            // Si tiene cita agendada pero envía comprobante, puede ser adicional
            // Mantener estado pero actualizar notas
            updateData.saleStatusNotes = `${contact.saleStatusNotes || ''}\nComprobante adicional recibido el ${new Date().toLocaleString('es-ES')}`;
        }

        const updatedContact = await ContactModel.findOneAndUpdate(
            { phoneNumber },
            { $set: updateData },
            { new: true }
        );

        // Crear notificación para el admin
        try {
            const { NotificationModel } = await import('../crm/models/notification.model');
            if (updatedContact) {
                await NotificationModel.create({
                    type: 'payment_receipt',
                    contactId: updatedContact._id.toString(),
                    phoneNumber: updatedContact.phoneNumber,
                    contactName: updatedContact.name || updatedContact.pushName || 'Unknown',
                    message: message.body || 'Comprobante de pago recibido',
                    metadata: {
                        receivedAt: new Date()
                    },
                    read: false
                });
            }
        } catch (notifError) {
            logger.error(`Error creating payment notification: ${notifError}`);
            // No fallar si la notificación no se crea
        }

        logger.info(`Payment receipt detected for ${phoneNumber}, status updated to: ${newStatus || contact.saleStatus}`);
    } catch (error) {
        logger.error(`Error handling payment receipt: ${error}`);
    }
}

/**
 * Envía mensaje automático cuando se confirma un pago (desde el admin)
 */
export async function sendPaymentConfirmationMessage(client: any, phoneNumber: string): Promise<void> {
    try {
        const formattedNumber = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
        
        const message = `✅ *Pago Confirmado*

¡Gracias por tu pago! Hemos confirmado tu comprobante de pago.

📅 *Próximo paso - Agendar Cita:*
Por favor, comparte tu disponibilidad para agendar la cita de instalación de tu compostero Müllblue.

📆 *Puedes enviarme:*
• Los días de la semana que te funcionan mejor
• Los horarios disponibles
• Cualquier preferencia especial

Una vez que recibamos tu disponibilidad, coordinaremos la fecha exacta de instalación y te enviaremos la confirmación.

¿Qué días de la semana te funcionan mejor para la instalación?`;

        await client.sendMessage(formattedNumber, message);
        logger.info(`Payment confirmation message sent to ${phoneNumber}`);
    } catch (error) {
        logger.error(`Error sending payment confirmation message: ${error}`);
    }
}

/**
 * Envía mensaje cuando se confirma una cita
 */
export async function sendAppointmentConfirmationMessage(client: any, phoneNumber: string, appointmentDate?: Date, notes?: string): Promise<void> {
    try {
        const formattedNumber = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
        
        let message = `✅ *Cita Confirmada*

¡Tu cita de instalación ha sido confirmada! 🎉

📅 *Fecha de Instalación:*`;

        if (appointmentDate) {
            const dateStr = appointmentDate.toLocaleString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            message += ` ${dateStr}`;
        } else {
            message += ` Pronto te confirmaremos la fecha exacta`;
        }

        message += `\n\n🔧 *Instalación del Compostero Müllblue*\n\nNos comunicaremos contigo antes de la fecha confirmada para confirmar los detalles finales.`;

        if (notes) {
            message += `\n\n📝 *Notas:* ${notes}`;
        }

        message += `\n\nSi tienes alguna pregunta o necesitas cambiar la fecha, por favor contáctanos.`;

        await client.sendMessage(formattedNumber, message);
        logger.info(`Appointment confirmation message sent to ${phoneNumber}`);
    } catch (error) {
        logger.error(`Error sending appointment confirmation message: ${error}`);
    }
}

