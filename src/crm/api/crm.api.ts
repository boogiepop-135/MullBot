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
    
    // Endpoint público para crear usuario (sin autenticación) - solo para desarrollo/uso personal
    // IMPORTANTE: En producción, considera proteger este endpoint con una API key o deshabilitarlo
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

    router.get('/auth/check', authenticate, (req, res) => {
        res.json({ user: req.user });
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

            await botManager.client.sendMessage(formattedNumber, message);
            res.json({ success: true });
        } catch (error) {
            logger.error('Failed to send message:', error);
            res.status(500).json({ error: 'Failed to send message' });
        }
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