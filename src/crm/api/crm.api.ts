import express from 'express';
import { BotManager } from '../../bot.manager';
import logger from '../../configs/logger.config';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware';
import prisma from '../../database/prisma';
import { AuthService } from '../utils/auth.util';
import { sendPaymentConfirmationMessage, sendAppointmentConfirmationMessage } from '../../utils/payment-detection.util';
import { sendCampaignMessages } from '../../crons/campaign.cron';
import { AutomationService } from '../utils/automation.util';
import { SaleStatus, CampaignStatus, BotContentCategory, NotificationType, Role, AutomationTrigger } from '@prisma/client';
import { SessionState } from '../../services/session-manager.service';
import EnvConfig from '../../configs/env.config';

export const router = express.Router();

export default function (botManager: BotManager) {
    // Contacts API
    router.get('/contacts', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { page = 1, limit = 20, search = '', sort = '-lastInteraction', saleStatus } = req.query;
            const skip = (Number(page) - 1) * Number(limit);

            const query: any = {};

            // Build where clause for Prisma
            const where: any = {};

            // Search filter
            if (search) {
                where.OR = [
                    { phoneNumber: { contains: search as string, mode: 'insensitive' } },
                    { name: { contains: search as string, mode: 'insensitive' } },
                    { pushName: { contains: search as string, mode: 'insensitive' } }
                ];
            }

            // Sale status filter - normalizar a mayúsculas para coincidir con enum
            if (saleStatus) {
                // Convertir a mayúsculas para que coincida con el enum SaleStatus
                const normalizedStatus = (saleStatus as string).toUpperCase();
                where.saleStatus = normalizedStatus as any;
            }

            // Parse sort
            const sortOrder = sort.toString().startsWith('-') ? 'desc' : 'asc';
            const sortField = sort.toString().replace(/^-/, '') as any;

            const contacts = await prisma.contact.findMany({
                where,
                orderBy: { [sortField]: sortOrder },
                skip,
                take: Number(limit)
            });

            // Enriquecer contactos con conteo de mensajes
            const contactsWithMessageCount = await Promise.all(
                contacts.map(async (contact) => {
                    const messageCount = await prisma.message.count({
                        where: { phoneNumber: contact.phoneNumber }
                    });
                    return {
                        ...contact,
                        messageCount
                    };
                })
            );

            const total = await prisma.contact.count({ where });

            res.json({
                data: contactsWithMessageCount,
                meta: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit))
                }
            });
        } catch (error) {
            logger.error('Failed to fetch contacts:', error);
            res.status(500).json({ error: 'Failed to fetch contacts' });
        }
    });

    // Update contact sale status
    router.put('/contacts/:phoneNumber/status', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { phoneNumber } = req.params;
            const { saleStatus, saleStatusNotes } = req.body;

            const validStatuses: SaleStatus[] = ['LEAD', 'INTERESTED', 'INFO_REQUESTED', 'AGENT_REQUESTED', 'PAYMENT_PENDING', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT_CONFIRMED', 'COMPLETED'];
            const saleStatusUpper = saleStatus.toUpperCase() as SaleStatus;
            if (!validStatuses.includes(saleStatusUpper)) {
                return res.status(400).json({ error: `Invalid sale status. Must be one of: ${validStatuses.join(', ')}` });
            }

            // Obtener estado anterior para disparar automatizaciones
            const previousContact = await prisma.contact.findUnique({ where: { phoneNumber } });
            const previousStatus = previousContact?.saleStatus || SaleStatus.LEAD;

            const updateData: any = { saleStatus: saleStatusUpper };
            if (saleStatusNotes !== undefined) {
                updateData.saleStatusNotes = saleStatusNotes;
            }

            // Manejar estados específicos
            if (saleStatusUpper === SaleStatus.PAYMENT_PENDING) {
                if (!req.body.paidAt) {
                    updateData.paidAt = new Date();
                }
            }
            if (saleStatusUpper === SaleStatus.APPOINTMENT_SCHEDULED && req.body.appointmentDate) {
                updateData.appointmentDate = new Date(req.body.appointmentDate);
            }
            if (saleStatusUpper === SaleStatus.APPOINTMENT_CONFIRMED) {
                updateData.appointmentConfirmed = true;
                if (req.body.appointmentNotes) {
                    updateData.appointmentNotes = req.body.appointmentNotes;
                }
            }
            if (req.body.paymentConfirmedAt) {
                updateData.paymentConfirmedAt = new Date(req.body.paymentConfirmedAt);
            }
            if (req.body.appointmentDate !== undefined) {
                updateData.appointmentDate = req.body.appointmentDate ? new Date(req.body.appointmentDate) : null;
            }
            if (req.body.appointmentNotes !== undefined) {
                updateData.appointmentNotes = req.body.appointmentNotes;
            }

            // Si el nuevo estado es AGENT_REQUESTED, crear asesoría automáticamente
            if (saleStatusUpper === SaleStatus.AGENT_REQUESTED) {
                updateData.isPaused = true; // Pausar el bot automáticamente
                
                try {
                    // Normalizar número de teléfono
                    const phoneNumberClean = phoneNumber.split('@')[0];
                    const phoneNumberWithSuffix = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

                    // Verificar si ya existe una asesoría pendiente o activa
                    const existingAdvisory = await prisma.advisory.findFirst({
                        where: {
                            OR: [
                                { customerPhone: phoneNumber },
                                { customerPhone: phoneNumberWithSuffix },
                                { customerPhone: phoneNumberClean }
                            ],
                            status: {
                                in: ['PENDING', 'ACTIVE']
                            }
                        }
                    });

                    if (!existingAdvisory) {
                        // Obtener últimos 5 mensajes para contexto
                        const recentMessages = await prisma.message.findMany({
                            where: {
                                OR: [
                                    { phoneNumber: phoneNumber },
                                    { phoneNumber: phoneNumberWithSuffix },
                                    { phoneNumber: phoneNumberClean }
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

                        // Generar resumen breve
                        const customerMessages = conversationSnapshot.filter(m => m.from === 'customer');
                        let summary = 'Solicitud de asesoría desde cambio de estado';
                        if (customerMessages.length > 0) {
                            const lastMsg = customerMessages[customerMessages.length - 1].body;
                            summary = `"${lastMsg.substring(0, 80)}${lastMsg.length > 80 ? '...' : ''}"`;
                        }

                        // Crear asesoría
                        await prisma.advisory.create({
                            data: {
                                customerPhone: phoneNumberWithSuffix,
                                customerName: previousContact?.name || previousContact?.pushName || 'Cliente',
                                status: 'PENDING',
                                conversationSnapshot,
                                summary,
                                lastActivityAt: new Date()
                            }
                        });

                        logger.info(`✅ Asesoría creada automáticamente para ${phoneNumberWithSuffix} desde cambio de estado a AGENT_REQUESTED`);

                        // Notificar al agente
                        try {
                            const { notifyAgentAboutContact } = await import('../utils/agent-notification.util');
                            await notifyAgentAboutContact(phoneNumber, previousContact?.name || previousContact?.pushName || null);
                        } catch (notifyError) {
                            logger.warn('Error notificando al agente desde cambio de estado:', notifyError);
                        }
                    } else {
                        logger.info(`ℹ️ Ya existe una asesoría activa para ${phoneNumber}, no se creó una nueva`);
                    }
                } catch (advisoryError) {
                    logger.error('Error creando asesoría desde cambio de estado:', advisoryError);
                    // No fallar el cambio de estado si falla la creación de asesoría
                }
            }

            const contact = await prisma.contact.update({
                where: { phoneNumber },
                data: updateData
            });

            if (!contact) {
                return res.status(404).json({ error: 'Contact not found' });
            }

            // Disparar automatizaciones de cambio de estado
            // Convertir ambos estados a string para comparación
            if (previousStatus !== saleStatusUpper) {
                AutomationService.triggerStatusChangeAutomations(
                    botManager,
                    phoneNumber,
                    previousStatus.toString(),
                    saleStatusUpper.toString()
                ).catch(err => logger.error('Error triggering status change automations:', err));
            }

            res.json(contact);
        } catch (error) {
            logger.error('Failed to update contact status:', error);
            res.status(500).json({ error: 'Failed to update contact status' });
        }
    });

    // Pausar/despausar contacto
    router.put('/contacts/:phoneNumber/pause', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { phoneNumber } = req.params;
            const { isPaused } = req.body;

            const contact = await prisma.contact.update({
                where: { phoneNumber },
                data: { isPaused: isPaused === true }
            });

            if (!contact) {
                return res.status(404).json({ error: 'Contact not found' });
            }

            // Si se está pausando (no despausando), enviar mensaje automático
            if (isPaused === true) {
                try {
                    const formattedNumber = phoneNumber.replace(/@[cg]\.us$/, '');

                    // Obtener configuración del bot para el mensaje de pausa
                    const botConfig = await prisma.botConfig.findFirst();
                    const businessHours = botConfig?.businessHours || 'Lunes a Viernes 9am - 7pm';
                    
                    let pauseMessage = botConfig?.pauseMessage || `✅ *Solicitud Recibida*

Tu solicitud ha sido registrada correctamente.

👤 *Estado:* En cola para atención humana
⏰ *Horario de atención:* {businessHours}

📝 Enseguida vendrá un asesor a atenderte. El bot ha sido pausado temporalmente para evitar respuestas automáticas.

¡Gracias por tu paciencia! 🌱`;

                    // Reemplazar variable {businessHours}
                    pauseMessage = pauseMessage.replace(/{businessHours}/g, businessHours);

                    await botManager.sendMessage(formattedNumber, pauseMessage);

                    // Guardar mensaje enviado en la base de datos
                    await botManager.saveSentMessage(phoneNumber, pauseMessage, null);

                    logger.info(`Pause confirmation message sent to ${phoneNumber}`);

                    // Notificar al agente si está habilitado
                    try {
                        const { notifyAgentAboutContact } = await import('../../utils/agent-notification.util');
                        await notifyAgentAboutContact(phoneNumber, contact.pushName || contact.name);
                        logger.info(`Agent notified about paused contact: ${phoneNumber}`);
                    } catch (notifyError) {
                        logger.error('Error notifying agent:', notifyError);
                        // No fallar la operación si la notificación falla
                    }

                } catch (messageError) {
                    logger.error(`Error sending pause confirmation message to ${phoneNumber}:`, messageError);
                    // No fallar la operación de pausa si el mensaje falla
                }
            }

            res.json({ message: `Contact ${isPaused ? 'paused' : 'unpaused'} successfully`, contact });
        } catch (error) {
            logger.error('Failed to pause/unpause contact:', error);
            res.status(500).json({ error: 'Failed to pause/unpause contact' });
        }
    });

    // Despausar TODOS los contactos
    router.post('/contacts/unpause-all', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const result = await prisma.contact.updateMany({
                where: { isPaused: true },
                data: { isPaused: false }
            });

            logger.info(`Unpaused ${result.count} contacts`);
            res.json({ 
                message: `Se despausaron ${result.count} contacto(s) exitosamente`,
                count: result.count 
            });
        } catch (error) {
            logger.error('Failed to unpause all contacts:', error);
            res.status(500).json({ error: 'Failed to unpause all contacts' });
        }
    });

    // Confirmar cita (por mullblue)
    router.put('/contacts/:phoneNumber/appointment/confirm', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { phoneNumber } = req.params;
            const { appointmentNotes, appointmentDate } = req.body;

            const updateData: any = {
                appointmentConfirmed: true,
                saleStatus: SaleStatus.APPOINTMENT_CONFIRMED
            };
            if (appointmentNotes) {
                updateData.appointmentNotes = appointmentNotes;
            }
            if (appointmentDate) {
                updateData.appointmentDate = new Date(appointmentDate);
            }

            const contact = await prisma.contact.update({
                where: { phoneNumber },
                data: updateData
            });

            if (!contact) {
                return res.status(404).json({ error: 'Contact not found' });
            }

            // Enviar mensaje automático de confirmación de cita
            try {
                await sendAppointmentConfirmationMessage(
                    botManager,
                    phoneNumber,
                    contact.appointmentDate ? new Date(contact.appointmentDate) : undefined,
                    contact.appointmentNotes
                );
            } catch (msgError) {
                logger.error('Error sending appointment confirmation message:', msgError);
                // No fallar la confirmación si el mensaje falla
            }

            res.json({ message: 'Appointment confirmed successfully', contact });
        } catch (error) {
            logger.error('Failed to confirm appointment:', error);
            res.status(500).json({ error: 'Failed to confirm appointment' });
        }
    });

    // Confirmar pago
    router.put('/contacts/:phoneNumber/payment/confirm', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { phoneNumber } = req.params;

            const contact = await prisma.contact.update({
                where: { phoneNumber },
                data: {
                    paymentConfirmedAt: new Date(),
                    saleStatus: SaleStatus.APPOINTMENT_SCHEDULED
                }
            });

            if (!contact) {
                return res.status(404).json({ error: 'Contact not found' });
            }

            // Enviar mensaje automático de confirmación de pago
            try {
                await sendPaymentConfirmationMessage(botManager, phoneNumber);
            } catch (msgError) {
                logger.error('Error sending payment confirmation message:', msgError);
                // No fallar la confirmación si el mensaje falla
            }

            res.json({ message: 'Payment confirmed successfully', contact });
        } catch (error) {
            logger.error('Failed to confirm payment:', error);
            res.status(500).json({ error: 'Failed to confirm payment' });
        }
    });

    // Exportar contactos a XLSX
    router.get('/contacts/export/xlsx', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const XLSX = require('xlsx');

            // Obtener todos los contactos
            const contacts = await prisma.contact.findMany({
                orderBy: { lastInteraction: 'desc' }
            });

            // Preparar datos para exportación
            const exportData = contacts.map(contact => ({
                Teléfono: contact.phoneNumber,
                Nombre: contact.name || contact.pushName || '',
                Estado: contact.saleStatus || 'lead',
                'Última interacción': contact.lastInteraction ?
                    new Date(contact.lastInteraction).toLocaleString('es-MX', {
                        timeZone: 'America/Mexico_City',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : 'Sin registro',
                Acciones: contact.isPaused ? 'Pausar' : ''
            }));

            // Crear libro de trabajo
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Contactos');

            // Generar buffer
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            // Enviar archivo
            res.setHeader('Content-Disposition', 'attachment; filename=contactos.xlsx');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);
        } catch (error) {
            logger.error('Failed to export contacts:', error);
            res.status(500).json({ error: 'Failed to export contacts' });
        }
    });

    // Importar contactos desde XLSX
    router.post('/contacts/import/xlsx', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const multer = require('multer');
            const XLSX = require('xlsx');

            // Configurar multer para recibir archivos en memoria
            const upload = multer({ storage: multer.memoryStorage() }).single('file');

            upload(req, res, async function (err: any) {
                if (err) {
                    logger.error('File upload error:', err);
                    return res.status(400).json({ error: 'File upload failed' });
                }

                try {
                    if (!req.file) {
                        return res.status(400).json({ error: 'No file uploaded' });
                    }

                    // Leer archivo XLSX
                    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const data = XLSX.utils.sheet_to_json(worksheet);

                    let imported = 0;
                    let updated = 0;
                    let errors = 0;

                    for (const row of data) {
                        try {
                            // Obtener valores de las columnas (soportar variaciones de nombres)
                            const phoneNumber = (row['Teléfono'] || row['Telefono'] || row['Número'] || row['Numero'] || row['Phone'] || '').toString().trim();
                            const name = (row['Nombre'] || row['Name'] || '').toString().trim();
                            const saleStatus = (row['Estado'] || row['Status'] || 'lead').toString().trim().toLowerCase();
                            const actions = (row['Acciones'] || row['Actions'] || '').toString().trim().toLowerCase();

                            if (!phoneNumber) {
                                errors++;
                                continue;
                            }

                            // Verificar si el contacto ya existe
                            const existingContact = await prisma.contact.findUnique({ where: { phoneNumber } });

                            const validStatuses = ['LEAD', 'INTERESTED', 'INFO_REQUESTED', 'AGENT_REQUESTED', 'PAYMENT_PENDING', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT_CONFIRMED', 'COMPLETED'];
                            const statusUpper = saleStatus.toUpperCase() as SaleStatus;
                            const finalStatus = validStatuses.includes(statusUpper) ? statusUpper : SaleStatus.LEAD;

                            const updateData: any = {
                                lastInteraction: row['Última interacción'] && row['Última interacción'] !== 'Sin registro'
                                    ? new Date(row['Última interacción'])
                                    : new Date(),
                                saleStatus: finalStatus
                            };

                            // Manejar nombre: si está vacío, intentar obtener pushName del perfil de WhatsApp
                            if (name) {
                                updateData.name = name;
                            } else if (!existingContact || !existingContact.pushName) {
                                // Si no hay nombre y no tenemos pushName, intentar obtenerlo de WhatsApp
                                try {
                                    // Evolution API no tiene getContactById, usar información de la BD
                                    const contact = await prisma.contact.findUnique({ 
                                        where: { phoneNumber: phoneNumber.replace(/@[cg]\.us$/, '') } 
                                    });
                                    if (contact && contact.pushName) {
                                        updateData.pushName = contact.pushName;
                                    }
                                } catch (waError) {
                                    logger.warn(`Could not get WhatsApp profile for ${phoneNumber}`);
                                }
                            }

                            // Manejar acciones de pausa
                            if (actions.includes('pausar') || actions.includes('pause')) {
                                updateData.isPaused = true;
                            }

                            if (existingContact) {
                                // Actualizar contacto existente
                                await prisma.contact.update({
                                    where: { phoneNumber },
                                    data: updateData
                                });
                                updated++;
                            } else {
                                // Crear nuevo contacto
                                await prisma.contact.create({
                                    data: {
                                        phoneNumber,
                                        ...updateData
                                    }
                                });
                                imported++;
                            }
                        } catch (rowError) {
                            logger.error(`Error processing row:`, rowError);
                            errors++;
                        }
                    }

                    res.json({
                        success: true,
                        summary: {
                            total: data.length,
                            imported,
                            updated,
                            errors
                        },
                        message: `Importación completada: ${imported} nuevos, ${updated} actualizados, ${errors} errores`
                    });
                } catch (processError) {
                    logger.error('Error processing file:', processError);
                    res.status(500).json({ error: 'Failed to process file' });
                }
            });
        } catch (error) {
            logger.error('Failed to import contacts:', error);
            res.status(500).json({ error: 'Failed to import contacts' });
        }
    });

    // Campaigns API
    router.post('/campaigns', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const {
                name,
                message,
                scheduledAt,
                contacts,
                isBatchCampaign,
                batchSize,
                batchInterval,
                saleStatusFilter
            } = req.body;

            // Si es campaña por lotes, calcular el total de lotes
            let totalBatches = 1;
            let actualContacts = contacts || [];

            // Si se especifica filtro por estado, obtener contactos
            if (saleStatusFilter && saleStatusFilter.length > 0) {
                const statusFilter = saleStatusFilter.map((s: string) => s.toUpperCase() as SaleStatus);
                const filteredContacts = await prisma.contact.findMany({
                    where: {
                        saleStatus: { in: statusFilter }
                    },
                    select: { phoneNumber: true }
                });
                actualContacts = filteredContacts.map(c => c.phoneNumber);
            }

            if (isBatchCampaign && batchSize && actualContacts.length > 0) {
                totalBatches = Math.ceil(actualContacts.length / batchSize);
            }

            // Validar y parsear scheduledAt
            let parsedScheduledAt: Date | null = null;
            if (scheduledAt) {
                parsedScheduledAt = new Date(scheduledAt);
                // Verificar que la fecha sea válida y futura
                if (isNaN(parsedScheduledAt.getTime())) {
                    return res.status(400).json({ error: 'Invalid scheduledAt date format' });
                }
                // Si la fecha está en el pasado, rechazar (o permitir si es muy reciente, dentro de 1 minuto)
                const now = new Date();
                const timeDiff = parsedScheduledAt.getTime() - now.getTime();
                if (timeDiff < -60000) { // Más de 1 minuto en el pasado
                    return res.status(400).json({ error: 'scheduledAt cannot be in the past' });
                }
            }

            const campaign = await prisma.campaign.create({
                data: {
                    name,
                    message,
                    scheduledAt: parsedScheduledAt,
                    contacts: actualContacts,
                    createdBy: req.user.userId,
                    status: parsedScheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT,
                    isBatchCampaign: isBatchCampaign || false,
                    batchSize: batchSize || actualContacts.length,
                    batchInterval: batchInterval || 0,
                    currentBatchIndex: 0,
                    totalBatches: totalBatches,
                    saleStatusFilter: saleStatusFilter || [],
                    // Para campañas por lotes, nextBatchAt debe ser igual a scheduledAt si existe
                    // Para campañas sin programar, será null y se establecerá cuando se envíe
                    nextBatchAt: parsedScheduledAt ? new Date(parsedScheduledAt) : null
                },
                include: { creator: true }
            });

            // Solo enviar inmediatamente si NO hay scheduledAt (campaña draft)
            // Si hay scheduledAt, el cron job se encargará de enviarlo en el momento correcto
            if (!parsedScheduledAt) {
                // Send immediately (first batch if it's a batch campaign)
                await sendCampaignMessages(botManager, campaign);
            } else {
                logger.info(`Campaign "${campaign.name}" scheduled for ${parsedScheduledAt.toISOString()}. Will be sent by cron job.`);
            }

            res.status(201).json({
                campaign,
                summary: {
                    totalContacts: actualContacts.length,
                    totalBatches: totalBatches,
                    contactsPerBatch: batchSize || actualContacts.length
                }
            });
        } catch (error) {
            logger.error('Failed to create campaign:', error);
            res.status(500).json({ error: 'Failed to create campaign' });
        }
    });

    router.get('/campaigns', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const campaigns = await prisma.campaign.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    creator: {
                        select: { username: true }
                    }
                }
            });

            res.json(campaigns);
        } catch (error) {
            logger.error('Failed to fetch campaigns:', error);
            res.status(500).json({ error: 'Failed to fetch campaigns' });
        }
    });

    // Templates API
    router.get('/templates', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const templates = await prisma.template.findMany({
                orderBy: { createdAt: 'desc' },
                include: { creator: true }
            });
            res.json(templates);
        } catch (error) {
            logger.error('Failed to fetch templates:', error);
            res.status(500).json({ error: 'Failed to fetch templates' });
        }
    });

    router.post('/templates', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { name, content } = req.body;

            const template = await prisma.template.create({
                data: {
                    name,
                    content,
                    createdBy: req.user.userId
                },
                include: { creator: true }
            });

            res.status(201).json(template);
        } catch (error) {
            logger.error('Failed to create template:', error);
            res.status(500).json({ error: 'Failed to create template' });
        }
    });

    router.put('/templates/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, content } = req.body;

            const template = await prisma.template.update({
                where: { id },
                data: { name, content }
            });

            if (!template) {
                return res.status(404).json({ error: 'Template not found' });
            }

            res.json(template);
        } catch (error) {
            logger.error('Failed to update template:', error);
            res.status(500).json({ error: 'Failed to update template' });
        }
    });

    router.delete('/templates/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            const template = await prisma.template.delete({
                where: { id }
            });

            if (!template) {
                return res.status(404).json({ error: 'Template not found' });
            }

            res.json({ success: true });
        } catch (error) {
            logger.error('Failed to delete template:', error);
            res.status(500).json({ error: 'Failed to delete template' });
        }
    });

    // Products API
    router.get('/products', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const products = await prisma.product.findMany({
                orderBy: { createdAt: 'desc' }
            });
            res.json(products);
        } catch (error) {
            logger.error('Failed to fetch products:', error);
            res.status(500).json({ error: 'Failed to fetch products' });
        }
    });

    router.post('/products', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { name, description, price, sizes, promotions, imageUrl, category, inStock } = req.body;

            const product = await prisma.product.create({
                data: {
                    name,
                    description,
                    price,
                    sizes,
                    promotions,
                    imageUrl,
                    category,
                    inStock
                }
            });

            res.status(201).json(product);
        } catch (error) {
            logger.error('Failed to create product:', error);
            res.status(500).json({ error: 'Failed to create product' });
        }
    });

    router.put('/products/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const product = await prisma.product.update({
                where: { id },
                data: updateData
            });

            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            res.json(product);
        } catch (error) {
            logger.error('Failed to update product:', error);
            res.status(500).json({ error: 'Failed to update product' });
        }
    });

    router.delete('/products/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            const product = await prisma.product.delete({
                where: { id }
            });

            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            res.json({ success: true });
        } catch (error) {
            logger.error('Failed to delete product:', error);
            res.status(500).json({ error: 'Failed to delete product' });
        }
    });

    // Sincronizar productos desde Google Sheets hacia la base de datos
    router.post('/products/sync-from-sheets', authenticate, authorizeAdmin, async (req, res) => {
        try {
            // Importar servicio de Google Sheets
            const { googleSheetsService } = await import('../../utils/google-sheets.util');
            
            // Verificar que Google Sheets esté configurado
            if (!EnvConfig.GOOGLE_SHEETS_API_KEY || !EnvConfig.GOOGLE_SHEETS_SPREADSHEET_ID) {
                return res.status(400).json({
                    success: false,
                    error: 'Google Sheets no está configurado. Configura GOOGLE_SHEETS_API_KEY y GOOGLE_SHEETS_SPREADSHEET_ID en las variables de entorno.'
                });
            }

            logger.info('📥 Sincronizando productos desde Google Sheets hacia la base de datos...');

            // Obtener productos desde Google Sheets
            const productsFromSheets = await googleSheetsService.getProductCatalog();

            if (!productsFromSheets || productsFromSheets.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No se encontraron productos en Google Sheets. Verifica que la hoja tenga datos y las columnas correctas.'
                });
            }

            let created = 0;
            let updated = 0;
            let errors = 0;

            // Sincronizar cada producto
            for (const sheetProduct of productsFromSheets) {
                try {
                    // Buscar si ya existe un producto con el mismo nombre
                    const existingProduct = await prisma.product.findFirst({
                        where: {
                            name: {
                                equals: sheetProduct.producto,
                                mode: 'insensitive'
                            }
                        }
                    });

                    const productData = {
                        name: sheetProduct.producto,
                        description: sheetProduct.descripcion || null,
                        price: sheetProduct.precio,
                        inStock: sheetProduct.disponibilidad,
                        imageUrl: sheetProduct.imagenLink || null,
                        category: null // Se puede agregar categoría después si es necesario
                    };

                    if (existingProduct) {
                        // Actualizar producto existente
                        await prisma.product.update({
                            where: { id: existingProduct.id },
                            data: productData
                        });
                        updated++;
                    } else {
                        // Crear nuevo producto
                        await prisma.product.create({
                            data: productData
                        });
                        created++;
                    }
                } catch (error) {
                    logger.error(`Error sincronizando producto "${sheetProduct.producto}":`, error);
                    errors++;
                }
            }

            logger.info(`✅ Sincronización completada: ${created} creados, ${updated} actualizados, ${errors} errores`);

            res.json({
                success: true,
                message: `Sincronización completada: ${created} productos creados, ${updated} actualizados, ${errors} errores`,
                stats: {
                    created,
                    updated,
                    errors,
                    total: productsFromSheets.length
                }
            });
        } catch (error: any) {
            logger.error('Error sincronizando productos desde Google Sheets:', error);
            res.status(500).json({
                success: false,
                error: 'Error sincronizando productos',
                message: error.message
            });
        }
    });

    // Sincronizar productos de DB hacia Google Sheets
    router.post('/products/sync-to-sheets', authenticate, authorizeAdmin, async (req, res) => {
        try {
            // Obtener todos los productos de la base de datos
            const products = await prisma.product.findMany({
                orderBy: { createdAt: 'desc' }
            });

            if (products.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No hay productos en la base de datos para sincronizar'
                });
            }

            // Importar servicio de Google Sheets
            const { googleSheetsService } = await import('../../utils/google-sheets.util');

            // Preparar productos para sincronización
            const productsToSync = products.map(product => ({
                name: product.name,
                description: product.description,
                price: product.price,
                imageUrl: product.imageUrl,
                inStock: product.inStock
            }));

            // Sincronizar hacia Google Sheets
            const result = await googleSheetsService.syncProductsToSheet(productsToSync);

            if (result.success) {
                logger.info(`✅ ${result.synced} productos sincronizados hacia Google Sheets`);
                res.json({
                    success: true,
                    message: result.message,
                    synced: result.synced
                });
            } else {
                logger.error(`❌ Error sincronizando productos: ${result.message}`);
                res.status(500).json({
                    success: false,
                    error: result.message,
                    synced: result.synced
                });
            }
        } catch (error: any) {
            logger.error('Error sincronizando productos hacia Google Sheets:', error);
            res.status(500).json({
                success: false,
                error: 'Error sincronizando productos',
                message: error.message
            });
        }
    });

    // Auth API
    // Endpoint para crear usuario (requiere autenticación admin)
    router.post('/auth/register', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { username, password, role = 'user' } = req.body;

            // Validación
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }

            if (!['admin', 'user'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role. Must be admin or user' });
            }

            const user = await AuthService.register(username, password, role);

            // No devolver la contraseña
            const userResponse = {
                id: user.id,
                username: user.username,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            };

            logger.info(`User created by ${req.user?.username}: ${username} (${role})`);
            res.status(201).json({
                message: 'User created successfully',
                user: userResponse
            });
        } catch (error) {
            logger.error('Registration failed:', error);
            res.status(400).json({ error: error.message });
        }
    });

    // Cambiar contraseña propia
    router.post('/auth/change-password', authenticate, async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;

            // Validación
            if (!currentPassword || !newPassword) {
                return res.status(400).json({ error: 'Current password and new password are required' });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'New password must be at least 6 characters long' });
            }

            await AuthService.changePassword(req.user.userId, currentPassword, newPassword);

            logger.info(`Password changed by user: ${req.user.username}`);
            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            logger.error('Password change failed:', error);
            res.status(400).json({ error: error.message });
        }
    });

    // Cambiar contraseña de otro usuario (admin only)
    router.post('/auth/change-password/:userId', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { userId } = req.params;
            const { newPassword } = req.body;

            // Validación
            if (!newPassword) {
                return res.status(400).json({ error: 'New password is required' });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'New password must be at least 6 characters long' });
            }

            await AuthService.changePasswordByAdmin(userId, newPassword);

            logger.info(`Password changed by admin ${req.user.username} for user: ${userId}`);
            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            logger.error('Password change failed:', error);
            res.status(400).json({ error: error.message });
        }
    });

    // Listar usuarios (admin only)
    router.get('/auth/users', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const users = await prisma.user.findMany({
                select: {
                    id: true,
                    username: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                },
                orderBy: { createdAt: 'desc' }
            });

            res.json({ users });
        } catch (error) {
            logger.error('Failed to fetch users:', error);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    });

    // Actualizar nombre de usuario (admin only)
    router.put('/auth/users/:userId', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { userId } = req.params;
            const { username } = req.body;

            // Validación
            if (!username) {
                return res.status(400).json({ error: 'Username is required' });
            }

            const user = await AuthService.updateUsername(userId, username);

            // No devolver la contraseña
            const userResponse = {
                id: user.id,
                username: user.username,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            };

            logger.info(`Username updated by admin ${req.user.username} for user: ${userId}`);
            res.json({ message: 'Username updated successfully', user: userResponse });
        } catch (error) {
            logger.error('Username update failed:', error);
            res.status(400).json({ error: error.message });
        }
    });

    // Eliminar usuario (admin only)
    router.delete('/auth/users/:userId', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { userId } = req.params;

            // No permitir que un admin se elimine a sí mismo
            if (userId === req.user.userId) {
                return res.status(400).json({ error: 'Cannot delete your own account' });
            }

            const user = await AuthService.deleteUser(userId);

            logger.info(`User deleted by admin ${req.user.username}: ${user.username}`);
            res.json({ message: 'User deleted successfully', username: user.username });
        } catch (error) {
            logger.error('User deletion failed:', error);
            res.status(400).json({ error: error.message });
        }
    });

    // Obtener usuario actual
    router.get('/auth/me', authenticate, async (req, res) => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user.userId },
                select: {
                    id: true,
                    username: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ user });
        } catch (error) {
            logger.error('Failed to fetch user:', error);
            res.status(500).json({ error: 'Failed to fetch user' });
        }
    });

    // Endpoint público para crear usuario (sin autenticación) - solo para desarrollo/uso personal
    router.post('/auth/create-user', async (req, res) => {
        try {
            const { username, password, role = 'user' } = req.body;

            // Validación
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }

            if (!['admin', 'user'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role. Must be admin or user' });
            }

            const user = await AuthService.register(username, password, role);

            // No devolver la contraseña
            const userResponse = {
                id: user.id,
                username: user.username,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            };

            logger.info(`User created via public API: ${username} (${role})`);
            res.status(201).json({
                message: 'User created successfully',
                user: userResponse
            });
        } catch (error) {
            logger.error('User creation failed:', error);
            res.status(400).json({ error: error.message });
        }
    });

    router.post('/auth/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            const { token, user } = await AuthService.login(username, password);
            res.json({ token, user });
        } catch (error) {
            logger.error('Login failed:', error);
            res.status(401).json({ error: error.message });
        }
    });

    router.get('/auth/check', authenticate, async (req, res) => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user.userId },
                select: {
                    id: true,
                    username: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }
            res.json({ user });
        } catch (error) {
            logger.error('Auth check failed:', error);
            res.status(500).json({ error: 'Auth check failed' });
        }
    });

    // Sales Statistics API
    router.get('/statistics', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const SalesTracker = (await import('../../utils/sales-tracker.util')).default;

            // Get sales statistics
            const salesStats = SalesTracker.getSalesStats();

            // Get contact statistics
            const totalContacts = await prisma.contact.count();
            const contactsWithTags = await prisma.contact.count({ where: { tags: { isEmpty: false } } });
            const recentContacts = await prisma.contact.count({
                where: {
                    lastInteraction: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }
            });

            // Get contacts by sale status
            const leads = await prisma.contact.count({ where: { saleStatus: SaleStatus.LEAD } });
            const interestedContacts = await prisma.contact.count({ where: { saleStatus: SaleStatus.INTERESTED } });
            const infoRequested = await prisma.contact.count({ where: { saleStatus: SaleStatus.INFO_REQUESTED } });
            const agentRequested = await prisma.contact.count({ where: { saleStatus: SaleStatus.AGENT_REQUESTED } });
            const paymentPending = await prisma.contact.count({ where: { saleStatus: SaleStatus.PAYMENT_PENDING } });
            const appointmentScheduled = await prisma.contact.count({ where: { saleStatus: SaleStatus.APPOINTMENT_SCHEDULED } });
            const appointmentConfirmed = await prisma.contact.count({ where: { saleStatus: SaleStatus.APPOINTMENT_CONFIRMED } });
            const completed = await prisma.contact.count({ where: { saleStatus: SaleStatus.COMPLETED } });
            const pausedContacts = await prisma.contact.count({ where: { isPaused: true } });

            // Get campaign statistics
            const totalCampaigns = await prisma.campaign.count();
            const sentCampaigns = await prisma.campaign.count({ where: { status: CampaignStatus.SENT } });
            const scheduledCampaigns = await prisma.campaign.count({ where: { status: CampaignStatus.SCHEDULED } });

            // Calculate total messages sent
            const campaigns = await prisma.campaign.findMany({ where: { status: CampaignStatus.SENT } });
            const totalMessagesSent = campaigns.reduce((sum, campaign) => sum + (campaign.sentCount || 0), 0);

            // Get top leads from contacts based on interactions
            const topLeadsContacts = await prisma.contact.findMany({
                orderBy: { interactionsCount: 'desc' },
                take: 10,
                select: {
                    phoneNumber: true,
                    name: true,
                    pushName: true,
                    interactionsCount: true,
                    lastInteraction: true
                }
            });

            res.json({
                sales: salesStats,
                contacts: {
                    total: totalContacts,
                    withTags: contactsWithTags,
                    recent: recentContacts,
                    byStatus: {
                        leads: leads,
                        interested: interestedContacts,
                        infoRequested: infoRequested,
                        paymentPending: paymentPending,
                        appointmentScheduled: appointmentScheduled,
                        appointmentConfirmed: appointmentConfirmed,
                        completed: completed,
                        paused: pausedContacts
                    }
                },
                campaigns: {
                    total: totalCampaigns,
                    sent: sentCampaigns,
                    scheduled: scheduledCampaigns,
                    totalMessagesSent: totalMessagesSent
                },
                topLeads: topLeadsContacts.map(contact => {
                    const score = SalesTracker.getLeadScore(contact.phoneNumber + '@c.us');
                    return {
                        phoneNumber: contact.phoneNumber,
                        name: contact.name || contact.pushName || 'Unknown',
                        interactionsCount: contact.interactionsCount,
                        lastInteraction: contact.lastInteraction,
                        score: score
                    };
                })
            });
        } catch (error) {
            logger.error('Failed to fetch statistics:', error);
            res.status(500).json({ error: 'Failed to fetch statistics' });
        }
    });

    // Bot Configuration API
    router.get('/bot-config', authenticate, authorizeAdmin, async (req, res) => {
        try {
            let config = await prisma.botConfig.findFirst();
            if (!config) {
                config = await prisma.botConfig.create({ data: {} });
            }
            res.json(config);
        } catch (error) {
            logger.error('Failed to fetch bot config:', error);
            res.status(500).json({ error: 'Failed to fetch bot config' });
        }
    });

    router.put('/bot-config', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const updateData = req.body;
            
            // Validar botDelay si se proporciona
            if (updateData.botDelay !== undefined && updateData.botDelay < 0) {
                return res.status(400).json({ error: 'botDelay must be >= 0' });
            }

            let config = await prisma.botConfig.findFirst();
            if (!config) {
                config = await prisma.botConfig.create({ data: updateData });
            } else {
                config = await prisma.botConfig.update({
                    where: { id: config.id },
                    data: updateData
                });
            }

            res.json({ message: 'Bot configuration updated successfully', config });
        } catch (error) {
            logger.error('Failed to update bot config:', error);
            res.status(500).json({ error: 'Failed to update bot config' });
        }
    });

    // Bot Content API (para mensajes y respuestas del bot)
    router.get('/bot-content', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const contents = await prisma.botContent.findMany({
                orderBy: [
                    { category: 'asc' },
                    { key: 'asc' }
                ]
            });
            res.json(contents);
        } catch (error) {
            logger.error('Failed to fetch bot content:', error);
            res.status(500).json({ error: 'Failed to fetch bot content' });
        }
    });

    router.get('/bot-content/:key', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const content = await prisma.botContent.findUnique({
                where: { key: req.params.key }
            });
            if (!content) {
                return res.status(404).json({ error: 'Content not found' });
            }
            res.json(content);
        } catch (error) {
            logger.error('Failed to fetch bot content:', error);
            res.status(500).json({ error: 'Failed to fetch bot content' });
        }
    });

    router.put('/bot-content/:key', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { content, mediaPath, description, category } = req.body;
            
            const updateData: any = { content };
            if (mediaPath !== undefined) updateData.mediaPath = mediaPath;
            if (description !== undefined) updateData.description = description;
            if (category !== undefined) {
                updateData.category = category.toUpperCase().replace('-', '_') as BotContentCategory;
            }

            const botContent = await prisma.botContent.upsert({
                where: { key: req.params.key },
                update: updateData,
                create: {
                    key: req.params.key,
                    ...updateData
                }
            });

            res.json({ message: 'Content updated successfully', content: botContent });
        } catch (error) {
            logger.error('Failed to update bot content:', error);
            res.status(500).json({ error: 'Failed to update bot content' });
        }
    });

    router.post('/bot-content', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { key, content, mediaPath, description, category } = req.body;
            
            if (!key || !content) {
                return res.status(400).json({ error: 'key and content are required' });
            }

            const existingContent = await prisma.botContent.findUnique({ where: { key } });
            if (existingContent) {
                return res.status(400).json({ error: 'Content with this key already exists' });
            }

            const botContent = await prisma.botContent.create({
                data: {
                    key,
                    content,
                    mediaPath,
                    description,
                    category: category ? (category.toUpperCase().replace('-', '_') as BotContentCategory) : BotContentCategory.OTHER
                }
            });

            res.status(201).json({ message: 'Content created successfully', content: botContent });
        } catch (error) {
            logger.error('Failed to create bot content:', error);
            res.status(500).json({ error: 'Failed to create bot content' });
        }
    });

    router.delete('/bot-content/:key', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const content = await prisma.botContent.delete({
                where: { key: req.params.key }
            });
            if (!content) {
                return res.status(404).json({ error: 'Content not found' });
            }
            res.json({ message: 'Content deleted successfully' });
        } catch (error) {
            logger.error('Failed to delete bot content:', error);
            res.status(500).json({ error: 'Failed to delete bot content' });
        }
    });

    // Inicializar contenido predeterminado del bot
    router.post('/bot-content/init-defaults', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const defaultContents = [
                {
                    key: 'main_menu',
                    description: 'Menú principal que se muestra al saludar',
                    category: 'quick_response',
                    content: `👋 *MENÚ PRINCIPAL*

¡Hola! ¿En qué puedo ayudarte hoy? 🤔

*Opciones disponibles:*

*1.* Conocer el proceso de compostaje fermentativo
*2.* Dudas sobre precios y promociones
*3.* Métodos de pago disponibles
*4.* ¿Qué incluye el kit?
*5.* Dimensiones y espacio necesario
*6.* Información sobre envío y entrega
*7.* Preguntas frecuentes
*8.* Hablar con un agente

Escribe el *número* de la opción que te interesa o pregunta lo que necesites 🌱`
                },
                {
                    key: 'option_1_process',
                    description: 'Respuesta sobre el proceso de compostaje',
                    category: 'quick_response',
                    content: `🌱 *PROCESO DE COMPOSTAJE FERMENTATIVO*

El sistema Müllblue utiliza tecnología de fermentación anaeróbica:

1️⃣ *Depositar* - Coloca tus residuos orgánicos
2️⃣ *Espolvorear* - Añade biocatalizador
3️⃣ *Compactar* - Presiona para eliminar aire
4️⃣ *Tapar* - Cierra herméticamente
5️⃣ *Repetir* - Hasta llenar el compostero

✅ Sin malos olores
✅ Sin plagas
✅ Proceso más rápido que el tradicional

¿Te gustaría saber más detalles? 🌿`
                },
                {
                    key: 'option_2_price',
                    description: 'Respuesta sobre precios',
                    category: 'quick_response',
                    content: `💰 *PRECIOS Y PROMOCIONES*

Consulta nuestros precios actualizados y promociones especiales.

¿Te gustaría recibir más información sobre algún producto específico?`
                },
                {
                    key: 'option_8_agent',
                    description: 'Respuesta cuando solicitan agente humano',
                    category: 'quick_response',
                    content: `👤 *ATENCIÓN PERSONALIZADA*

Entiendo que prefieres hablar con una persona.

Tu solicitud ha sido registrada y un asesor te contactará pronto.

⏰ *Horario de atención:* Lunes a Viernes 9am - 7pm

¡Gracias por tu paciencia! 🌱`
                }
            ];

            let created = 0;
            let skipped = 0;

            for (const content of defaultContents) {
                const exists = await prisma.botContent.findUnique({ where: { key: content.key } });
                if (!exists) {
                    await prisma.botContent.create({
                        data: {
                            ...content,
                            category: content.category ? (content.category.toUpperCase().replace('-', '_') as BotContentCategory) : BotContentCategory.OTHER
                        }
                    });
                    created++;
                } else {
                    skipped++;
                }
            }

            res.json({ 
                message: `Defaults initialized: ${created} created, ${skipped} skipped (already exist)`,
                created,
                skipped
            });
        } catch (error) {
            logger.error('Failed to initialize default content:', error);
            res.status(500).json({ error: 'Failed to initialize default content' });
        }
    });

    // Send message route
    router.post('/send-message', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { phoneNumber, message } = req.body;

            // Validar datos de entrada
            if (!phoneNumber || !message) {
                return res.status(400).json({ 
                    error: 'phoneNumber and message are required',
                    success: false 
                });
            }

            if (typeof phoneNumber !== 'string' || typeof message !== 'string') {
                return res.status(400).json({ 
                    error: 'phoneNumber and message must be strings',
                    success: false 
                });
            }

            if (message.trim().length === 0) {
                return res.status(400).json({ 
                    error: 'message cannot be empty',
                    success: false 
                });
            }

            // Verificar que Evolution API esté conectado
            const evolutionAPI = botManager.getEvolutionAPI();
            const isConnected = await evolutionAPI.isConnected();
            
            if (!isConnected) {
                return res.status(503).json({ 
                    error: 'WhatsApp is not connected. Please wait for the connection to be established.',
                    success: false,
                    reason: 'not_connected',
                    details: 'Go to Settings > WhatsApp to check the connection status and scan the QR code if needed.'
                });
            }

            // Normalizar número de teléfono (remover @ si existe)
            const formattedNumber = phoneNumber.replace(/@[cg]\.us$/, '');

            logger.info(`Sending message to ${formattedNumber} from CRM`);

            // Enviar mensaje usando Evolution API
            try {
                await botManager.sendMessage(formattedNumber, message.trim());
            } catch (sendError: any) {
                logger.error(`Error sending message to ${formattedNumber}:`, sendError);
                
                // Proporcionar mensajes de error más específicos
                const errorMessage = sendError.message || String(sendError);
                
                if (errorMessage.includes('not registered') || errorMessage.includes('not found')) {
                    return res.status(400).json({ 
                        error: 'El número de teléfono no está registrado en WhatsApp.',
                        success: false
                    });
                }
                
                // Error genérico
                return res.status(500).json({ 
                    error: `Error al enviar mensaje: ${errorMessage}`,
                    success: false
                });
            }

            // Guardar mensaje enviado en la base de datos
            try {
                await botManager.saveSentMessage(phoneNumber, message.trim(), null);
                logger.info(`Message sent successfully to ${formattedNumber}, saved to database`);
            } catch (saveError) {
                logger.warn(`Message sent but failed to save to database: ${saveError}`);
                // No fallar la respuesta si el mensaje se envió pero falló al guardar
            }

            res.json({ 
                success: true,
                messageId: null // Evolution API no retorna ID de mensaje en sendText
            });
        } catch (error: any) {
            logger.error('Failed to send message from CRM:', error);
            
            // Proporcionar mensajes de error más específicos
            let errorMessage = 'Failed to send message';
            if (error.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            res.status(500).json({ 
                error: errorMessage,
                success: false,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });

    // Obtener mensajes de un contacto
    router.get('/contacts/:phoneNumber/messages', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { phoneNumber } = req.params;
            // Aumentar límite por defecto a 500 para cargar más historial
            const { limit = 500, before, after, requiresAttention } = req.query;

            const where: any = { phoneNumber };

            // Si hay un timestamp "before", obtener mensajes anteriores a esa fecha
            if (before) {
                where.timestamp = { lt: new Date(before as string) };
            }

            // Si hay un timestamp "after", obtener mensajes posteriores a esa fecha
            if (after) {
                where.timestamp = { ...where.timestamp, gt: new Date(after as string) };
            }

            // Si se solicita solo mensajes que requieren atención
            if (requiresAttention === 'true') {
                where.requiresAttention = true;
            }

            // Contar total de mensajes para este contacto
            const totalMessages = await prisma.message.count({ where });

            const messages = await prisma.message.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                take: Math.min(Number(limit), 1000) // Máximo 1000 mensajes por petición
            });

            // Ordenar por timestamp ascendente para mostrar en orden cronológico
            messages.reverse();

            // Evitar caching para tener mensajes siempre actualizados
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            
            res.json({ 
                messages,
                total: totalMessages,
                loaded: messages.length,
                hasMore: totalMessages > messages.length
            });
        } catch (error) {
            logger.error('Failed to fetch messages:', error);
            res.status(500).json({ error: 'Failed to fetch messages' });
        }
    });

    // Obtener mensajes que requieren atención (todos los contactos)
    router.get('/messages/requires-attention', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { limit = 50 } = req.query;

            const messages = await prisma.message.findMany({
                where: { requiresAttention: true, isFromBot: false },
                orderBy: { timestamp: 'desc' },
                take: Number(limit),
                include: {
                    contact: {
                        select: { phoneNumber: true, name: true, pushName: true }
                    }
                }
            });

            res.json({ messages });
        } catch (error) {
            logger.error('Failed to fetch messages requiring attention:', error);
            res.status(500).json({ error: 'Failed to fetch messages requiring attention' });
        }
    });

    // Endpoint para limpiar completamente todas las sesiones de WhatsApp
    // DEPRECATED: Ahora usa logout() que hace lo mismo. Mantenido por compatibilidad.
    router.post('/whatsapp/clear-sessions', authenticate, authorizeAdmin, async (req, res) => {
        try {
            logger.info('Clear all sessions request received (usando logout unificado)...');
            
            // Usar logout() que ahora hace todo: desvincular + limpiar todas las sesiones
            const deletedCount = await botManager.logout();
            
            // Esperar y reinicializar igual que logout
            await new Promise(resolve => setTimeout(resolve, 2000));
            await botManager.initializeClient();
            await new Promise(resolve => setTimeout(resolve, 1000));
            botManager.initialize().catch(err => {
                logger.error('Error during initialization after clear:', err);
            });
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            res.json({ 
                message: `Todas las sesiones han sido eliminadas (${deletedCount} sesiones). Generando nuevo QR...`,
                success: true,
                deletedCount
            });
        } catch (error: any) {
            logger.error('Failed to clear sessions:', error);
            res.status(500).json({ 
                error: 'Error al limpiar sesiones',
                details: error.message || 'Error desconocido',
                success: false
            });
        }
    });

    // WhatsApp logout endpoint - Unificado: desvincula y limpia todas las sesiones
    // Compatible con whatsapp-web.js y Evolution API
    router.post('/whatsapp/logout', authenticate, authorizeAdmin, async (req, res) => {
        try {
            logger.info('☢️☢️☢️ === LIMPIEZA COMPLETA DE SESIÓN SOLICITADA === ☢️☢️☢️');
            
            const sessionManager = botManager.getSessionManager();
            let deletedCount = 0;
            let logoutWarning = '';
            
            // PASO 1: LIMPIEZA NUCLEAR - Elimina ABSOLUTAMENTE TODO
            logger.info('🧹 Paso 1: Ejecutando limpieza nuclear del sistema...');
            try {
                await sessionManager.nuclearReset();
                deletedCount = 1;
                logger.info('✅ Limpieza nuclear completada exitosamente');
            } catch (error: any) {
                // Capturar errores pero continuar
                if (error.message?.includes('getaddrinfo') || 
                    error.message?.includes('EAI_AGAIN') ||
                    error.code === 'ECONNREFUSED' ||
                    error.code === 'ENOTFOUND') {
                    logoutWarning = 'Evolution API no accesible durante limpieza, pero se continuó. Verifica que el servicio esté corriendo.';
                    logger.warn(`⚠️ ${logoutWarning}`);
                } else {
                    logoutWarning = `Advertencia durante limpieza: ${error.message || 'Error desconocido'}`;
                    logger.warn(`⚠️ ${logoutWarning}`);
                }
                // SIEMPRE forzar reset, sin importar el error
                sessionManager.forceReset();
            }
            
            // PASO 2: Limpieza adicional del BotManager (por compatibilidad)
            logger.info('🧹 Paso 2: Limpieza adicional del BotManager...');
            try {
                await botManager.logout();
            } catch (error: any) {
                logger.warn(`⚠️ Error en botManager.logout(): ${error.message || error}`);
            }
            
            // PASO 3: Espera extendida para asegurar limpieza completa
            logger.info('⏳ Paso 3: Esperando 3 segundos para asegurar limpieza completa...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // PASO 4: Verificación de estado y reset adicional si es necesario
            logger.info('🔍 Paso 4: Verificando estado del sistema...');
            const currentState = sessionManager.getState();
            logger.info(`   Estado actual: ${currentState}`);
            
            if (currentState !== SessionState.IDLE && currentState !== SessionState.ERROR) {
                logger.warn(`⚠️ Estado inesperado: ${currentState}, aplicando reset adicional`);
                sessionManager.forceReset();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // PASO 5: Verificar si aún existe alguna instancia en Evolution API
            logger.info('🔍 Paso 5: Verificando instancias en Evolution API...');
            try {
                const evolutionAPI = botManager.getEvolutionAPI();
                const isStillConnected = await evolutionAPI.isConnected();
                if (isStillConnected) {
                    logger.warn('⚠️ Instancia todavía conectada, forzando eliminación...');
                    await evolutionAPI.logout();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                logger.info('✅ No hay instancias activas en Evolution API');
            } catch (checkError: any) {
                logger.debug(`Verificación de instancias: ${checkError.message}`);
            }
            
            // PASO 6: Inicializar nueva sesión limpia desde cero
            logger.info('🚀 Paso 6: Inicializando nueva sesión limpia...');
            try {
                await sessionManager.initializeSession();
                logger.info('✅ Nueva sesión inicializada exitosamente');
            } catch (error: any) {
                logger.error(`❌ Error al inicializar nueva sesión: ${error.message || error}`);
                // Continuar de todas formas, el QR se generará eventualmente
            }
            
            logger.info('☢️☢️☢️ === LIMPIEZA COMPLETA FINALIZADA === ☢️☢️☢️');
            logger.info('📋 Sistema listo para nueva conexión desde cero');
            
            const responseMessage = logoutWarning 
                ? `WhatsApp desvinculado con limpieza profunda (con advertencias). ${deletedCount} sesión(es) eliminada(s). ${logoutWarning} Generando nuevo código QR...`
                : `WhatsApp desvinculado correctamente con limpieza profunda. ${deletedCount} sesión(es) eliminada(s). Sistema completamente reseteado. Generando nuevo código QR...`;
            
            res.json({ 
                message: responseMessage,
                success: true,
                deletedCount,
                warning: logoutWarning || undefined,
                systemReset: true
            });
        } catch (error: any) {
            logger.error('❌ Error crítico durante desvinculación:', error);
            
            // Determinar si es un error de conexión
            const isConnectionError = error.message?.includes('getaddrinfo') || 
                                     error.message?.includes('EAI_AGAIN') ||
                                     error.code === 'ECONNREFUSED' ||
                                     error.code === 'ENOTFOUND';
            
            const errorMessage = isConnectionError 
                ? 'Evolution API no está accesible. Verifica que el servicio esté corriendo y la URL sea correcta.'
                : (error.message || 'Error desconocido');
            
            res.status(500).json({ 
                error: 'Error al desvincular WhatsApp',
                details: errorMessage,
                success: false
            });
        }
    });

    // Notifications API
    router.get('/notifications', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { unreadOnly = 'true', limit = 50 } = req.query;

            const where: any = {};
            if (unreadOnly === 'true') {
                where.read = false;
            }

            const notifications = await prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: Number(limit)
            });

            const unreadCount = await prisma.notification.count({ where: { read: false } });

            res.json({
                notifications,
                unreadCount
            });
        } catch (error) {
            logger.error('Failed to fetch notifications:', error);
            res.status(500).json({ error: 'Failed to fetch notifications' });
        }
    });

    router.put('/notifications/:id/read', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            const notification = await prisma.notification.update({
                where: { id },
                data: { read: true }
            });

            if (!notification) {
                return res.status(404).json({ error: 'Notification not found' });
            }

            res.json(notification);
        } catch (error) {
            logger.error('Failed to mark notification as read:', error);
            res.status(500).json({ error: 'Failed to mark notification as read' });
        }
    });

    router.put('/notifications/read-all', authenticate, authorizeAdmin, async (req, res) => {
        try {
            await prisma.notification.updateMany({
                where: { read: false },
                data: { read: true }
            });

            res.json({ message: 'All notifications marked as read' });
        } catch (error) {
            logger.error('Failed to mark all notifications as read:', error);
            res.status(500).json({ error: 'Failed to mark all notifications as read' });
        }
    });

    // Server-Sent Events para notificaciones en tiempo real
    // Middleware especial para SSE que acepta token como query parameter
    router.get('/notifications/stream', async (req, res, next) => {
        try {
            // Intentar obtener token del query parameter o del header
            let token = req.query.token as string || req.header('Authorization')?.replace('Bearer ', '');

            if (!token) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const decoded = await (await import('../utils/auth.util')).AuthService.verifyToken(token);
            if (!decoded) {
                return res.status(401).json({ error: 'Invalid token' });
            }

            // Verificar que sea admin
            if (decoded.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }

            req.user = decoded;
            next();
        } catch (error) {
            logger.error('SSE Authentication error:', error);
            res.status(401).json({ error: 'Authentication failed' });
        }
    }, (req, res) => {
        // Configurar SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Deshabilitar buffering en nginx

        // Enviar ping inicial
        res.write(': ping\n\n');

        // Polling cada 2 segundos para notificaciones nuevas
        const interval = setInterval(async () => {
            try {
                // Verificar si la conexión sigue activa
                if (req.closed || res.destroyed) {
                    clearInterval(interval);
                    return;
                }

                const unreadCount = await prisma.notification.count({ where: { read: false } });
                const latestNotifications = await prisma.notification.findMany({
                    where: { read: false },
                    orderBy: { createdAt: 'desc' },
                    take: 5
                });

                res.write(`data: ${JSON.stringify({ unreadCount, notifications: latestNotifications })}\n\n`);
            } catch (error) {
                logger.error('Error in notification stream:', error);
                if (!res.destroyed) {
                    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to fetch notifications' })}\n\n`);
                }
            }
        }, 2000);

        // Limpiar cuando el cliente se desconecta
        req.on('close', () => {
            clearInterval(interval);
            if (!res.destroyed) {
                res.end();
            }
        });

        req.on('error', () => {
            clearInterval(interval);
            if (!res.destroyed) {
                res.end();
            }
        });
    });

    // Custom Statuses API
    router.get('/custom-statuses', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const statuses = await prisma.customStatus.findMany({
                orderBy: { order: 'asc' }
            });
            res.json({ statuses });
        } catch (error) {
            logger.error('Failed to fetch custom statuses:', error);
            res.status(500).json({ error: 'Failed to fetch custom statuses' });
        }
    });

    router.post('/custom-statuses', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { name, value, color, description, order } = req.body;

            if (!name || !value) {
                return res.status(400).json({ error: 'Name and value are required' });
            }

            const status = await prisma.customStatus.create({
                data: {
                    name,
                    value,
                    color,
                    description,
                    order: order || 0,
                    createdBy: req.user.userId
                }
            });

            res.status(201).json({ status });
        } catch (error) {
            logger.error('Failed to create custom status:', error);
            res.status(500).json({ error: 'Failed to create custom status' });
        }
    });

    router.put('/custom-statuses/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, value, color, description, order, isActive } = req.body;

            const status = await prisma.customStatus.update({
                where: { id },
                data: { name, value, color, description, order, isActive }
            });

            if (!status) {
                return res.status(404).json({ error: 'Custom status not found' });
            }

            res.json({ status });
        } catch (error) {
            logger.error('Failed to update custom status:', error);
            res.status(500).json({ error: 'Failed to update custom status' });
        }
    });

    router.delete('/custom-statuses/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            const status = await prisma.customStatus.delete({
                where: { id }
            });

            if (!status) {
                return res.status(404).json({ error: 'Custom status not found' });
            }

            res.json({ message: 'Custom status deleted successfully' });
        } catch (error) {
            logger.error('Failed to delete custom status:', error);
            res.status(500).json({ error: 'Failed to delete custom status' });
        }
    });

    // Automations API
    router.get('/automations', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const automations = await prisma.automation.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    creator: {
                        select: { username: true }
                    }
                }
            });

            res.json({ automations });
        } catch (error) {
            logger.error('Failed to fetch automations:', error);
            res.status(500).json({ error: 'Failed to fetch automations' });
        }
    });

    router.post('/automations', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { name, description, triggerType, triggerConditions, actions } = req.body;

            if (!name || !triggerType || !actions || actions.length === 0) {
                return res.status(400).json({ error: 'Name, triggerType, and actions are required' });
            }

            const triggerTypeUpper = triggerType.toUpperCase().replace('-', '_') as AutomationTrigger;
            const automation = await prisma.automation.create({
                data: {
                    name,
                    description,
                    triggerType: triggerTypeUpper,
                    triggerConditions: triggerConditions || {},
                    actions,
                    createdBy: req.user.userId
                },
                include: { creator: true }
            });

            res.status(201).json({ automation });
        } catch (error) {
            logger.error('Failed to create automation:', error);
            res.status(500).json({ error: 'Failed to create automation' });
        }
    });

    router.put('/automations/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description, triggerType, triggerConditions, actions, isActive } = req.body;

            const updateData: any = { name, description, triggerConditions, actions, isActive };
            if (triggerType) {
                updateData.triggerType = triggerType.toUpperCase().replace('-', '_') as AutomationTrigger;
            }
            const automation = await prisma.automation.update({
                where: { id },
                data: updateData,
                include: { creator: true }
            });

            if (!automation) {
                return res.status(404).json({ error: 'Automation not found' });
            }

            res.json({ automation });
        } catch (error) {
            logger.error('Failed to update automation:', error);
            res.status(500).json({ error: 'Failed to update automation' });
        }
    });

    router.delete('/automations/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            const automation = await prisma.automation.delete({
                where: { id }
            });

            if (!automation) {
                return res.status(404).json({ error: 'Automation not found' });
            }

            res.json({ message: 'Automation deleted successfully' });
        } catch (error) {
            logger.error('Failed to delete automation:', error);
            res.status(500).json({ error: 'Failed to delete automation' });
        }
    });

    // Version Notes API
    router.get('/version-notes', authenticate, async (req, res) => {
        try {
            const { VERSION_NOTES, CURRENT_VERSION } = await import('../../configs/version.config');
            res.json({
                currentVersion: CURRENT_VERSION,
                notes: VERSION_NOTES
            });
        } catch (error) {
            logger.error('Failed to fetch version notes:', error);
            res.status(500).json({ error: 'Failed to fetch version notes' });
        }
    });

    // ==========================================
    // 🔧 GESTIÓN DE INSTANCIAS WHATSAPP
    // Emergency Dashboard para solucionar problemas de vinculación
    // ==========================================

    /**
     * Obtener estado de la instancia actual y lista de todas las instancias
     */
    router.get('/whatsapp/instances', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const evolutionAPI = botManager.getEvolutionAPI();

            // Obtener todas las instancias del servidor Evolution
            let allInstances: any[] = [];
            let fetchError = null;
            
            try {
                allInstances = await evolutionAPI.fetchInstances();
            } catch (fetchErr: any) {
                fetchError = fetchErr;
                logger.error('Error al obtener lista de instancias:', fetchErr.message);
                
                // Si es error 403, devolver error específico
                if (fetchErr.message?.includes('403') || fetchErr.message?.includes('permisos')) {
                    return res.status(403).json({ 
                        success: false,
                        error: '⛔ Error 403: Tu API Key no tiene permisos para listar instancias.\n\nVerifica en Easypanel que estés usando una API Key MAESTRA (Global), no una API Key de instancia específica.\n\nPasos:\n1. Ve a Evolution API en Easypanel\n2. Busca la sección "API Keys" o "Global API Key"\n3. Copia la API Key Global/Maestra\n4. Actualiza la variable EVOLUTION_APIKEY en tu proyecto',
                        errorType: 'permission_denied',
                        hint: 'La API Key actual no es Maestra'
                    });
                }
            }

            // Obtener información de la instancia actual
            let currentInstance = null;
            try {
                currentInstance = await evolutionAPI.fetchInstance();
            } catch (err: any) {
                logger.warn('No se pudo obtener instancia actual:', err.message);
            }

            // Verificar si está conectada
            let isConnected = false;
            try {
                isConnected = await evolutionAPI.isConnected();
            } catch (err: any) {
                logger.warn('No se pudo verificar conexión:', err.message);
            }

            // CORREGIDO: Extraer datos con la estructura real de Evolution API
            const currentInstanceName = currentInstance ? 
                ((currentInstance as any)?.name || (currentInstance as any)?.instanceName || currentInstance.instance?.instanceName) : 
                null;
            const currentInstanceStatus = currentInstance ? 
                ((currentInstance as any)?.connectionStatus || (currentInstance as any)?.status || currentInstance.instance?.status || 'unknown') : 
                'not_found';

            res.json({
                success: true,
                current: {
                    exists: !!currentInstance,
                    status: currentInstanceStatus,
                    instanceName: currentInstanceName,
                    connected: isConnected,
                    data: currentInstance
                },
                allInstances: allInstances.map((inst: any) => ({
                    // CORREGIDO: Usar inst.name en lugar de inst.instance.instanceName
                    instanceName: inst?.name || inst?.instanceName || inst?.instance?.instanceName,
                    status: inst?.connectionStatus || inst?.status || inst?.state || inst?.instance?.status || 'unknown',
                    owner: inst?.owner || inst?.instance?.owner
                })),
                warning: fetchError ? 'Hubo problemas al obtener la lista completa de instancias' : null
            });
        } catch (error: any) {
            logger.error('Failed to fetch instances:', error);
            
            res.status(500).json({ 
                success: false,
                error: 'Error al obtener instancias',
                details: error.message || 'Error desconocido'
            });
        }
    });

    /**
     * 🔴 Forzar eliminación de instancia
     * Botón de emergencia para borrar manualmente la instancia si se traba
     */
    router.delete('/whatsapp/delete-instance', authenticate, authorizeAdmin, async (req, res) => {
        try {
            logger.info('🔴 [Emergency] Forzar eliminación de instancia solicitada...');
            const evolutionAPI = botManager.getEvolutionAPI();

            // Intentar eliminar la instancia
            try {
                await evolutionAPI.deleteInstance();
                logger.info('✅ Instancia eliminada exitosamente');
                
                res.json({
                    success: true,
                    message: 'Instancia eliminada exitosamente. Puedes crear una nueva ahora.',
                    action: 'deleted'
                });
            } catch (deleteError: any) {
                // Si ya no existe (404), es OK
                if (deleteError.response?.status === 404) {
                    logger.info('ℹ️ Instancia no encontrada (puede estar ya eliminada)');
                    return res.json({
                        success: true,
                        message: 'La instancia no existe o ya fue eliminada.',
                        action: 'not_found'
                    });
                }

                // Error 403 - permisos
                if (deleteError.response?.status === 403) {
                    throw new Error('⛔ Error 403: La API Key no tiene permisos para eliminar instancias. Verifica que sea una API Key Maestra.');
                }

                throw deleteError;
            }
        } catch (error: any) {
            logger.error('❌ Error al eliminar instancia:', error);
            res.status(500).json({
                success: false,
                error: 'Error al eliminar instancia',
                details: error.message || 'Error desconocido'
            });
        }
    });

    /**
     * 🟢 Re-crear instancia
     * Fuerza la creación de una instancia nueva (usa ensureInstance con force=true)
     */
    router.post('/whatsapp/create-instance', authenticate, authorizeAdmin, async (req, res) => {
        try {
            logger.info('🟢 [Emergency] Recreación de instancia solicitada...');
            const evolutionAPI = botManager.getEvolutionAPI();

            // Usar el método de autocuración con force=true
            const result = await evolutionAPI.ensureInstance(true);

            res.json({
                success: result.success,
                message: result.message,
                action: result.action,
                instance: result.instance ? {
                    name: result.instance.instance?.instanceName,
                    status: result.instance.instance?.status
                } : null
            });
        } catch (error: any) {
            logger.error('❌ Error al crear instancia:', error);
            
            // Detectar errores específicos
            if (error.message?.includes('Error de Permisos') || error.message?.includes('403')) {
                return res.status(403).json({
                    success: false,
                    error: '⛔ Error 403: Revisa tu API Key en Easypanel. Debe ser una API Key Maestra (Global).',
                    errorType: 'permission_denied',
                    details: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Error al crear instancia',
                details: error.message || 'Error desconocido'
            });
        }
    });

    /**
     * 🔄 Verificar y curar instancia automáticamente
     * Ejecuta el método ensureInstance() para limpiar estados bugeados
     */
    router.post('/whatsapp/heal-instance', authenticate, authorizeAdmin, async (req, res) => {
        try {
            logger.info('🔄 [Emergency] Autocuración de instancia solicitada...');
            const evolutionAPI = botManager.getEvolutionAPI();

            // Usar el método de autocuración (sin force, solo limpia si está bugeada)
            const result = await evolutionAPI.ensureInstance(false);

            res.json({
                success: result.success,
                message: result.message,
                action: result.action,
                instance: result.instance ? {
                    name: result.instance.instance?.instanceName,
                    status: result.instance.instance?.status
                } : null
            });
        } catch (error: any) {
            logger.error('❌ Error en autocuración:', error);
            res.status(500).json({
                success: false,
                error: 'Error en autocuración',
                details: error.message || 'Error desconocido'
            });
        }
    });

    // Importar conversaciones antiguas desde Evolution API
    router.post('/contacts/import-conversations', authenticate, authorizeAdmin, async (req, res) => {
        try {
            logger.info('🔄 Iniciando importación de conversaciones antiguas desde Evolution API...');

            const evolutionAPI = botManager.getEvolutionAPI();
            if (!evolutionAPI) {
                return res.status(500).json({ 
                    error: 'Evolution API no disponible',
                    details: 'No se pudo obtener el servicio de Evolution API'
                });
            }

            // Obtener chats desde Evolution API
            const axios = require('axios');
            const evolutionUrl = EnvConfig.EVOLUTION_URL;
            const apiKey = EnvConfig.EVOLUTION_APIKEY;
            const instanceName = EnvConfig.EVOLUTION_INSTANCE_NAME;

            if (!evolutionUrl || !apiKey || !instanceName) {
                return res.status(400).json({
                    error: 'Variables de entorno faltantes',
                    details: 'EVOLUTION_URL, EVOLUTION_APIKEY o EVOLUTION_INSTANCE_NAME no configuradas'
                });
            }

            let importedContacts = 0;
            let importedMessages = 0;
            let errors: any[] = [];

            try {
                // Obtener lista de chats
                const chatsResponse = await axios.get(
                    `${evolutionUrl}/chat/fetchChats/${instanceName}`,
                    { headers: { apikey: apiKey } }
                );

                const chats = chatsResponse.data || [];

                logger.info(`📋 Encontrados ${chats.length} chats para importar`);

                // Procesar cada chat
                for (const chat of chats) {
                    try {
                        const phoneNumber = chat.id?.split('@')[0] || chat.remoteJid?.split('@')[0];
                        if (!phoneNumber || phoneNumber.includes('g.us') || phoneNumber === 'status') {
                            continue; // Saltar grupos y estados
                        }

                        const contactId = `${phoneNumber}@s.whatsapp.net`;
                        const contactName = chat.name || chat.pushName || phoneNumber;

                        // Crear o actualizar contacto
                        const contact = await prisma.contact.upsert({
                            where: { phoneNumber: contactId },
                            create: {
                                phoneNumber: contactId,
                                name: contactName,
                                pushName: contactName,
                                lastInteraction: chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp * 1000) : new Date(),
                                interactionsCount: 1
                            },
                            update: {
                                name: contactName || undefined,
                                pushName: contactName || undefined,
                                lastInteraction: chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp * 1000) : undefined
                            }
                        });

                        importedContacts++;

                        // Intentar obtener mensajes del chat
                        try {
                            const messagesResponse = await axios.get(
                                `${evolutionUrl}/message/fetchMessages/${instanceName}`,
                                {
                                    params: {
                                        remoteJid: contactId,
                                        limit: 100
                                    },
                                    headers: { apikey: apiKey }
                                }
                            );

                            const messages = messagesResponse.data?.messages || [];
                            
                            // Guardar mensajes en la base de datos
                            for (const msg of messages.slice(0, 50)) { // Limitar a 50 mensajes por chat
                                try {
                                    const messageText = msg.message?.conversation || 
                                                       msg.message?.extendedTextMessage?.text ||
                                                       msg.message?.imageMessage?.caption ||
                                                       '';
                                    
                                    if (!messageText && !msg.message?.imageMessage && !msg.message?.videoMessage) {
                                        continue; // Saltar mensajes sin contenido de texto
                                    }

                                    const messageId = msg.key?.id || `${msg.timestamp}-${Math.random()}`;
                                    const from = msg.key?.fromMe === true || msg.fromMe === true 
                                        ? contactId 
                                        : (msg.key?.remoteJid || contactId);
                                    const to = msg.key?.fromMe === true || msg.fromMe === true
                                        ? (msg.key?.remoteJid || contactId)
                                        : contactId;
                                    const hasMedia = !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.audioMessage);
                                    
                                    await prisma.message.upsert({
                                        where: {
                                            messageId: messageId
                                        },
                                        create: {
                                            phoneNumber: contactId,
                                            messageId: messageId,
                                            from: from,
                                            to: to,
                                            body: messageText || '[Media]',
                                            isFromBot: msg.key?.fromMe === true || msg.fromMe === true,
                                            timestamp: msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date(),
                                            hasMedia: hasMedia,
                                            type: hasMedia ? 'MEDIA' : 'TEXT',
                                            metadata: msg as any
                                        },
                                        update: {
                                            body: messageText || '[Media]',
                                            timestamp: msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : undefined,
                                            hasMedia: hasMedia
                                        }
                                    });

                                    importedMessages++;
                                } catch (msgError: any) {
                                    errors.push({ type: 'message', error: msgError.message, chat: contactId });
                                }
                            }
                        } catch (msgFetchError: any) {
                            logger.warn(`⚠️ No se pudieron obtener mensajes para ${contactId}: ${msgFetchError.message}`);
                            errors.push({ type: 'fetch_messages', error: msgFetchError.message, chat: contactId });
                        }

                    } catch (contactError: any) {
                        logger.error(`❌ Error procesando chat: ${contactError.message}`);
                        errors.push({ type: 'contact', error: contactError.message, chat: chat.id || 'unknown' });
                    }
                }

                logger.info(`✅ Importación completada: ${importedContacts} contactos, ${importedMessages} mensajes`);

                res.json({
                    success: true,
                    importedContacts,
                    importedMessages,
                    errors: errors.length > 0 ? errors.slice(0, 10) : [], // Solo primeros 10 errores
                    errorCount: errors.length
                });

            } catch (apiError: any) {
                logger.error('❌ Error obteniendo chats desde Evolution API:', apiError);
                res.status(500).json({
                    error: 'Error al obtener chats desde Evolution API',
                    details: apiError.response?.data || apiError.message,
                    statusCode: apiError.response?.status
                });
            }

        } catch (error: any) {
            logger.error('❌ Error en importación de conversaciones:', error);
            res.status(500).json({
                error: 'Error al importar conversaciones',
                details: error.message
            });
        }
    });

    return router;
}