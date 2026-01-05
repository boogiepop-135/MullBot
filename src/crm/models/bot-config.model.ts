import mongoose, { Document, Schema } from 'mongoose';

export interface IBotConfig extends Document {
    // Configuración general del bot
    botName: string;
    botEmoji: string;
    botDelay: number; // Delay en milisegundos (por defecto 10000 = 10 segundos)
    
    // Información del negocio
    businessName: string;
    businessDescription: string;
    businessPhone: string;
    businessEmail: string;
    businessAddress: string;
    businessWebsite: string;
    
    // Horario de atención
    businessHours: string;
    
    // Redes sociales
    socialFacebook: string;
    socialInstagram: string;
    socialTiktok: string;
    
    // Configuración de IA
    aiSystemPrompt: string;
    aiModel: string;
    
    // Configuración de vendedor
    sellerPersonality: string; // Personalidad del vendedor (experto, amigable, formal, etc.)
    canOfferDiscounts: boolean; // Si puede ofrecer descuentos
    maxDiscountPercent: number; // Porcentaje máximo de descuento
    discountConditions: string; // Condiciones para ofrecer descuentos
    
    // Mensajes personalizados
    welcomeMessage: string;
    pauseMessage: string;
    paymentConfirmationMessage: string;
    appointmentConfirmationMessage: string;
    
    // Configuración de pagos
    bankInfo: string;
    paypalEmail: string;

    // Agent forwarding
    humanAgentPhone?: string;
    notifyAgentOnAttention?: boolean;

    updatedAt: Date;
    createdAt: Date;
}

const BotConfigSchema = new Schema<IBotConfig>({
    // Configuración general del bot
    botName: { type: String, default: 'MüllBot' },
    botEmoji: { type: String, default: '🌱' },
    botDelay: { type: Number, default: 10000 }, // 10 segundos por defecto
    
    // Información del negocio
    businessName: { type: String, default: 'Müllblue' },
    businessDescription: { type: String, default: 'Transforma residuos en vida con nuestros sistemas de compostaje' },
    businessPhone: { type: String, default: '' },
    businessEmail: { type: String, default: '' },
    businessAddress: { type: String, default: '' },
    businessWebsite: { type: String, default: '' },
    
    // Teléfono de agente humano (opcional) - si está configurado, el bot podrá notificar a este número
    humanAgentPhone: { type: String, default: '' },
    // Notificar automáticamente al agente cuando un contacto solicite atención humana
    notifyAgentOnAttention: { type: Boolean, default: false },

    // Horario de atención
    businessHours: { type: String, default: 'Lunes a Viernes 9am - 7pm' },
    
    // Redes sociales
    socialFacebook: { type: String, default: '' },
    socialInstagram: { type: String, default: '' },
    socialTiktok: { type: String, default: '' },
    
    // Configuración de IA
    aiSystemPrompt: { type: String, default: '' },
    aiModel: { type: String, default: 'gemini-2.0-flash-exp' },
    
    // Configuración de vendedor
    sellerPersonality: { type: String, default: 'experto' }, // experto, amigable, formal, persuasivo
    canOfferDiscounts: { type: Boolean, default: false },
    maxDiscountPercent: { type: Number, default: 10 },
    discountConditions: { type: String, default: 'Solo ofrecer descuentos cuando el cliente pregunte directamente por promociones o descuentos. No ofrecer descuentos de forma proactiva.' },
    
    // Mensajes personalizados
    welcomeMessage: { type: String, default: '' },
    pauseMessage: { type: String, default: `✅ *Solicitud Recibida*

Tu solicitud ha sido registrada correctamente.

👤 *Estado:* En cola para atención humana
⏰ *Horario de atención:* {businessHours}

📝 Enseguida vendrá un asesor a atenderte. El bot ha sido pausado temporalmente para evitar respuestas automáticas.

¡Gracias por tu paciencia! 🌱` },
    paymentConfirmationMessage: { type: String, default: '' },
    appointmentConfirmationMessage: { type: String, default: '' },
    
    // Configuración de pagos
    bankInfo: { type: String, default: '' },
    paypalEmail: { type: String, default: '' },
}, { timestamps: true });

// Crear un documento único para la configuración
BotConfigSchema.statics.getConfig = async function() {
    let config = await this.findOne();
    if (!config) {
        config = await this.create({});
    }
    return config;
};

export const BotConfigModel = mongoose.model<IBotConfig>('BotConfig', BotConfigSchema);

