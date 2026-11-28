const express = require('express');
const router = express.Router();
const { db, logActivity } = require('../db');
const { runFullSync } = require('../services/scheduler');
const { getUplikaInstagramAccount } = require('../services/uplika');
const { verifyTelegramBot, startTelegramPolling } = require('../services/telegram');

// List all connected channels
router.get('/', (req, res) => {
  try {
    const channels = db.prepare(`
      SELECT id, platform, platform_id, display_name, username, avatar_url, 
             token_expires_at, metadata, status, created_at, updated_at
      FROM channels
      ORDER BY platform, created_at DESC
    `).all();

    const formatted = channels.map(c => {
      let meta = {};
      try { meta = JSON.parse(c.metadata || '{}'); } catch {}
      return {
        ...c,
        meta,
        isTokenValid: c.token_expires_at ? c.token_expires_at > Date.now() : true
      };
    });

    res.json({ success: true, channels: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get a single channel by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const channel = db.prepare(`
      SELECT id, platform, platform_id, display_name, username, avatar_url, 
             token_expires_at, metadata, status, created_at, updated_at
      FROM channels WHERE id = ?
    `).get(id);

    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    let meta = {};
    try { meta = JSON.parse(channel.metadata || '{}'); } catch {}

    res.json({
      success: true,
      channel: {
        ...channel,
        meta,
        isTokenValid: channel.token_expires_at ? channel.token_expires_at > Date.now() : true
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update an existing channel's configuration
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);

    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    const {
      display_name,
      username,
      platform_id,
      access_token,
      metadata,
      status: newStatus,
      auto_reply_enabled,
      publishing_enabled,
      target_chat_id
    } = req.body;

    let existingMeta = {};
    try { existingMeta = JSON.parse(channel.metadata || '{}'); } catch {}

    const updatedMeta = {
      ...existingMeta,
      ...(metadata || {})
    };

    if (auto_reply_enabled !== undefined) updatedMeta.autoReplyEnabled = Boolean(auto_reply_enabled);
    if (publishing_enabled !== undefined) updatedMeta.publishingEnabled = Boolean(publishing_enabled);
    if (target_chat_id !== undefined) updatedMeta.targetChatId = target_chat_id;

    const finalDisplayName = display_name !== undefined ? display_name.trim() : channel.display_name;
    const finalUsername = username !== undefined ? (username.startsWith('@') ? username : `@${username}`) : channel.username;
    const finalPlatformId = target_chat_id || platform_id || channel.platform_id;
    const finalStatus = newStatus || channel.status || 'active';

    // Only update token if explicitly provided and not masked
    let finalToken = channel.access_token;
    if (access_token && !access_token.includes('••••')) {
      finalToken = access_token.trim();
    }

    db.prepare(`
      UPDATE channels 
      SET display_name = ?,
          username = ?,
          platform_id = ?,
          access_token = ?,
          metadata = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      finalDisplayName,
      finalUsername,
      finalPlatformId,
      finalToken,
      JSON.stringify(updatedMeta),
      finalStatus,
      id
    );

    // If Telegram platform, keep settings table synchronized
    if (channel.platform === 'telegram') {
      const { setSetting } = require('../db');
      if (finalPlatformId) setSetting('TELEGRAM_CHANNEL_ID', finalPlatformId);
      if (finalToken && finalToken !== channel.access_token) setSetting('TELEGRAM_BOT_TOKEN', finalToken);
      if (finalUsername) setSetting('TELEGRAM_BOT_USERNAME', finalUsername.replace(/^@/, ''));
      if (auto_reply_enabled !== undefined) {
        setSetting('TELEGRAM_AUTO_REPLY_ENABLED', auto_reply_enabled ? '1' : '0');
      }
    }

    logActivity(channel.platform, 'channel_edit', 'success', `Updated configuration for ${channel.platform} account "${finalDisplayName}"`);

    const updated = db.prepare('SELECT id, platform, platform_id, display_name, username, avatar_url, metadata, status, updated_at FROM channels WHERE id = ?').get(id);
    let parsedMeta = {};
    try { parsedMeta = JSON.parse(updated.metadata || '{}'); } catch {}

    res.json({
      success: true,
      channel: {
        ...updated,
        meta: parsedMeta
      },
      message: 'Channel configuration updated successfully'
    });
  } catch (err) {
    console.error('Error updating channel:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a channel
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const channel = db.prepare('SELECT display_name, platform FROM channels WHERE id = ?').get(id);
    
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    db.prepare('DELETE FROM channels WHERE id = ?').run(id);
    logActivity(channel.platform, 'channel_disconnect', 'success', `Disconnected ${channel.platform} channel "${channel.display_name}"`);

    res.json({ success: true, message: 'Channel disconnected successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger manual sync for all or single channel
router.post('/sync', async (req, res) => {
  try {
    // Run sync asynchronously
    runFullSync().catch(console.error);
    res.json({ success: true, message: 'Sync started in background' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Connect Instagram via Uplika / MCP
router.post('/connect-uplika', async (req, res) => {
  try {
    const { apiKey, mcpUrl, customUsername } = req.body;
    if (!apiKey && !mcpUrl) {
      return res.status(400).json({ success: false, error: 'Uplika API Key or MCP URL is required.' });
    }

    const verified = await getUplikaInstagramAccount(apiKey);
    const handle = customUsername ? customUsername.replace(/^@/, '') : verified.handle.replace(/^@/, '');
    const username = `@${handle}`;
    const displayName = verified.displayName || handle;
    const channelId = `ig_uplika_${verified.connectionId || handle.replace(/[^a-zA-Z0-9_]/g, '')}`;

    const metadata = JSON.stringify({
      provider: 'uplika',
      connectionId: verified.connectionId,
      mcpUrl: mcpUrl || 'https://api.uplika.com/mcp',
      apiKey,
      verifiedAt: new Date().toISOString()
    });

    db.prepare(`
      INSERT INTO channels (
        id, platform, platform_id, display_name, username, avatar_url,
        access_token, metadata, status, updated_at
      ) VALUES (?, 'instagram', ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        platform_id = excluded.platform_id,
        display_name = excluded.display_name,
        username = excluded.username,
        avatar_url = excluded.avatar_url,
        access_token = excluded.access_token,
        metadata = excluded.metadata,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
    `).run(
      channelId,
      verified.connectionId || channelId,
      displayName,
      username,
      verified.avatarUrl,
      apiKey,
      metadata
    );

    logActivity('instagram', 'channel_connect', 'success', `Connected Instagram ${username} (${displayName}) via Uplika`);
    res.json({ success: true, channelId, username, displayName, connectionId: verified.connectionId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Connect Telegram Bot / Channel
router.post('/connect-telegram', async (req, res) => {
  try {
    const { botToken, channelId: targetChannel } = req.body;
    if (!botToken || !botToken.trim()) {
      return res.status(400).json({ success: false, error: 'Telegram Bot Token is required' });
    }

    const bot = await verifyTelegramBot(botToken.trim());
    const channelRecordId = `tg_bot_${bot.botId}`;
    const displayName = `${bot.firstName} (Telegram)`;
    const username = `@${bot.username}`;
    const targetChat = (targetChannel || '').trim() || bot.botId;

    const metadata = JSON.stringify({
      botId: bot.botId,
      botUsername: bot.username,
      targetChatId: targetChat,
      connectedAt: new Date().toISOString()
    });

    db.prepare(`
      INSERT INTO channels (
        id, platform, platform_id, display_name, username, avatar_url,
        access_token, metadata, status, updated_at
      ) VALUES (?, 'telegram', ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        platform_id = excluded.platform_id,
        display_name = excluded.display_name,
        username = excluded.username,
        access_token = excluded.access_token,
        metadata = excluded.metadata,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
    `).run(
      channelRecordId,
      targetChat,
      displayName,
      username,
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      botToken.trim(),
      metadata
    );

    // Save into settings for easy access
    const { setSetting } = require('../db');
    setSetting('TELEGRAM_BOT_TOKEN', botToken.trim());
    setSetting('TELEGRAM_BOT_USERNAME', bot.username);
    if (targetChannel && targetChannel.trim()) {
      setSetting('TELEGRAM_CHANNEL_ID', targetChannel.trim());
    }

    startTelegramPolling().catch(console.error);

    logActivity('telegram', 'channel_connect', 'success', `Connected Telegram Bot @${bot.username} (${bot.firstName})`);
    res.json({
      success: true,
      channelId: channelRecordId,
      username,
      displayName,
      bot
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
