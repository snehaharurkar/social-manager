const express = require('express');
const router = express.Router();
const { db, getSetting, setSetting, logActivity } = require('../db');
const { 
  formatPhoneNumber, 
  sendWhatsAppMessage, 
  handleIncomingWhatsAppMessage,
  getHumanEscalationMessage 
} = require('../services/whatsapp');
const baileys = require('../services/baileys');

// GET /api/whatsapp/webhook (Meta verification)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const configuredToken = getSetting('WHATSAPP_VERIFY_TOKEN') || 'social_manager_wa_token';

  if (mode && token) {
    if (mode === 'subscribe' && token === configuredToken) {
      console.log('[WhatsApp Webhook Verified Successfully]');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  res.sendStatus(400);
});

// POST /api/whatsapp/webhook (Meta Inbound Messages)
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];
      const contact = change?.contacts?.[0];

      if (message && message.type === 'text') {
        const from = message.from;
        const senderName = contact?.profile?.name || '';
        const text = message.text?.body || '';
        const messageId = message.id;

        await handleIncomingWhatsAppMessage({
          from,
          senderName,
          text,
          messageId
        });
      }

      return res.status(200).send('EVENT_RECEIVED');
    }

    res.sendStatus(404);
  } catch (err) {
    console.error('[WhatsApp Inbound Webhook Error]:', err);
    res.status(500).send('ERROR');
  }
});

