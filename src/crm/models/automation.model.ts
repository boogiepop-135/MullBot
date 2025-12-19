import mongoose, { Document, Schema } from 'mongoose';

export interface IAutomation extends Document {
  name: string;
  description?: string;
  triggerType: 'status_change' | 'message_received' | 'time_based' | 'tag_added';

  // Condiciones del trigger
  triggerConditions: {
    fromStatus?: string; // Estado desde el que se cambió
    toStatus?: string;   // Estado al que se cambió
    messageContains?: string[]; // Palabras clave en el mensaje
    tags?: string[]; // Tags que deben tener el contacto
    afterHours?: number; // Horas después de la última interacción (para time_based)
  };

  // Acciones a ejecutar
  actions: {
    type: 'send_message' | 'change_status' | 'add_tag' | 'pause_bot' | 'create_notification';
    value: string; // Mensaje a enviar, nuevo estado, tag, etc.
  }[];

  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  lastTriggered?: Date;
  triggerCount: number;
  
  // Programación de ejecución
  scheduledAt?: Date; // Fecha y hora específica para ejecutar
  scheduleType?: 'once' | 'daily' | 'weekly' | 'monthly'; // Tipo de programación
  scheduleTime?: string; // Hora del día (HH:mm) para programaciones recurrentes
  scheduleDays?: number[]; // Días de la semana (0-6) para programaciones semanales
}

const AutomationSchema = new Schema<IAutomation>({
  name: { type: String, required: true },
  description: String,
  triggerType: {
    type: String,
    enum: ['status_change', 'message_received', 'time_based', 'tag_added'],
    required: true
  },
  triggerConditions: {
    fromStatus: String,
    toStatus: String,
    messageContains: [String],
    tags: [String],
    afterHours: Number
  },
  actions: [{
    type: {
      type: String,
      enum: ['send_message', 'change_status', 'add_tag', 'pause_bot', 'create_notification'],
      required: true
    },
    value: { type: String, required: true }
  }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  lastTriggered: Date,
  triggerCount: { type: Number, default: 0 },
  
  // Programación de ejecución
  scheduledAt: Date,
  scheduleType: { type: String, enum: ['once', 'daily', 'weekly', 'monthly'] },
  scheduleTime: String, // Formato HH:mm
  scheduleDays: [Number] // Array de días (0=domingo, 6=sábado)
}, { timestamps: true });

export const AutomationModel = mongoose.model<IAutomation>('Automation', AutomationSchema);
