const fs = require('fs');
const path = require('path');
const { getSetting } = require('../db');

/**
 * YouTube API Service
 * Handles OAuth, channel info, comment polling, and replying via YouTube Data API v3
 */

// Generate OAuth URL for Google YouTube login
function getYouTubeAuthUrl(redirectUri, state) {
  const clientId = getSetting('GOOGLE_CLIENT_ID');
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured in Settings');
  }

  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: state || 'youtube_oauth'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Exchange authorization code for tokens
async function exchangeYouTubeCode(code, redirectUri) {
  const clientId = getSetting('GOOGLE_CLIENT_ID');
  const clientSecret = getSetting('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Google Client ID and Client Secret must be configured');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    expiresAt: Date.now() + (data.expires_in * 1000)
  };
}

// Refresh Google access token using refresh_token
async function refreshYouTubeAccessToken(refreshToken) {
  const clientId = getSetting('GOOGLE_CLIENT_ID');
  const clientSecret = getSetting('GOOGLE_CLIENT_SECRET');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    })
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000)
  };
}

// Get YouTube Channel details for the authenticated user
async function getYouTubeChannelInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch YouTube channel');
  }

  const channel = data.items?.[0];
  if (!channel) {
    throw new Error('No YouTube channel found for this Google account');
  }

  return {
    channelId: channel.id,
    title: channel.snippet.title,
    customUrl: channel.snippet.customUrl || `@${channel.snippet.title.replace(/\s+/g, '').toLowerCase()}`,
    description: channel.snippet.description,
    avatarUrl: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url,
    subscriberCount: channel.statistics?.subscriberCount || '0',
    videoCount: channel.statistics?.videoCount || '0',
    viewCount: channel.statistics?.viewCount || '0',
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads
  };
}

// Fetch recent videos of the channel
async function getRecentVideos(accessToken, maxResults = 10) {
  const channelInfo = await getYouTubeChannelInfo(accessToken);
  const uploadsId = channelInfo.uploadsPlaylistId;

  if (!uploadsId) return [];

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch videos');
  }

  return (data.items || []).map(item => ({
    videoId: item.contentDetails.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url
  }));
}

// Fetch comments related to the authenticated channel
async function getChannelComments(accessToken, channelId, maxResults = 50) {
  let targetChannelId = channelId;
  if (!targetChannelId) {
    const info = await getYouTubeChannelInfo(accessToken);
    targetChannelId = info.channelId;
  }

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${targetChannelId}&maxResults=${maxResults}&order=time`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const data = await res.json();
  if (!res.ok) {
    // If comments are disabled on the channel or no videos exist yet, fail gracefully
    if (data.error?.message?.includes('disabled comments') || data.error?.message?.includes('could not be found')) {
      return [];
    }
    throw new Error(data.error?.message || 'Failed to fetch comments');
  }

  return (data.items || []).map(item => {
    const top = item.snippet.topLevelComment.snippet;
    return {
      commentId: item.id,
      videoId: item.snippet.videoId,
      postTitle: '', // filled when correlated
      authorName: top.authorDisplayName,
      authorAvatar: top.authorProfileImageUrl,
      authorChannelUrl: top.authorChannelUrl,
      text: top.textDisplay || top.textOriginal,
      publishedAt: top.publishedAt,
      totalReplyCount: item.snippet.totalReplyCount || 0
    };
  });
}

// Reply to a YouTube comment
async function replyToYouTubeComment(accessToken, parentCommentId, replyText) {
  const res = await fetch('https://www.googleapis.com/youtube/v3/comments?part=snippet', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      snippet: {
        parentId: parentCommentId,
        textOriginal: replyText
      }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to reply to comment');
  }

  return {
    replyId: data.id,
    publishedAt: data.snippet?.publishedAt
  };
}

// Upload a video to YouTube using Resumable Upload
async function uploadYouTubeVideo(accessToken, filePath, { title, description, privacyStatus = 'public', tags = [] }) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Video file not found at: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();

  let mimeType = 'video/mp4';
  if (ext === '.mov') mimeType = 'video/quicktime';
  else if (ext === '.avi') mimeType = 'video/x-msvideo';
  else if (ext === '.mkv') mimeType = 'video/x-matroska';
  else if (ext === '.webm') mimeType = 'video/webm';

  console.log(`[YouTube Upload] Starting upload of "${title}" (${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);

  // Step 1: Initiate Resumable Upload Session
  const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': fileSize.toString()
    },
    body: JSON.stringify({
      snippet: {
        title: title || 'New Video Upload',
        description: description || '',
        tags: tags.length ? tags : ['socialmanager'],
        categoryId: '22' // People & Blogs
      },
      status: {
        privacyStatus: privacyStatus || 'public',
        selfDeclaredMadeForKids: false
      }
    })
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`YouTube video initialization failed (${initRes.status}): ${errText}`);
  }

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) {
    throw new Error('YouTube did not return a resumable upload location header.');
  }

  // Step 2: Upload the actual video binary
  const fileBuffer = fs.readFileSync(filePath);
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Content-Length': fileSize.toString()
    },
    body: fileBuffer
  });

  const videoData = await uploadRes.json();
  if (!uploadRes.ok) {
    throw new Error(`YouTube video upload failed: ${videoData.error?.message || JSON.stringify(videoData)}`);
  }

  console.log(`[YouTube Upload] Successfully uploaded! Video ID: ${videoData.id}`);

  return {
    videoId: videoData.id,
    videoUrl: `https://www.youtube.com/watch?v=${videoData.id}`,
    title: videoData.snippet?.title,
    status: videoData.status?.privacyStatus
  };
}

module.exports = {
  getYouTubeAuthUrl,
  exchangeYouTubeCode,
  refreshYouTubeAccessToken,
  getYouTubeChannelInfo,
  getRecentVideos,
  getChannelComments,
  replyToYouTubeComment,
  uploadYouTubeVideo
};
