import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomStatus extends Document {
  name: string; // Nombre del estado personalizado (ej: "Cliente Potencial", "En Negociación")
  value: string; // Valor interno (ej: "potential_client", "negotiating")
  color?: string; // Color para la UI (hex code)
  description?: string;
  order: number; // Orden de visualización
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
}

const CustomStatusSchema = new Schema<ICustomStatus>({
  name: { type: String, required: true },
  value: { type: String, required: true, unique: true },
  color: { type: String, default: '#3B82F6' }, // blue-500 por defecto
  description: String,
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export const CustomStatusModel = mongoose.model<ICustomStatus>('CustomStatus', CustomStatusSchema);
