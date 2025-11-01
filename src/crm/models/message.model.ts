import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
    phoneNumber: string;
    contactId?: string;
    messageId: string; // ID del mensaje en WhatsApp
    from: string; // Número que envió el mensaje
    to: string; // Número que recibió el mensaje
    body: string;
    type: string; // TEXT, IMAGE, DOCUMENT, VOICE, etc.
    isFromBot: boolean; // true si fue enviado por el bot, false si fue recibido
    timestamp: Date;
    hasMedia: boolean;
    mediaUrl?: string; // URL o path del archivo de media si existe
    metadata?: any; // Información adicional del mensaje
}

const MessageSchema = new Schema<IMessage>({
    phoneNumber: { type: String, required: true, index: true },
    contactId: { type: String, index: true },
    messageId: { type: String, required: true, unique: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    body: { type: String, default: '' },
    type: { type: String, required: true, default: 'TEXT' },
    isFromBot: { type: Boolean, required: true, default: false },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    hasMedia: { type: Boolean, default: false },
    mediaUrl: String,
    metadata: Schema.Types.Mixed
}, { timestamps: true });

// Índices para búsquedas rápidas
MessageSchema.index({ phoneNumber: 1, timestamp: -1 });
MessageSchema.index({ contactId: 1, timestamp: -1 });

export const MessageModel = mongoose.model<IMessage>('Message', MessageSchema);

