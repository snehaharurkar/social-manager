const express = require('express');
const router = express.Router();
const { db } = require('../db');

/**
 * Helper to compute SQL date range filter
 */
function getDateCondition(range, start, end, field = 'created_at') {
  if (range === 'custom' && start && end) {
    return {
      sql: `${field} >= datetime(?) AND ${field} <= datetime(? || ' 23:59:59')`,
      params: [start, end]
    };
  }

  let days = 30;
  if (range === '7d') days = 7;
  else if (range === '30d') days = 30;
  else if (range === '90d') days = 90;

  return {
    sql: `${field} >= datetime('now', '-${days} days')`,
    params: []
  };
}

// 1. GET /api/analytics/overview - Real database metrics with date range filter
router.get('/overview', (req, res) => {
  try {
    const { range = '30d', start, end } = req.query;
    const dateCond = getDateCondition(range, start, end, 'created_at');

    // Total comments & replies
    const commentsStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN replied = 1 THEN 1 ELSE 0 END) as replied
      FROM comments
      WHERE ${dateCond.sql}
    `).get(...dateCond.params);

    const totalComments = commentsStats?.total || 0;
    const repliedComments = commentsStats?.replied || 0;
    const responseRate = totalComments > 0 ? Math.round((repliedComments / totalComments) * 100) : 0;

    // Scheduled & Published posts breakdown
    const postCond = getDateCondition(range, start, end, 'scheduled_at');
    const postsStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM scheduled_posts
      WHERE ${postCond.sql}
    `).get(...postCond.params);

    const totalPosts = postsStats?.total || 0;
    const publishedPosts = postsStats?.published || 0;
    const pendingPosts = postsStats?.pending || 0;
    const failedPosts = postsStats?.failed || 0;

    // Automation executions & health
    const execsStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM automation_executions
      WHERE ${dateCond.sql}
    `).get(...dateCond.params);

    const totalExecs = execsStats?.total || 0;
    const successExecs = execsStats?.successful || 0;
    const failedExecs = execsStats?.failed || 0;
    const autoSuccessRate = totalExecs > 0 ? Math.round((successExecs / totalExecs) * 100) : (failedExecs === 0 ? 100 : 0);

    // Leads & Calling
    const callingStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN call_status IN ('completed', 'interested', 'needs_follow_up') THEN 1 ELSE 0 END) as completed,
        SUM(call_duration) as duration_secs
      FROM calling_leads
      WHERE ${dateCond.sql}
    `).get(...dateCond.params);

    const callingLeads = callingStats?.total || 0;
    const completedCalls = callingStats?.completed || 0;
    const callDurationMinutes = Math.round((callingStats?.duration_secs || 0) / 60);

    // Multi-channel message counts
    const waMessages = db.prepare(`SELECT COUNT(*) as c FROM whatsapp_messages WHERE ${dateCond.sql}`).get(...dateCond.params)?.c || 0;
    const igMessages = db.prepare(`SELECT COUNT(*) as c FROM instagram_messages WHERE ${dateCond.sql}`).get(...dateCond.params)?.c || 0;
    const tgMessages = db.prepare(`SELECT COUNT(*) as c FROM telegram_messages WHERE ${dateCond.sql}`).get(...dateCond.params)?.c || 0;

    // Channels
    const activeChannels = db.prepare("SELECT COUNT(*) as c FROM channels WHERE status = 'active'").get()?.c || 0;

    res.json({
      success: true,
      range,
      summary: {
        totalComments,
        repliedComments,
        responseRate,
        totalPosts,
        publishedPosts,
        pendingPosts,
        failedPosts,
        totalExecs,
        successExecs,
        failedExecs,
        autoSuccessRate,
        callingLeads,
        completedCalls,
        callDurationMinutes,
        waMessages,
        igMessages,
        tgMessages,
        activeChannels
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET /api/analytics/youtube - Platform analytics for YouTube
router.get('/youtube', (req, res) => {
  try {
    const { range = '30d', start, end } = req.query;
    const postCond = getDateCondition(range, start, end, 'scheduled_at');
    const commentCond = getDateCondition(range, start, end, 'created_at');

    const channels = db.prepare("SELECT * FROM channels WHERE platform = 'youtube'").all();
    const parsedChannels = channels.map(c => {
      let meta = {};
      try { meta = JSON.parse(c.meta || '{}'); } catch {}
      return {
        id: c.id,
        name: c.display_name,
        subscribers: meta.subscriberCount || 0,
        totalViews: meta.viewCount || 0,
        totalVideos: meta.videoCount || 0,
        avatar: c.avatar_url
      };
    });

    const postsStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM scheduled_posts
      WHERE platform = 'youtube' AND ${postCond.sql}
    `).get(...postCond.params);

    const commentsStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN replied = 1 THEN 1 ELSE 0 END) as replied
      FROM comments
      WHERE platform = 'youtube' AND ${commentCond.sql}
    `).get(...commentCond.params);

    const topVideos = db.prepare(`
      SELECT id, title, content, published_url, scheduled_at, status
      FROM scheduled_posts
      WHERE platform = 'youtube' AND status = 'published' AND ${postCond.sql}
      ORDER BY id DESC LIMIT 5
    `).all(...postCond.params);

    res.json({
      success: true,
      range,
      channels: parsedChannels,
      metrics: {
        totalPublished: postsStats?.published || 0,
        failedUploads: postsStats?.failed || 0,
        totalComments: commentsStats?.total || 0,
        repliedComments: commentsStats?.replied || 0,
        responseRate: (commentsStats?.total || 0) > 0 ? Math.round(((commentsStats?.replied || 0) / commentsStats.total) * 100) : 0
      },
      topVideos
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET /api/analytics/instagram - Platform analytics for Instagram
router.get('/instagram', (req, res) => {
  try {
    const { range = '30d', start, end } = req.query;
    const postCond = getDateCondition(range, start, end, 'scheduled_at');
    const msgCond = getDateCondition(range, start, end, 'created_at');

    const channels = db.prepare("SELECT * FROM channels WHERE platform = 'instagram'").all();
    const parsedChannels = channels.map(c => {
      let meta = {};
      try { meta = JSON.parse(c.meta || '{}'); } catch {}
      return {
        id: c.id,
        name: c.display_name,
        provider: meta.provider || 'meta_graph',
        followers: meta.followersCount || 'Available via Meta Business Suite',
        avatar: c.avatar_url
      };
    });

    const postsStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM scheduled_posts
      WHERE platform = 'instagram' AND ${postCond.sql}
    `).get(...postCond.params);

    const dmsStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound
      FROM instagram_messages
      WHERE ${msgCond.sql}
    `).get(...msgCond.params);

    const leadsCount = db.prepare(`SELECT COUNT(*) as c FROM instagram_leads WHERE ${msgCond.sql}`).get(...msgCond.params)?.c || 0;

    const recentPosts = db.prepare(`
      SELECT id, title, content, media_url, published_url, scheduled_at, status
      FROM scheduled_posts
      WHERE platform = 'instagram' AND status = 'published' AND ${postCond.sql}
      ORDER BY id DESC LIMIT 5
    `).all(...postCond.params);

    res.json({
      success: true,
      range,
      channels: parsedChannels,
      metrics: {
        totalPublished: postsStats?.published || 0,
        failedPosts: postsStats?.failed || 0,
        totalDMs: dmsStats?.total || 0,
        inboundDMs: dmsStats?.inbound || 0,
        outboundDMs: dmsStats?.outbound || 0,
        leadsCaptured: leadsCount
      },
      notice: 'Detailed account reach, story views, and follower growth require Meta Business Verification permissions.',
      recentPosts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. GET /api/analytics/telegram - Platform analytics for Telegram
router.get('/telegram', (req, res) => {
  try {
    const { range = '30d', start, end } = req.query;
    const postCond = getDateCondition(range, start, end, 'scheduled_at');
    const msgCond = getDateCondition(range, start, end, 'created_at');

    const channels = db.prepare("SELECT * FROM channels WHERE platform = 'telegram'").all();
    const parsedChannels = channels.map(c => ({
      id: c.id,
      name: c.display_name,
      channelId: c.platform_id,
      status: c.status
    }));

    const postsStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM scheduled_posts
      WHERE platform = 'telegram' AND ${postCond.sql}
    `).get(...postCond.params);

    const msgStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound
      FROM telegram_messages
      WHERE ${msgCond.sql}
    `).get(...msgCond.params);

    const leadsCount = db.prepare(`SELECT COUNT(*) as c FROM telegram_leads WHERE ${msgCond.sql}`).get(...msgCond.params)?.c || 0;

    res.json({
      success: true,
      range,
      channels: parsedChannels,
      metrics: {
        totalPublished: postsStats?.published || 0,
        failedPosts: postsStats?.failed || 0,
        totalMessages: msgStats?.total || 0,
        inboundMessages: msgStats?.inbound || 0,
        outboundMessages: msgStats?.outbound || 0,
        leadsCaptured: leadsCount
      },
      notice: 'Telegram Bot API does not expose subscriber impressions or view counts for standard bots.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. GET /api/analytics/unified - Comparative multi-platform dashboard
router.get('/unified', (req, res) => {
  try {
    const { range = '30d', start, end } = req.query;
    const postCond = getDateCondition(range, start, end, 'scheduled_at');
    const actCond = getDateCondition(range, start, end, 'created_at');

    // Platform publishing breakdown
    const platformBreakdown = db.prepare(`
      SELECT 
        platform,
        COUNT(*) as total_posts,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM scheduled_posts
      WHERE ${postCond.sql}
      GROUP BY platform
    `).all(...postCond.params);

    // Platform leads breakdown
    const leadsCalling = db.prepare(`SELECT COUNT(*) as c FROM calling_leads WHERE ${actCond.sql}`).get(...actCond.params)?.c || 0;
    const leadsWa = db.prepare(`SELECT COUNT(*) as c FROM whatsapp_contacts WHERE ${actCond.sql}`).get(...actCond.params)?.c || 0;
    const leadsIg = db.prepare(`SELECT COUNT(*) as c FROM instagram_leads WHERE ${actCond.sql}`).get(...actCond.params)?.c || 0;
    const leadsTg = db.prepare(`SELECT COUNT(*) as c FROM telegram_leads WHERE ${actCond.sql}`).get(...actCond.params)?.c || 0;

    // Platform comparison table
    const comparisonTable = [
      {
        platform: 'YouTube',
        publishedCount: platformBreakdown.find(p => p.platform === 'youtube')?.published || 0,
        failedCount: platformBreakdown.find(p => p.platform === 'youtube')?.failed || 0,
        leadsGenerated: 0, // YouTube leads flow via comments/descriptions
        interactionMetricName: 'Comments Received',
        interactionValue: db.prepare(`SELECT COUNT(*) as c FROM comments WHERE platform = 'youtube' AND ${actCond.sql}`).get(...actCond.params)?.c || 0
      },
      {
        platform: 'Instagram',
        publishedCount: platformBreakdown.find(p => p.platform === 'instagram')?.published || 0,
        failedCount: platformBreakdown.find(p => p.platform === 'instagram')?.failed || 0,
        leadsGenerated: leadsIg,
        interactionMetricName: 'DMs Exchanged',
        interactionValue: db.prepare(`SELECT COUNT(*) as c FROM instagram_messages WHERE ${actCond.sql}`).get(...actCond.params)?.c || 0
      },
      {
        platform: 'Telegram',
        publishedCount: platformBreakdown.find(p => p.platform === 'telegram')?.published || 0,
        failedCount: platformBreakdown.find(p => p.platform === 'telegram')?.failed || 0,
        leadsGenerated: leadsTg,
        interactionMetricName: 'Messages Exchanged',
        interactionValue: db.prepare(`SELECT COUNT(*) as c FROM telegram_messages WHERE ${actCond.sql}`).get(...actCond.params)?.c || 0
      },
      {
        platform: 'WhatsApp & Calling',
        publishedCount: 0,
        failedCount: 0,
        leadsGenerated: leadsWa + leadsCalling,
        interactionMetricName: 'Calls & Messages',
        interactionValue: db.prepare(`SELECT COUNT(*) as c FROM calling_leads WHERE ${actCond.sql}`).get(...actCond.params)?.c || 0
      }
    ];

    res.json({
      success: true,
      range,
      comparisonTable,
      totalContentPublished: comparisonTable.reduce((sum, item) => sum + item.publishedCount, 0),
      totalLeadsGenerated: comparisonTable.reduce((sum, item) => sum + item.leadsGenerated, 0),
      metricDefinitions: {
        youtubeViews: 'Total video views reported directly by YouTube Channel Statistics API.',
        instagramReach: 'Distinct accounts reached; requires Meta Business verification.',
        telegramActivity: 'Direct message interactions with the connected Telegram bot.'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. GET /api/analytics/timeseries - Daily timeline points
router.get('/timeseries', (req, res) => {
  try {
    const { range = '7d' } = req.query;
    let days = 7;
    if (range === '30d') days = 30;
    else if (range === '90d') days = 90;

    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const commentsCount = db.prepare(`
        SELECT COUNT(*) as c FROM comments WHERE DATE(created_at) = ?
      `).get(dateStr)?.c || 0;

      const postsCount = db.prepare(`
        SELECT COUNT(*) as c FROM scheduled_posts WHERE DATE(created_at) = ?
      `).get(dateStr)?.c || 0;

      const activityCount = db.prepare(`
        SELECT COUNT(*) as c FROM activity_logs WHERE DATE(created_at) = ?
      `).get(dateStr)?.c || 0;

      const callsCount = db.prepare(`
        SELECT COUNT(*) as c FROM calling_leads WHERE DATE(created_at) = ?
      `).get(dateStr)?.c || 0;

      result.push({
        date: dateStr,
        label: d.toLocaleDateString('en-US', { weekday: days <= 7 ? 'short' : undefined, month: 'short', day: 'numeric' }),
        comments: commentsCount,
        posts: postsCount,
        activity: activityCount,
        leads: callsCount
      });
    }

    res.json({ success: true, range, timeseries: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
