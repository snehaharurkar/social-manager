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

// Verify a Telegram Channel or Group using getChat and getChatMember (Zero getUpdates conflict)
async function verifyTelegramChannel(channelId, customToken = null) {
  if (!channelId || !String(channelId).trim()) {
    throw new Error('Telegram Channel ID is required.');
  }

  const token = (customToken || getSetting('TELEGRAM_BOT_TOKEN') || '').trim();
  if (!token) {
    throw new Error('Telegram Bot Token is not configured. Please connect your bot first.');
  }

  let formattedChatId = String(channelId).trim();

  // Normalize user input formats safely:
  // 1. Link format: https://t.me/c/2456789012/10 or t.me/c/2456789012
  const linkMatch = formattedChatId.match(/\/c\/(\d+)/);
  if (linkMatch) {
    formattedChatId = `-100${linkMatch[1]}`;
  } else if (formattedChatId.includes('web.telegram.org')) {
    // 2. Web Telegram URL: https://web.telegram.org/a/#-1002456789012
    const webDashMatch = formattedChatId.match(/-100\d+/);
    if (webDashMatch) {
      formattedChatId = webDashMatch[0];
    } else {
      const numMatch = formattedChatId.match(/\d{9,}/);
      if (numMatch) formattedChatId = `-100${numMatch[0]}`;
    }
  } else if (/^\d{9,}$/.test(formattedChatId)) {
    // 3. Positive 9+ digit integer without -100 prefix for private channel
    formattedChatId = `-100${formattedChatId}`;
  }

  // 1. Call getMe to get the bot's user ID for permission verification
  const meRes = await fetch(`${TG_API_BASE}/bot${token}/getMe`);
  const meData = await meRes.json().catch(() => ({}));
  if (!meRes.ok || !meData.ok) {
    throw new Error(meData.description || 'Invalid Telegram Bot Token. Failed to verify bot identity.');
  }
  const botId = meData.result.id;
  const botUsername = meData.result.username;

  // 2. Call getChat to retrieve chat info (channel title, type, username)
  const chatRes = await fetch(`${TG_API_BASE}/bot${token}/getChat?chat_id=${encodeURIComponent(formattedChatId)}`);
  const chatData = await chatRes.json().catch(() => ({}));

  if (!chatRes.ok || !chatData.ok) {
    const desc = chatData.description || 'Failed to access Telegram channel.';
    if (desc.toLowerCase().includes('chat not found')) {
      throw new Error(`Chat not found for "${formattedChatId}". Make sure: 1) The bot @${botUsername} is an Administrator of the channel, 2) For private channels, the ID begins with -100 (e.g. -1001234567890).`);
    }
    if (desc.toLowerCase().includes('bot was kicked') || desc.toLowerCase().includes('bot is not a member')) {
      throw new Error(`Bot @${botUsername} is not an active member of this channel. Please add @${botUsername} to the channel and promote it to Administrator.`);
    }
    throw new Error(desc);
  }

  const chat = chatData.result;

  // 3. Call getChatMember to verify administrator rights and posting permissions
  let isAdministrator = false;
  let canPost = false;
  let memberStatus = 'unknown';

  try {
    const memberRes = await fetch(`${TG_API_BASE}/bot${token}/getChatMember?chat_id=${encodeURIComponent(formattedChatId)}&user_id=${botId}`);
    const memberData = await memberRes.json().catch(() => ({}));
    if (memberRes.ok && memberData.ok) {
      const details = memberData.result;
      memberStatus = details.status; // 'creator', 'administrator', 'member', etc.
      isAdministrator = memberStatus === 'administrator' || memberStatus === 'creator';
      if (memberStatus === 'creator') {
        canPost = true;
      } else if (memberStatus === 'administrator') {
        // Can post messages or stories in channel
        canPost = details.can_post_messages !== false;
      }
    }
  } catch (err) {
    console.warn('[Telegram Verify] getChatMember check failed:', err.message);
  }

  // If chat is a channel, verify administrator and post permissions
  if (chat.type === 'channel') {
    if (!isAdministrator) {
      throw new Error(`Bot @${botUsername} was found in "${chat.title}", but is NOT an Administrator. Please promote the bot to Administrator with "Post Messages" permission.`);
    }
    if (!canPost) {
      throw new Error(`Bot @${botUsername} is an Administrator in "${chat.title}", but lacks "Post Messages" permission. Please enable "Post Messages" in the bot's admin privileges.`);
    }
  }

  return {
    success: true,
    chatId: String(chat.id),
    title: chat.title || 'Untitled Chat',
    type: chat.type, // 'channel', 'supergroup', 'group'
    username: chat.username ? `@${chat.username}` : null,
    description: chat.description || null,
    memberStatus,
    isAdministrator,
    canPost,
    botUsername
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

// Helper to resolve media file path on disk
function resolveUploadPath(mediaUrl) {
  if (!mediaUrl) return null;
  let clean = String(mediaUrl).trim();
  
  if (path.isAbsolute(clean) && fs.existsSync(clean)) {
    return clean;
  }

  try {
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      const parsed = new URL(clean);
      clean = parsed.pathname;
    }
  } catch {}

  if (clean.startsWith('/uploads/')) {
    clean = clean.replace('/uploads/', '');
  } else if (clean.startsWith('uploads/')) {
    clean = clean.replace('uploads/', '');
  }

  const uploadsDir = path.join(__dirname, '../../uploads');
  const candidate = path.join(uploadsDir, clean);
  if (fs.existsSync(candidate)) return candidate;

  const serverUploads = path.join(__dirname, '../uploads');
  if (fs.existsSync(path.join(serverUploads, clean))) return path.join(serverUploads, clean);

  const baseCandidate = path.join(uploadsDir, path.basename(clean));
  if (fs.existsSync(baseCandidate)) return baseCandidate;

  return null;
}

// Escape HTML entities for Telegram HTML parse mode
function escapeTelegramHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Publish post (Text, Photo, or Video) to Telegram Channel / Group
async function publishToTelegram(channelOrChatId, { title, content, mediaUrl, mediaType }, customToken = null) {
  const token = (customToken || getSetting('TELEGRAM_BOT_TOKEN') || '').trim();
  if (!token) {
    throw new Error('Telegram Bot Token is not configured. Please connect your bot first in Connected Accounts.');
  }

  // 1. Resolve targetChatId
  let targetChatId = channelOrChatId ? String(channelOrChatId).trim() : '';

  // If channelOrChatId is an internal channel ID (e.g. tg_bot_...), look up real channel ID
  if (!targetChatId || targetChatId.startsWith('tg_') || !/^(-100\d+|@\w+|\d+)$/.test(targetChatId)) {
    targetChatId = (getSetting('TELEGRAM_CHANNEL_ID') || '').trim();
  }

  if (!targetChatId) {
    const ch = db.prepare("SELECT platform_id, metadata FROM channels WHERE platform = 'telegram'").get();
    if (ch) {
      if (ch.platform_id && (ch.platform_id.startsWith('-100') || ch.platform_id.startsWith('@'))) {
        targetChatId = ch.platform_id.trim();
      } else if (ch.metadata) {
        try {
          const meta = JSON.parse(ch.metadata);
          if (meta.targetChatId) targetChatId = meta.targetChatId.trim();
        } catch {}
      }
    }
  }

  // Normalize channel ID format
  const linkMatch = targetChatId.match(/\/c\/(\d+)/);
  if (linkMatch) {
    targetChatId = `-100${linkMatch[1]}`;
  } else if (/^\d{9,}$/.test(targetChatId)) {
    targetChatId = `-100${targetChatId}`;
  }

  if (!targetChatId) {
    throw new Error('Telegram Channel ID is not configured. Please verify your channel in Telegram & Leads settings.');
  }

  // 2. Pre-flight verification: verify bot token and channel access
  const meRes = await fetch(`${TG_API_BASE}/bot${token}/getMe`);
  const meData = await meRes.json().catch(() => ({}));
  if (!meRes.ok || !meData.ok) {
    throw new Error(`Telegram Bot Authentication failed: ${meData.description || 'Invalid token'}`);
  }
  const botId = meData.result.id;
  const botUsername = meData.result.username;

  const chatRes = await fetch(`${TG_API_BASE}/bot${token}/getChat?chat_id=${encodeURIComponent(targetChatId)}`);
  const chatData = await chatRes.json().catch(() => ({}));
  if (!chatRes.ok || !chatData.ok) {
    const desc = chatData.description || 'Chat not found';
    throw new Error(`Telegram channel error for "${targetChatId}": ${desc}. Ensure bot @${botUsername} is added as Administrator.`);
  }

  const chat = chatData.result;
  const channelTitle = chat.title || chat.username || targetChatId;

  // 3. Determine media type and build formatted caption
  const hasMedia = Boolean(mediaUrl && String(mediaUrl).trim() && String(mediaUrl).trim() !== 'null' && String(mediaUrl).trim() !== 'undefined');
  const isVideo = hasMedia && (mediaType === 'video' || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(mediaUrl));
  const isImage = hasMedia && (mediaType === 'image' || /\.(jpg|jpeg|png|webp|gif)$/i.test(mediaUrl));

  let caption = '';
  if (title && title.trim()) {
    caption += `<b>${escapeTelegramHtml(title.trim())}</b>\n\n`;
  }
  if (content && content.trim()) {
    caption += escapeTelegramHtml(content.trim());
  }

  // Truncate according to Telegram limits
  if ((isVideo || isImage) && caption.length > 1024) {
    caption = caption.substring(0, 1020) + '...';
  } else if (!isVideo && !isImage && caption.length > 4096) {
    caption = caption.substring(0, 4090) + '...';
  }

  let resultData = null;

  // 4a. Video Upload (sendVideo)
  if (isVideo) {
    const localPath = resolveUploadPath(mediaUrl);
    if (localPath && fs.existsSync(localPath)) {
      const fileBuffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).toLowerCase() || '.mp4';
      const mime = ext === '.mov' ? 'video/quicktime' : 'video/mp4';
      const blob = new Blob([fileBuffer], { type: mime });

      const formData = new FormData();
      formData.append('chat_id', targetChatId);
      formData.append('video', blob, path.basename(localPath));
      if (caption) formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');

      const res = await fetch(`${TG_API_BASE}/bot${token}/sendVideo`, {
        method: 'POST',
        body: formData
      });
      resultData = await res.json().catch(() => ({}));
      if (!res.ok || !resultData.ok) {
        throw new Error(`Telegram sendVideo failed: ${resultData.description || `HTTP ${res.status}`}`);
      }
    } else if (mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'))) {
      const res = await fetch(`${TG_API_BASE}/bot${token}/sendVideo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          video: mediaUrl,
          caption: caption || undefined,
          parse_mode: 'HTML'
        })
      });
      resultData = await res.json().catch(() => ({}));
      if (!res.ok || !resultData.ok) {
        throw new Error(`Telegram sendVideo failed: ${resultData.description || `HTTP ${res.status}`}`);
      }
    } else {
      throw new Error(`Video file could not be found at: "${mediaUrl}". Please upload a valid video file.`);
    }
  } 
  // 4b. Image Upload (sendPhoto)
  else if (isImage) {
    const localPath = resolveUploadPath(mediaUrl);
    if (localPath && fs.existsSync(localPath)) {
      const fileBuffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
      const blob = new Blob([fileBuffer], { type: mime });

      const formData = new FormData();
      formData.append('chat_id', targetChatId);
      formData.append('photo', blob, path.basename(localPath));
      if (caption) formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');

      const res = await fetch(`${TG_API_BASE}/bot${token}/sendPhoto`, {
        method: 'POST',
        body: formData
      });
      resultData = await res.json().catch(() => ({}));
      if (!res.ok || !resultData.ok) {
        throw new Error(`Telegram sendPhoto failed: ${resultData.description || `HTTP ${res.status}`}`);
      }
    } else if (mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'))) {
      const res = await fetch(`${TG_API_BASE}/bot${token}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          photo: mediaUrl,
          caption: caption || undefined,
          parse_mode: 'HTML'
        })
      });
      resultData = await res.json().catch(() => ({}));
      if (!res.ok || !resultData.ok) {
        throw new Error(`Telegram sendPhoto failed: ${resultData.description || `HTTP ${res.status}`}`);
      }
    } else {
      throw new Error(`Image file could not be found at: "${mediaUrl}". Please upload a valid image file.`);
    }
  } 
  // 4c. Text Message (sendMessage)
  else {
    const res = await fetch(`${TG_API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: caption || 'New update from Sneharmony',
        parse_mode: 'HTML'
      })
    });
    resultData = await res.json().catch(() => ({}));
    if (!res.ok || !resultData.ok) {
      throw new Error(`Telegram sendMessage failed: ${resultData.description || `HTTP ${res.status}`}`);
    }
  }

  const messageId = resultData.result.message_id;
  let postUrl;
  if (chat.username) {
    postUrl = `https://t.me/${chat.username}/${messageId}`;
  } else if (targetChatId.startsWith('@')) {
    postUrl = `https://t.me/${targetChatId.replace('@', '')}/${messageId}`;
  } else {
    postUrl = `https://t.me/c/${targetChatId.replace('-100', '')}/${messageId}`;
  }

  return {
    success: true,
    postId: String(messageId),
    messageId,
    postUrl,
    channelTitle
  };
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
  verifyTelegramChannel,
  sendTelegramMessage,
  publishToTelegram,
  isHumanEscalationRequested,
  getHumanEscalationMessage,
  answerTelegramWithAi,
  handleIncomingTelegramMessage,
  startTelegramPolling,
  stopTelegramPolling
};
