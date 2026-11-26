const express = require('express');
const router = express.Router();
const { db, logActivity } = require('../db');
const { matchRule } = require('../services/scheduler');
const { polishReplyWithAi } = require('../services/ai');

// List all rules
router.get('/', (req, res) => {
  try {
    const rules = db.prepare('SELECT * FROM rules ORDER BY created_at DESC').all();
    res.json({ success: true, rules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a new rule
router.post('/', (req, res) => {
  try {
    const {
      name,
      platform = 'all',
      trigger_type = 'contains',
      keywords,
      reply_template,
      use_ai_polish = 0,
      ai_prompt = '',
      cooldown_seconds = 60
    } = req.body;

    if (!name || !keywords || !reply_template) {
      return res.status(400).json({ success: false, error: 'Name, keywords, and reply template are required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO rules (
        name, platform, trigger_type, keywords, reply_template, 
        use_ai_polish, ai_prompt, cooldown_seconds, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      name.trim(),
      platform,
      trigger_type,
      keywords.trim(),
      reply_template.trim(),
      use_ai_polish ? 1 : 0,
      ai_prompt ? ai_prompt.trim() : '',
      Number(cooldown_seconds) || 60
    );

    logActivity(platform, 'rule_created', 'success', `Created auto-reply rule "${name}"`);
    res.json({ success: true, ruleId: Number(result.lastInsertRowid) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update a rule
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      platform,
      trigger_type,
      keywords,
      reply_template,
      use_ai_polish,
      ai_prompt,
      cooldown_seconds,
      is_active
    } = req.body;

    const existing = db.prepare('SELECT * FROM rules WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    db.prepare(`
      UPDATE rules SET
        name = COALESCE(?, name),
        platform = COALESCE(?, platform),
        trigger_type = COALESCE(?, trigger_type),
        keywords = COALESCE(?, keywords),
        reply_template = COALESCE(?, reply_template),
        use_ai_polish = COALESCE(?, use_ai_polish),
        ai_prompt = COALESCE(?, ai_prompt),
        cooldown_seconds = COALESCE(?, cooldown_seconds),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : null,
      platform,
      trigger_type,
      keywords !== undefined ? keywords.trim() : null,
      reply_template !== undefined ? reply_template.trim() : null,
      use_ai_polish !== undefined ? (use_ai_polish ? 1 : 0) : null,
      ai_prompt !== undefined ? ai_prompt.trim() : null,
      cooldown_seconds !== undefined ? Number(cooldown_seconds) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      id
    );

    res.json({ success: true, message: 'Rule updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a rule
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const info = db.prepare('DELETE FROM rules WHERE id = ?').run(id);
    if (info.changes === 0) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    res.json({ success: true, message: 'Rule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test comment against rules (Simulator / Sandbox)
router.post('/test', async (req, res) => {
  try {
    const { text, platform = 'all', author_name = 'Alex' } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Please provide test comment text' });
    }

    const rules = db.prepare(`
      SELECT * FROM rules 
      WHERE is_active = 1 AND (platform = 'all' OR platform = ?)
    `).all(platform);

    for (const rule of rules) {
      if (matchRule(text, rule)) {
        let reply = rule.reply_template.replace(/\{name\}/gi, author_name);
        let aiPolished = null;

        if (rule.use_ai_polish) {
          aiPolished = await polishReplyWithAi(reply, text, rule.ai_prompt);
        }

        return res.json({
          success: true,
          matched: true,
          rule: { id: rule.id, name: rule.name, trigger_type: rule.trigger_type },
          finalReply: aiPolished || reply,
          rawReply: reply,
          usedAi: !!rule.use_ai_polish
        });
      }
    }

    res.json({
      success: true,
      matched: false,
      message: 'No active rule matched this test comment.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
