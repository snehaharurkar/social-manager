const express = require('express');
const router = express.Router();
const { db, getSetting, setSetting, logActivity } = require('../db');
const { 
  verifyTelegramBot, 
  verifyTelegramChannel,
  sendTelegramMessage, 
  handleIncomingTelegramMessage, 
  startTelegramPolling, 
  stopTelegramPolling 
} = require('../services/telegram');

// POST /api/telegram/verify (Verify bot token and get details)
router.post('/verify', async (req, res) => {
  try {
    const { botToken } = req.body;
    const bot = await verifyTelegramBot(botToken);
    res.json({ success: true, bot });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/telegram/verify-channel (Verify channel access and post permissions via getChat & getChatMember)
router.post('/verify-channel', async (req, res) => {
  try {
    const { channelId, botToken, saveIfValid } = req.body;
    if (!channelId || !String(channelId).trim()) {
      return res.status(400).json({ success: false, error: 'Telegram Channel ID is required' });
    }

    const verification = await verifyTelegramChannel(channelId.trim(), botToken ? botToken.trim() : null);

    if (saveIfValid) {
      setSetting('TELEGRAM_CHANNEL_ID', verification.chatId);

      const existingChannel = db.prepare("SELECT id, metadata FROM channels WHERE platform = 'telegram'").get();
      if (existingChannel) {
        let meta = {};
        try { meta = JSON.parse(existingChannel.metadata || '{}'); } catch {}
        meta.targetChatId = verification.chatId;
        meta.channelTitle = verification.title;
        meta.verifiedAt = new Date().toISOString();
        db.prepare("UPDATE channels SET platform_id = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(verification.chatId, JSON.stringify(meta), existingChannel.id);
      }
      logActivity('telegram', 'channel_verified', 'success', `Verified Telegram channel "${verification.title}" (${verification.chatId})`);
    }

    res.json({ success: true, verification });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/telegram/leads
router.get('/leads', (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM telegram_leads WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (chat_id LIKE ? OR username LIKE ? OR first_name LIKE ? OR tags LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY COALESCE(last_interaction_at, created_at) DESC';
    const leads = db.prepare(query).all(...params);

    res.json({ success: true, leads });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/telegram/leads (Manual lead entry)
router.post('/leads', (req, res) => {
  try {
    const { chat_id, username, first_name, last_name, source, status, tags, notes } = req.body;

    if (!chat_id) {
      return res.status(400).json({ success: false, error: 'Chat ID is required' });
    }

    const stmt = db.prepare(`
      INSERT INTO telegram_leads (chat_id, username, first_name, last_name, source, status, tags, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        username = COALESCE(excluded.username, telegram_leads.username),
        first_name = COALESCE(excluded.first_name, telegram_leads.first_name),
        status = COALESCE(excluded.status, telegram_leads.status),
        tags = COALESCE(excluded.tags, telegram_leads.tags),
        notes = COALESCE(excluded.notes, telegram_leads.notes),
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      String(chat_id).trim(),
      username ? username.replace(/^@/, '') : null,
      first_name || null,
      last_name || null,
      source || 'manual',
      status || 'new',
      tags || 'lead',
      notes || null
    );

    const lead = db.prepare('SELECT * FROM telegram_leads WHERE chat_id = ?').get(String(chat_id));
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/telegram/leads/:id
router.put('/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, status, tags, notes } = req.body;

    db.prepare(`
      UPDATE telegram_leads 
      SET first_name = COALESCE(?, first_name),
          status = COALESCE(?, status),
          tags = COALESCE(?, tags),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(first_name, status, tags, notes, id);

    res.json({ success: true, message: 'Lead updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/telegram/leads/:id
router.delete('/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const lead = db.prepare('SELECT chat_id FROM telegram_leads WHERE id = ?').get(id);

    if (lead) {
      db.prepare('DELETE FROM telegram_messages WHERE chat_id = ?').run(lead.chat_id);
      db.prepare('DELETE FROM telegram_leads WHERE id = ?').run(id);
    }

    res.json({ success: true, message: 'Lead and messages deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/telegram/messages/:chatId
router.get('/messages/:chatId', (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT * FROM telegram_messages 
      WHERE chat_id = ? 
      ORDER BY created_at ASC
    `).all(String(req.params.chatId));

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/telegram/messages/send
router.post('/messages/send', async (req, res) => {
  try {
    const { chatId, text } = req.body;
    if (!chatId || !text) {
      return res.status(400).json({ success: false, error: 'Chat ID and message text are required' });
    }

    const result = await sendTelegramMessage(chatId, text);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/telegram/simulate (Interactive Simulator)
router.post('/simulate', async (req, res) => {
  try {
    const { chatId, username, firstName, messageText } = req.body;

    if (!messageText) {
      return res.status(400).json({ success: false, error: 'Message text is required' });
    }

    const targetChatId = chatId || '987654321';
    const result = await handleIncomingTelegramMessage({
      chatId: targetChatId,
      username: username || 'telegram_fan',
      firstName: firstName || 'Interested Fan',
      text: messageText,
      source: 'simulator'
    });

    const history = db.prepare(`
      SELECT * FROM telegram_messages 
      WHERE chat_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all(targetChatId);

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

// POST /api/telegram/broadcast
router.post('/broadcast', async (req, res) => {
  try {
    const { template, targetStatus, targetTag } = req.body;

    if (!template || !template.trim()) {
      return res.status(400).json({ success: false, error: 'Message template is required' });
    }

    let query = 'SELECT * FROM telegram_leads WHERE 1=1';
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
        .replace(/\{name\}/gi, lead.first_name || lead.username ? `@${lead.username}` : 'Friend')
        .replace(/\{username\}/gi, lead.username ? `@${lead.username}` : '');

      try {
        await sendTelegramMessage(lead.chat_id, personalized);
        sentCount++;
      } catch (err) {
        console.error(`[Telegram Broadcast Error] Chat ${lead.chat_id}:`, err.message);
      }
    }

    logActivity('telegram', 'telegram_broadcast', 'success', `Sent Telegram broadcast to ${sentCount} leads`);
    res.json({ success: true, count: sentCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/telegram/settings
router.get('/settings', (req, res) => {
  try {
    res.json({
      success: true,
      settings: {
        TELEGRAM_BOT_TOKEN: getSetting('TELEGRAM_BOT_TOKEN') || '',
        TELEGRAM_BOT_USERNAME: getSetting('TELEGRAM_BOT_USERNAME') || '',
        TELEGRAM_CHANNEL_ID: getSetting('TELEGRAM_CHANNEL_ID') || '',
        TELEGRAM_AUTO_REPLY_ENABLED: getSetting('TELEGRAM_AUTO_REPLY_ENABLED') || '1',
        TELEGRAM_HUMAN_HELP_NAME: getSetting('TELEGRAM_HUMAN_HELP_NAME') || 'Sneha (Support Manager)',
        TELEGRAM_HUMAN_HELP_PHONE: getSetting('TELEGRAM_HUMAN_HELP_PHONE') || '+91 98765 43210',
        TELEGRAM_HUMAN_HELP_EMAIL: getSetting('TELEGRAM_HUMAN_HELP_EMAIL') || 'support@sneharmony.com',
        TELEGRAM_HUMAN_HELP_HANDLE: getSetting('TELEGRAM_HUMAN_HELP_HANDLE') || '@sneharmony',
        TELEGRAM_WELCOME_MESSAGE: getSetting('TELEGRAM_WELCOME_MESSAGE') || 'Hello {name}! 🌷 Welcome to Sneharmony on Telegram! How can we assist you today?',
        TELEGRAM_KNOWLEDGE_BASE: getSetting('TELEGRAM_KNOWLEDGE_BASE') || ''
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/telegram/settings
router.post('/settings', async (req, res) => {
  try {
    const allowedKeys = [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_BOT_USERNAME',
      'TELEGRAM_CHANNEL_ID',
      'TELEGRAM_AUTO_REPLY_ENABLED',
      'TELEGRAM_HUMAN_HELP_NAME',
      'TELEGRAM_HUMAN_HELP_PHONE',
      'TELEGRAM_HUMAN_HELP_EMAIL',
      'TELEGRAM_HUMAN_HELP_HANDLE',
      'TELEGRAM_WELCOME_MESSAGE',
      'TELEGRAM_KNOWLEDGE_BASE'
    ];

    const prevToken = getSetting('TELEGRAM_BOT_TOKEN');

    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        setSetting(key, req.body[key]);
      }
    }

    const newToken = getSetting('TELEGRAM_BOT_TOKEN');
    if (newToken && newToken !== prevToken) {
      stopTelegramPolling();
      startTelegramPolling().catch(console.error);
    }

    res.json({ success: true, message: 'Telegram settings saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
