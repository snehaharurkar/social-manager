const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { db, logActivity, createNotification } = require('../db');
const { publishInstagramPost } = require('../services/instagram');
const { uploadYouTubeVideo, refreshYouTubeAccessToken } = require('../services/youtube');
const { publishPostViaUplika } = require('../services/uplika');
const { publishToTelegram } = require('../services/telegram');

/**
 * Helper: Publish a single post record to its designated channel
 */
async function publishSinglePost(post, channel) {
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
      if (!post.media_url) {
        throw new Error('Instagram posts require an image or video URL.');
      }
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

  // Update DB to published
  db.prepare(`
    UPDATE scheduled_posts 
    SET status = 'published', published_at = CURRENT_TIMESTAMP, published_url = ?, error_message = NULL 
    WHERE id = ?
  `).run(publishedUrl, post.id);

  logActivity(
    channel.platform, 
    'post_published', 
    'success', 
    `Published "${post.title || post.content.slice(0, 30)}"${publishedUrl ? ` [${publishedUrl}]` : ''} on ${channel.display_name}`
  );

  createNotification(
    `Post Published to ${channel.platform.toUpperCase()}`,
    `"${post.title || post.content.slice(0, 40)}..." was successfully published on ${channel.display_name}.`,
    'publishing',
    'success',
    'scheduler',
    post.id
  );

  return { success: true, publishedUrl };
}

