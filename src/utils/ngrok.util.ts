import axios from 'axios';
import logger from '../configs/logger.config';
import EnvConfig from '../configs/env.config';

/**
 * Obtiene la URL pública de ngrok desde la API local
 */
export async function getNgrokUrl(): Promise<string | null> {
    try {
        // Intentar obtener la URL desde la API de ngrok
        // En Docker, ngrok está en el servicio 'ngrok', en local es localhost
        const ngrokHost = process.env.NGROK_API_HOST || 'localhost';
        const ngrokUrl = `http://${ngrokHost}:4040/api/tunnels`;
        
        const response = await axios.get(ngrokUrl, {
            timeout: 3000
        });

        if (response.data && response.data.tunnels && response.data.tunnels.length > 0) {
            // Buscar el túnel HTTPS
            const httpsTunnel = response.data.tunnels.find((tunnel: any) => 
                tunnel.proto === 'https' || tunnel.config?.addr?.includes('3001')
            );
            
            if (httpsTunnel && httpsTunnel.public_url) {
                logger.info(`Ngrok URL obtenida: ${httpsTunnel.public_url}`);
                return httpsTunnel.public_url;
            }

            // Si no hay HTTPS, usar el primero disponible
            if (response.data.tunnels[0]?.public_url) {
                logger.info(`Ngrok URL obtenida (fallback): ${response.data.tunnels[0].public_url}`);
                return response.data.tunnels[0].public_url;
            }
        }
    } catch (error: any) {
        // Si ngrok no está disponible o no responde, no es crítico
        logger.debug(`No se pudo obtener URL de ngrok: ${error.message}`);
    }

    return null;
}

/**
 * Obtiene información completa del sistema para enviar al admin
 */
export async function getSystemInfo(): Promise<{
    ngrokUrl: string | null;
    publicUrl: string | null;
    localUrl: string;
    adminCredentials: { username: string; password: string };
    serverStatus: string;
}> {
    const ngrokUrl = await getNgrokUrl();
    
    // Priorizar dominio propio si está configurado, luego ngrok, luego null
    const publicUrl = process.env.PUBLIC_URL || ngrokUrl || null;
    const localUrl = `http://localhost:${EnvConfig.PORT || 3001}`;
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    return {
        ngrokUrl,
        publicUrl,
        localUrl,
        adminCredentials: {
            username: adminUsername,
            password: adminPassword
        },
        serverStatus: 'running'
    };
}
