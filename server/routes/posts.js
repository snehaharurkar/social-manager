const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { db, logActivity } = require('../db');
const { publishInstagramPost } = require('../services/instagram');
const { uploadYouTubeVideo, refreshYouTubeAccessToken } = require('../services/youtube');
const { publishPostViaUplika } = require('../services/uplika');
const { publishToTelegram } = require('../services/telegram');

// List all posts
router.get('/', (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT p.*, c.display_name as channel_name, c.avatar_url as channel_avatar
      FROM scheduled_posts p
      LEFT JOIN channels c ON p.channel_id = c.id
      ORDER BY p.scheduled_at DESC
    `).all();

    res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Schedule a new post
router.post('/', (req, res) => {
  try {
    const { platform, channel_id, title, content, media_url, scheduled_at, privacy_status, media_type } = req.body;

    if (!channel_id || !content || !scheduled_at) {
      return res.status(400).json({
        success: false,
        error: 'Channel, content, and scheduled date/time are required.'
      });
    }

    const channel = db.prepare('SELECT platform, display_name FROM channels WHERE id = ?').get(channel_id);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Selected channel not found' });
    }

    const targetPlatform = platform || channel.platform;

    // Validate Instagram media requirement
    if (targetPlatform === 'instagram' && !media_url) {
      return res.status(400).json({
        success: false,
        error: 'Instagram posts require an image file or URL (media_url).'
      });
    }

    // Validate YouTube video requirement
    if (targetPlatform === 'youtube' && !media_url) {
      return res.status(400).json({
        success: false,
        error: 'YouTube posts require an uploaded video file.'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO scheduled_posts (
        platform, channel_id, title, content, media_url, privacy_status, media_type, scheduled_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(?), 'pending')
    `);

    const result = stmt.run(
      targetPlatform,
      channel_id,
      title ? title.trim() : (targetPlatform === 'youtube' ? 'Untitled Video' : null),
      content.trim(),
      media_url ? media_url.trim() : null,
      privacy_status || 'public',
      media_type || (targetPlatform === 'youtube' ? 'video' : 'image'),
      scheduled_at
    );

    logActivity(
      targetPlatform,
      'post_scheduled',
      'success',
      `Scheduled ${targetPlatform} post for ${new Date(scheduled_at).toLocaleString()} on ${channel.display_name}`
    );

    res.json({ success: true, postId: Number(result.lastInsertRowid) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete or cancel a scheduled post
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM scheduled_posts WHERE id = ?').run(id);
    res.json({ success: true, message: 'Scheduled post removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Publish now on demand
router.post('/:id/publish-now', async (req, res) => {
  try {
    const { id } = req.params;
    const post = db.prepare('SELECT * FROM scheduled_posts WHERE id = ?').get(id);

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(post.channel_id);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    let publishedUrl = null;

    if (channel.platform === 'instagram') {
      let meta = {};
      try { meta = JSON.parse(channel.metadata || '{}'); } catch {}

      if (meta.provider === 'uplika') {
        const result = await publishPostViaUplika(channel.access_token, {
          caption: post.content,
          mediaUrl: post.media_url
        });
        publishedUrl = result.postUrl;
      } else {
        await publishInstagramPost(channel.access_token, channel.platform_id, post.media_url, post.content);
      }
    } else if (channel.platform === 'youtube') {
      if (!post.media_url) {
        throw new Error('YouTube upload requires a video file. Please upload a video file first.');
      }

      let filePath = post.media_url;
      if (filePath.startsWith('/uploads/')) {
        filePath = path.join(__dirname, '../../uploads', filePath.replace('/uploads/', ''));
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(`Video file not found at: ${filePath}`);
      }

      let accessToken = channel.access_token;
      if (channel.refresh_token && channel.token_expires_at && Date.now() > (channel.token_expires_at - 60000)) {
        const refreshed = await refreshYouTubeAccessToken(channel.refresh_token);
        accessToken = refreshed.accessToken;
        db.prepare('UPDATE channels SET access_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(refreshed.accessToken, refreshed.expiresAt, channel.id);
      }

      const uploadResult = await uploadYouTubeVideo(accessToken, filePath, {
        title: post.title || 'New Video Upload',
        description: post.content || '',
        privacyStatus: post.privacy_status || 'public'
      });

      publishedUrl = uploadResult.videoUrl;
    } else if (channel.platform === 'telegram') {
      const result = await publishToTelegram(channel.platform_id, {
        title: post.title,
        content: post.content,
        mediaUrl: post.media_url,
        mediaType: post.media_type
      }, channel.access_token);
      publishedUrl = result.postUrl;
    }

    db.prepare(`
      UPDATE scheduled_posts 
      SET status = 'published', published_at = CURRENT_TIMESTAMP, published_url = ? 
      WHERE id = ?
    `).run(publishedUrl, id);

    logActivity(
      channel.platform, 
      'scheduled_publish', 
      'success', 
      `Published "${post.title || post.content.slice(0, 30)}"${publishedUrl ? ` [${publishedUrl}]` : ''}`
    );

    res.json({ success: true, message: 'Published successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