// 1. List all posts (with optional batch filter)
router.get('/', (req, res) => {
  try {
    const { batch_id } = req.query;
    let query = `
      SELECT p.*, c.display_name as channel_name, c.avatar_url as channel_avatar
      FROM scheduled_posts p
      LEFT JOIN channels c ON p.channel_id = c.id
    `;
    const params = [];

    if (batch_id) {
      query += ' WHERE p.batch_id = ?';
      params.push(batch_id);
    }

    query += ' ORDER BY p.scheduled_at DESC';

    const posts = db.prepare(query).all(...params);
    res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Schedule a single post (existing endpoint preserved)
router.post('/', (req, res) => {
  try {
    const { platform, channel_id, title, content, media_url, scheduled_at, privacy_status, media_type, is_draft } = req.body;

    if (!channel_id || !content || (!scheduled_at && !is_draft)) {
      return res.status(400).json({
        success: false,
        error: 'Channel, content, and scheduled date/time (or draft flag) are required.'
      });
    }

    const channel = db.prepare('SELECT platform, display_name FROM channels WHERE id = ?').get(channel_id);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Selected channel not found' });
    }

    const targetPlatform = platform || channel.platform;

    // Validate Instagram media requirement
    if (targetPlatform === 'instagram' && !media_url && !is_draft) {
      return res.status(400).json({
        success: false,
        error: 'Instagram posts require an image file or URL (media_url).'
      });
    }

    // Validate YouTube video requirement
    if (targetPlatform === 'youtube' && !media_url && !is_draft) {
      return res.status(400).json({
        success: false,
        error: 'YouTube posts require an uploaded video file.'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO scheduled_posts (
        platform, channel_id, title, content, media_url, privacy_status, media_type, scheduled_at, status, is_draft
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(?), ?, ?)
    `);

    const result = stmt.run(
      targetPlatform,
      channel_id,
      title ? title.trim() : (targetPlatform === 'youtube' ? 'Untitled Video' : null),
      content.trim(),
      media_url ? media_url.trim() : null,
      privacy_status || 'public',
      media_type || (targetPlatform === 'youtube' ? 'video' : 'image'),
      scheduled_at || new Date().toISOString(),
      is_draft ? 'draft' : 'pending',
      is_draft ? 1 : 0
    );

    const postId = Number(result.lastInsertRowid);

    if (!is_draft) {
      createNotification(
        `Post Scheduled (${targetPlatform.toUpperCase()})`,
        `Scheduled for ${new Date(scheduled_at).toLocaleString()} on ${channel.display_name}`,
        'scheduler',
        'info',
        'scheduler',
        postId
      );
    }

    res.json({ success: true, postId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. MULTI-PLATFORM PUBLISHING — Upload once, publish/schedule to multiple platforms
router.post('/multi', async (req, res) => {
  try {
    const { 
      channel_ids, 
      title, 
      content, 
      media_url, 
      media_type, 
      scheduled_at, 
      privacy_status, 
      action = 'schedule', // 'publish_now' | 'schedule'
      is_draft = false
    } = req.body;

    if (!channel_ids || !Array.isArray(channel_ids) || channel_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Please select at least one connected channel to publish.' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Post caption or description is required.' });
    }

    if (action === 'schedule' && !scheduled_at && !is_draft) {
      return res.status(400).json({ success: false, error: 'A scheduled date and time is required to schedule posts.' });
    }

    // Sanitize and fetch all selected channels matching by id, platform_id, or username
    const cleanIds = channel_ids
      .map(id => String(id || '').trim())
      .filter(id => id && id !== 'null' && id !== 'undefined' && id !== 'NaN');

    if (cleanIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Please select at least one valid connected channel to publish.' });
    }

    const placeholders = cleanIds.map(() => '?').join(',');
    const channels = db.prepare(`
      SELECT * FROM channels 
      WHERE id IN (${placeholders}) 
         OR platform_id IN (${placeholders})
         OR username IN (${placeholders})
    `).all(...cleanIds, ...cleanIds, ...cleanIds);

    if (channels.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `None of the selected channels (${cleanIds.join(', ')}) were found in the connected accounts database.` 
      });
    }

    // Pre-validate media requirements per platform
    const validationErrors = [];
    for (const ch of channels) {
      if (ch.platform === 'youtube' && (!media_url || media_type !== 'video')) {
        validationErrors.push(`YouTube channel "${ch.display_name}" requires an uploaded video file.`);
      }
      if (ch.platform === 'instagram' && !media_url) {
        validationErrors.push(`Instagram channel "${ch.display_name}" requires an image or video file.`);
      }
      if (ch.platform === 'telegram') {
        const targetChatId = ch.platform_id || getSetting('TELEGRAM_CHANNEL_ID');
        if (!targetChatId) {
          validationErrors.push(`Telegram account "${ch.display_name}" is missing a target channel ID. Please verify your channel in Telegram & Leads settings.`);
        }
      }
    }

    if (validationErrors.length > 0 && !is_draft) {
      return res.status(400).json({
        success: false,
        error: 'Media validation failed for some selected platforms',
        details: validationErrors
      });
    }

    // Generate shared batch ID
    const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    // Create a scheduled_posts row for each channel
    const insertStmt = db.prepare(`
      INSERT INTO scheduled_posts (
        platform, channel_id, title, content, media_url, privacy_status, media_type, scheduled_at, status, is_draft, batch_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(?), ?, ?, ?)
    `);

    const createdPosts = [];
    for (const ch of channels) {
      const postTitle = title ? title.trim() : (ch.platform === 'youtube' ? 'Untitled Video' : null);
      const postScheduledAt = scheduled_at || new Date().toISOString();
      const initialStatus = is_draft ? 'draft' : (action === 'publish_now' ? 'publishing' : 'pending');

      const result = insertStmt.run(
        ch.platform,
        ch.id,
        postTitle,
        content.trim(),
        media_url ? media_url.trim() : null,
        privacy_status || 'public',
        media_type || (media_url ? (ch.platform === 'youtube' ? 'video' : 'image') : 'text'),
        postScheduledAt,
        initialStatus,
        is_draft ? 1 : 0,
        batchId
      );

      const postId = Number(result.lastInsertRowid);
      const postRow = db.prepare('SELECT * FROM scheduled_posts WHERE id = ?').get(postId);
      createdPosts.push({ post: postRow, channel: ch });
    }

    // If action is schedule or draft, return immediately
    if (action === 'schedule' || is_draft) {
      createNotification(
        `Multi-Platform Post ${is_draft ? 'Drafted' : 'Scheduled'}`,
        `Content queued for ${channels.length} platform(s) (${channels.map(c => c.platform.toUpperCase()).join(', ')}).`,
        'scheduler',
        'info',
        'scheduler',
        batchId
      );

      return res.json({
        success: true,
        batchId,
        action,
        totalCreated: createdPosts.length,
        posts: createdPosts.map(p => ({
          id: p.post.id,
          platform: p.channel.platform,
          channel_name: p.channel.display_name,
          status: p.post.status
        }))
      });
    }

    // Action is publish_now: Dispatch to each platform independently
    const results = await Promise.allSettled(
      createdPosts.map(async ({ post, channel }) => {
        try {
          const resPub = await publishSinglePost(post, channel);
          return {
            id: post.id,
            platform: channel.platform,
            channel_name: channel.display_name,
            channel_id: channel.id,
            status: 'published',
            published_url: resPub.publishedUrl
          };
        } catch (err) {
          // Record failure in DB without affecting other platforms
          db.prepare(`
            UPDATE scheduled_posts 
            SET status = 'failed', error_message = ? 
            WHERE id = ?
          `).run(err.message, post.id);

          logActivity(channel.platform, 'post_published', 'failed', `Publish failed on ${channel.display_name}: ${err.message}`);

          createNotification(
            `Publishing Failed on ${channel.platform.toUpperCase()}`,
            `"${post.title || post.content.slice(0, 30)}": ${err.message}`,
            'publishing',
            'error',
            'scheduler',
            post.id
          );

          return {
            id: post.id,
            platform: channel.platform,
            channel_name: channel.display_name,
            channel_id: channel.id,
            status: 'failed',
            error: err.message
          };
        }
      })
    );

    const formattedResults = results.map(r => r.value);
    const successCount = formattedResults.filter(r => r.status === 'published').length;
    const failCount = formattedResults.filter(r => r.status === 'failed').length;

    createNotification(
      `Multi-Platform Publishing Finished`,
      `Published to ${successCount}/${formattedResults.length} platform(s). ${failCount > 0 ? `${failCount} platform(s) failed.` : 'All platforms succeeded!'}`,
      'publishing',
      failCount === 0 ? 'success' : (successCount > 0 ? 'warning' : 'error'),
      'scheduler',
      batchId
    );

    res.json({
      success: true,
      batchId,
      action: 'publish_now',
      summary: {
        total: formattedResults.length,
        successful: successCount,
        failed: failCount
      },
      results: formattedResults
    });
  } catch (err) {
    console.error('Multi-platform publish error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. RETRY FAILED PLATFORMS IN A MULTI-PLATFORM BATCH (without republishing successful ones)
router.post('/retry-batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const failedPosts = db.prepare(`
      SELECT p.*, c.platform, c.display_name 
      FROM scheduled_posts p
      JOIN channels c ON p.channel_id = c.id
      WHERE p.batch_id = ? AND p.status = 'failed'
    `).all(batchId);

    if (failedPosts.length === 0) {
      return res.json({ success: true, message: 'No failed posts found in this batch to retry.' });
    }

    const retryResults = [];
    for (const post of failedPosts) {
      const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(post.channel_id);
      try {
        db.prepare('UPDATE scheduled_posts SET retry_count = COALESCE(retry_count, 0) + 1 WHERE id = ?').run(post.id);
        const pubRes = await publishSinglePost(post, channel);
        retryResults.push({
          id: post.id,
          platform: channel.platform,
          channel_name: channel.display_name,
          status: 'published',
          published_url: pubRes.publishedUrl
        });
      } catch (err) {
        db.prepare("UPDATE scheduled_posts SET status = 'failed', error_message = ? WHERE id = ?").run(err.message, post.id);
        retryResults.push({
          id: post.id,
          platform: channel.platform,
          channel_name: channel.display_name,
          status: 'failed',
          error: err.message
        });
      }
    }

    const successCount = retryResults.filter(r => r.status === 'published').length;
    res.json({
      success: true,
      batchId,
      retried: retryResults.length,
      successCount,
      results: retryResults
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Publish single post on demand
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

    try {
      const pubRes = await publishSinglePost(post, channel);
      res.json({ success: true, message: 'Published successfully', publishedUrl: pubRes.publishedUrl });
    } catch (err) {
      db.prepare("UPDATE scheduled_posts SET status = 'failed', error_message = ? WHERE id = ?").run(err.message, id);
      createNotification(
        `Publishing Failed on ${channel.platform.toUpperCase()}`,
        `"${post.title || post.content.slice(0, 30)}": ${err.message}`,
        'publishing',
        'error',
        'scheduler',
        id
      );
      res.status(500).json({ success: false, error: err.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Delete or cancel a scheduled post
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM scheduled_posts WHERE id = ?').run(id);
    res.json({ success: true, message: 'Scheduled post removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
