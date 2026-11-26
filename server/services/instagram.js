const { getSetting } = require('../db');

/**
 * Instagram API Service
 * Handles OAuth, fetching IG business accounts, fetching media, comments, replying and publishing
 */

// Generate OAuth URL for Instagram / Facebook Login
function getInstagramAuthUrl(redirectUri, state) {
  const appId = getSetting('META_APP_ID');
  if (!appId) {
    throw new Error('META_APP_ID is not configured in Settings');
  }

  const scopes = [
    'instagram_basic',
    'instagram_manage_comments',
    'instagram_content_publish',
    'pages_show_list',
    'pages_read_engagement'
  ];

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(','),
    state: state || 'instagram_oauth'
  });

  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

// Exchange authorization code for token
async function exchangeInstagramCode(code, redirectUri) {
  const appId = getSetting('META_APP_ID');
  const appSecret = getSetting('META_APP_SECRET');

  if (!appId || !appSecret) {
    throw new Error('META_APP_ID and META_APP_SECRET must be configured in Settings');
  }

  // 1. Exchange short-lived token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` + new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code
    })
  );
  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    throw new Error(tokenData.error.message);
  }

  // 2. Exchange for long-lived user token (60 days)
  const longTokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` + new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: tokenData.access_token
    })
  );
  const longData = await longTokenRes.json();
  const userAccessToken = longData.access_token || tokenData.access_token;
  const expiresIn = longData.expires_in || 5184000; // ~60 days

  // 3. Find connected Instagram Business / Creator accounts via Pages
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${userAccessToken}`
  );
  const pagesData = await pagesRes.json();

  const accounts = [];
  if (pagesData.data) {
    for (const page of pagesData.data) {
      if (page.instagram_business_account) {
        accounts.push({
          igUserId: page.instagram_business_account.id,
          username: page.instagram_business_account.username,
          name: page.instagram_business_account.name || page.instagram_business_account.username,
          avatarUrl: page.instagram_business_account.profile_picture_url,
          pageId: page.id,
          pageName: page.name,
          pageAccessToken: page.access_token
        });
      }
    }
  }

  return {
    accessToken: userAccessToken,
    expiresAt: Date.now() + (expiresIn * 1000),
    accounts
  };
}

// Fetch recent posts/media of the Instagram account
async function getInstagramMedia(accessToken, igUserId) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,thumbnail_url,like_count,comments_count&limit=20&access_token=${accessToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data || [];
}

// Fetch comments on an Instagram post
async function getInstagramComments(accessToken, mediaId) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${mediaId}/comments?fields=id,text,timestamp,username,from{id,username},like_count,replies{id,text,timestamp,username}&limit=50&access_token=${accessToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.data || []).map(c => ({
    commentId: c.id,
    mediaId,
    authorName: c.username || c.from?.username || 'User',
    authorId: c.from?.id,
    text: c.text,
    publishedAt: c.timestamp,
    hasReplies: (c.replies?.data || []).length > 0
  }));
}

// Reply to an Instagram comment
async function replyToInstagramComment(accessToken, commentId, replyMessage) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${commentId}/replies?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: replyMessage })
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data; // { id: "reply_id" }
}

// Publish an Instagram Photo post
async function publishInstagramPost(accessToken, igUserId, imageUrl, caption) {
  // Step 1: Create container
  const containerRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption
      })
    }
  );
  const containerData = await containerRes.json();
  if (containerData.error) throw new Error(containerData.error.message);

  const creationId = containerData.id;

  // Step 2: Publish container
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId })
    }
  );
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(publishData.error.message);

  return publishData; // { id: "media_id" }
}

module.exports = {
  getInstagramAuthUrl,
  exchangeInstagramCode,
  getInstagramMedia,
  getInstagramComments,
  replyToInstagramComment,
  publishInstagramPost
};
