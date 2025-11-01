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
        // MongoStore guarda automáticamente la sesión de WhatsApp en MongoDB
        // La colección por defecto es 'auth_sessions' pero puede personalizarse
        const store = new MongoStore({ 
            mongoose: mongoose
            // La sesión se guarda automáticamente en MongoDB y persiste entre reinicios
            // No se borra con cada push en Railway porque está en la base de datos
        });
        
        logger.info("MongoStore created successfully - Sessions will be stored in MongoDB");
        logger.info("WhatsApp session will persist across deployments on Railway");
        return store;
    } catch (error) {
        logger.error("Error creating MongoStore:", error);
        throw error;
    }
}
