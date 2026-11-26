const express = require('express');
const router = express.Router();
const { db, getSetting, setSetting, logActivity } = require('../db');
const { 
  formatInstagramUsername, 
  sendInstagramDirectMessage, 
  handleIncomingInstagramMessage,
  getHumanEscalationMessage 
} = require('../services/instagram_leads');

// GET /api/instagram/webhook (Verification)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const configuredToken = getSetting('INSTAGRAM_VERIFY_TOKEN') || 'social_manager_ig_token';

  if (mode && token) {
    if (mode === 'subscribe' && token === configuredToken) {
      console.log('[Instagram Webhook Verified Successfully]');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  res.sendStatus(400);
});

// POST /api/instagram/webhook (Inbound DMs from Meta/Uplika)
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'instagram') {
      const entry = body.entry?.[0];
      const messaging = entry?.messaging?.[0];

      if (messaging && messaging.message?.text) {
        const senderId = messaging.sender?.id;
        const text = messaging.message.text;
        const messageId = messaging.message.mid;

        await handleIncomingInstagramMessage({
          username: senderId,
          fullName: `IG User ${senderId.slice(-4)}`,
          text,
          messageId,
          source: 'direct_message'
        });
      }

      return res.status(200).send('EVENT_RECEIVED');
    }

    res.sendStatus(404);
  } catch (err) {
    console.error('[Instagram Inbound Webhook Error]:', err);
    res.status(500).send('ERROR');
  }
});

