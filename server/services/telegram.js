const fs = require('fs');
const path = require('path');
const { db, getSetting, logActivity } = require('../db');
const { polishReplyWithAi } = require('./ai');

const TG_API_BASE = 'https://api.telegram.org';

let pollingActive = false;
let pollingAbortController = null;
let lastUpdateId = 0;

// Verify a Telegram Bot Token via getMe
async function verifyTelegramBot(botToken) {
  if (!botToken || !botToken.trim()) {
    throw new Error('Telegram Bot Token is required.');
  }

  const token = botToken.trim();
  const res = await fetch(`${TG_API_BASE}/bot${token}/getMe`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.ok) {
    throw new Error(data.description || 'Invalid Telegram Bot Token');
  }

  return {
    botId: String(data.result.id),
    username: data.result.username,
    firstName: data.result.first_name,
    canJoinGroups: data.result.can_join_groups,
    canReadAllGroupMessages: data.result.can_read_all_group_messages
  };
}

// Send a text message via Telegram Bot
async function sendTelegramMessage(chatId, text, customToken = null) {
  const token = customToken || getSetting('TELEGRAM_BOT_TOKEN');
  if (!token) {
    // Simulator or local mode
    console.log(`[Telegram Local/Simulated Message] To Chat ${chatId} | Text: "${text.slice(0, 50)}..."`);
    const messageId = `tg_out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    db.prepare(`
      INSERT INTO telegram_messages (id, chat_id, direction, sender_name, message_text, status, is_escalated)
      VALUES (?, ?, 'outbound', 'Sneharmony Bot', ?, 'delivered', 0)
    `).run(messageId, String(chatId), text);

    db.prepare(`
      UPDATE telegram_leads 
      SET last_interaction_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE chat_id = ?
    `).run(String(chatId));

    return { success: true, messageId };
  }

  const res = await fetch(`${TG_API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    // Fallback without parse_mode if HTML entities failed
    const fallbackRes = await fetch(`${TG_API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });
    const fallbackData = await fallbackRes.json().catch(() => ({}));
    if (!fallbackRes.ok || !fallbackData.ok) {
      throw new Error(fallbackData.description || 'Failed to send Telegram message');
    }
    data.result = fallbackData.result;
  }

  const msgId = String(data.result?.message_id || `tg_out_${Date.now()}`);
  db.prepare(`
    INSERT INTO telegram_messages (id, chat_id, direction, sender_name, message_text, status, is_escalated)
    VALUES (?, ?, 'outbound', 'Sneharmony Bot', ?, 'delivered', 0)
  `).run(msgId, String(chatId), text);

  db.prepare(`
    UPDATE telegram_leads 
    SET last_interaction_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
    WHERE chat_id = ?
  `).run(String(chatId));

  return { success: true, messageId: msgId };
}

// Publish post (Text, Photo, or Video) to Telegram Channel / Group
async function publishToTelegram(channelOrChatId, { title, content, mediaUrl, mediaType }, customToken = null) {
  const token = customToken || getSetting('TELEGRAM_BOT_TOKEN');
  if (!token) {
    throw new Error('Telegram Bot Token is not configured. Please connect your bot first.');
  }

  const targetChatId = channelOrChatId || getSetting('TELEGRAM_CHANNEL_ID');
  if (!targetChatId) {
    throw new Error('Telegram Target Channel ID or Chat ID is required (e.g. @mychannel or -100123456789).');
  }

  let caption = content || '';
  if (title && title.trim()) {
    caption = `<b>${title.trim()}</b>\n\n${caption}`;
  }

  // 1. If video is attached
  if (mediaUrl && (mediaType === 'video' || mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.mov'))) {
    let filePath = mediaUrl;
    if (filePath.startsWith('/uploads/')) {
      filePath = path.join(__dirname, '../../uploads', filePath.replace('/uploads/', ''));
    }

    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer], { type: 'video/mp4' });
      const formData = new FormData();
      formData.append('chat_id', targetChatId);
      formData.append('video', blob, path.basename(filePath));
      if (caption) formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');

      const res = await fetch(`${TG_API_BASE}/bot${token}/sendVideo`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.description || 'Failed to send Telegram video');
      }

      const postUrl = targetChatId.startsWith('@') 
        ? `https://t.me/${targetChatId.replace('@', '')}/${data.result.message_id}`
        : `https://t.me/c/${targetChatId.replace('-100', '')}/${data.result.message_id}`;

      return { success: true, postId: String(data.result.message_id), postUrl };
    }
  }

  // 2. If photo is attached
  if (mediaUrl && (mediaType === 'image' || mediaUrl.match(/\.(jpg|jpeg|png|webp)$/i))) {
    let filePath = mediaUrl;
    if (filePath.startsWith('/uploads/')) {
      filePath = path.join(__dirname, '../../uploads', filePath.replace('/uploads/', ''));
    }

    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('chat_id', targetChatId);
      formData.append('photo', blob, path.basename(filePath));
      if (caption) formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');

      const res = await fetch(`${TG_API_BASE}/bot${token}/sendPhoto`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.description || 'Failed to send Telegram photo');
      }

      const postUrl = targetChatId.startsWith('@') 
        ? `https://t.me/${targetChatId.replace('@', '')}/${data.result.message_id}`
        : `https://t.me/c/${targetChatId.replace('-100', '')}/${data.result.message_id}`;

      return { success: true, postId: String(data.result.message_id), postUrl };
    }
  }

  // 3. Text Message
  const res = await fetch(`${TG_API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: targetChatId,
      text: caption,
      parse_mode: 'HTML'
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.description || 'Failed to publish to Telegram');
  }

  const postUrl = targetChatId.startsWith('@') 
    ? `https://t.me/${targetChatId.replace('@', '')}/${data.result.message_id}`
    : `https://t.me/c/${targetChatId.replace('-100', '')}/${data.result.message_id}`;

  return { success: true, postId: String(data.result.message_id), postUrl };
}

