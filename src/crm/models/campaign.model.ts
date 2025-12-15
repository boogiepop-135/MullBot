import mongoose, { Document, Schema } from 'mongoose';

export interface ICampaign extends Document {
  name: string;
  message: string;
  scheduledAt: Date;
  status: 'draft' | 'scheduled' | 'sent' | 'failed' | 'sending';
  contacts: string[]; // Array of phone numbers
  sentCount: number;
  failedCount: number;
  createdBy: mongoose.Types.ObjectId;

  // Campos para campañas por lotes
  isBatchCampaign?: boolean; // Indica si es una campaña por lotes
  batchSize?: number; // Tamaño máximo de cada lote
  batchInterval?: number; // Intervalo de pausa entre lotes (en minutos)
  currentBatchIndex?: number; // Índice del lote actual (0-based)
  totalBatches?: number; // Total de lotes a enviar
  saleStatusFilter?: string[]; // Filtro por estado de venta
  nextBatchAt?: Date; // Fecha y hora del próximo lote
}

const CampaignSchema = new Schema<ICampaign>({
  name: { type: String, required: true },
  message: { type: String, required: true },
  scheduledAt: { type: Date },
  status: { type: String, enum: ['draft', 'scheduled', 'sent', 'failed', 'sending'], default: 'draft' },
  contacts: [{ type: String }],
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

  // Campos para campañas por lotes
  isBatchCampaign: { type: Boolean, default: false },
  batchSize: { type: Number },
  batchInterval: { type: Number }, // en minutos
  currentBatchIndex: { type: Number, default: 0 },
  totalBatches: { type: Number },
  saleStatusFilter: [{ type: String }],
  nextBatchAt: { type: Date }
}, { timestamps: true });

export const CampaignModel = mongoose.model<ICampaign>('Campaign', CampaignSchema);