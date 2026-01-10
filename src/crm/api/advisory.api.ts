import { Router, Request, Response } from 'express';
import prisma from '../../database/prisma';
import logger from '../../configs/logger.config';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

/**
 * GET /api/advisory/queue
 * Obtener todas las asesorías pendientes y activas
 */
router.get('/queue', authenticate, async (req: Request, res: Response) => {
    try {
        const advisories = await prisma.advisory.findMany({
            where: {
                status: {
                    in: ['PENDING', 'ACTIVE']
                }
            },
            orderBy: [
                { priority: 'desc' },
                { startedAt: 'asc' }
            ]
        });

        // Log para debugging
        logger.debug(`📋 Cola de asesorías: ${advisories.length} encontradas`);

        res.json({
            success: true,
            advisories,
            count: advisories.length
        });
    } catch (error: any) {
        logger.error('Error obteniendo cola de asesorías:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener cola de asesorías',
            message: error.message
        });
    }
});

/**
 * POST /api/advisory/create
 * Crear una nueva solicitud de asesoría
 */
router.post('/create', async (req: Request, res: Response) => {
    try {
        const { customerPhone, customerName } = req.body;

        if (!customerPhone) {
            return res.status(400).json({
                success: false,
                error: 'customerPhone es requerido'
            });
        }

        // Normalizar número de teléfono para búsqueda
        const phoneNumber = customerPhone.split('@')[0];
        const phoneNumberWithSuffix = customerPhone.includes('@') ? customerPhone : `${customerPhone}@s.whatsapp.net`;

        // Verificar si ya tiene una asesoría pendiente o activa
        const existing = await prisma.advisory.findFirst({
            where: {
                OR: [
                    { customerPhone: customerPhone },
                    { customerPhone: phoneNumberWithSuffix },
                    { customerPhone: phoneNumber }
                ],
                status: {
                    in: ['PENDING', 'ACTIVE']
                }
            }
        });

        if (existing) {
            return res.json({
                success: false,
                message: 'Ya existe una asesoría activa para este número',
                advisory: existing
            });
        }

        // Obtener últimos 5 mensajes para el resumen (buscar con diferentes formatos de número)
        const recentMessages = await prisma.message.findMany({
            where: {
                OR: [
                    { phoneNumber: customerPhone },
                    { phoneNumber: phoneNumberWithSuffix },
                    { phoneNumber: phoneNumber }
                ]
            },
            orderBy: { timestamp: 'desc' },
            take: 5
        });

        const conversationSnapshot = recentMessages.reverse().map(msg => ({
            from: msg.isFromBot ? 'bot' : 'customer',
            body: msg.body,
            timestamp: msg.timestamp
        }));

        // Generar resumen automático
        const summary = await generateConversationSummary(conversationSnapshot);

        // Crear asesoría usando el número con sufijo (formato completo)
        const advisory = await prisma.advisory.create({
            data: {
                customerPhone: phoneNumberWithSuffix,
                customerName: customerName || 'Cliente',
                status: 'PENDING',
                conversationSnapshot,
                summary,
                lastActivityAt: new Date()
            }
        });

        logger.info(`📞 Nueva asesoría creada: ${advisory.id} para ${customerPhone}`);

        res.json({
            success: true,
            advisory,
            message: 'Asesoría creada exitosamente'
        });
    } catch (error: any) {
        logger.error('Error creando asesoría:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear asesoría',
            message: error.message
        });
    }
});

/**
 * POST /api/advisory/:id/accept
 * Aceptar una asesoría (asesor toma el caso)
 */
router.post('/:id/accept', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { agentPhone } = req.body;

        const advisory = await prisma.advisory.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                agentPhone,
                acceptedAt: new Date(),
                lastActivityAt: new Date()
            }
        });

        // Despausar al cliente si estaba pausado (buscar con diferentes formatos de número)
        const customerPhone = advisory.customerPhone.split('@')[0];
        const customerPhoneWithSuffix = advisory.customerPhone.includes('@') ? advisory.customerPhone : `${advisory.customerPhone}@s.whatsapp.net`;

        await prisma.contact.updateMany({
            where: {
                OR: [
                    { phoneNumber: advisory.customerPhone },
                    { phoneNumber: customerPhoneWithSuffix },
                    { phoneNumber: customerPhone }
                ]
            },
            data: { isPaused: false }
        });

        logger.info(`✅ Asesoría ${id} aceptada por agente ${agentPhone}`);

        res.json({
            success: true,
            advisory,
            message: 'Asesoría aceptada'
        });
    } catch (error: any) {
        logger.error('Error aceptando asesoría:', error);
        res.status(500).json({
            success: false,
            error: 'Error al aceptar asesoría',
            message: error.message
        });
    }
});

