const express = require('express');
const router = express.Router();
const { db, getSetting, setSetting, logActivity } = require('../db');

// 1. GET /api/brand/knowledge - Fetch all knowledge base entries and brand voice config
router.get('/knowledge', (req, res) => {
  try {
    const { category = 'all' } = req.query;
    let query = 'SELECT * FROM brand_knowledge';
    const params = [];

    if (category !== 'all') {
      query += ' WHERE category = ?';
      params.push(category);
    }
    query += ' ORDER BY id DESC';

    const items = db.prepare(query).all(...params);

    const brandVoice = {
      brandName: getSetting('BRAND_NAME') || 'Sneharmony',
      brandDescription: getSetting('BRAND_DESCRIPTION') || 'Acoustic guitar learning academy, lifestyle covers, and creator music brand founded by Sneha.',
      brandTone: getSetting('BRAND_TONE') || 'warm, encouraging, cheerful, patient, and artistic',
      restrictedTopics: getSetting('BRAND_RESTRICTED_TOPICS') || 'politics, explicit content, unverified medical claims, financial guarantees',
      humanEscalationName: getSetting('BRAND_ESCALATION_NAME') || 'Sneha (Support Manager)',
      humanEscalationPhone: getSetting('BRAND_ESCALATION_PHONE') || '+91 98765 43210',
      humanEscalationEmail: getSetting('BRAND_ESCALATION_EMAIL') || 'support@sneharmony.com'
    };

    res.json({
      success: true,
      items,
      brandVoice
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. POST /api/brand/knowledge - Add new knowledge base item
router.post('/knowledge', (req, res) => {
  try {
    const { title, category = 'faq', content, tags = '' } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    const stmt = db.prepare(`
      INSERT INTO brand_knowledge (title, category, content, tags)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(title.trim(), category.trim(), content.trim(), tags ? tags.trim() : '');

    const newItem = db.prepare('SELECT * FROM brand_knowledge WHERE id = ?').get(result.lastInsertRowid);
    logActivity('brand', 'knowledge_created', 'success', `Created knowledge entry: "${title}"`);

    res.json({ success: true, item: newItem });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. PUT /api/brand/knowledge/:id - Update knowledge item
router.put('/knowledge/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, content, tags, is_active } = req.body;

    db.prepare(`
      UPDATE brand_knowledge
      SET title = COALESCE(?, title),
          category = COALESCE(?, category),
          content = COALESCE(?, content),
          tags = COALESCE(?, tags),
          is_active = COALESCE(?, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, category, content, tags, is_active !== undefined ? Number(is_active) : undefined, Number(id));

    const updated = db.prepare('SELECT * FROM brand_knowledge WHERE id = ?').get(Number(id));
    res.json({ success: true, item: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. DELETE /api/brand/knowledge/:id - Delete knowledge item
router.delete('/knowledge/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM brand_knowledge WHERE id = ?').run(Number(id));
    logActivity('brand', 'knowledge_deleted', 'success', `Deleted knowledge entry ID ${id}`);
    res.json({ success: true, message: 'Knowledge entry deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. GET /api/brand/voice - Fetch global brand voice config
router.get('/voice', (req, res) => {
  try {
    const brandVoice = {
      brandName: getSetting('BRAND_NAME') || 'Sneharmony',
      brandDescription: getSetting('BRAND_DESCRIPTION') || 'Acoustic guitar learning academy, lifestyle covers, and creator music brand founded by Sneha.',
      brandTone: getSetting('BRAND_TONE') || 'warm, encouraging, cheerful, patient, and artistic',
      restrictedTopics: getSetting('BRAND_RESTRICTED_TOPICS') || 'politics, explicit content, unverified medical claims, financial guarantees',
      humanEscalationName: getSetting('BRAND_ESCALATION_NAME') || 'Sneha (Support Manager)',
      humanEscalationPhone: getSetting('BRAND_ESCALATION_PHONE') || '+91 98765 43210',
      humanEscalationEmail: getSetting('BRAND_ESCALATION_EMAIL') || 'support@sneharmony.com'
    };
    res.json({ success: true, brandVoice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. POST /api/brand/voice - Update global brand voice config
router.post('/voice', (req, res) => {
  try {
    const {
      brandName,
      brandDescription,
      brandTone,
      restrictedTopics,
      humanEscalationName,
      humanEscalationPhone,
      humanEscalationEmail
    } = req.body;

    if (brandName) setSetting('BRAND_NAME', brandName.trim());
    if (brandDescription) setSetting('BRAND_DESCRIPTION', brandDescription.trim());
    if (brandTone) setSetting('BRAND_TONE', brandTone.trim());
    if (restrictedTopics !== undefined) setSetting('BRAND_RESTRICTED_TOPICS', restrictedTopics.trim());
    if (humanEscalationName) setSetting('BRAND_ESCALATION_NAME', humanEscalationName.trim());
    if (humanEscalationPhone) setSetting('BRAND_ESCALATION_PHONE', humanEscalationPhone.trim());
    if (humanEscalationEmail) setSetting('BRAND_ESCALATION_EMAIL', humanEscalationEmail.trim());

    logActivity('brand', 'voice_updated', 'success', 'Updated global brand voice configuration');
    res.json({ success: true, message: 'Brand voice settings saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
