const { db, getSetting, setSetting, logActivity } = require('../db');
const { isNumberSuppressed } = require('./vapi');
const providerManager = require('./calling/providerManager');

// In-memory active campaign workers map: campaignId -> { timer, isRunning, isPaused }
const activeCampaigns = new Map();

/**
 * Check if the current time in the specified timezone is within permitted calling hours.
 */
function isWithinCallingHours(windowStart = '10:00', windowEnd = '19:00', timeZone = 'Asia/Kolkata') {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const hour = parts.find(p => p.type === 'hour')?.value || '12';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const currentTimeStr = `${hour}:${minute}`;

    return currentTimeStr >= windowStart && currentTimeStr <= windowEnd;
  } catch (err) {
    console.warn('Calling hours check warning:', err.message);
    return true; // Fallback to allowing calls if timezone parser fails
  }
}

/**
 * Start or resume a campaign's automated calling worker
 */
async function startCampaign(campaignId) {
  const campaign = db.prepare('SELECT * FROM calling_campaigns WHERE id = ?').get(campaignId);
  if (!campaign) {
    throw new Error(`Campaign #${campaignId} not found.`);
  }

  // Update status in DB
  db.prepare("UPDATE calling_campaigns SET status = 'calling', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);

  // If already running, unpause
  if (activeCampaigns.has(campaignId)) {
    const worker = activeCampaigns.get(campaignId);
    worker.isPaused = false;
    worker.isRunning = true;
    logActivity('calling', 'campaign_resumed', 'success', `Resumed automated calling for "${campaign.title}"`);
    return { success: true, message: 'Campaign resumed', campaignId };
  }

  const workerState = {
    campaignId,
    isRunning: true,
    isPaused: false,
    timer: null
  };
  activeCampaigns.set(campaignId, workerState);

  logActivity('calling', 'campaign_started', 'success', `Started automated calling queue for "${campaign.title}"`);

  // Start background process loop
  processCampaignNext(campaignId).catch(err => {
    console.error(`Error in campaign worker ${campaignId}:`, err);
  });

  return { success: true, message: 'Campaign started', campaignId };
}

/**
 * Pause a running campaign
 */
function pauseCampaign(campaignId) {
  const worker = activeCampaigns.get(campaignId);
  if (worker) {
    worker.isPaused = true;
    if (worker.timer) {
      clearTimeout(worker.timer);
      worker.timer = null;
    }
  }

  db.prepare("UPDATE calling_campaigns SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
  logActivity('calling', 'campaign_paused', 'success', `Paused automated calling for Campaign #${campaignId}`);
  return { success: true, message: 'Campaign paused', campaignId };
}

/**
 * Stop a campaign completely
 */
function stopCampaign(campaignId) {
  const worker = activeCampaigns.get(campaignId);
  if (worker) {
    worker.isRunning = false;
    worker.isPaused = false;
    if (worker.timer) {
      clearTimeout(worker.timer);
      worker.timer = null;
    }
    activeCampaigns.delete(campaignId);
  }

  db.prepare("UPDATE calling_campaigns SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
  logActivity('calling', 'campaign_stopped', 'success', `Stopped Campaign #${campaignId}`);
  return { success: true, message: 'Campaign stopped', campaignId };
}

/**
 * Background loop: picks the next eligible pending lead and dispatches a call with rate limiting
 */
async function processCampaignNext(campaignId) {
  const worker = activeCampaigns.get(campaignId);
  if (!worker || !worker.isRunning || worker.isPaused) {
    return;
  }

  const campaign = db.prepare('SELECT * FROM calling_campaigns WHERE id = ?').get(campaignId);
  if (!campaign || campaign.status !== 'calling') {
    activeCampaigns.delete(campaignId);
    return;
  }

  const delaySeconds = Number(campaign.delay_seconds) || 8;
  const maxAttempts = Number(campaign.max_attempts) || 3;
  const windowStart = campaign.calling_window_start || '10:00';
  const windowEnd = campaign.calling_window_end || '19:00';
  const timeZone = campaign.timezone || 'Asia/Kolkata';

  // 1. Check Calling Hours
  if (!isWithinCallingHours(windowStart, windowEnd, timeZone)) {
    console.log(`[Campaign #${campaignId}] Outside permitted calling hours (${windowStart} - ${windowEnd} ${timeZone}). Pausing until window reopens.`);
    // Re-check in 5 minutes
    worker.timer = setTimeout(() => processCampaignNext(campaignId), 5 * 60 * 1000);
    return;
  }

  // 2. Fetch the next eligible lead
  const lead = db.prepare(`
    SELECT * FROM calling_leads 
    WHERE campaign_id = ? 
      AND call_status = 'pending'
      AND do_not_contact = 0
      AND call_attempts < ?
    ORDER BY id ASC 
    LIMIT 1
  `).get(campaignId, maxAttempts);

  if (!lead) {
    // No more pending leads; mark campaign completed
    db.prepare("UPDATE calling_campaigns SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
    activeCampaigns.delete(campaignId);
    logActivity('calling', 'campaign_finished', 'success', `Campaign "${campaign.title}" has processed all eligible leads.`);
    return;
  }

  // 3. Check DND suppression
  if (isNumberSuppressed(lead.phone_number)) {
    db.prepare("UPDATE calling_leads SET call_status = 'dnc', do_not_contact = 1, last_call_outcome = 'Suppressed via DNC list' WHERE id = ?").run(lead.id);
    // Move immediately to next
    return processCampaignNext(campaignId);
  }

  try {
    console.log(`[Campaign #${campaignId}] Dispatching automated call to lead #${lead.id} (${lead.name} - ${lead.phone_number})...`);
    
    // Dispatch the call via resolved provider (Vapi, Retell, or OmniDimension)
    await providerManager.dispatchCall({
      leadId: lead.id,
      providerId: campaign.provider,
      customOpeningMessage: campaign.call_script,
      campaignId: campaign.id
    });

  } catch (callErr) {
    console.warn(`[Campaign #${campaignId}] Call dispatch error on lead #${lead.id}:`, callErr.message);
    db.prepare(`
      UPDATE calling_leads 
      SET call_status = 'failed', 
          last_call_outcome = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(`Dispatch failed: ${callErr.message}`, lead.id);
  }

  // 4. Rate-limiting delay before processing next lead
  const delayMs = Math.max(delaySeconds, 4) * 1000;
  worker.timer = setTimeout(() => {
    processCampaignNext(campaignId).catch(console.error);
  }, delayMs);
}

/**
 * Retry an individual failed or unanswered lead
 */
async function retryLead(leadId) {
  const lead = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(leadId);
  if (!lead) throw new Error(`Lead #${leadId} not found.`);

  if (lead.do_not_contact === 1 || isNumberSuppressed(lead.phone_number)) {
    throw new Error('Cannot retry: Lead has opted out or is on the Do Not Contact list.');
  }

  db.prepare("UPDATE calling_leads SET call_status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(leadId);
  return await providerManager.dispatchCall({
    leadId,
    providerId: lead.provider,
    campaignId: lead.campaign_id
  });
}

module.exports = {
  isWithinCallingHours,
  startCampaign,
  pauseCampaign,
  stopCampaign,
  retryLead,
  activeCampaigns
};
