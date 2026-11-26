const express = require('express');
const router = express.Router();
const { db, getSetting, logActivity } = require('../db');
const { getYouTubeAuthUrl, exchangeYouTubeCode, getYouTubeChannelInfo } = require('../services/youtube');
const { getInstagramAuthUrl, exchangeInstagramCode } = require('../services/instagram');

// YouTube OAuth entrypoint
router.get('/youtube', (req, res) => {
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/youtube/callback`;
    const url = getYouTubeAuthUrl(redirectUri, 'yt_auth');
    res.redirect(url);
  } catch (err) {
    res.status(400).send(`YouTube OAuth Error: ${err.message}. Please configure GOOGLE_CLIENT_ID in Settings.`);
  }
});

// YouTube OAuth Callback
router.get('/youtube/callback', async (req, res) => {
  const { code, error } = req.query;
  const clientAppUrl = getSetting('CLIENT_APP_URL') || 'http://localhost:5000';

  if (error) {
    return res.redirect(`${clientAppUrl}/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${clientAppUrl}/?error=no_code_provided`);
  }

  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/youtube/callback`;
    const tokens = await exchangeYouTubeCode(code, redirectUri);
    const channelInfo = await getYouTubeChannelInfo(tokens.accessToken);

    // Insert or update channel in DB
    const channelId = `yt_${channelInfo.channelId}`;
    db.prepare(`
      INSERT INTO channels (
        id, platform, platform_id, display_name, username, avatar_url, 
        access_token, refresh_token, token_expires_at, metadata, status, updated_at
      ) VALUES (?, 'youtube', ?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        username = excluded.username,
        avatar_url = excluded.avatar_url,
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, channels.refresh_token),
        token_expires_at = excluded.token_expires_at,
        metadata = excluded.metadata,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
    `).run(
      channelId,
      channelInfo.channelId,
      channelInfo.title,
      channelInfo.customUrl,
      channelInfo.avatarUrl,
      tokens.accessToken,
      tokens.refreshToken || null,
      tokens.expiresAt,
      JSON.stringify(channelInfo)
    );

    logActivity('youtube', 'channel_connect', 'success', `Connected YouTube channel "${channelInfo.title}"`);
    res.redirect(`${clientAppUrl}/channels?connected=youtube&name=${encodeURIComponent(channelInfo.title)}`);
  } catch (err) {
    console.error('[YouTube OAuth Callback Error]:', err);
    res.redirect(`${clientAppUrl}/channels?error=${encodeURIComponent(err.message)}`);
  }
});

// Instagram OAuth entrypoint
router.get('/instagram', (req, res) => {
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/instagram/callback`;
    const url = getInstagramAuthUrl(redirectUri, 'ig_auth');
    res.redirect(url);
  } catch (err) {
    res.status(400).send(`Instagram OAuth Error: ${err.message}. Please configure META_APP_ID in Settings.`);
  }
});

// Instagram OAuth Callback
router.get('/instagram/callback', async (req, res) => {
  const { code, error, error_description } = req.query;
  const clientAppUrl = getSetting('CLIENT_APP_URL') || 'http://localhost:5000';

  if (error) {
    return res.redirect(`${clientAppUrl}/channels?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.redirect(`${clientAppUrl}/channels?error=no_code_provided`);
  }

  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/instagram/callback`;
    const { accessToken, expiresAt, accounts } = await exchangeInstagramCode(code, redirectUri);

    if (accounts.length === 0) {
      return res.redirect(`${clientAppUrl}/channels?error=${encodeURIComponent('No Instagram Business/Creator account found linked to your Facebook account')}`);
    }

    for (const acc of accounts) {
      const channelId = `ig_${acc.igUserId}`;
      db.prepare(`
        INSERT INTO channels (
          id, platform, platform_id, display_name, username, avatar_url,
          access_token, token_expires_at, metadata, status, updated_at
        ) VALUES (?, 'instagram', ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          display_name = excluded.display_name,
          username = excluded.username,
          avatar_url = excluded.avatar_url,
          access_token = excluded.access_token,
          token_expires_at = excluded.token_expires_at,
          metadata = excluded.metadata,
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
      `).run(
        channelId,
        acc.igUserId,
        acc.name,
        `@${acc.username}`,
        acc.avatarUrl,
        acc.pageAccessToken || accessToken,
        expiresAt,
        JSON.stringify(acc)
      );

      logActivity('instagram', 'channel_connect', 'success', `Connected Instagram account @${acc.username}`);
    }

    res.redirect(`${clientAppUrl}/channels?connected=instagram&count=${accounts.length}`);
  } catch (err) {
    console.error('[Instagram OAuth Callback Error]:', err);
    res.redirect(`${clientAppUrl}/channels?error=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
