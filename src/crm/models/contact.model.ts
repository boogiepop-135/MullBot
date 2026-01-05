import mongoose, { Document, Schema } from 'mongoose';

export interface IContact extends Document {
    phoneNumber: string;
    name?: string;
    pushName?: string;
    language?: string;
    lastInteraction: Date;
    interactionsCount: number;
    tags: string[];
    saleStatus: 'lead' | 'interested' | 'info_requested' | 'payment_pending' | 'appointment_scheduled' | 'appointment_confirmed' | 'completed';
    saleStatusNotes?: string;
    paidAt?: Date;
    isPaused: boolean;
    appointmentDate?: Date;
    appointmentConfirmed: boolean;
    appointmentNotes?: string;
    paymentConfirmedAt?: Date;

    // Agente asignado (opcional)
    assignedAgentPhone?: string;
}

const ContactSchema = new Schema<IContact>({
    phoneNumber: { type: String, required: true, unique: true },
    name: String,
    pushName: String,
    language: String,
    lastInteraction: { type: Date, default: Date.now },
    interactionsCount: { type: Number, default: 1 },
    tags: [{ type: String }],
    saleStatus: { 
        type: String, 
        enum: ['lead', 'interested', 'info_requested', 'payment_pending', 'appointment_scheduled', 'appointment_confirmed', 'completed'],
        default: 'lead'
    },
    saleStatusNotes: String,
    paidAt: Date,
    isPaused: { type: Boolean, default: false },
    appointmentDate: Date,
    appointmentConfirmed: { type: Boolean, default: false },
    appointmentNotes: String,
    paymentConfirmedAt: Date,

    // Agent assignment (phone number of human agent currently handling this contact)
    assignedAgentPhone: { type: String, default: '' }
}, { timestamps: true });

export const ContactModel = mongoose.model<IContact>('Contact', ContactSchema);