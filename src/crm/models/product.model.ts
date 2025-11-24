import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
    name: string;
    description: string;
    price: number;
    sizes: string[];
    promotions: string;
    imageUrl: string;
    category: string;
    inStock: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const ProductSchema: Schema = new Schema({
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    sizes: [{ type: String }],
    promotions: { type: String },
    imageUrl: { type: String },
    category: { type: String },
    inStock: { type: Boolean, default: true },
}, {
    timestamps: true
});

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
