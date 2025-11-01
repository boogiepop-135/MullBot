import mongoose, { Document, Schema } from 'mongoose';

export interface IBotConfig extends Document {
    botDelay: number; // Delay en milisegundos (por defecto 10000 = 10 segundos)
    updatedAt: Date;
    createdAt: Date;
}

const BotConfigSchema = new Schema<IBotConfig>({
    botDelay: { type: Number, default: 10000 }, // 10 segundos por defecto
}, { timestamps: true });

// Crear un documento único para la configuración
BotConfigSchema.statics.getConfig = async function() {
    let config = await this.findOne();
    if (!config) {
        config = await this.create({ botDelay: 10000 });
    }
    return config;
};

export const BotConfigModel = mongoose.model<IBotConfig>('BotConfig', BotConfigSchema);

