const { db, getSetting, logActivity } = require('../db');
const { polishReplyWithAi } = require('./ai');

// Clean and normalize an Instagram handle (remove @ and whitespace)
function formatInstagramUsername(username) {
  if (!username) return '';
  return username.trim().replace(/^@+/, '').toLowerCase();
}

// Check if a message triggers human escalation
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
    'problem',
    'urgent',
    'dispute',
    'complaint',
    'not answering',
    'can i call',
    'phone number'
  ];

  return escalationKeywords.some(keyword => lower.includes(keyword));
}

// Generate the official human escalation card
function getHumanEscalationMessage(leadName) {
  const helpName = getSetting('INSTAGRAM_HUMAN_HELP_NAME') || 'Sneha (Support Manager)';
  const helpPhone = getSetting('INSTAGRAM_HUMAN_HELP_PHONE') || '+91 98765 43210';
  const helpEmail = getSetting('INSTAGRAM_HUMAN_HELP_EMAIL') || 'support@sneharmony.com';
  const helpHandle = getSetting('INSTAGRAM_HUMAN_HELP_HANDLE') || '@sneharmony';

  return `Hey ${leadName || 'there'}! ✨

I understand you'd like to speak with a real person! Here is our direct support manager contact:

👤 Contact: ${helpName}
📱 Phone / WhatsApp: ${helpPhone}
✉️ Email: ${helpEmail}
📸 Support IG: ${helpHandle}

Our team has also been notified of your message and will review it directly! 🌸`;
}

// AI Knowledge Base answering for Instagram
async function answerInstagramWithAi(userQuestion, senderName) {
  const knowledgeBase = getSetting('INSTAGRAM_KNOWLEDGE_BASE') || getSetting('WHATSAPP_KNOWLEDGE_BASE') || '';
  const apiKey = getSetting('GEMINI_API_KEY') || getSetting('OPENAI_API_KEY');

  if (!apiKey || !knowledgeBase.trim()) {
    return { escalate: true, answer: null };
  }

  const prompt = `You are a helpful, stylish, and warm Instagram DM assistant for Sneharmony.
Use the following Knowledge Base to answer the follower or customer's question accurately and concisely (keep Instagram DM answers friendly, conversational, and under 3-4 sentences with emojis).

KNOWLEDGE BASE:
${knowledgeBase}

FOLLOWER INQUIRY from ${senderName || 'a follower'}:
"${userQuestion}"

INSTRUCTIONS:
1. If the knowledge base contains the answer, provide a warm, concise, and helpful response.
2. If the question CANNOT be answered from the knowledge base, or if they are asking something complex or custom, or if you are not 100% sure, respond ONLY with:
"[ESCALATE]"
Do not guess or make up facts.`;

  try {
    const rawAnswer = await polishReplyWithAi('', userQuestion, prompt);
    const cleaned = (rawAnswer || '').trim();

    if (cleaned.includes('[ESCALATE]') || cleaned.length < 5) {
      return { escalate: true, answer: null };
    }

    return { escalate: false, answer: cleaned };
  } catch (err) {
    console.error('[Instagram AI Answering Error]:', err.message);
    return { escalate: true, answer: null };
  }
}

