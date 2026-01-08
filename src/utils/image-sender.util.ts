import logger from '../configs/logger.config';
import path from 'path';
import fs from 'fs';

/**
 * Detectar y extraer comandos de imagen del texto de respuesta
 * Formato esperado: [ENVIAR IMAGEN: nombre.png]
 */
export function detectImageCommands(text: string): {
    images: string[];
    cleanText: string;
} {
    const imageRegex = /\[ENVIAR IMAGEN:\s*([^\]]+)\]/gi;
    const images: string[] = [];
    let match;

    // Extraer todos los nombres de imágenes
    while ((match = imageRegex.exec(text)) !== null) {
        const imageName = match[1].trim();
        images.push(imageName);
        logger.info(`🖼️ Detectado comando de imagen: ${imageName}`);
    }

    // Remover los comandos de imagen del texto
    const cleanText = text.replace(imageRegex, '').trim();

    return { images, cleanText };
}

/**
 * Obtener la ruta completa de una imagen desde la carpeta public
 */
export function getImagePath(imageName: string): string | null {
    // Ruta base de imágenes (carpeta public)
    const baseImagePath = path.join(__dirname, '../../public');
    
    // Construir ruta completa
    const fullPath = path.join(baseImagePath, imageName);

    // Verificar si el archivo existe
    if (fs.existsSync(fullPath)) {
        logger.info(`✅ Imagen encontrada: ${fullPath}`);
        return fullPath;
    }

    logger.warn(`⚠️ Imagen no encontrada: ${fullPath}`);
    return null;
}

/**
 * Validar que la imagen esté en la lista de imágenes permitidas
 */
export function isAllowedImage(imageName: string): boolean {
    const allowedImages = ['info.png', 'precio.png', 'pago.png'];
    return allowedImages.includes(imageName.toLowerCase());
}

/**
 * Procesar respuesta completa: detectar imágenes, enviarlas y retornar texto limpio
 */
export async function processResponseWithImages(
    text: string,
    sendImageCallback: (imagePath: string) => Promise<void>
): Promise<string> {
    const { images, cleanText } = detectImageCommands(text);

    if (images.length === 0) {
        return text; // No hay imágenes, retornar texto original
    }

    // Enviar cada imagen detectada
    for (const imageName of images) {
        // Validar que sea una imagen permitida
        if (!isAllowedImage(imageName)) {
            logger.warn(`⚠️ Imagen no permitida: ${imageName}`);
            continue;
        }

        // Obtener ruta de la imagen
        const imagePath = getImagePath(imageName);
        if (!imagePath) {
            logger.error(`❌ No se pudo encontrar la imagen: ${imageName}`);
            continue;
        }

        // Enviar imagen usando el callback
        try {
            await sendImageCallback(imagePath);
            logger.info(`✅ Imagen enviada: ${imageName}`);
        } catch (error) {
            logger.error(`❌ Error enviando imagen ${imageName}:`, error);
        }
    }

    return cleanText;
}