// Check for human escalation intent
function isHumanEscalationRequested(text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  const escalationKeywords = [
    'human',
    'agent',
    'support',
    'real person',
    'talk to someone',
    'speak to person',
    'speak with person',
    'call me',
    'talk to human',
    'contact person',
    'help person',
    'customer service',
    'customer care',
    'executive',
    'representative',
    'manager',
    'stuck',
    'urgent',
    'dispute',
    'complaint',
    'not answering',
    'phone number'
  ];

  return escalationKeywords.some(k => lower.includes(k));
}

// Generate Human Escalation Card for Telegram
function getHumanEscalationMessage(senderName) {
  const helpName = getSetting('TELEGRAM_HUMAN_HELP_NAME') || 'Sneha (Support Manager)';
  const helpPhone = getSetting('TELEGRAM_HUMAN_HELP_PHONE') || '+91 98765 43210';
  const helpEmail = getSetting('TELEGRAM_HUMAN_HELP_EMAIL') || 'support@sneharmony.com';
  const helpHandle = getSetting('TELEGRAM_HUMAN_HELP_HANDLE') || '@sneharmony';

  return `Hello ${senderName || 'there'}! 🌷

I understand you would like to speak with a real person! Here is our direct support manager contact:

👤 <b>Support Manager:</b> ${helpName}
📱 <b>Phone / WhatsApp:</b> ${helpPhone}
✉️ <b>Email:</b> ${helpEmail}
✈️ <b>Telegram Direct:</b> ${helpHandle}

Our team has also been notified of your message and will review it directly! ✨`;
}

// AI Knowledge Base answering for Telegram
async function answerTelegramWithAi(userQuestion, senderName) {
  const knowledgeBase = getSetting('TELEGRAM_KNOWLEDGE_BASE') || getSetting('WHATSAPP_KNOWLEDGE_BASE') || '';
  const apiKey = getSetting('GEMINI_API_KEY') || getSetting('OPENAI_API_KEY');

  if (!apiKey || !knowledgeBase.trim()) {
    return { escalate: true, answer: null };
  }

  const prompt = `You are a helpful and polite Telegram assistant for Sneharmony.
Use the following Knowledge Base to answer the user's question accurately and concisely (keep Telegram answers warm, informative, and under 3-4 sentences with emojis).

KNOWLEDGE BASE:
${knowledgeBase}

CUSTOMER INQUIRY from ${senderName || 'a customer'}:
"${userQuestion}"

INSTRUCTIONS:
1. If the knowledge base contains the answer, provide a warm, concise, and helpful response.
2. If the user question CANNOT be answered from the knowledge base, or if they are asking something complicated, respond ONLY with:
"[ESCALATE]"
Do not guess or invent facts not in the knowledge base.`;

  try {
    const rawAnswer = await polishReplyWithAi('', userQuestion, prompt);
    const cleaned = (rawAnswer || '').trim();

    if (cleaned.includes('[ESCALATE]') || cleaned.length < 5) {
      return { escalate: true, answer: null };
    }

    return { escalate: false, answer: cleaned };
  } catch (err) {
    console.error('[Telegram AI Answering Error]:', err.message);
    return { escalate: true, answer: null };
  }
}

