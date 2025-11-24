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
import { BotContentModel } from '../models/bot-content.model';

export const router = express.Router();

export default function (botManager: BotManager) {
    // Content Management API
    router.get('/content', authenticate, authorizeAdmin, async (req, res) => {
        try {
            // Seed content if empty (simple check)
            const count = await BotContentModel.countDocuments();
            if (count === 0) {
                await seedDefaultContent();
            }

            const content = await BotContentModel.find().sort({ key: 1 });
            res.json(content);
        } catch (error) {
            logger.error('Failed to fetch content:', error);
            res.status(500).json({ error: 'Failed to fetch content' });
        }
    });

    router.put('/content/:key', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { key } = req.params;
            const { content, mediaPath } = req.body;

            const updatedContent = await BotContentModel.findOneAndUpdate(
                { key },
                { content, mediaPath },
                { new: true, upsert: true }
            );

            res.json(updatedContent);
        } catch (error) {
            logger.error('Failed to update content:', error);
            res.status(500).json({ error: 'Failed to update content' });
        }
    });

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

    // Campaigns API
    router.post('/campaigns', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { name, message, scheduledAt, contacts } = req.body;

            const campaign = new CampaignModel({
                name,
                message,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                contacts,
                createdBy: req.user.userId,
                status: scheduledAt ? 'scheduled' : 'draft'
            });

            await campaign.save();

            if (!scheduledAt) {
                // Send immediately
                await sendCampaignMessages(botManager, campaign);
            }

            res.status(201).json(campaign);
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
            const config = await BotConfigModel.findOne() || await BotConfigModel.create({ botDelay: 10000 });
            res.json(config);
        } catch (error) {
            logger.error('Failed to fetch bot config:', error);
            res.status(500).json({ error: 'Failed to fetch bot config' });
        }
    });

    router.put('/bot-config', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { botDelay } = req.body;

            if (botDelay === undefined || botDelay < 0) {
                return res.status(400).json({ error: 'botDelay is required and must be >= 0' });
            }

            let config = await BotConfigModel.findOne();
            if (!config) {
                config = await BotConfigModel.create({ botDelay });
            } else {
                config.botDelay = botDelay;
                await config.save();
            }

            res.json({ message: 'Bot configuration updated successfully', config });
        } catch (error) {
            logger.error('Failed to update bot config:', error);
            res.status(500).json({ error: 'Failed to update bot config' });
        }
    });

    // Send message route
    router.post('/send-message', authenticate, authorizeAdmin, async (req, res) => {
        try {
            // Asegurar que el cliente esté inicializado
            if (!botManager.client) {
                await botManager.initializeClient();
            }

            const { phoneNumber, message } = req.body;
            const formattedNumber = phoneNumber.includes('@')
                ? phoneNumber
                : `${phoneNumber}@c.us`;

            const sentMessage = await botManager.client.sendMessage(formattedNumber, message);

            // Guardar mensaje enviado en la base de datos
            if (sentMessage) {
                await botManager.saveSentMessage(phoneNumber, message, sentMessage.id._serialized);
            }

            res.json({ success: true });
        } catch (error) {
            logger.error('Failed to send message:', error);
            res.status(500).json({ error: 'Failed to send message' });
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

    // WhatsApp logout endpoint
    router.post('/whatsapp/logout', authenticate, authorizeAdmin, async (req, res) => {
        try {
            await botManager.logout();
            res.json({ message: 'WhatsApp session disconnected successfully. You can now scan a new QR code.' });
        } catch (error) {
            logger.error('Failed to logout WhatsApp:', error);
            res.status(500).json({ error: 'Failed to logout WhatsApp' });
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

    return router;
}

async function sendCampaignMessages(botManager: BotManager, campaign: any) {
    try {
        // Asegurar que el cliente esté inicializado
        if (!botManager.client) {
            await botManager.initializeClient();
        }

        campaign.status = 'sending';
        await campaign.save();

        let sentCount = 0;
        let failedCount = 0;

        for (const phoneNumber of campaign.contacts) {
            try {
                const formattedNumber = phoneNumber.includes('@')
                    ? phoneNumber
                    : `${phoneNumber}@c.us`;

                await botManager.client.sendMessage(formattedNumber, campaign.message);
                sentCount++;
            } catch (error) {
                logger.error(`Failed to send message to ${phoneNumber}:`, error);
                failedCount++;
            }
        }

        campaign.sentCount = sentCount;
        campaign.failedCount = failedCount;
        campaign.status = sentCount > 0 ? 'sent' : 'failed';
        campaign.sentAt = new Date();
        await campaign.save();

    } catch (error) {
        logger.error('Failed to send campaign:', error);
        campaign.status = 'failed';
        await campaign.save();
    }
}

async function seedDefaultContent() {
    try {
        const defaultContent = [
            // Quick Responses (Menus)
            {
                key: 'main_menu',
                category: 'quick_response',
                description: 'Mensaje del menú principal',
                content: `👋 *MENÚ PRINCIPAL MÜLLBLUE*

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

Escribe el *número* de la opción que te interesa o pregunta lo que necesites 🌱

*💡 Tip:* Puedes escribir *menú* o *volver* en cualquier momento para ver estas opciones nuevamente`,
                mediaPath: 'public/info.png'
            },
            {
                key: 'option_1_process',
                category: 'quick_response',
                description: 'Opción 1: Proceso de compostaje',
                content: `🌱 *PROCESO DE COMPOSTAJE FERMENTATIVO MÜLLBLUE*

*PASOS SIMPLES:*
1️⃣ *Depositar* residuos orgánicos
2️⃣ *Espolvorear* biocatalizador (50g por kg)
3️⃣ *Compactar* para eliminar aire
4️⃣ *Tapar* herméticamente
5️⃣ *Repetir* hasta llenar

*TIEMPO:*
⏰ Llenado: 4-6 semanas
⏰ Fermentación: 2 semanas adicionales
⏰ Resultado: Tierra fértil lista

*BENEFICIOS:*
✅ Reduce residuos 2.5x
✅ Sin olores ni plagas
✅ Genera biofertilizante líquido

¿Quieres más detalles sobre algún paso específico o te gustaría conocer otra opción? 🌱`,
                mediaPath: 'public/info.png'
            },
            {
                key: 'option_2_price',
                category: 'quick_response',
                description: 'Opción 2: Precio y promoción',
                content: `💰 *PRECIO Y PROMOCIÓN MÜLLBLUE*

*PRECIO ESPECIAL:*
💵 *$1,490 MXN* (antes $1,890)
🎁 *Ahorro: $400 MXN*

*QUÉ INCLUYE:*
📦 Compostero fementador 12.5L
🌿 Biocatalizador 1kg
🚚 Envío gratis
📞 Acompañamiento personalizado

*PROMOCIÓN VIGENTE:*
⏰ Precio promocional limitado
✨ Disponibilidad limitada

¿Te gustaría conocer más sobre los métodos de pago disponibles o tienes alguna pregunta sobre el producto? 🌱`,
                mediaPath: 'public/precio.png'
            },
            {
                key: 'option_3_payment',
                category: 'quick_response',
                description: 'Opción 3: Métodos de pago',
                content: `💳 *MÉTODOS DE PAGO MÜLLBLUE*

*OPCIÓN 1 - TRANSFERENCIA:*
🏦 Banco Azteca
📝 Cuenta: 127180013756372173
👤 Titular: Aldair Eduardo Rivera García
💵 Monto: $1,490 MXN

*OPCIÓN 2 - TARJETAS:*
💳 Tarjetas de crédito/débito
🔄 Hasta 3 meses sin intereses (3MSI)
🔗 Link de pago: https://mpago.li/1W2JhS5

*VENTAJAS:*
✅ Pago seguro y rápido
✅ Confirmación inmediata
✅ Envío en 2-3 días hábiles

¿Prefieres transferencia o tarjeta? Si tienes más dudas sobre el producto, puedo ayudarte 🌱`,
                mediaPath: 'public/pago.png'
            },
            {
                key: 'option_4_kit',
                category: 'quick_response',
                description: 'Opción 4: Contenido del kit',
                content: `📦 *CONTENIDO DEL KIT MÜLLBLUE*

*INCLUYE:*
✅ Compostero fermentador 12.5L
✅ Biocatalizador 1kg (equivalente a 2-3 meses)
✅ Envío gratis a toda la República
✅ Guía de uso digital
✅ Acompañamiento personalizado por WhatsApp
✅ Soporte post-venta

*ESPECIFICACIONES:*
📏 Dimensiones: 30x30x40 cm
💧 Capacidad: 12.5 litros máximo
🌿 Material: Plástico de alta calidad
🔒 Tapa hermética anti-olores

¿Tienes alguna pregunta sobre el kit o te gustaría conocer más sobre dimensiones, envío u otra opción? 🌱`,
                mediaPath: 'public/info.png'
            },
            {
                key: 'option_5_dimensions',
                category: 'quick_response',
                description: 'Opción 5: Dimensiones',
                content: `📏 *DIMENSIONES Y ESPACIO MÜLLBLUE*

*ESPECIFICACIONES:*
📐 Dimensiones: 30 x 30 x 40 cm (alto)
💧 Capacidad: 12.5 litros máximo
📦 Peso: ~2.5 kg (vacío)
✨ Material: Plástico reciclable

*ESPACIO NECESARIO:*
🏠 Ideal para patios, jardines o terrazas
🏢 También funciona en interiores (cocina/balcón)
📍 Área mínima: 30x30 cm
📌 Superficie: Debe estar nivelada

*VENTAJAS:*
✅ Compacto y práctico
✅ No requiere mucho espacio
✅ Fácil de mover si es necesario

¿Tienes un espacio adecuado o te gustaría conocer más sobre el proceso de uso? 🌱`,
                mediaPath: 'public/info.png'
            },
            {
                key: 'option_6_shipping',
                category: 'quick_response',
                description: 'Opción 6: Envío',
                content: `🚚 *ENVÍO Y ENTREGA MÜLLBLUE*

*ENVÍO GRATIS:*
🚚 A toda la República Mexicana
📦 Empaque seguro y protegido
⏰ Entrega en 2-3 días hábiles
2️⃣ Confirmamos tu compra
3️⃣ Preparamos tu kit
4️⃣ Te enviamos guía de rastreo
5️⃣ Recibes en tu domicilio

*SEGUIMIENTO:*
📱 Te notificamos cada paso
📧 Recibes número de rastreo
✅ Confirmación de entrega

¿Tienes alguna pregunta sobre el proceso de envío o quieres conocer más sobre métodos de pago? 🌱`,
                mediaPath: 'public/info.png'
            },
            {
                key: 'option_7_faq',
                category: 'quick_response',
                description: 'Opción 7: Preguntas frecuentes',
                content: `❓ *PREGUNTAS FRECUENTES MÜLLBLUE*

*P: ¿Qué puedo agregar?*
R: Cáscaras, restos de comida, carnes, lácteos (poca cantidad), pan, arroz, café molido.

*P: ¿Qué NO puedo agregar?*
R: Estampas de frutas, huesos grandes, semillas grandes, aceite, líquidos excesivos, plásticos, metales.

*P: ¿Cuánto biocatalizador usar?*
    } catch (error) {
        logger.error('Failed to send campaign:', error);
        logger.error('Failed to send campaign:', error);
        campaign.status = 'failed';
        await campaign.save();
    }
}

async function seedDefaultContent() {
    try {
        const defaultContent = [
            // Quick Responses (Menus)
            {
                key: 'main_menu',
                category: 'quick_response',
                description: 'Mensaje del menú principal',
                content: `👋 *MENÚ PRINCIPAL MÜLLBLUE*

¡Hola! ¿En qué puedo ayudarte hoy ? 🤔

* Opciones disponibles:*

* 1. * Conocer el proceso de compostaje fermentativo
            * 2. * Dudas sobre precios y promociones
                * 3. * Métodos de pago disponibles
                    * 4. * ¿Qué incluye el kit ?
* 5. * Dimensiones y espacio necesario
            * 6. * Información sobre envío y entrega
                * 7. * Preguntas frecuentes
                    * 8. * Hablar con un agente

Escribe el * número * de la opción que te interesa o pregunta lo que necesites 🌱

*💡 Tip:* Puedes escribir * menú * o * volver * en cualquier momento para ver estas opciones nuevamente`,
                mediaPath: 'public/info.png'
            },
            {
                key: 'option_1_process',
                category: 'quick_response',
                description: 'Opción 1: Proceso de compostaje',
                content: `🌱 * PROCESO DE COMPOSTAJE FERMENTATIVO MÜLLBLUE *

* PASOS SIMPLES:*
            1️⃣ * Depositar * residuos orgánicos
        2️⃣ * Espolvorear * biocatalizador(50g por kg)
        3️⃣ * Compactar * para eliminar aire
        4️⃣ * Tapar * herméticamente
        5️⃣ * Repetir * hasta llenar

            * TIEMPO:*
⏰ Llenado: 4 - 6 semanas
⏰ Fermentación: 2 semanas adicionales
⏰ Resultado: Tierra fértil lista

            * BENEFICIOS:*
✅ Reduce residuos 2.5x
✅ Sin olores ni plagas
✅ Genera biofertilizante líquido

¿Quieres más detalles sobre algún paso específico o te gustaría conocer otra opción ? 🌱`,
                mediaPath: 'public/info.png'
            },
            {
                key: 'option_2_price',
                category: 'quick_response',
                description: 'Opción 2: Precio y promoción',
                content: `💰 * PRECIO Y PROMOCIÓN MÜLLBLUE *

* PRECIO ESPECIAL:*
💵 * $1, 490 MXN * (antes $1, 890)
🎁 * Ahorro: $400 MXN *

* QUÉ INCLUYE:*
📦 Compostero fementador 12.5L
🌿 Biocatalizador 1kg
🚚 Envío gratis
📞 Acompañamiento personalizado

            * PROMOCIÓN VIGENTE:*
⏰ Precio promocional limitado
✨ Disponibilidad limitada

¿Te gustaría conocer más sobre los métodos de pago disponibles o tienes alguna pregunta sobre el producto ? 🌱`,
                mediaPath: 'public/precio.png'
            },
            {
                key: 'option_3_payment',
                category: 'quick_response',
                description: 'Opción 3: Métodos de pago',
                content: `💳 * MÉTODOS DE PAGO MÜLLBLUE *

* OPCIÓN 1 - TRANSFERENCIA:*
🏦 Banco Azteca
📝 Cuenta: 127180013756372173
👤 Titular: Aldair Eduardo Rivera García
💵 Monto: $1, 490 MXN

            * OPCIÓN 2 - TARJETAS:*
💳 Tarjetas de crédito / débito
🔄 Hasta 3 meses sin intereses(3MSI)
🔗 Link de pago: https://mpago.li/1W2JhS5

* VENTAJAS:*
✅ Pago seguro y rápido
✅ Confirmación inmediata
✅ Envío en 2 - 3 días hábiles

¿Prefieres transferencia o tarjeta ? Si tienes más dudas sobre el producto, puedo ayudarte 🌱`,
                mediaPath: 'public/pago.png'
            },
            {
                key: 'option_4_kit',
                category: 'quick_response',
                description: 'Opción 4: Contenido del kit',
                content: `📦 * CONTENIDO DEL KIT MÜLLBLUE *

* INCLUYE:*
✅ Compostero fermentador 12.5L
✅ Biocatalizador 1kg(equivalente a 2 - 3 meses)
✅ Envío gratis a toda la República
✅ Guía de uso digital
✅ Acompañamiento personalizado por WhatsApp
✅ Soporte post - venta

            * ESPECIFICACIONES:*
📏 Dimensiones: 30x30x40 cm
💧 Capacidad: 12.5 litros máximo
🌿 Material: Plástico de alta calidad
🔒 Tapa hermética anti - olores

¿Tienes alguna pregunta sobre el kit o te gustaría conocer más sobre dimensiones, envío u otra opción ? 🌱`,
                mediaPath: 'public/info.png'
            },
            {
                key: 'option_5_dimensions',
                category: 'quick_response',
                description: 'Opción 5: Dimensiones',
                content: `📏 * DIMENSIONES Y ESPACIO MÜLLBLUE *

* ESPECIFICACIONES:*
📐 Dimensiones: 30 x 30 x 40 cm(alto)
💧 Capacidad: 12.5 litros máximo
📦 Peso: ~2.5 kg(vacío)
✨ Material: Plástico reciclable

            * ESPACIO NECESARIO:*
🏠 Ideal para patios, jardines o terrazas
🏢 También funciona en interiores(cocina / balcón)
📍 Área mínima: 30x30 cm
📌 Superficie: Debe estar nivelada

            * VENTAJAS:*
✅ Compacto y práctico
✅ No requiere mucho espacio
✅ Fácil de mover si es necesario

¿Tienes un espacio adecuado o te gustaría conocer más sobre el proceso de uso ? 🌱`,
                mediaPath: 'public/info.png'
            },
            {
                key: 'option_6_shipping',
                category: 'quick_response',
                description: 'Opción 6: Envío',
                content: `🚚 * ENVÍO Y ENTREGA MÜLLBLUE *

* ENVÍO GRATIS:*
🚚 A toda la República Mexicana
📦 Empaque seguro y protegido
⏰ Entrega en 2 - 3 días hábiles
        2️⃣ Confirmamos tu compra
        3️⃣ Preparamos tu kit
        4️⃣ Te enviamos guía de rastreo
        5️⃣ Recibes en tu domicilio

            * SEGUIMIENTO:*
📱 Te notificamos cada paso
📧 Recibes número de rastreo
✅ Confirmación de entrega

¿Tienes alguna pregunta sobre el proceso de envío o quieres conocer más sobre métodos de pago ? 🌱`,
                mediaPath: 'public/info.png'
            },
            {
                key: 'option_7_faq',
                category: 'quick_response',
                description: 'Opción 7: Preguntas frecuentes',
                content: `❓ * PREGUNTAS FRECUENTES MÜLLBLUE *

* P: ¿Qué puedo agregar ?*
            R : Cáscaras, restos de comida, carnes, lácteos(poca cantidad), pan, arroz, café molido.

* P: ¿Qué NO puedo agregar ?*
            R : Estampas de frutas, huesos grandes, semillas grandes, aceite, líquidos excesivos, plásticos, metales.

* P: ¿Cuánto biocatalizador usar ?*
            R : 50g por cada kg de residuos(equivale a 2 palas por cubeta de 5 litros).

* P: ¿Genera mal olor ?*
            R : No, el proceso anaeróbico y el biocatalizador eliminan olores completamente.

* P: ¿Atrae plagas ?*
            R : No, al estar herméticamente cerrado no atrae insectos ni animales.

¿Tienes alguna otra pregunta específica o te gustaría conocer más sobre precios o métodos de pago ? 🌱`,
                mediaPath: 'public/info.png'
            },
            {
                key: 'option_8_agent',
                category: 'quick_response',
                description: 'Opción 8: Agente humano',
                content: `👤 * HABLAR CON UN AGENTE *

            Para hablar directamente con un agente de Müllblue:

📞 Puedes escribir "agente" o "humano" en cualquier momento
⏰ Horario de atención: Lunes a Viernes 9am - 7pm
📱 También puedes llamarnos directamente

            * MIENTRAS TANTO:*
                Puedo ayudarte con:
✅ Información del producto
✅ Proceso de compra
✅ Métodos de pago
✅ Preguntas técnicas

¿En qué más puedo ayudarte ? Puedo resolver la mayoría de tus dudas aquí mismo 🌱`,
                mediaPath: 'public/info.png'
            },
            {
                key: 'command_precios',
                category: 'command',
                description: 'Comando /precios (Detallado)',
                content: `💰 * PRECIOS MÜLLBLUE - COMPOSTERO FERMENTADOR 15L *

* PRECIO ESPECIAL * 🎯
💵 * $1, 490 MXN * (antes $1, 890)
   ⏰ Precio promocional por tiempo limitado
   💳 A 3 meses sin intereses

            * INCLUYE TODO * ✅
✅ Compostero fermentador de 15 litros
✅ Biocatalizador(1 kg) - Ya incluido
✅ Envío gratis a todo México
✅ Acompañamiento personalizado
✅ Garantía de satisfacción

            * BIOCATALIZADOR ADICIONAL * 🌿
💵 * $150 pesos por kg *
   📦 Rinde para 30 kg de residuos orgánicos
   🚚 Envío gratis a partir de 3 kg

            * MÉTODOS DE PAGO * 💳

🏦 * Transferencia Bancaria:*
            Banco Azteca
        Cuenta: 127180013756372173
        Beneficiario: Aldair Eduardo Rivera García
        Concepto: [Tu nombre]

💳 * Tarjetas de Crédito:*
            A 3 meses sin intereses
   Enlace seguro: https://mpago.li/1W2JhS5

*¡Paga aquí con tarjeta! * 👆
        https://mpago.li/1W2JhS5

* ENVÍO Y ENTREGA * 🚚
📦 Gratis a todo México
⏰ 5 a 7 días hábiles
📋 Seguimiento incluido

            * GARANTÍAS * 🛡️
✅ Garantía de satisfacción
✅ Soporte técnico incluido
✅ Acompañamiento personalizado
✅ Reposición de piezas

            * VIDEO DEMOSTRATIVO * 📹
        https://youtube.com/shorts/Cap3U3eoLvY?si=M6E8icomSvMnK-L

¿Te interesa adquirir tu compostero fermentador ? ¿Tienes alguna pregunta sobre el proceso de compra ? 🌱`,
                mediaPath: 'public/precio.png'
            }
        ];

        for (const item of defaultContent) {
            await BotContentModel.findOneAndUpdate(
                { key: item.key },
                item,
                { upsert: true }
            );
        }
        logger.info('Default bot content seeded successfully');
    } catch (error) {
        logger.error('Failed to seed default content:', error);
    }
}