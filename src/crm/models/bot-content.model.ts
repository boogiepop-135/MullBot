import mongoose, { Schema, Document } from 'mongoose';

export interface IBotContent extends Document {
    key: string;
    content: string;
    mediaPath?: string;
    description: string;
    category: 'quick_response' | 'command' | 'other';
    createdAt: Date;
    updatedAt: Date;
}

const BotContentSchema: Schema = new Schema({
    key: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    mediaPath: { type: String },
    description: { type: String },
    category: {
        type: String,
        enum: ['quick_response', 'command', 'other'],
        default: 'other'
    }
}, {
    timestamps: true
});

export const BotContentModel = mongoose.model<IBotContent>('BotContent', BotContentSchema);
