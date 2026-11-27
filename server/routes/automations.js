const express = require('express');
const router = express.Router();
const { db, logAutomationExecution } = require('../db');
const { generateAiReply } = require('../services/ai');

// 1. GET /api/automations/executions - Full execution log history
router.get('/executions', (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    let query = 'SELECT * FROM automation_executions';
    const params = [];

    if (status && status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY id DESC LIMIT ?';
    params.push(Number(limit));

    const executions = db.prepare(query).all(...params);
    res.json({ success: true, executions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET /api/automations/templates - Production-grade automation templates
router.get('/templates', (req, res) => {
  const templates = [
    {
      id: 'template_faq_responder',
      name: 'Smart FAQ & Lesson Inquiry Responder',
      description: 'Detects lesson or guitar course inquiries, references knowledge base, and drafts warm answers.',
      platform: 'all',
      trigger_type: 'contains',
      keywords: 'learn, guitar, lesson, fees, syllabus, tutorial, beginner',
      reply_template: 'Hi {name}! 🌷 We offer beginner and intermediate online guitar lessons. You can check our lesson details, or let us know if you would like Sneha to get in touch with you!',
      use_ai_polish: 1,
      ai_prompt: 'Be welcoming, encouraging, and mention our beginner acoustic curriculum without making price commitments.'
    },
    {
      id: 'template_lead_capture',
      name: 'High-Intent Lead Capture & WhatsApp Handoff',
      description: 'Captures purchase or collaboration intent and directs the contact to WhatsApp support.',
      platform: 'all',
      trigger_type: 'contains',
      keywords: 'price, cost, buy, purchase, booking, hire, collaborate, sponsor',
      reply_template: 'Hello {name}! 🎵 Thank you for your interest. To help you with exact booking rates and availability, feel free to reach our team on WhatsApp at +91 98765 43210!',
      use_ai_polish: 1,
      ai_prompt: 'Polite, professional, clear referral to WhatsApp support.'
    },
    {
      id: 'template_praise_moderation',
      name: 'Fan Love & Appreciation Booster',
      description: 'Acknowledges positive feedback on YouTube covers and Instagram reels with personalized thank-yous.',
      platform: 'all',
      trigger_type: 'contains',
      keywords: 'beautiful, loved it, amazing cover, melody, voice, soothing, wonderful',
      reply_template: 'Thank you so much {name}! ❤️ Your kind words mean the world to our music journey. More acoustic songs coming this week!',
      use_ai_polish: 1,
      ai_prompt: 'Warm, humble, enthusiastic creator persona.'
    },
    {
      id: 'template_support_escalator',
      name: 'Urgent Help & Escalation Notice',
      description: 'Detects complaints or urgent questions and notifies the manager while acknowledging receipt.',
      platform: 'all',
      trigger_type: 'contains',
      keywords: 'urgent, problem, issue, refund, complaint, cancel, help',
      reply_template: 'Hi {name}, we take your experience very seriously. Our support manager Sneha has been notified and will assist you directly within 2 hours.',
      use_ai_polish: 0,
      ai_prompt: 'Urgent, professional, reassuring.'
    }
  ];

  res.json({ success: true, templates });
});

// 3. POST /api/automations/test - Interactive Sandbox Simulator (Zero Side-Effects)
router.post('/test', async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, platform = 'all', authorName = 'Test User' } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Test message is required' });
    }

    const cleanInput = message.trim().toLowerCase();
    const rules = db.prepare('SELECT * FROM rules WHERE is_active = 1').all();

    let matchedRule = null;
    for (const rule of rules) {
      if (rule.platform !== 'all' && platform !== 'all' && rule.platform !== platform) {
        continue;
      }

      const keywords = (rule.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      let isMatch = false;

      if (rule.trigger_type === 'exact') {
        isMatch = keywords.some(k => cleanInput === k);
      } else if (rule.trigger_type === 'starts_with') {
        isMatch = keywords.some(k => cleanInput.startsWith(k));
      } else if (rule.trigger_type === 'regex') {
        isMatch = keywords.some(k => {
          try { return new RegExp(k, 'i').test(cleanInput); } catch { return false; }
        });
      } else {
        // Default 'contains'
        isMatch = keywords.some(k => cleanInput.includes(k));
      }

      if (isMatch) {
        matchedRule = rule;
        break;
      }
    }

    if (!matchedRule) {
      logAutomationExecution({
        rule_id: null,
        rule_name: 'No Match',
        platform,
        trigger_type: 'test_simulation',
        input_content: message,
        author_name: authorName,
        status: 'skipped',
        action_taken: 'none',
        output_content: 'No active automation rule matched the test message.',
        execution_time_ms: Date.now() - startTime
      });

      return res.json({
        success: true,
        matched: false,
        message: 'No active rule matched this test message.',
        actions: ['No action taken']
      });
    }

    // Generate response using template & AI if enabled
    let finalReply = matchedRule.reply_template.replace('{name}', authorName);
    let usedAi = false;

    if (matchedRule.use_ai_polish) {
      try {
        const aiPrompt = matchedRule.ai_prompt || 'Be warm and conversational.';
        finalReply = await generateAiReply(message, finalReply, aiPrompt);
        usedAi = true;
      } catch (e) {
        console.warn('AI polish failed in simulation, falling back to template:', e.message);
      }
    }

    const proposedActions = [
      `Reply generated with template "${matchedRule.name}"`,
      usedAi ? 'AI tone polish applied' : 'Standard template output',
      'Rule cooldown timer checked (simulated)',
      'Telemetry audit entry recorded'
    ];

    logAutomationExecution({
      rule_id: matchedRule.id,
      rule_name: matchedRule.name,
      platform,
      trigger_type: matchedRule.trigger_type,
      input_content: message,
      author_name: authorName,
      status: 'simulated',
      action_taken: 'simulated_reply',
      output_content: finalReply,
      execution_time_ms: Date.now() - startTime
    });

    res.json({
      success: true,
      matched: true,
      rule: matchedRule,
      usedAi,
      finalReply,
      actions: proposedActions,
      executionTimeMs: Date.now() - startTime
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST /api/automations/clear-executions - Clear execution history
router.post('/clear-executions', (req, res) => {
  try {
    db.prepare('DELETE FROM automation_executions').run();
    res.json({ success: true, message: 'Automation execution history cleared' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
