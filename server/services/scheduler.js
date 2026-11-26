const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { db, logActivity } = require('../db');
const { getChannelComments, replyToYouTubeComment, refreshYouTubeAccessToken, uploadYouTubeVideo } = require('./youtube');
const { getInstagramMedia, getInstagramComments, replyToInstagramComment, publishInstagramPost } = require('./instagram');
const { publishPostViaUplika } = require('./uplika');
const { publishToTelegram } = require('./telegram');
const { polishReplyWithAi } = require('./ai');

/**
 * Check if a comment matches a given rule
 */
function matchRule(commentText, rule) {
  if (!rule.is_active) return false;

  const text = (commentText || '').trim().toLowerCase();
  const keywords = (rule.keywords || '')
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);

  if (keywords.length === 0) return false;

  switch (rule.trigger_type) {
    case 'exact':
      return keywords.some(k => text === k);
    case 'starts_with':
      return keywords.some(k => text.startsWith(k));
    case 'regex':
      return keywords.some(k => {
        try {
          return new RegExp(k, 'i').test(text);
        } catch {
          return false;
        }
      });
    case 'contains':
    default:
      return keywords.some(k => text.includes(k));
  }
}

/**
 * Process a single incoming comment against active rules
 */
async function processComment(comment, channel) {
  // Check if already replied
  if (comment.replied) return false;

  // Fetch active rules for this platform or 'all'
  const rules = db.prepare(`
    SELECT * FROM rules 
    WHERE is_active = 1 AND (platform = 'all' OR platform = ?)
    ORDER BY id ASC
  `).all(channel.platform);

  for (const rule of rules) {
    if (matchRule(comment.text, rule)) {
      // Personalize placeholder {name}
      let reply = rule.reply_template.replace(/\{name\}/gi, comment.author_name || 'friend');

      // AI polish if enabled
      if (rule.use_ai_polish) {
        reply = await polishReplyWithAi(reply, comment.text, rule.ai_prompt);
      }

      try {
        // Send reply to platform
        if (channel.platform === 'youtube') {
          await replyToYouTubeComment(channel.access_token, comment.id, reply);
        } else if (channel.platform === 'instagram') {
          await replyToInstagramComment(channel.access_token, comment.id, reply);
        }

        // Update comment record
        db.prepare(`
          UPDATE comments 
          SET replied = 1, reply_text = ? 
          WHERE id = ?
        `).run(reply, comment.id);

        // Increment rule match count
        db.prepare('UPDATE rules SET match_count = match_count + 1 WHERE id = ?').run(rule.id);

        logActivity(
          channel.platform,
          'comment_reply',
          'success',
          `Replied to @${comment.author_name}: "${reply.slice(0, 50)}..." [Rule: ${rule.name}]`
        );

        return true;
      } catch (err) {
        console.error(`[AutoReply Error] ${channel.platform}:`, err.message);
        logActivity(channel.platform, 'comment_reply', 'failed', `Failed replying to @${comment.author_name}: ${err.message}`);
      }
    }
  }

  return false;
}

/**
 * Poll YouTube comments for a channel
 */
async function pollYouTubeChannel(channel) {
  try {
    let accessToken = channel.access_token;

    // Check if token needs refresh
    if (channel.refresh_token && channel.token_expires_at && Date.now() > (channel.token_expires_at - 60000)) {
      const refreshed = await refreshYouTubeAccessToken(channel.refresh_token);
      accessToken = refreshed.accessToken;
      db.prepare(`
        UPDATE channels 
        SET access_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(refreshed.accessToken, refreshed.expiresAt, channel.id);
    }

    const comments = await getChannelComments(accessToken, channel.platform_id, 20);

    for (const c of comments) {
      // Check if already exists in DB
      const existing = db.prepare('SELECT id, replied FROM comments WHERE id = ?').get(c.commentId);

      if (!existing) {
        db.prepare(`
          INSERT INTO comments (id, platform, channel_id, video_or_post_id, post_title, author_name, author_avatar, text, published_at)
          VALUES (?, 'youtube', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          c.commentId,
          channel.id,
          c.videoId || '',
          c.postTitle || '',
          c.authorName,
          c.authorAvatar || '',
          c.text,
          c.publishedAt
        );

        // Attempt immediate rule auto-reply
        const freshComment = {
          id: c.commentId,
          text: c.text,
          author_name: c.authorName,
          replied: 0
        };
        await processComment(freshComment, { ...channel, access_token: accessToken });
      }
    }
  } catch (err) {
    console.error(`[Poll YouTube] Error for channel ${channel.display_name}:`, err.message);
  }
}

/**
 * Check and publish scheduled posts
 */
async function processScheduledPosts() {
  const pendingPosts = db.prepare(`
    SELECT * FROM scheduled_posts 
    WHERE status = 'pending' AND datetime(scheduled_at) <= datetime('now', 'localtime')
  `).all();

  for (const post of pendingPosts) {
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(post.channel_id);

    if (!channel) {
      db.prepare("UPDATE scheduled_posts SET status = 'failed', error_message = 'Channel not found' WHERE id = ?").run(post.id);
      continue;
    }

    try {
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
            throw new Error('Instagram posts require an image URL (media_url)');
          }
          await publishInstagramPost(channel.access_token, channel.platform_id, post.media_url, post.content);
        }
      } else if (channel.platform === 'youtube') {
        if (!post.media_url) {
          throw new Error('YouTube posts require an uploaded video file');
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
      `).run(publishedUrl, post.id);

      logActivity(
        channel.platform, 
        'scheduled_publish', 
        'success', 
        `Published scheduled post "${post.title || post.content.slice(0, 30)}"${publishedUrl ? ` [${publishedUrl}]` : ''} to ${channel.display_name}`
      );
    } catch (err) {
      console.error(`[Scheduled Publish Failed]:`, err.message);
      db.prepare(`
        UPDATE scheduled_posts 
        SET status = 'failed', error_message = ? 
        WHERE id = ?
      `).run(err.message, post.id);

      logActivity(channel.platform, 'scheduled_publish', 'failed', `Failed to publish post: ${err.message}`);
    }
  }
}

/**
 * Master Sync: Polls all channels and processes scheduled posts
 */
async function runFullSync() {
  console.log('[Scheduler] Running sync check...');

  // 1. Process scheduled posts
  await processScheduledPosts();

  // 2. Poll channels for new comments
  const channels = db.prepare("SELECT * FROM channels WHERE status = 'active'").all();
  for (const ch of channels) {
    if (ch.platform === 'youtube') {
      await pollYouTubeChannel(ch);
    }
  }
}

// Start cron job running every 60 seconds
let isRunning = false;
function startScheduler() {
  cron.schedule('* * * * *', async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await runFullSync();
    } catch (err) {
      console.error('[Scheduler] Sync error:', err);
    } finally {
      isRunning = false;
    }
  });

  console.log('[Scheduler] Background worker initialized (runs every 60s)');
}

module.exports = {
  startScheduler,
  runFullSync,
  processComment,
  matchRule
};
