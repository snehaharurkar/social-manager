const { db, getSetting, logActivity } = require('../db');
const { polishReplyWithAi } = require('./ai');
const baileys = require('./baileys');

/**
 * WhatsApp Business Automation Service
 * Supports Meta Cloud API, automated lead messaging, knowledge base Q&A, and human escalation.
 */

// Format phone number to international standard (digits only)
function formatPhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  return rawPhone.replace(/[^0-9]/g, '');
}

// Check if incoming text triggers human escalation
function isHumanEscalationRequested(text) {
  if (!text) return false;
  const lower = text.trim().toLowerCase();
  const escalationKeywords = [
    'human',
    'agent',
    'support',
    'person',
    'representative',
    'executive',
    'call me',
    'stuck',
    'not working',
    'talk to someone',
    'speak with someone',
    'speak to a person',
    'real person',
    'manager',
    'contact person',
    'helping person',
    'issue',
    'problem',
    'complaint',
    'help me please',
    'i need help'
  ];

  return escalationKeywords.some(kw => {
    // Whole word or direct phrase match
    return lower === kw || lower.includes(` ${kw} `) || lower.startsWith(`${kw} `) || lower.endsWith(` ${kw}`) || lower.includes(kw);
  });
}

// Generate the standard human escalation reply
function getHumanEscalationMessage(senderName) {
  const helpName = getSetting('WHATSAPP_HUMAN_HELP_NAME') || 'Our Support Manager';
  const helpPhone = getSetting('WHATSAPP_HUMAN_HELP_PHONE') || '+91 98765 43210';
  const helpEmail = getSetting('WHATSAPP_HUMAN_HELP_EMAIL') || 'support@brand.com';

  const greeting = senderName ? `Hi ${senderName}! ` : '';
  return `${greeting}I understand you'd like to speak with our team! 🤝

You can reach our dedicated specialist, *${helpName}*, directly:
📞 *Phone / WhatsApp:* ${helpPhone}
✉️ *Email:* ${helpEmail}

Our team has also been alerted to your inquiry and will reach out to you directly! ✨`;
}

// Send an outbound WhatsApp message
async function sendWhatsAppMessage(toPhone, messageText) {
  const cleanPhone = formatPhoneNumber(toPhone);
  if (!cleanPhone) {
    throw new Error('Valid recipient phone number is required.');
  }

  const phoneNumberId = getSetting('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = getSetting('WHATSAPP_ACCESS_TOKEN');
  let status = 'sent';

  const baileysState = baileys.getStatus();
  if (baileysState.status === 'connected') {
    try {
      await baileys.sendBaileysMessage(cleanPhone, messageText);
      status = 'delivered';
    } catch (err) {
      console.error('[Baileys Outbound Send Error]:', err.message);
      status = 'failed';
    }
  } else if (phoneNumberId && accessToken) {
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { body: messageText }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('[WhatsApp Cloud API Error]:', data);
        status = 'failed';
      } else {
        status = 'delivered';
      }
    } catch (err) {
      console.error('[WhatsApp Network Error]:', err.message);
      status = 'failed';
    }
  } else {
    // Simulator / Local mode (logs and records message)
    console.log(`[WhatsApp Local / Simulated Message] To: ${cleanPhone} | Text: "${messageText}"`);
    status = 'delivered';
  }

  // Save to database
  const messageId = `wa_out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(`
    INSERT INTO whatsapp_messages (id, phone_number, direction, sender_name, message_text, status, is_escalated)
    VALUES (?, ?, 'outbound', 'Brand Bot', ?, ?, 0)
  `).run(messageId, cleanPhone, messageText, status);

  // Update contact last_contacted_at
  db.prepare(`
    UPDATE whatsapp_contacts 
    SET last_contacted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
    WHERE phone_number = ?
  `).run(cleanPhone);

  return { messageId, status, text: messageText };
}

// AI Knowledge Base answering
async function answerWithAiKnowledge(userQuestion, senderName) {
  const knowledgeBase = getSetting('WHATSAPP_KNOWLEDGE_BASE') || '';
  const apiKey = getSetting('GEMINI_API_KEY') || getSetting('OPENAI_API_KEY');

  if (!apiKey || !knowledgeBase.trim()) {
    return { escalate: true, answer: null };
  }

  const prompt = `You are a helpful and polite WhatsApp assistant for Sneharmony.
Use the following Knowledge Base to answer the customer's question accurately and concisely (keep WhatsApp answers friendly and under 4 sentences).

KNOWLEDGE BASE:
${knowledgeBase}

CUSTOMER INQUIRY from ${senderName || 'a customer'}:
"${userQuestion}"