/**
 * POST /api/advisory/:id/complete
 * Completar/finalizar una asesoría
 */
router.post('/:id/complete', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const advisory = await prisma.advisory.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                notes: notes || null
            }
        });

        // Despausar al cliente
        await prisma.contact.updateMany({
            where: { phoneNumber: advisory.customerPhone },
            data: { isPaused: false }
        });

        logger.info(`✅ Asesoría ${id} completada`);

        res.json({
            success: true,
            advisory,
            message: 'Asesoría completada exitosamente'
        });
    } catch (error: any) {
        logger.error('Error completando asesoría:', error);
        res.status(500).json({
            success: false,
            error: 'Error al completar asesoría',
            message: error.message
        });
    }
});

/**
 * POST /api/advisory/:id/cancel
 * Cancelar/expulsar una asesoría
 */
router.post('/:id/cancel', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const advisory = await prisma.advisory.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                completedAt: new Date(),
                notes: reason || 'Cancelado por el asesor'
            }
        });

        // Despausar al cliente
        await prisma.contact.updateMany({
            where: { phoneNumber: advisory.customerPhone },
            data: { isPaused: false }
        });

        logger.info(`❌ Asesoría ${id} cancelada`);

        res.json({
            success: true,
            advisory,
            message: 'Asesoría cancelada'
        });
    } catch (error: any) {
        logger.error('Error cancelando asesoría:', error);
        res.status(500).json({
            success: false,
            error: 'Error al cancelar asesoría',
            message: error.message
        });
    }
});

/**
 * GET /api/advisory/:id/messages
 * Obtener mensajes de la conversación
 */
router.get('/:id/messages', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { limit = 20 } = req.query;

        const advisory = await prisma.advisory.findUnique({
            where: { id }
        });

        if (!advisory) {
            return res.status(404).json({
                success: false,
                error: 'Asesoría no encontrada'
            });
        }

        // Buscar mensajes usando el número normalizado y con sufijo
        const phoneNumber = advisory.customerPhone.split('@')[0];
        const phoneNumberWithSuffix = advisory.customerPhone.includes('@') ? advisory.customerPhone : `${advisory.customerPhone}@s.whatsapp.net`;

        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { phoneNumber: advisory.customerPhone },
                    { phoneNumber: phoneNumberWithSuffix },
                    { phoneNumber: phoneNumber }
                ]
            },
            orderBy: { timestamp: 'desc' },
            take: Number(limit)
        });

        res.json({
            success: true,
            messages: messages.reverse(),
            count: messages.length
        });
    } catch (error: any) {
        logger.error('Error obteniendo mensajes:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener mensajes',
            message: error.message
        });
    }
});

/**
 * GET /api/advisory/stats
 * Obtener estadísticas de asesorías
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
    try {
        const pending = await prisma.advisory.count({
            where: { status: 'PENDING' }
        });

        const active = await prisma.advisory.count({
            where: { status: 'ACTIVE' }
        });

        const completedToday = await prisma.advisory.count({
            where: {
                status: 'COMPLETED',
                completedAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        });

        res.json({
            success: true,
            stats: {
                pending,
                active,
                completedToday
            }
        });
    } catch (error: any) {
        logger.error('Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas',
            message: error.message
        });
    }
});

/**
 * Generar un resumen breve de la conversación
 */
async function generateConversationSummary(messages: any[]): Promise<string> {
    if (messages.length === 0) {
        return 'Sin conversación previa';
    }

    const lastMessages = messages.slice(-5);
    const customerMessages = lastMessages.filter(m => m.from === 'customer');
    
    if (customerMessages.length === 0) {
        return 'Cliente acaba de iniciar conversación';
    }

    // Tomar las últimas 2 preguntas del cliente
    const lastQuestions = customerMessages.slice(-2).map(m => m.body);
    
    let summary = '';
    if (lastQuestions.length > 0) {
        summary = `Preguntó: "${lastQuestions[lastQuestions.length - 1].substring(0, 80)}..."`;
    }

    // Detectar intención si es posible
    const allText = customerMessages.map(m => m.body.toLowerCase()).join(' ');
    
    if (allText.includes('precio') || allText.includes('costo') || allText.includes('cuanto')) {
        summary += ' | Interés en precios';
    } else if (allText.includes('comprar') || allText.includes('adquirir') || allText.includes('pagar')) {
        summary += ' | Quiere comprar';
    } else if (allText.includes('duda') || allText.includes('pregunta') || allText.includes('funciona')) {
        summary += ' | Tiene dudas';
    }

    return summary;
}

export default router;