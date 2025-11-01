import { MongoStore } from "wwebjs-mongo";
import mongoose from "mongoose";
import logger from "./logger.config";

export async function getMongoStore(): Promise<InstanceType<typeof MongoStore>> {
    try {
        // Verificar que mongoose esté conectado
        if (mongoose.connection.readyState !== 1) {
            throw new Error("MongoDB must be connected before creating MongoStore");
        }

        // Crear y retornar MongoStore
        // IMPORTANTE: NO usar MongoStore.connect() - ese método NO existe
        const store = new MongoStore({ mongoose: mongoose });
        
        logger.info("MongoStore created successfully");
        return store;
    } catch (error) {
        logger.error("Error creating MongoStore:", error);
        throw error;
    }
}
