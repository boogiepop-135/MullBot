import { RemoteAuth } from "whatsapp-web.js";
import EnvConfig from "./env.config";
// NOTA: Este archivo ya no se usa con Evolution API, pero se mantiene por compatibilidad
// MongoStore eliminado en migración a PostgreSQL/Prisma

export async function getClientConfig() {
    // DEPRECATED: Este archivo ya no se usa con Evolution API
    // Evolution API maneja las sesiones directamente en PostgreSQL
    // Este código nunca se ejecuta - la función lanza un error inmediatamente
    throw new Error('getClientConfig is deprecated. Evolution API handles sessions directly. This file is no longer used.');
    
    // Código legacy nunca alcanzado (TypeScript requiere que retornemos algo pero nunca se ejecuta):
    return {} as any;
}
