import express from 'express';
import { BotManager } from '../../bot.manager';
import logger from '../../configs/logger.config';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware';
import { CampaignModel } from '../models/campaign.model';
import { ContactModel } from '../models/contact.model';
import { AuthService } from '../utils/auth.util';
import { TemplateModel } from '../models/template.model';
import { BotConfigModel } from '../models/bot-config.model';
import { sendPaymentConfirmationMessage, sendAppointmentConfirmationMessage } from '../../utils/payment-detection.util';
import { NotificationModel } from '../models/notification.model';
import { MessageModel } from '../models/message.model';
import { UserModel } from '../models/user.model';
import { ProductModel } from '../models/product.model';
import { sendCampaignMessages } from '../../crons/campaign.cron';
import { CustomStatusModel } from '../models/custom-status.model';
import { AutomationModel } from '../models/automation.model';
import { AutomationService } from '../utils/automation.util';

export const router = express.Router();

export default function (botManager: BotManager) {
    // Contacts API
    router.get('/contacts', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { page = 1, limit = 20, search = '', sort = '-lastInteraction', saleStatus } = req.query;
            const skip = (Number(page) - 1) * Number(limit);

            const query: any = {};

            // Search filter
            if (search) {
                query.$or = [
                    { phoneNumber: { $regex: search, $options: 'i' } },
                    { name: { $regex: search, $options: 'i' } },
                    { pushName: { $regex: search, $options: 'i' } }
                ];
            }

            // Sale status filter
            if (saleStatus) {
                query.saleStatus = saleStatus;
            }

            const contacts = await ContactModel.find(query)
                .sort(sort)
                .skip(skip)
                .limit(Number(limit));

            const total = await ContactModel.countDocuments(query);

            res.json({
                data: contacts,
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

            const validStatuses = ['lead', 'interested', 'info_requested', 'payment_pending', 'appointment_scheduled', 'appointment_confirmed', 'completed'];
            if (!validStatuses.includes(saleStatus)) {
                return res.status(400).json({ error: `Invalid sale status. Must be one of: ${validStatuses.join(', ')}` });
            }

            // Obtener estado anterior para disparar automatizaciones
            const previousContact = await ContactModel.findOne({ phoneNumber });
            const previousStatus = previousContact?.saleStatus || 'lead';

            const updateData: any = { saleStatus };
            if (saleStatusNotes !== undefined) {
                updateData.saleStatusNotes = saleStatusNotes;
            }

            // Manejar estados específicos
            if (saleStatus === 'payment_pending') {
                if (!req.body.paidAt) {
                    updateData.paidAt = new Date();
                }
            }
            if (saleStatus === 'appointment_scheduled' && req.body.appointmentDate) {
                updateData.appointmentDate = new Date(req.body.appointmentDate);
            }
            if (saleStatus === 'appointment_confirmed') {
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

            const contact = await ContactModel.findOneAndUpdate(
                { phoneNumber },
                { $set: updateData },
                { new: true }
            );

            if (!contact) {
                return res.status(404).json({ error: 'Contact not found' });
            }

            // Disparar automatizaciones de cambio de estado
            if (previousStatus !== saleStatus) {
                AutomationService.triggerStatusChangeAutomations(
                    botManager,
                    phoneNumber,
                    previousStatus,
                    saleStatus
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

            const contact = await ContactModel.findOneAndUpdate(
                { phoneNumber },
                { $set: { isPaused: isPaused === true } },
                { new: true }
            );

            if (!contact) {
                return res.status(404).json({ error: 'Contact not found' });
            }

            // Si se está pausando (no despausando), enviar mensaje automático
            if (isPaused === true && botManager.client) {
                try {
                    const formattedNumber = phoneNumber.includes('@')
                        ? phoneNumber
                        : `${phoneNumber}@c.us`;

                    const pauseMessage = `✅ *Solicitud Recibida*

Tu solicitud ha sido registrada correctamente.

👤 *Estado:* En cola para atención humana
⏰ *Horario de atención:* Lunes a Viernes 9am - 7pm

📝 Enseguida vendrá un asesor a atenderte. El bot ha sido pausado temporalmente para evitar respuestas automáticas.

¡Gracias por tu paciencia! 🌱`;

                    const sentMessage = await botManager.client.sendMessage(formattedNumber, pauseMessage);

                    // Guardar mensaje enviado en la base de datos
                    if (sentMessage) {
                        await botManager.saveSentMessage(phoneNumber, pauseMessage, sentMessage.id._serialized);
                    }

                    logger.info(`Pause confirmation message sent to ${phoneNumber}`);
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
            const result = await ContactModel.updateMany(
                { isPaused: true },
                { $set: { isPaused: false } }
            );

            logger.info(`Unpaused ${result.modifiedCount} contacts`);
            res.json({ 
                message: `Se despausaron ${result.modifiedCount} contacto(s) exitosamente`,
                count: result.modifiedCount 
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
                saleStatus: 'appointment_confirmed'
            };
            if (appointmentNotes) {
                updateData.appointmentNotes = appointmentNotes;
            }
            if (appointmentDate) {
                updateData.appointmentDate = new Date(appointmentDate);
            }

            const contact = await ContactModel.findOneAndUpdate(
                { phoneNumber },
                { $set: updateData },
                { new: true }
            );

            if (!contact) {
                return res.status(404).json({ error: 'Contact not found' });
            }

            // Enviar mensaje automático de confirmación de cita
            try {
                if (botManager.client) {
                    await sendAppointmentConfirmationMessage(
                        botManager.client,
                        phoneNumber,
                        contact.appointmentDate ? new Date(contact.appointmentDate) : undefined,
                        contact.appointmentNotes
                    );
                }
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

            const contact = await ContactModel.findOneAndUpdate(
                { phoneNumber },
                {
                    $set: {
                        paymentConfirmedAt: new Date(),
                        saleStatus: 'appointment_scheduled'
                    }
                },
                { new: true }
            );

            if (!contact) {
                return res.status(404).json({ error: 'Contact not found' });
            }

            // Enviar mensaje automático de confirmación de pago
            try {
                if (botManager.client) {
                    await sendPaymentConfirmationMessage(botManager.client, phoneNumber);
                }
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
            const contacts = await ContactModel.find().sort({ lastInteraction: -1 });

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
                            const existingContact = await ContactModel.findOne({ phoneNumber });

                            const updateData: any = {
                                lastInteraction: row['Última interacción'] && row['Última interacción'] !== 'Sin registro'
                                    ? new Date(row['Última interacción'])
                                    : new Date(),
                                saleStatus: ['lead', 'interested', 'info_requested', 'payment_pending', 'appointment_scheduled', 'appointment_confirmed', 'completed'].includes(saleStatus)
                                    ? saleStatus
                                    : 'lead'
                            };

                            // Manejar nombre: si está vacío, intentar obtener pushName del perfil de WhatsApp
                            if (name) {
                                updateData.name = name;
                            } else if (!existingContact || !existingContact.pushName) {
                                // Si no hay nombre y no tenemos pushName, intentar obtenerlo de WhatsApp
                                try {
                                    if (botManager.client) {
                                        const formattedNumber = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
                                        const contact = await botManager.client.getContactById(formattedNumber);
                                        if (contact && contact.pushname) {
                                            updateData.pushName = contact.pushname;
                                        }
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
                                await ContactModel.findOneAndUpdate(
                                    { phoneNumber },
                                    { $set: updateData },
                                    { new: true }
                                );
                                updated++;
                            } else {
                                // Crear nuevo contacto
                                await ContactModel.create({
                                    phoneNumber,
                                    ...updateData
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
                const query: any = {};
                if (saleStatusFilter.length > 0) {
                    query.saleStatus = { $in: saleStatusFilter };
                }

                const filteredContacts = await ContactModel.find(query).select('phoneNumber');
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

            const campaign = new CampaignModel({
                name,
                message,
                scheduledAt: parsedScheduledAt,
                contacts: actualContacts,
                createdBy: req.user.userId,
                status: parsedScheduledAt ? 'scheduled' : 'draft',
                isBatchCampaign: isBatchCampaign || false,
                batchSize: batchSize || actualContacts.length,
                batchInterval: batchInterval || 0,
                currentBatchIndex: 0,
                totalBatches: totalBatches,
                saleStatusFilter: saleStatusFilter || [],
                // Para campañas por lotes, nextBatchAt debe ser igual a scheduledAt si existe
                // Para campañas sin programar, será null y se establecerá cuando se envíe
                nextBatchAt: parsedScheduledAt ? new Date(parsedScheduledAt) : null
            });

            await campaign.save();

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
            const campaigns = await CampaignModel.find()
                .sort({ createdAt: -1 })
                .populate('createdBy', 'username');

            res.json(campaigns);
        } catch (error) {
            logger.error('Failed to fetch campaigns:', error);
            res.status(500).json({ error: 'Failed to fetch campaigns' });
        }
    });

    // Templates API
    router.get('/templates', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const templates = await TemplateModel.find().sort({ createdAt: -1 });
            res.json(templates);
        } catch (error) {
            logger.error('Failed to fetch templates:', error);
            res.status(500).json({ error: 'Failed to fetch templates' });
        }
    });

    router.post('/templates', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { name, content } = req.body;

            const template = new TemplateModel({
                name,
                content,
                createdBy: req.user.userId
            });

            await template.save();
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

            const template = await TemplateModel.findByIdAndUpdate(
                id,
                { name, content },
                { new: true }
            );

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

            const template = await TemplateModel.findByIdAndDelete(id);

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
            const products = await ProductModel.find().sort({ createdAt: -1 });
            res.json(products);
        } catch (error) {
            logger.error('Failed to fetch products:', error);
            res.status(500).json({ error: 'Failed to fetch products' });
        }
    });

    router.post('/products', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { name, description, price, sizes, promotions, imageUrl, category, inStock } = req.body;

            const product = new ProductModel({
                name,
                description,
                price,
                sizes,
                promotions,
                imageUrl,
                category,
                inStock
            });

            await product.save();
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

            const product = await ProductModel.findByIdAndUpdate(
                id,
                updateData,
                { new: true }
            );

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

            const product = await ProductModel.findByIdAndDelete(id);

            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            res.json({ success: true });
        } catch (error) {
            logger.error('Failed to delete product:', error);
            res.status(500).json({ error: 'Failed to delete product' });
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
                _id: user._id,
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
            const users = await UserModel.find().select('-password').sort({ createdAt: -1 });

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
                _id: user._id,
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
            const user = await UserModel.findById(req.user.userId).select('-password');
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
                _id: user._id,
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
            const user = await UserModel.findById(req.user.userId).select('-password');
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
            const totalContacts = await ContactModel.countDocuments();
            const contactsWithTags = await ContactModel.countDocuments({ tags: { $exists: true, $ne: [] } });
            const recentContacts = await ContactModel.countDocuments({
                lastInteraction: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            });

            // Get contacts by sale status
            const leads = await ContactModel.countDocuments({ saleStatus: 'lead' });
            const interestedContacts = await ContactModel.countDocuments({ saleStatus: 'interested' });
            const infoRequested = await ContactModel.countDocuments({ saleStatus: 'info_requested' });
            const paymentPending = await ContactModel.countDocuments({ saleStatus: 'payment_pending' });
            const appointmentScheduled = await ContactModel.countDocuments({ saleStatus: 'appointment_scheduled' });
            const appointmentConfirmed = await ContactModel.countDocuments({ saleStatus: 'appointment_confirmed' });
            const completed = await ContactModel.countDocuments({ saleStatus: 'completed' });
            const pausedContacts = await ContactModel.countDocuments({ isPaused: true });

            // Get campaign statistics
            const totalCampaigns = await CampaignModel.countDocuments();
            const sentCampaigns = await CampaignModel.countDocuments({ status: 'sent' });
            const scheduledCampaigns = await CampaignModel.countDocuments({ status: 'scheduled' });

            // Calculate total messages sent
            const campaigns = await CampaignModel.find({ status: 'sent' });
            const totalMessagesSent = campaigns.reduce((sum, campaign) => sum + (campaign.sentCount || 0), 0);

            // Get top leads from contacts based on interactions
            const topLeadsContacts = await ContactModel.find()
                .sort({ interactionsCount: -1 })
                .limit(10)
                .select('phoneNumber name pushName interactionsCount lastInteraction');

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
            const config = await BotConfigModel.findOne() || await BotConfigModel.create({});
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

            let config = await BotConfigModel.findOne();
            if (!config) {
                config = await BotConfigModel.create(updateData);
            } else {
                // Actualizar todos los campos proporcionados
                Object.keys(updateData).forEach(key => {
                    if (updateData[key] !== undefined) {
                        (config as any)[key] = updateData[key];
                    }
                });
                await config.save();
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
            const { BotContentModel } = await import('../models/bot-content.model');
            const contents = await BotContentModel.find().sort({ category: 1, key: 1 });
            res.json(contents);
        } catch (error) {
            logger.error('Failed to fetch bot content:', error);
            res.status(500).json({ error: 'Failed to fetch bot content' });
        }
    });

    router.get('/bot-content/:key', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { BotContentModel } = await import('../models/bot-content.model');
            const content = await BotContentModel.findOne({ key: req.params.key });
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
            const { BotContentModel } = await import('../models/bot-content.model');
            const { content, mediaPath, description, category } = req.body;
            
            const updateData: any = { content };
            if (mediaPath !== undefined) updateData.mediaPath = mediaPath;
            if (description !== undefined) updateData.description = description;
            if (category !== undefined) updateData.category = category;

            const botContent = await BotContentModel.findOneAndUpdate(
                { key: req.params.key },
                { $set: updateData },
                { new: true, upsert: true }
            );

            res.json({ message: 'Content updated successfully', content: botContent });
        } catch (error) {
            logger.error('Failed to update bot content:', error);
            res.status(500).json({ error: 'Failed to update bot content' });
        }
    });

    router.post('/bot-content', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { BotContentModel } = await import('../models/bot-content.model');
            const { key, content, mediaPath, description, category } = req.body;
            
            if (!key || !content) {
                return res.status(400).json({ error: 'key and content are required' });
            }

            const existingContent = await BotContentModel.findOne({ key });
            if (existingContent) {
                return res.status(400).json({ error: 'Content with this key already exists' });
            }

            const botContent = await BotContentModel.create({
                key,
                content,
                mediaPath,
                description,
                category: category || 'other'
            });

            res.status(201).json({ message: 'Content created successfully', content: botContent });
        } catch (error) {
            logger.error('Failed to create bot content:', error);
            res.status(500).json({ error: 'Failed to create bot content' });
        }
    });

    router.delete('/bot-content/:key', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { BotContentModel } = await import('../models/bot-content.model');
            const content = await BotContentModel.findOneAndDelete({ key: req.params.key });
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
            const { BotContentModel } = await import('../models/bot-content.model');
            
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
                const exists = await BotContentModel.findOne({ key: content.key });
                if (!exists) {
                    await BotContentModel.create(content);
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

            // Asegurar que el cliente esté inicializado
            if (!botManager.client) {
                logger.info('Client not initialized, initializing...');
                await botManager.initializeClient();
            }

            if (!botManager.client) {
                logger.warn('Send message failed: Client is null after initialization attempt');
                return res.status(503).json({ 
                    error: 'WhatsApp client is not available. Please try again later.',
                    success: false,
                    reason: 'client_not_initialized'
                });
            }

            // Verificar que el cliente esté listo usando la misma lógica que /health
            const isClientReady = botManager.client && botManager.client.info ? true : false;
            
            // Si el cliente está conectado pero qrScanned es false (después de reinicio), actualizarlo
            if (isClientReady && !botManager.qrData.qrScanned) {
                logger.info('Client is ready but qrScanned is false, updating status');
                botManager.qrData.qrScanned = true;
            }
            
            if (!isClientReady) {
                const qrScanned = botManager.qrData.qrScanned;
                const hasInfo = !!botManager.client.info;
                
                logger.warn(`Send message failed: Client not ready. qrScanned: ${qrScanned}, hasInfo: ${hasInfo}`);
                
                if (!hasInfo) {
                    return res.status(503).json({ 
                        error: 'WhatsApp client is not authenticated. Please wait for the connection to be established.',
                        success: false,
                        reason: 'client_not_authenticated',
                        details: 'The client may be initializing. Please wait a moment and try again. If the problem persists, go to Settings > WhatsApp to check the connection status.'
                    });
                }
                
                // Si no tiene info, no puede enviar mensajes
                return res.status(503).json({ 
                    error: 'WhatsApp client is not ready. Please wait for the connection to be established.',
                    success: false,
                    reason: 'client_not_ready',
                    details: 'Go to Settings > WhatsApp to check the connection status and scan the QR code if needed.'
                });
            }

            // Verificar que el cliente tenga el método sendMessage disponible
            if (typeof botManager.client.sendMessage !== 'function') {
                logger.warn('Send message failed: sendMessage method not available');
                return res.status(503).json({ 
                    error: 'WhatsApp client sendMessage method is not available. The client may not be fully initialized.',
                    success: false,
                    reason: 'sendMessage_not_available'
                });
            }

            // Formatear número de teléfono
            const formattedNumber = phoneNumber.includes('@')
                ? phoneNumber
                : `${phoneNumber}@c.us`;

            logger.info(`Sending message to ${formattedNumber} from CRM`);

            // Enviar mensaje - sendMessage creará el chat automáticamente si no existe
            let sentMessage;
            try {
                sentMessage = await botManager.client.sendMessage(formattedNumber, message.trim());
            } catch (sendError: any) {
                logger.error(`Error sending message to ${formattedNumber}:`, sendError);
                
                // Proporcionar mensajes de error más específicos
                const errorMessage = sendError.message || String(sendError);
                
                if (errorMessage.includes('getChat') || errorMessage.includes('Cannot read properties')) {
                    return res.status(400).json({ 
                        error: 'No se pudo enviar el mensaje. El cliente de WhatsApp puede no estar completamente inicializado o el número puede ser inválido.',
                        success: false,
                        details: 'Verifica que el número de teléfono sea correcto y que el cliente de WhatsApp esté listo. Intenta recargar la página.'
                    });
                }
                
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
            if (sentMessage) {
                try {
                    await botManager.saveSentMessage(phoneNumber, message.trim(), sentMessage.id._serialized);
                    logger.info(`Message sent successfully to ${formattedNumber}, saved to database`);
                } catch (saveError) {
                    logger.warn(`Message sent but failed to save to database: ${saveError}`);
                    // No fallar la respuesta si el mensaje se envió pero falló al guardar
                }
            }

            res.json({ 
                success: true,
                messageId: sentMessage?.id?._serialized || null
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
            const { limit = 50, before, requiresAttention } = req.query; // Paginación opcional y filtro de atención

            const query: any = { phoneNumber };

            // Si hay un timestamp "before", obtener mensajes anteriores a esa fecha
            if (before) {
                query.timestamp = { $lt: new Date(before) };
            }

            // Si se solicita solo mensajes que requieren atención
            if (requiresAttention === 'true') {
                query.requiresAttention = true;
            }

            const messages = await MessageModel.find(query)
                .sort({ timestamp: -1 })
                .limit(Number(limit));

            // Ordenar por timestamp ascendente para mostrar en orden cronológico
            messages.reverse();

            // Evitar caching para tener mensajes siempre actualizados
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            
            res.json({ messages });
        } catch (error) {
            logger.error('Failed to fetch messages:', error);
            res.status(500).json({ error: 'Failed to fetch messages' });
        }
    });

    // Obtener mensajes que requieren atención (todos los contactos)
    router.get('/messages/requires-attention', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { limit = 50 } = req.query;

            const messages = await MessageModel.find({ requiresAttention: true, isFromBot: false })
                .sort({ timestamp: -1 })
                .limit(Number(limit))
                .populate('contactId', 'phoneNumber name pushName');

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
            await botManager.initializeClient(true);
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
    router.post('/whatsapp/logout', authenticate, authorizeAdmin, async (req, res) => {
        try {
            logger.info('=== SOLICITUD DE DESVINCULACIÓN RECIBIDA ===');
            
            // Paso 1: Desvincular y limpiar TODAS las sesiones (función unificada)
            logger.info('Paso 1: Desvinculando y limpiando todas las sesiones...');
            const deletedCount = await botManager.logout();
            logger.info(`✓ Logout completado. ${deletedCount} sesión(es) eliminada(s)`);
            
            // Paso 2: Esperar para asegurar que todo se limpió completamente
            logger.info('Paso 2: Esperando que la limpieza se complete...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Paso 3: Crear nuevo cliente limpio
            logger.info('Paso 3: Creando nuevo cliente limpio...');
            await botManager.initializeClient(true); // skipSessionClear porque ya limpiamos todo
            logger.info('✓ Nuevo cliente creado');
            
            // Paso 4: Esperar antes de inicializar
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Paso 5: Inicializar el cliente - esto generará un nuevo QR
            logger.info('Paso 4: Inicializando cliente para generar nuevo QR...');
            botManager.initialize().catch(err => {
                logger.error('❌ Error durante inicialización después de logout:', err);
            });
            
            // Paso 6: Esperar para que el QR se genere (dar más tiempo)
            logger.info('Paso 5: Esperando generación del QR...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            logger.info('=== DESVINCULACIÓN COMPLETADA ===');
            res.json({ 
                message: `WhatsApp desvinculado correctamente. ${deletedCount} sesión(es) eliminada(s). Generando nuevo código QR...`,
                success: true,
                deletedCount
            });
        } catch (error: any) {
            logger.error('❌ Error durante desvinculación:', error);
            res.status(500).json({ 
                error: 'Error al desvincular WhatsApp',
                details: error.message || 'Error desconocido',
                success: false
            });
        }
    });

    // Notifications API
    router.get('/notifications', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { unreadOnly = 'true', limit = 50 } = req.query;

            const query: any = {};
            if (unreadOnly === 'true') {
                query.read = false;
            }

            const notifications = await NotificationModel.find(query)
                .sort({ createdAt: -1 })
                .limit(Number(limit));

            const unreadCount = await NotificationModel.countDocuments({ read: false });

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

            const notification = await NotificationModel.findByIdAndUpdate(
                id,
                { $set: { read: true } },
                { new: true }
            );

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
            await NotificationModel.updateMany(
                { read: false },
                { $set: { read: true } }
            );

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

                const unreadCount = await NotificationModel.countDocuments({ read: false });
                const latestNotifications = await NotificationModel.find({ read: false })
                    .sort({ createdAt: -1 })
                    .limit(5);

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
            const statuses = await CustomStatusModel.find().sort({ order: 1 });
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

            const status = await CustomStatusModel.create({
                name,
                value,
                color,
                description,
                order: order || 0,
                createdBy: req.user.userId
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

            const status = await CustomStatusModel.findByIdAndUpdate(
                id,
                { name, value, color, description, order, isActive },
                { new: true }
            );

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

            const status = await CustomStatusModel.findByIdAndDelete(id);

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
            const automations = await AutomationModel.find()
                .sort({ createdAt: -1 })
                .populate('createdBy', 'username');

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

            const automation = await AutomationModel.create({
                name,
                description,
                triggerType,
                triggerConditions: triggerConditions || {},
                actions,
                createdBy: req.user.userId
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

            const automation = await AutomationModel.findByIdAndUpdate(
                id,
                { name, description, triggerType, triggerConditions, actions, isActive },
                { new: true }
            );

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

            const automation = await AutomationModel.findByIdAndDelete(id);

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

    return router;
}