// GET /api/whatsapp/contacts
router.get('/contacts', (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM whatsapp_contacts WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (name LIKE ? OR phone_number LIKE ? OR tags LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY COALESCE(last_contacted_at, created_at) DESC';
    const contacts = db.prepare(query).all(...params);

    res.json({ success: true, contacts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/contacts (Create or Edit Lead)
router.post('/contacts', (req, res) => {
  try {
    const { phone_number, name, source, status, tags, notes } = req.body;
    const cleanPhone = formatPhoneNumber(phone_number);

    if (!cleanPhone) {
      return res.status(400).json({ success: false, error: 'Valid phone number is required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO whatsapp_contacts (phone_number, name, source, status, tags, notes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone_number) DO UPDATE SET
        name = COALESCE(excluded.name, whatsapp_contacts.name),
        source = COALESCE(excluded.source, whatsapp_contacts.source),
        status = COALESCE(excluded.status, whatsapp_contacts.status),
        tags = COALESCE(excluded.tags, whatsapp_contacts.tags),
        notes = COALESCE(excluded.notes, whatsapp_contacts.notes),
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      cleanPhone,
      name ? name.trim() : 'New Lead',
      source || 'manual',
      status || 'new',
      tags || '',
      notes || ''
    );

    logActivity('whatsapp', 'lead_created', 'success', `Added/Updated lead: ${name || cleanPhone}`);
    res.json({ success: true, phone_number: cleanPhone });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/whatsapp/contacts/:id
router.delete('/contacts/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM whatsapp_contacts WHERE id = ?').run(id);
    res.json({ success: true, message: 'Contact removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/whatsapp/messages/:phone
router.get('/messages/:phone', (req, res) => {
  try {
    const cleanPhone = formatPhoneNumber(req.params.phone);
    const messages = db.prepare(`
      SELECT * FROM whatsapp_messages 
      WHERE phone_number = ? 
      ORDER BY datetime(created_at) ASC
    `).all(cleanPhone);

    const contact = db.prepare('SELECT * FROM whatsapp_contacts WHERE phone_number = ?').get(cleanPhone);

    res.json({ success: true, contact, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/send (Manual or direct reply)
router.post('/send', async (req, res) => {
  try {
    const { phone_number, message } = req.body;
    if (!phone_number || !message) {
      return res.status(400).json({ success: false, error: 'Phone number and message are required' });
    }

    const result = await sendWhatsAppMessage(phone_number, message);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/broadcast (Send to selected or all leads)
router.post('/broadcast', async (req, res) => {
  try {
    const { message_template, filter_status, filter_tag } = req.body;
    if (!message_template) {
      return res.status(400).json({ success: false, error: 'Message template is required' });
    }

    let query = 'SELECT * FROM whatsapp_contacts WHERE 1=1';
    const params = [];

    if (filter_status && filter_status !== 'all') {
      query += ' AND status = ?';
      params.push(filter_status);
    }

    if (filter_tag) {
      query += ' AND tags LIKE ?';
      params.push(`%${filter_tag}%`);
    }

    const contacts = db.prepare(query).all(...params);
    let sentCount = 0;

    for (const c of contacts) {
      const personalized = message_template.replace(/\{name\}/gi, c.name || 'Friend');
      try {
        await sendWhatsAppMessage(c.phone_number, personalized);
        sentCount++;
      } catch (err) {
        console.error(`Broadcast failed for ${c.phone_number}:`, err.message);
      }
    }

    logActivity('whatsapp', 'broadcast_sent', 'success', `Sent automated broadcast to ${sentCount} leads`);
    res.json({ success: true, sentCount, total: contacts.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/simulate (Real-time in-browser Chatbot Simulator)
router.post('/simulate', async (req, res) => {
  try {
    const { phone_number, sender_name, message } = req.body;
    const testPhone = formatPhoneNumber(phone_number) || '919876543210';

    const result = await handleIncomingWhatsAppMessage({
      from: testPhone,
      senderName: sender_name || 'Test Lead',
      text: message,
      messageId: `sim_${Date.now()}`
    });

    const messages = db.prepare(`
      SELECT * FROM whatsapp_messages 
      WHERE phone_number = ? 
      ORDER BY datetime(created_at) ASC
    `).all(testPhone);

    const contact = db.prepare('SELECT * FROM whatsapp_contacts WHERE phone_number = ?').get(testPhone);

    res.json({ success: true, result, contact, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/whatsapp/settings
router.get('/settings', (req, res) => {
  try {
    const settings = {
      WHATSAPP_AUTO_REPLY_ENABLED: getSetting('WHATSAPP_AUTO_REPLY_ENABLED') || '1',
      WHATSAPP_PHONE_NUMBER_ID: getSetting('WHATSAPP_PHONE_NUMBER_ID') || '',
      WHATSAPP_ACCESS_TOKEN: getSetting('WHATSAPP_ACCESS_TOKEN') || '',
      WHATSAPP_VERIFY_TOKEN: getSetting('WHATSAPP_VERIFY_TOKEN') || 'social_manager_wa_token',
      WHATSAPP_HUMAN_HELP_NAME: getSetting('WHATSAPP_HUMAN_HELP_NAME') || '',
      WHATSAPP_HUMAN_HELP_PHONE: getSetting('WHATSAPP_HUMAN_HELP_PHONE') || '',
      WHATSAPP_HUMAN_HELP_EMAIL: getSetting('WHATSAPP_HUMAN_HELP_EMAIL') || '',
      WHATSAPP_WELCOME_MESSAGE: getSetting('WHATSAPP_WELCOME_MESSAGE') || '',
      WHATSAPP_KNOWLEDGE_BASE: getSetting('WHATSAPP_KNOWLEDGE_BASE') || ''
    };
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/settings
router.post('/settings', (req, res) => {
  try {
    const settings = req.body;
    for (const [key, val] of Object.entries(settings)) {
      setSetting(key, val);
    }
    logActivity('whatsapp', 'settings_update', 'success', 'Updated WhatsApp automation & human help settings');
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/whatsapp/web/status
router.get('/web/status', (req, res) => {
  try {
    const status = baileys.getStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/web/connect
router.post('/web/connect', async (req, res) => {
  try {
    const status = await baileys.startWhatsAppWeb();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/web/disconnect
router.post('/web/disconnect', async (req, res) => {
  try {
    const success = await baileys.disconnectWhatsAppWeb();
    res.json({ success });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
