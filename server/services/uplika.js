const fs = require('fs');
const path = require('path');
const { getSetting, logActivity } = require('../db');

const UPLIKA_API_BASE = 'https://api.uplika.com';

// Fetch the active Instagram connection candidate from Uplika
async function getUplikaInstagramAccount(apiKey) {
  if (!apiKey) {
    throw new Error('Uplika API Key is required');
  }

  // Trigger a dry check to get candidates
  const res = await fetch(`${UPLIKA_API_BASE}/v1/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: '',
      platforms: ['instagram']
    })
  });

  const data = await res.json().catch(() => ({}));
  const candidates = data.error?.candidates || data.candidates || [];
  const igAccount = candidates.find(c => (c.platform || '').toLowerCase() === 'instagram') || candidates[0];

  if (!igAccount) {
    throw new Error(data.error?.message || 'No connected Instagram account found in your Uplika workspace.');
  }

  return {
    connectionId: igAccount.id,
    handle: igAccount.handle || igAccount.username || 'instagram_user',
    displayName: igAccount.displayName || igAccount.handle || 'Instagram Account',
    avatarUrl: igAccount.avatarUrl || 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=120&auto=format&fit=crop&q=80',
    status: igAccount.status || 'active'
  };
}

// Upload a local file to Uplika Media Storage
async function uploadMediaToUplika(apiKey, localFilePath) {
  if (!fs.existsSync(localFilePath)) {
    throw new Error(`Media file not found at: ${localFilePath}`);
  }

  const stat = fs.statSync(localFilePath);
  const bytes = stat.size;
  const fileName = path.basename(localFilePath);
  const ext = path.extname(localFilePath).toLowerCase();

  let contentType = 'video/mp4';
  if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.mov') contentType = 'video/quicktime';

  console.log(`[Uplika Upload] Requesting presigned URL for ${fileName} (${(bytes / (1024 * 1024)).toFixed(2)} MB)...`);

  // Step 1: Request presigned slot
  const presignRes = await fetch(`${UPLIKA_API_BASE}/v1/media/presign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileName,
      contentType,
      bytes
    })
  });

  const presignData = await presignRes.json();
  if (!presignRes.ok) {
    throw new Error(presignData.error?.message || 'Failed to get upload slot from Uplika');
  }

  const mediaId = presignData.id;
  const uploadUrl = presignData.uploadUrl;

  console.log(`[Uplika Upload] Uploading bytes to S3/B2 storage...`);

  // Step 2: PUT file buffer to uploadUrl
  const fileBuffer = fs.readFileSync(localFilePath);
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': bytes.toString()
    },
    body: fileBuffer
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload media bytes to storage (HTTP ${uploadRes.status})`);
  }

  // Step 3: Complete upload
  console.log(`[Uplika Upload] Confirming upload completion for ${mediaId}...`);
  const completeRes = await fetch(`${UPLIKA_API_BASE}/v1/media/${mediaId}/complete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  const completeData = await completeRes.json();
  if (!completeRes.ok) {
    throw new Error(completeData.error?.message || 'Uplika media complete verification failed');
  }

  console.log(`[Uplika Upload] Media ready: ${mediaId}`);
  return {
    mediaId,
    publicUrl: presignData.publicUrl
  };
}

// Publish post to Instagram via Uplika
async function publishPostViaUplika(apiKey, { caption, mediaUrl }) {
  if (!apiKey) {
    throw new Error('Uplika API Key is not configured for this channel.');
  }

  // 1. Get active Instagram connection from Uplika
  const account = await getUplikaInstagramAccount(apiKey);

  // 2. Resolve media file if attached
  let mediaIds = [];
  if (mediaUrl) {
    let filePath = mediaUrl;
    if (filePath.startsWith('/uploads/')) {
      filePath = path.join(__dirname, '../../uploads', filePath.replace('/uploads/', ''));
    }

    if (fs.existsSync(filePath)) {
      const uploadResult = await uploadMediaToUplika(apiKey, filePath);
      mediaIds.push(uploadResult.mediaId);
    }
  }

  if (mediaIds.length === 0) {
    throw new Error('Instagram requires an image or video file to publish.');
  }

  console.log(`[Uplika Publish] Publishing post to Instagram @${account.handle}...`);

  const payload = {
    accountIds: [account.connectionId],
    content: caption || '',
    mediaIds,
    wait: true
  };

  const res = await fetch(`${UPLIKA_API_BASE}/v1/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.error?.message || data.message || `Uplika publishing failed (HTTP ${res.status})`;
    throw new Error(errorMsg);
  }

  const postUrl = data.permalink || data.url || `https://www.instagram.com/${account.handle}/`;
  console.log(`[Uplika Publish] Post published successfully: ${postUrl}`);

  return {
    success: true,
    postId: data.id || `uplika_post_${Date.now()}`,
    postUrl
  };
}

// Reply to an Instagram comment via Uplika
async function replyCommentViaUplika(apiKey, commentId, replyText) {
  if (!apiKey) {
    throw new Error('Uplika API Key is not configured.');
  }

  const res = await fetch(`${UPLIKA_API_BASE}/v1/comments/${commentId}/reply`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: replyText })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to reply via Uplika');
  }

  return {
    success: true,
    replyId: data.id
  };
}

module.exports = {
  getUplikaInstagramAccount,
  uploadMediaToUplika,
  publishPostViaUplika,
  replyCommentViaUplika
};
