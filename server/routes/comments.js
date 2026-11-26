const express = require('express');
const router = express.Router();
const { db, logActivity } = require('../db');
const { replyToYouTubeComment } = require('../services/youtube');
const { replyToInstagramComment } = require('../services/instagram');

// List comments
router.get('/', (req, res) => {
  try {
    const { platform, filter } = req.query; // filter: 'all' | 'unreplied' | 'replied'

    let sql = 'SELECT * FROM comments WHERE 1=1';
    const params = [];

    if (platform && platform !== 'all') {
      sql += ' AND platform = ?';
      params.push(platform);
    }

    if (filter === 'unreplied') {
      sql += ' AND replied = 0';
    } else if (filter === 'replied') {
      sql += ' AND replied = 1';
    }

    sql += ' ORDER BY published_at DESC LIMIT 100';

    const comments = db.prepare(sql).all(...params);
    res.json({ success: true, comments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Manual reply from inbox
router.post('/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Reply text cannot be empty' });
    }

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(comment.channel_id);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    // Call platform API
    if (channel.platform === 'youtube') {
      await replyToYouTubeComment(channel.access_token, comment.id, text.trim());
    } else if (channel.platform === 'instagram') {
      await replyToInstagramComment(channel.access_token, comment.id, text.trim());
    }

    // Update comment
    db.prepare(`
      UPDATE comments 
      SET replied = 1, reply_text = ? 
      WHERE id = ?
    `).run(text.trim(), id);

    logActivity(
      channel.platform,
      'manual_reply',
      'success',
      `Manual reply sent to @${comment.author_name}: "${text.trim().slice(0, 40)}..."`
    );

    res.json({ success: true, message: 'Reply sent successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