INSTRUCTIONS:
1. If the knowledge base contains the answer, provide a warm, concise, and helpful response.
2. If the user question CANNOT be answered from the knowledge base, or if they are asking something complicated, or if you are not 100% sure, respond ONLY with:
"[ESCALATE]"
Do not guess or invent details not in the knowledge base.`;

  try {
    const rawAnswer = await polishReplyWithAi('', userQuestion, prompt);
    const cleaned = (rawAnswer || '').trim();

    if (cleaned.includes('[ESCALATE]') || cleaned.length < 5) {
      return { escalate: true, answer: null };
    }

    return { escalate: false, answer: cleaned };
  } catch (err) {
    console.error('[WhatsApp AI Answering Error]:', err.message);
    return { escalate: true, answer: null };
  }
}

// Process incoming WhatsApp message
async function handleIncomingWhatsAppMessage({ from, senderName, text, messageId }) {
  const cleanPhone = formatPhoneNumber(from);
  if (!cleanPhone || !text) return null;

  const rawMsgId = messageId || `wa_in_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // 1. Ensure contact exists in CRM
  let contact = db.prepare('SELECT * FROM whatsapp_contacts WHERE phone_number = ?').get(cleanPhone);
  if (!contact) {
    db.prepare(`
      INSERT INTO whatsapp_contacts (phone_number, name, source, status, tags)
      VALUES (?, ?, 'inbound', 'new', 'lead')
    `).run(cleanPhone, senderName || 'WhatsApp User');
    contact = db.prepare('SELECT * FROM whatsapp_contacts WHERE phone_number = ?').get(cleanPhone);
  } else if (senderName && contact.name === 'WhatsApp User') {
    db.prepare('UPDATE whatsapp_contacts SET name = ? WHERE phone_number = ?').run(senderName, cleanPhone);
  }

  // 2. Record incoming message
  db.prepare(`
    INSERT INTO whatsapp_messages (id, phone_number, direction, sender_name, message_text, status)
    VALUES (?, ?, 'inbound', ?, ?, 'received')
    ON CONFLICT(id) DO NOTHING
  `).run(rawMsgId, cleanPhone, senderName || contact.name || 'Customer', text);

  logActivity('whatsapp', 'whatsapp_message', 'success', `Received WhatsApp from ${senderName || cleanPhone}: "${text.slice(0, 40)}"`);

  // Check if auto-reply is enabled
  const autoReplyEnabled = getSetting('WHATSAPP_AUTO_REPLY_ENABLED') !== '0';
  if (!autoReplyEnabled) {
    return { status: 'received_no_autoreply', contactId: contact.id };
  }

  // 3. Check for human escalation triggers
  if (isHumanEscalationRequested(text)) {
    const escalationReply = getHumanEscalationMessage(senderName || contact.name);

    // Update contact status to escalated
    db.prepare(`
      UPDATE whatsapp_contacts 
      SET status = 'escalated', updated_at = CURRENT_TIMESTAMP 
      WHERE phone_number = ?
    `).run(cleanPhone);

    // Send escalation message
    await sendWhatsAppMessage(cleanPhone, escalationReply);

    // Flag message as escalated
    db.prepare('UPDATE whatsapp_messages SET is_escalated = 1 WHERE id = ?').run(rawMsgId);

    logActivity('whatsapp', 'whatsapp_escalation', 'success', `Escalated conversation for ${cleanPhone} to human contact`);
    return {
      type: 'escalated',
      reply: escalationReply,
      contact
    };
  }

  // 4. Check keyword rules for WhatsApp or 'all'
  const rules = db.prepare(`
    SELECT * FROM rules 
    WHERE is_active = 1 AND (platform = 'whatsapp' OR platform = 'all')
    ORDER BY id ASC
  `).all();

  for (const rule of rules) {
    const keywords = (rule.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    const lowerText = text.toLowerCase();
    const matched = keywords.some(k => lowerText.includes(k));

    if (matched) {
      let reply = rule.reply_template.replace(/\{name\}/gi, senderName || contact.name || 'friend');

      if (rule.use_ai_polish) {
        reply = await polishReplyWithAi(reply, text, rule.ai_prompt);
      }

      await sendWhatsAppMessage(cleanPhone, reply);
      db.prepare('UPDATE rules SET match_count = match_count + 1 WHERE id = ?').run(rule.id);
      db.prepare("UPDATE whatsapp_contacts SET status = 'engaged', updated_at = CURRENT_TIMESTAMP WHERE phone_number = ?").run(cleanPhone);

      logActivity('whatsapp', 'whatsapp_reply', 'success', `Replied to ${cleanPhone} via rule "${rule.name}"`);
      return {
        type: 'rule_matched',
        ruleName: rule.name,
        reply,
        contact
      };
    }
  }

  // 5. Try Smart AI Knowledge Base Answering
  const aiResult = await answerWithAiKnowledge(text, senderName || contact.name);

  if (!aiResult.escalate && aiResult.answer) {
    await sendWhatsAppMessage(cleanPhone, aiResult.answer);
    db.prepare("UPDATE whatsapp_contacts SET status = 'engaged', updated_at = CURRENT_TIMESTAMP WHERE phone_number = ?").run(cleanPhone);

    logActivity('whatsapp', 'whatsapp_ai_reply', 'success', `AI answered query from ${cleanPhone}`);
    return {
      type: 'ai_answered',
      reply: aiResult.answer,
      contact
    };
  }

  // 6. If AI cannot answer or is unsure -> Escalate to Helping Person
  const fallbackEscalation = getHumanEscalationMessage(senderName || contact.name);
  db.prepare(`
    UPDATE whatsapp_contacts 
    SET status = 'escalated', updated_at = CURRENT_TIMESTAMP 
    WHERE phone_number = ?
  `).run(cleanPhone);

  await sendWhatsAppMessage(cleanPhone, fallbackEscalation);
  db.prepare('UPDATE whatsapp_messages SET is_escalated = 1 WHERE id = ?').run(rawMsgId);

  logActivity('whatsapp', 'whatsapp_escalation', 'success', `Unanswered query escalated to human support for ${cleanPhone}`);
  return {
    type: 'escalated_fallback',
    reply: fallbackEscalation,
    contact
  };
}

// Hook Baileys incoming messages to main handler
baileys.setIncomingMessageCallback(handleIncomingWhatsAppMessage);

module.exports = {
  formatPhoneNumber,
  isHumanEscalationRequested,
  getHumanEscalationMessage,
  sendWhatsAppMessage,
  handleIncomingWhatsAppMessage
};