// GET /api/instagram/leads
router.get('/leads', (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM instagram_leads WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (ig_username LIKE ? OR full_name LIKE ? OR tags LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY COALESCE(last_interaction_at, created_at) DESC';
    const leads = db.prepare(query).all(...params);

    res.json({ success: true, leads });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/instagram/leads (Create manual lead)
router.post('/leads', (req, res) => {
  try {
    const { ig_username, full_name, source, status, tags, notes } = req.body;
    const cleanUsername = formatInstagramUsername(ig_username);

    if (!cleanUsername) {
      return res.status(400).json({ success: false, error: 'Valid Instagram username is required' });
    }

    const stmt = db.prepare(`
      INSERT INTO instagram_leads (ig_username, full_name, source, status, tags, notes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(ig_username) DO UPDATE SET
        full_name = COALESCE(excluded.full_name, instagram_leads.full_name),
        status = COALESCE(excluded.status, instagram_leads.status),
        tags = COALESCE(excluded.tags, instagram_leads.tags),
        notes = COALESCE(excluded.notes, instagram_leads.notes),
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      cleanUsername,
      full_name || `@${cleanUsername}`,
      source || 'manual',
      status || 'new',
      tags || 'lead',
      notes || null
    );

    const lead = db.prepare('SELECT * FROM instagram_leads WHERE ig_username = ?').get(cleanUsername);
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/instagram/leads/:id
router.put('/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, status, tags, notes } = req.body;

    db.prepare(`
      UPDATE instagram_leads 
      SET full_name = COALESCE(?, full_name),
          status = COALESCE(?, status),
          tags = COALESCE(?, tags),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(full_name, status, tags, notes, id);

    res.json({ success: true, message: 'Lead updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/instagram/leads/:id
router.delete('/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const lead = db.prepare('SELECT ig_username FROM instagram_leads WHERE id = ?').get(id);

    if (lead) {
      db.prepare('DELETE FROM instagram_messages WHERE ig_username = ?').run(lead.ig_username);
      db.prepare('DELETE FROM instagram_leads WHERE id = ?').run(id);
    }

    res.json({ success: true, message: 'Lead and messages deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/instagram/messages/:username
router.get('/messages/:username', (req, res) => {
  try {
    const cleanUsername = formatInstagramUsername(req.params.username);
    const messages = db.prepare(`
      SELECT * FROM instagram_messages 
      WHERE ig_username = ? 
      ORDER BY created_at ASC
    `).all(cleanUsername);

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/instagram/messages/send (Direct outbound DM)
router.post('/messages/send', async (req, res) => {
  try {
    const { username, text } = req.body;
    if (!username || !text) {
      return res.status(400).json({ success: false, error: 'Username and message text are required' });
    }

    const result = await sendInstagramDirectMessage(username, text);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/instagram/simulate (Interactive Simulator)
router.post('/simulate', async (req, res) => {
  try {
    const { username, fullName, messageText } = req.body;

    if (!messageText) {
      return res.status(400).json({ success: false, error: 'Message text is required' });
    }

    const cleanUsername = formatInstagramUsername(username || 'fashion_lead_test');
    const senderName = fullName || 'Interested Follower';

    const result = await handleIncomingInstagramMessage({
      username: cleanUsername,
      fullName: senderName,
      text: messageText,
      source: 'simulator'
    });

    // Fetch conversation thread
    const history = db.prepare(`
      SELECT * FROM instagram_messages 
      WHERE ig_username = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all(cleanUsername);

    res.json({
      success: true,
      botAction: result?.type || 'received',
      reply: result?.reply || null,
      history: history.reverse()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/instagram/broadcast
router.post('/broadcast', async (req, res) => {
  try {
    const { template, targetStatus, targetTag } = req.body;

    if (!template || !template.trim()) {
      return res.status(400).json({ success: false, error: 'Message template is required' });
    }

    let query = 'SELECT * FROM instagram_leads WHERE 1=1';
    const params = [];

    if (targetStatus && targetStatus !== 'all') {
      query += ' AND status = ?';
      params.push(targetStatus);
    }

    if (targetTag && targetTag.trim()) {
      query += ' AND tags LIKE ?';
      params.push(`%${targetTag.trim()}%`);
    }

    const targets = db.prepare(query).all(...params);
    let sentCount = 0;

    for (const lead of targets) {
      const personalized = template
        .replace(/\{name\}/gi, lead.full_name || `@${lead.ig_username}`)
        .replace(/\{username\}/gi, `@${lead.ig_username}`);

      try {
        await sendInstagramDirectMessage(lead.ig_username, personalized);
        sentCount++;
      } catch (err) {
        console.error(`[Instagram Broadcast Error] @${lead.ig_username}:`, err.message);
      }
    }

    logActivity('instagram', 'instagram_broadcast', 'success', `Sent Instagram broadcast to ${sentCount} leads`);
    res.json({ success: true, count: sentCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/instagram/settings
router.get('/settings', (req, res) => {
  try {
    res.json({
      success: true,
      settings: {
        INSTAGRAM_AUTO_REPLY_ENABLED: getSetting('INSTAGRAM_AUTO_REPLY_ENABLED') || '1',
        INSTAGRAM_HUMAN_HELP_NAME: getSetting('INSTAGRAM_HUMAN_HELP_NAME') || 'Sneha (Support Manager)',
        INSTAGRAM_HUMAN_HELP_PHONE: getSetting('INSTAGRAM_HUMAN_HELP_PHONE') || '+91 98765 43210',
        INSTAGRAM_HUMAN_HELP_EMAIL: getSetting('INSTAGRAM_HUMAN_HELP_EMAIL') || 'support@sneharmony.com',
        INSTAGRAM_HUMAN_HELP_HANDLE: getSetting('INSTAGRAM_HUMAN_HELP_HANDLE') || '@sneharmony-x5d',
        INSTAGRAM_WELCOME_MESSAGE: getSetting('INSTAGRAM_WELCOME_MESSAGE') || 'Hey {name}! ✨ Welcome to Sneharmony! How can we help you today?',
        INSTAGRAM_KNOWLEDGE_BASE: getSetting('INSTAGRAM_KNOWLEDGE_BASE') || '',
        INSTAGRAM_VERIFY_TOKEN: getSetting('INSTAGRAM_VERIFY_TOKEN') || 'social_manager_ig_token'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/instagram/settings
router.post('/settings', (req, res) => {
  try {
    const allowedKeys = [
      'INSTAGRAM_AUTO_REPLY_ENABLED',
      'INSTAGRAM_HUMAN_HELP_NAME',
      'INSTAGRAM_HUMAN_HELP_PHONE',
      'INSTAGRAM_HUMAN_HELP_EMAIL',
      'INSTAGRAM_HUMAN_HELP_HANDLE',
      'INSTAGRAM_WELCOME_MESSAGE',
      'INSTAGRAM_KNOWLEDGE_BASE',
      'INSTAGRAM_VERIFY_TOKEN'
    ];

    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        setSetting(key, req.body[key]);
      }
    }

    res.json({ success: true, message: 'Instagram settings saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
