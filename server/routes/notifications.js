const express = require('express');
const router = express.Router();
const { db, createNotification } = require('../db');

// 1. GET /api/notifications - List notifications with filters & unread counter
router.get('/', (req, res) => {
  try {
    const { category, is_read, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM notifications';
    const conditions = [];
    const params = [];

    if (category && category !== 'all') {
      conditions.push('category = ?');
      params.push(category);
    }

    if (is_read !== undefined && is_read !== '') {
      conditions.push('is_read = ?');
      params.push(is_read === 'true' || is_read === '1' ? 1 : 0);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const notifications = db.prepare(query).all(...params);

    // Unread count
    const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get()?.count || 0;
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM notifications').get()?.count || 0;

    res.json({
      success: true,
      notifications,
      unreadCount,
      totalCount
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. PATCH /api/notifications/:id/read - Toggle or set read status
router.patch('/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    const { is_read = 1 } = req.body;

    db.prepare('UPDATE notifications SET is_read = ? WHERE id = ?')
      .run(Number(is_read) ? 1 : 0, Number(id));

    const updated = db.prepare('SELECT * FROM notifications WHERE id = ?').get(Number(id));
    const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get()?.count || 0;

    res.json({ success: true, notification: updated, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/notifications/mark-all-read - Mark all notifications as read
router.post('/mark-all-read', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
    res.json({ success: true, message: 'All notifications marked as read', unreadCount: 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. DELETE /api/notifications/:id - Delete single notification
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM notifications WHERE id = ?').run(Number(id));
    const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get()?.count || 0;
    res.json({ success: true, message: 'Notification deleted', unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. DELETE /api/notifications - Clear all or only read notifications
router.delete('/', (req, res) => {
  try {
    const { only_read } = req.query;
    if (only_read === 'true' || only_read === '1') {
      db.prepare('DELETE FROM notifications WHERE is_read = 1').run();
    } else {
      db.prepare('DELETE FROM notifications').run();
    }
    const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get()?.count || 0;
    res.json({ success: true, message: 'Notifications cleared', unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. POST /api/notifications/test - Trigger a simulated test notification
router.post('/test', (req, res) => {
  try {
    const { title = 'Test In-App Notification', message = 'This is a live test notification generated inside SocialManager.', category = 'system', level = 'info', linkTab = 'overview' } = req.body;
    const notifId = createNotification(title, message, category, level, linkTab);
    res.json({ success: true, id: notifId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