// Process Incoming Telegram Message
async function handleIncomingTelegramMessage({ chatId, username, firstName, lastName, text, messageId, source = 'bot_direct' }) {
  if (!chatId || !text) return null;

  const rawMsgId = messageId ? String(messageId) : `tg_in_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || (username ? `@${username}` : `User ${String(chatId).slice(-4)}`);

  // 1. Upsert lead in CRM
  let lead = db.prepare('SELECT * FROM telegram_leads WHERE chat_id = ?').get(String(chatId));
  if (!lead) {
    db.prepare(`
      INSERT INTO telegram_leads (chat_id, username, first_name, last_name, source, status, tags, last_interaction_at)
      VALUES (?, ?, ?, ?, ?, 'new', 'telegram_lead', CURRENT_TIMESTAMP)
    `).run(String(chatId), username || null, firstName || null, lastName || null, source);
    lead = db.prepare('SELECT * FROM telegram_leads WHERE chat_id = ?').get(String(chatId));
  } else {
    db.prepare(`
      UPDATE telegram_leads 
      SET username = COALESCE(?, username),
          first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          last_interaction_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE chat_id = ?
    `).run(username || null, firstName || null, lastName || null, String(chatId));
  }

  // 2. Record incoming message
  db.prepare(`
    INSERT INTO telegram_messages (id, chat_id, direction, sender_name, message_text, status)
    VALUES (?, ?, 'inbound', ?, ?, 'received')
    ON CONFLICT(id) DO NOTHING
  `).run(rawMsgId, String(chatId), fullName, text);

  logActivity('telegram', 'telegram_message', 'success', `Received Telegram from ${fullName}: "${text.slice(0, 40)}"`);

  // Check if auto-reply is enabled
  const autoReplyEnabled = getSetting('TELEGRAM_AUTO_REPLY_ENABLED') !== '0';
  if (!autoReplyEnabled) {
    return { status: 'received_no_autoreply', leadId: lead.id };
  }

  // 3. Check for human escalation triggers
  if (isHumanEscalationRequested(text)) {
    const escalationReply = getHumanEscalationMessage(fullName);

    db.prepare(`
      UPDATE telegram_leads 
      SET status = 'escalated', updated_at = CURRENT_TIMESTAMP 
      WHERE chat_id = ?
    `).run(String(chatId));

    await sendTelegramMessage(chatId, escalationReply);
    db.prepare('UPDATE telegram_messages SET is_escalated = 1 WHERE id = ?').run(rawMsgId);

    logActivity('telegram', 'telegram_escalation', 'success', `Escalated Telegram chat ${chatId} (${fullName}) to human contact`);
    return {
      type: 'escalated',
      reply: escalationReply,
      leadId: lead.id,
      leadStatus: 'escalated'
    };
  }

  // 4. Answer via AI & Knowledge Base
  const aiResult = await answerTelegramWithAi(text, fullName);

  if (aiResult.escalate || !aiResult.answer) {
    const escalationReply = getHumanEscalationMessage(fullName);

    db.prepare(`
      UPDATE telegram_leads 
      SET status = 'escalated', updated_at = CURRENT_TIMESTAMP 
      WHERE chat_id = ?
    `).run(String(chatId));

    await sendTelegramMessage(chatId, escalationReply);
    db.prepare('UPDATE telegram_messages SET is_escalated = 1 WHERE id = ?').run(rawMsgId);

    return {
      type: 'escalated',
      reply: escalationReply,
      leadId: lead.id,
      leadStatus: 'escalated'
    };
  }

  // 5. Normal AI answer successfully found
  await sendTelegramMessage(chatId, aiResult.answer);

  db.prepare(`
    UPDATE telegram_leads 
    SET status = 'contacted', updated_at = CURRENT_TIMESTAMP 
    WHERE chat_id = ? AND status = 'new'
  `).run(String(chatId));

  return {
    type: 'ai_answered',
    reply: aiResult.answer,
    leadId: lead.id,
    leadStatus: 'contacted'
  };
}

// Background Telegram Poller (long polling getUpdates)
async function startTelegramPolling() {
  const token = getSetting('TELEGRAM_BOT_TOKEN');
  if (!token) {
    return;
  }

  if (pollingActive) return;
  pollingActive = true;
  pollingAbortController = new AbortController();

  console.log('[Telegram Poller] Starting live update poller...');

  (async () => {
    while (pollingActive) {
      try {
        const currentToken = getSetting('TELEGRAM_BOT_TOKEN');
        if (!currentToken) {
          pollingActive = false;
          break;
        }

        const url = `${TG_API_BASE}/bot${currentToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=10&allowed_updates=["message","channel_post"]`;
        const res = await fetch(url, { signal: pollingAbortController?.signal });
        const data = await res.json().catch(() => ({}));

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);
            const msg = update.message || update.channel_post;
            if (msg && msg.text) {
              const chatId = msg.chat?.id;
              const text = msg.text;
              const from = msg.from || {};

              // Skip messages sent by the bot itself
              if (from.is_bot && from.username === getSetting('TELEGRAM_BOT_USERNAME')) {
                continue;
              }

              await handleIncomingTelegramMessage({
                chatId,
                username: from.username || msg.chat?.username,
                firstName: from.first_name || msg.chat?.title,
                lastName: from.last_name,
                text,
                messageId: msg.message_id,
                source: msg.chat?.type === 'channel' ? 'channel' : (msg.chat?.type === 'group' || msg.chat?.type === 'supergroup' ? 'group' : 'bot_direct')
              });
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') break;
        // Wait 3 seconds on network error before retrying
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    console.log('[Telegram Poller] Polling stopped.');
  })();
}

function stopTelegramPolling() {
  pollingActive = false;
  if (pollingAbortController) {
    pollingAbortController.abort();
    pollingAbortController = null;
  }
}

module.exports = {
  verifyTelegramBot,
  sendTelegramMessage,
  publishToTelegram,
  isHumanEscalationRequested,
  getHumanEscalationMessage,
  answerTelegramWithAi,
  handleIncomingTelegramMessage,
  startTelegramPolling,
  stopTelegramPolling
};
