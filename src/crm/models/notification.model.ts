import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
    type: 'payment_receipt' | 'appointment_request' | 'appointment_proposed';
    contactId: string;
    phoneNumber: string;
    contactName?: string;
    message?: string;
    metadata?: any; // Para almacenar datos adicionales como horarios propuestos, etc.
    read: boolean;
    createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
    type: { 
        type: String, 
        enum: ['payment_receipt', 'appointment_request', 'appointment_proposed'],
        required: true
    },
    contactId: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    contactName: String,
    message: String,
    metadata: Schema.Types.Mixed,
    read: { type: Boolean, default: false }
}, { timestamps: true });

export const NotificationModel = mongoose.model<INotification>('Notification', NotificationSchema);

