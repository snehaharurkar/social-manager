const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { db, getSetting, setSetting, getAllSettings, logActivity } = require('../db');

const dataDir = path.join(__dirname, '..', '..', 'data');
const backupsDir = path.join(dataDir, 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

// Get all settings (masked)
router.get('/', (req, res) => {
  try {
    const raw = getAllSettings();
    const safe = {
      GOOGLE_CLIENT_ID: raw.GOOGLE_CLIENT_ID || '',
      GOOGLE_CLIENT_SECRET: raw.GOOGLE_CLIENT_SECRET ? '••••••••••••••••' : '',
      META_APP_ID: raw.META_APP_ID || '',
      META_APP_SECRET: raw.META_APP_SECRET ? '••••••••••••••••' : '',
      GEMINI_API_KEY: raw.GEMINI_API_KEY ? '••••••••••••••••' : '',
      OPENAI_API_KEY: raw.OPENAI_API_KEY ? '••••••••••••••••' : '',
      AI_BASE_URL: raw.AI_BASE_URL || 'https://api.openai.com/v1',
      AI_MODEL: raw.AI_MODEL || 'gpt-4o-mini',
      CLIENT_APP_URL: raw.CLIENT_APP_URL || 'http://localhost:3000'
    };

    res.json({ success: true, settings: safe });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update settings
router.post('/', (req, res) => {
  try {
    const updates = req.body || {};

    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined && val !== null) {
        // Skip if value is masked placeholder
        if (typeof val === 'string' && val.includes('••••')) {
          continue;
        }
        setSetting(key, String(val).trim());
      }
    }

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dashboard stats endpoint
router.get('/stats', (req, res) => {
  try {
    const activeChannels = db.prepare("SELECT count(*) as count FROM channels WHERE status = 'active'").get().count;
    const activeRules = db.prepare("SELECT count(*) as count FROM rules WHERE is_active = 1").get().count;
    const totalReplies = db.prepare("SELECT count(*) as count FROM comments WHERE replied = 1").get().count;
    const pendingScheduled = db.prepare("SELECT count(*) as count FROM scheduled_posts WHERE status = 'pending'").get().count;
    const totalComments = db.prepare("SELECT count(*) as count FROM comments").get().count;

    const recentLogs = db.prepare(`
      SELECT * FROM activity_logs 
      ORDER BY created_at DESC 
      LIMIT 15
    `).all();

    res.json({
      success: true,
      stats: {
        activeChannels,
        activeRules,
        totalReplies,
        pendingScheduled,
        totalComments
      },
      recentLogs
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1. Create a Snapshot Backup
router.post('/backup', (req, res) => {
  try {
    const dbPath = path.join(dataDir, 'app.db');
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ success: false, error: 'Source database file not found' });
    }

    // Flush WAL to main DB file before taking copy
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${timestamp}.db`;
    const targetPath = path.join(backupsDir, backupFileName);

    fs.copyFileSync(dbPath, targetPath);
    const stats = fs.statSync(targetPath);

    logActivity('system', 'backup_created', 'success', `Created snapshot backup ${backupFileName} (${(stats.size / 1024).toFixed(1)} KB)`);

    res.json({
      success: true,
      backupFile: backupFileName,
      size: stats.size,
      path: targetPath,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error creating database backup:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. List all existing backups
router.get('/backups', (req, res) => {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.db'))
      .map(name => {
        const full = path.join(backupsDir, name);
        const st = fs.statSync(full);
        return {
          filename: name,
          size: st.size,
          createdAt: st.mtime
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, backups: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Verify Backup Integrity
router.post('/backup/verify', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Backup filename is required' });
    }

    const cleanName = path.basename(filename);
    const targetPath = path.join(backupsDir, cleanName);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ success: false, error: 'Backup file does not exist' });
    }

    const testDb = new DatabaseSync(targetPath);
    const integrity = testDb.prepare('PRAGMA integrity_check;').all();
    const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table';").all().map(t => t.name);
    testDb.close();

    const isOk = integrity.length === 1 && integrity[0].integrity_check === 'ok';

    res.json({
      success: true,
      filename: cleanName,
      integrity: isOk ? 'ok' : 'corrupted',
      tableCount: tables.length,
      tables
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