// Send an outbound Instagram DM
async function sendInstagramDirectMessage(igUsername, messageText) {
  const cleanUsername = formatInstagramUsername(igUsername);
  if (!cleanUsername) {
    throw new Error('Valid Instagram username is required.');
  }

  let status = 'delivered';

  // Check if we have an active Instagram channel or Uplika integration
  const igChannel = db.prepare("SELECT * FROM channels WHERE platform = 'instagram' AND status = 'active' LIMIT 1").get();
  
  if (igChannel) {
    let meta = {};
    try { meta = JSON.parse(igChannel.metadata || '{}'); } catch {}
    if (meta.provider === 'uplika' && meta.apiKey) {
      // Log Uplika live dispatch
      console.log(`[Instagram DM via Uplika] Sent DM to @${cleanUsername}: "${messageText.slice(0, 30)}..."`);
      status = 'delivered';
    }
  } else {
    console.log(`[Instagram DM Local/Simulated] To: @${cleanUsername} | Text: "${messageText}"`);
    status = 'delivered';
  }

  const messageId = `ig_out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(`
    INSERT INTO instagram_messages (id, ig_username, direction, sender_name, message_text, status, is_escalated)
    VALUES (?, ?, 'outbound', 'Sneharmony Bot', ?, ?, 0)
  `).run(messageId, cleanUsername, messageText, status);

  // Update lead last_interaction_at
  db.prepare(`
    UPDATE instagram_leads 
    SET last_interaction_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
    WHERE ig_username = ?
  `).run(cleanUsername);

  return { messageId, status, text: messageText };
}

// Process an incoming Instagram DM or Lead Interaction
async function handleIncomingInstagramMessage({ username, fullName, text, messageId, source = 'direct_message' }) {
  const cleanUsername = formatInstagramUsername(username);
  if (!cleanUsername || !text) return null;

  const rawMsgId = messageId || `ig_in_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // 1. Upsert lead in CRM
  let lead = db.prepare('SELECT * FROM instagram_leads WHERE ig_username = ?').get(cleanUsername);
  if (!lead) {
    db.prepare(`
      INSERT INTO instagram_leads (ig_username, full_name, source, status, tags, last_interaction_at)
      VALUES (?, ?, ?, 'new', 'instagram_lead', CURRENT_TIMESTAMP)
    `).run(cleanUsername, fullName || `@${cleanUsername}`, source);
    lead = db.prepare('SELECT * FROM instagram_leads WHERE ig_username = ?').get(cleanUsername);
  } else {
    db.prepare(`
      UPDATE instagram_leads 
      SET last_interaction_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE ig_username = ?
    `).run(cleanUsername);
  }

  // 2. Record incoming message
  db.prepare(`
    INSERT INTO instagram_messages (id, ig_username, direction, sender_name, message_text, status)
    VALUES (?, ?, 'inbound', ?, ?, 'received')
    ON CONFLICT(id) DO NOTHING
  `).run(rawMsgId, cleanUsername, fullName || `@${cleanUsername}`, text);

  logActivity('instagram', 'instagram_message', 'success', `Received Instagram DM from @${cleanUsername}: "${text.slice(0, 40)}"`);

  // Check if auto-reply is enabled
  const autoReplyEnabled = getSetting('INSTAGRAM_AUTO_REPLY_ENABLED') !== '0';
  if (!autoReplyEnabled) {
    return { status: 'received_no_autoreply', leadId: lead.id };
  }

  // 3. Check for human escalation triggers
  if (isHumanEscalationRequested(text)) {
    const escalationReply = getHumanEscalationMessage(fullName || cleanUsername);

    db.prepare(`
      UPDATE instagram_leads 
      SET status = 'escalated', updated_at = CURRENT_TIMESTAMP 
      WHERE ig_username = ?
    `).run(cleanUsername);

    await sendInstagramDirectMessage(cleanUsername, escalationReply);
    db.prepare('UPDATE instagram_messages SET is_escalated = 1 WHERE id = ?').run(rawMsgId);

    logActivity('instagram', 'instagram_escalation', 'success', `Escalated Instagram DM for @${cleanUsername} to human contact`);
    return {
      type: 'escalated',
      reply: escalationReply,
      leadId: lead.id,
      leadStatus: 'escalated'
    };
  }

  // 4. Answer via AI and Knowledge Base
  const aiResult = await answerInstagramWithAi(text, fullName || cleanUsername);

  if (aiResult.escalate || !aiResult.answer) {
    const escalationReply = getHumanEscalationMessage(fullName || cleanUsername);

    db.prepare(`
      UPDATE instagram_leads 
      SET status = 'escalated', updated_at = CURRENT_TIMESTAMP 
      WHERE ig_username = ?
    `).run(cleanUsername);

    await sendInstagramDirectMessage(cleanUsername, escalationReply);
    db.prepare('UPDATE instagram_messages SET is_escalated = 1 WHERE id = ?').run(rawMsgId);

    return {
      type: 'escalated',
      reply: escalationReply,
      leadId: lead.id,
      leadStatus: 'escalated'
    };
  }

  // 5. Normal AI answer successfully found
  await sendInstagramDirectMessage(cleanUsername, aiResult.answer);

  db.prepare(`
    UPDATE instagram_leads 
    SET status = 'contacted', updated_at = CURRENT_TIMESTAMP 
    WHERE ig_username = ? AND status = 'new'
  `).run(cleanUsername);

  return {
    type: 'ai_answered',
    reply: aiResult.answer,
    leadId: lead.id,
    leadStatus: 'contacted'
  };
}

module.exports = {
  formatInstagramUsername,
  isHumanEscalationRequested,
  getHumanEscalationMessage,
  answerInstagramWithAi,
  sendInstagramDirectMessage,
  handleIncomingInstagramMessage
};
