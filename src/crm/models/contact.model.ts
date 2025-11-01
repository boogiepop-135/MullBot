import mongoose, { Document, Schema } from 'mongoose';

export interface IContact extends Document {
    phoneNumber: string;
    name?: string;
    pushName?: string;
    language?: string;
    lastInteraction: Date;
    interactionsCount: number;
    tags: string[];
    saleStatus: 'interested' | 'potential_buyer' | 'paid' | 'lead';
    saleStatusNotes?: string;
    paidAt?: Date;
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
        enum: ['interested', 'potential_buyer', 'paid', 'lead'],
        default: 'lead'
    },
    saleStatusNotes: String,
    paidAt: Date
}, { timestamps: true });

export const ContactModel = mongoose.model<IContact>('Contact', ContactSchema);