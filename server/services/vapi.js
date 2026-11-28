const { db, getSetting, setSetting, logActivity } = require('../db');

const VAPI_BASE_URL = 'https://api.vapi.ai';

/**
 * Format any input phone string into clean E.164 format.
 * Defaults to India (+91) for 10-digit mobile numbers starting with 6, 7, 8, or 9.
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';
  const raw = String(phone).trim();
  // Strip non-digit characters except leading plus
  let cleaned = raw.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If 10 digits starting with Indian mobile prefixes (6, 7, 8, 9)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // If 11 digits starting with 0 followed by 10-digit mobile
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned.slice(1)}`;
  }

  // If 12 digits starting with 91
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // If 10 digits US/Canada
  if (/^[2-9]\d{9}$/.test(cleaned)) {
    return `+1${cleaned}`;
  }

  // If 11 digits starting with 1
  if (/^1[2-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

/**
 * Check if a phone number is on the Do Not Contact list
 */
function isNumberSuppressed(phoneNumber) {
  const formatted = formatPhoneNumber(phoneNumber);
  const row = db.prepare('SELECT id, reason FROM do_not_contact WHERE phone_number = ?').get(formatted);
  return row || null;
}

/**
 * Add a phone number to the Do Not Contact list
 */
function addToDoNotContact(phoneNumber, reason = 'Customer requested opt-out during call', source = 'call_optout') {
  const formatted = formatPhoneNumber(phoneNumber);
  try {
    db.prepare(`
      INSERT INTO do_not_contact (phone_number, reason, source)
      VALUES (?, ?, ?)
      ON CONFLICT(phone_number) DO UPDATE SET reason = excluded.reason, source = excluded.source
    `).run(formatted, reason, source);

    // Also mark in calling_leads
    db.prepare(`
      UPDATE calling_leads 
      SET do_not_contact = 1, call_status = 'dnc'
      WHERE phone_number = ? OR phone_number LIKE ?
    `).run(formatted, `%${formatted.slice(-10)}`);

    logActivity('calling', 'dnc_added', 'success', `Added ${formatted} to Do Not Contact list (${reason})`);
  } catch (err) {
    console.error('Failed to add to DNC:', err.message);
  }
}

/**
 * Build dynamic assistant prompt & variables combining all user business settings
 */
function buildAssistantOverrides(lead, campaign) {
  const companyName = getSetting('CALLING_COMPANY_NAME') || 'Sneharmony Music Academy';
  const callerName = getSetting('CALLING_AGENT_NAME') || 'Aria';
  const businessDesc = getSetting('CALLING_BUSINESS_DESCRIPTION') || '';
  const productDetails = getSetting('CALLING_PRODUCT_DETAILS') || '';
  const pricing = getSetting('CALLING_PRICING') || '';
  const offers = getSetting('CALLING_OFFERS') || '';
  const eligibility = getSetting('CALLING_ELIGIBILITY') || '';
  const faqs = getSetting('CALLING_FAQS') || '';
  const salesObjectives = getSetting('CALLING_SALES_OBJECTIVES') || '';
  const qualQuestions = getSetting('CALLING_QUALIFICATION_QUESTIONS') || '';
  const objections = getSetting('CALLING_OBJECTION_HANDLING') || '';
  const handoff = getSetting('CALLING_HUMAN_HANDOFF_CONTACT') || '';
  const closingMsg = getSetting('CALLING_CLOSING_MESSAGE') || '';

  const rawScript = campaign?.call_script || getSetting('CALLING_DEFAULT_SCRIPT') || `Hello {name}! This is Aria calling on behalf of ${companyName}.`;
  
  const greeting = rawScript
    .replace(/\{name\}/gi, lead.name || 'there')
    .replace(/\{company_name\}/gi, companyName)
    .replace(/\{agent_name\}/gi, callerName)
    .replace(/\{interest\}/gi, lead.interest || 'our programs');

  const closing = closingMsg
    .replace(/\{name\}/gi, lead.name || 'there')
    .replace(/\{company_name\}/gi, companyName);

  const dynamicSystemPrompt = `You are ${callerName}, an empathetic, friendly, and honest outbound AI telecaller calling on behalf of ${companyName}.

ABOUT THE BUSINESS:
${businessDesc}

PRODUCTS / SERVICES / COURSES:
${productDetails}

OFFICIAL PRICING:
${pricing}

ACTIVE OFFERS & PROMOTIONS:
${offers}

TARGET AUDIENCE & ELIGIBILITY:
${eligibility}

FREQUENTLY ASKED QUESTIONS:
${faqs}

PRIMARY SALES & CONVERSATION OBJECTIVES:
${salesObjectives}

QUALIFICATION QUESTIONS TO ASK:
${qualQuestions}

OBJECTION HANDLING PROTOCOLS:
${objections}

HUMAN ADVISOR CONTACT & ESCALATION:
${handoff}

CLOSING MESSAGE:
${closing}

IMPORTANT CONVERSATION RULES:
1. Honestly introduce yourself as an AI assistant calling on behalf of ${companyName}.
2. Confirm if the customer has a quick 2 minutes to speak. If they are busy, in a meeting, driving, or ask to call later, apologize politely, offer a convenient callback time, and conclude smoothly.
3. Keep your answers concise, natural, and conversational (1 to 2 sentences per turn), exactly like a live phone call. Avoid long monologues.
4. Listen attentively. Never interrupt the customer while they are speaking.
5. Answer questions accurately using ONLY the business knowledge provided above. NEVER invent pricing, guarantees, dates, or discounts.
6. If the customer asks a question not covered above, offer to connect them with a human advisor (${handoff}).
7. If the customer states they are NOT interested or asks to be removed, immediately respect their request, thank them politely for their time, and end the call. NEVER push or argue.
8. Current Lead Context:
- Name: ${lead.name}
- Interest: ${lead.interest || 'General Inquiry'}
- Notes: ${lead.notes || 'None'}`;

  return {
    firstMessage: greeting,
    variableValues: {
      name: lead.name,
      company: companyName,
      interest: lead.interest || 'our programs',
      phone: lead.phone_number,
      notes: lead.notes || ''
    },
    model: {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: dynamicSystemPrompt
        }
      ]
    }
  };
}

/**
 * Run comprehensive diagnostics on the Vapi account, credentials, phone numbers, and assistants
 */
async function diagnoseVapi() {
  const apiKey = getSetting('VAPI_API_KEY') || process.env.VAPI_API_KEY || '';
  const selectedPhoneNumberId = getSetting('VAPI_PHONE_NUMBER_ID') || '';
  const selectedAssistantId = getSetting('VAPI_ASSISTANT_ID') || '';
  const callingMode = getSetting('CALLING_MODE') || 'live';

  const result = {
    timestamp: new Date().toISOString(),
    apiKeyConfigured: Boolean(apiKey && apiKey.trim().length > 10),
    apiKeyMasked: apiKey ? `${apiKey.substring(0, 6)}••••••••${apiKey.substring(apiKey.length - 4)}` : null,
    apiKeyValid: false,
    callingMode,
    assistants: [],
    selectedAssistantId,
    selectedAssistant: null,
    phoneNumbers: [],
    selectedPhoneNumberId,
    selectedPhoneNumber: null,
    outboundCapability: {
      supportedCountryCodes: [],
      canCallIndia: false,
      canCallUS: false,
      reason: ''
    },
    recentCalls: [],
    issues: [],
    recommendations: []
  };

  if (!result.apiKeyConfigured) {
    result.issues.push({
      level: 'error',
      component: 'API_KEY',
      message: 'Vapi API Key is missing. Add your private API key from dashboard.vapi.ai/api-keys.'
    });
    return result;
  }

  // 1. Validate API Key & fetch Assistants
  try {
    const astRes = await fetch(`${VAPI_BASE_URL}/assistant`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (astRes.ok) {
      result.apiKeyValid = true;
      const assistants = await astRes.json();
      result.assistants = assistants.map(a => ({
        id: a.id,
        name: a.name || 'Unnamed Assistant',
        model: a.model?.model || 'gpt-4',
        voice: a.voice?.voiceId || a.voice?.provider || 'default',
        updatedAt: a.updatedAt
      }));

      if (selectedAssistantId) {
        result.selectedAssistant = result.assistants.find(a => a.id === selectedAssistantId) || null;
      }
      if (!result.selectedAssistant && result.assistants.length > 0) {
        // Recommend or auto-select first available assistant
        result.selectedAssistant = result.assistants[0];
      }
    } else {
      const errText = await astRes.text();
      result.issues.push({
        level: 'error',
        component: 'API_KEY',
        message: `Vapi API Key rejected by Vapi server (${astRes.status} ${astRes.statusText}): ${errText}`
      });
      return result;
    }
  } catch (err) {
    result.issues.push({
      level: 'error',
      component: 'NETWORK',
      message: `Failed to connect to Vapi API: ${err.message}`
    });
    return result;
  }

  // 2. Fetch Phone Numbers
  try {
    const numRes = await fetch(`${VAPI_BASE_URL}/phone-number`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (numRes.ok) {
      const numbers = await numRes.json();
      result.phoneNumbers = numbers.map(n => ({
        id: n.id,
        number: n.number,
        provider: n.provider, // 'vapi' | 'twilio' | 'vonage' | 'byo-phone-number'
        name: n.name || n.number,
        status: n.status || 'active'
      }));

      if (selectedPhoneNumberId) {
        result.selectedPhoneNumber = result.phoneNumbers.find(n => n.id === selectedPhoneNumberId) || null;
      }
      if (!result.selectedPhoneNumber && result.phoneNumbers.length > 0) {
        result.selectedPhoneNumber = result.phoneNumbers[0];
      }
    }
  } catch (err) {
    result.issues.push({
      level: 'warning',
      component: 'PHONE_NUMBERS',
      message: `Failed to fetch phone numbers from Vapi: ${err.message}`
    });
  }

  // 3. Inspect Outbound Telephony Capability
  if (!result.selectedPhoneNumber) {
    result.issues.push({
      level: 'error',
      component: 'PHONE_NUMBER',
      message: 'No active outbound phone number selected or found in your Vapi account.'
    });
    result.recommendations.push('Buy a phone number in Vapi or import your Twilio phone number under Vapi Dashboard -> Phone Numbers.');
  } else {
    const p = result.selectedPhoneNumber;
    if (p.provider === 'vapi') {
      result.outboundCapability.canCallUS = true;
      result.outboundCapability.canCallIndia = false;
      result.outboundCapability.supportedCountryCodes = ['+1 (US & Canada)'];
      result.outboundCapability.reason = `Your phone number (${p.number}) was purchased directly through Vapi's default pool. Vapi native numbers only support US/Canada (+1) destination calls and block international destinations (+91 India).`;

      result.issues.push({
        level: 'warning',
        component: 'INTERNATIONAL_CALLING',
        message: `Phone number ${p.number} is a native Vapi number (Provider: vapi). Vapi blocks international calls (e.g. India +91) on native numbers with error: "call.start.error-vapi-number-international".`
      });

      result.recommendations.push(
        'To call Indian phone numbers (+91): In your Vapi Dashboard (dashboard.vapi.ai), go to "Phone Numbers" -> "Import from Twilio" and connect a Twilio number with international voice enabled.',
        'If testing with US/Canada numbers (+1), your current Vapi number (+1-346-372-7599) will dial and connect directly.'
      );
    } else if (p.provider === 'twilio' || p.provider === 'byo-phone-number' || p.provider === 'vonage') {
      result.outboundCapability.canCallUS = true;
      result.outboundCapability.canCallIndia = true;
      result.outboundCapability.supportedCountryCodes = ['+1', '+91 (Global / Twilio BYO)'];
      result.outboundCapability.reason = `Your phone number (${p.number}) is backed by ${p.provider}. It supports international outbound dialing subject to your provider's geo-permissions.`;
    }
  }

  // 4. Fetch Recent Calls & endedReasons
  try {
    const callRes = await fetch(`${VAPI_BASE_URL}/call?limit=8`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (callRes.ok) {
      const calls = await callRes.json();
      result.recentCalls = calls.map(c => ({
        id: c.id,
        status: c.status,
        endedReason: c.endedReason || null,
        destination: c.customer?.number || 'Unknown',
        type: c.type,
        createdAt: c.createdAt
      }));
    }
  } catch (e) {
    // Non-blocking
  }

  return result;
}

/**
 * Dispatch a live outbound AI phone call to a single lead
 */
async function dispatchVapiCall({ leadId, customOpeningMessage, customScript }) {
  const apiKey = getSetting('VAPI_API_KEY') || process.env.VAPI_API_KEY;
  const phoneNumberId = getSetting('VAPI_PHONE_NUMBER_ID');
  const assistantId = getSetting('VAPI_ASSISTANT_ID');
  const callingMode = getSetting('CALLING_MODE') || 'live';

  if (!apiKey) {
    throw new Error('Vapi API Key is missing. Configure it in Agent Settings.');
  }

  const lead = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(leadId);
  if (!lead) {
    throw new Error(`Lead #${leadId} not found in database.`);
  }

  // 1. Consent and DND verification
  const dndEntry = isNumberSuppressed(lead.phone_number);
  if (dndEntry || lead.do_not_contact === 1) {
    db.prepare("UPDATE calling_leads SET call_status = 'dnc' WHERE id = ?").run(leadId);
    throw new Error(`Call blocked: Number ${lead.phone_number} is on the Do Not Contact list (${dndEntry?.reason || 'Opted out'}).`);
  }

  // 2. Prevent concurrent duplicate calls to the same lead
  if (lead.call_status === 'calling' || lead.call_status === 'in_progress') {
    throw new Error(`A call is already active or in progress for ${lead.name} (${lead.phone_number}). Please wait for it to complete.`);
  }

  // 3. Format destination number
  const e164Phone = formatPhoneNumber(lead.phone_number);
  if (!e164Phone || e164Phone.length < 10) {
    db.prepare("UPDATE calling_leads SET call_status = 'failed', last_call_outcome = 'Invalid phone number' WHERE id = ?").run(leadId);
    throw new Error(`Invalid destination phone number: ${lead.phone_number}. Must be in valid telephone format.`);
  }

  const campaign = lead.campaign_id ? db.prepare('SELECT * FROM calling_campaigns WHERE id = ?').get(lead.campaign_id) : null;
  const overrides = buildAssistantOverrides(lead, campaign);

  if (customOpeningMessage && customOpeningMessage.trim()) {
    overrides.firstMessage = customOpeningMessage.trim();
  }

  // 4. Construct Vapi Outbound Call Payload
  const payload = {
    phoneNumberId: phoneNumberId || undefined,
    customer: {
      number: e164Phone,
      name: lead.name
    },
    assistantId: assistantId || undefined,
    assistantOverrides: overrides
  };

  // If no assistant ID is chosen on Vapi, provide full assistant specification
  if (!assistantId) {
    payload.assistant = {
      name: getSetting('CALLING_AGENT_NAME') || 'Aria',
      firstMessage: overrides.firstMessage,
      model: overrides.model,
      voice: {
        provider: 'vapi',
        voiceId: 'Elliot'
      }
    };
    delete payload.assistantId;
  }

  // Mark status as 'calling' in DB before network call
  db.prepare(`
    UPDATE calling_leads 
    SET call_status = 'calling',
        call_attempts = call_attempts + 1,
        last_called_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(leadId);

  let vapiRes;
  let resJson;

  try {
    vapiRes = await fetch(`${VAPI_BASE_URL}/call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    resJson = await vapiRes.json();
  } catch (netErr) {
    db.prepare(`
      UPDATE calling_leads 
      SET call_status = 'failed', 
          last_call_outcome = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(`Network dispatch failure: ${netErr.message}`, leadId);

    throw new Error(`Failed to reach Vapi API: ${netErr.message}`);
  }

  if (!vapiRes.ok) {
    const errorMsg = resJson.message || resJson.error || 'Vapi call dispatch rejected';
    db.prepare(`
      UPDATE calling_leads 
      SET call_status = 'failed', 
          last_call_outcome = ?,
          end_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(errorMsg, 'dispatch_rejected', leadId);

    // Also record failed attempt in call_logs
    const logId = `call_err_${Date.now()}`;
    db.prepare(`
      INSERT INTO call_logs (id, lead_id, phone_number, lead_name, direction, status, transcript, outcome, end_reason)
      VALUES (?, ?, ?, ?, 'outbound', 'failed', ?, ?, ?)
    `).run(logId, leadId, e164Phone, lead.name, `[Vapi Dispatch Error]: ${errorMsg}`, errorMsg, 'dispatch_rejected');

    throw new Error(`Vapi Outbound Call Error: ${errorMsg}`);
  }

  const callId = resJson.id;
  const initialStatus = resJson.status || 'queued';

  // Store external call ID
  db.prepare(`
    UPDATE calling_leads 
    SET external_call_id = ?,
        call_status = 'calling',
        last_call_outcome = 'Outbound call initiated via Vapi',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(callId, leadId);

  // Create initial record in call_logs
  const logId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT INTO call_logs (id, lead_id, phone_number, lead_name, direction, status, transcript, outcome, external_call_id, campaign_id)
    VALUES (?, ?, ?, ?, 'outbound', 'calling', ?, 'Real-time AI voice call dispatched', ?, ?)
  `).run(
    logId,
    leadId,
    e164Phone,
    lead.name,
    `[Vapi Outbound AI]: Dialing ${e164Phone} via Vapi...`,
    callId,
    lead.campaign_id || null
  );

  logActivity('calling', 'vapi_call_dispatched', 'success', `Dispatched Vapi call to ${lead.name} (${e164Phone}) [Call ID: ${callId}]`);

  // Asynchronous quick verification after 3 seconds:
  // Catches immediate rejections (like international number blocks) so the UI doesn't spin endlessly
  setTimeout(() => {
    syncCallDetails(callId).catch(() => {});
  }, 3500);

  return {
    success: true,
    callId,
    status: initialStatus,
    leadId,
    leadName: lead.name,
    phoneNumber: e164Phone
  };
}

/**
 * Sync live call results, transcript, duration, and analysis directly from Vapi REST API
 */
async function syncCallDetails(callId) {
  if (!callId) return null;
  const apiKey = getSetting('VAPI_API_KEY') || process.env.VAPI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${VAPI_BASE_URL}/call/${callId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!res.ok) return null;
    const call = await res.json();

    const status = call.status; // 'queued' | 'ringing' | 'in-progress' | 'ended'
    const endedReason = call.endedReason || null;
    const duration = Math.round(call.duration || (call.endedAt && call.startedAt ? (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000 : 0));
    const transcript = call.transcript || '';
    const recordingUrl = call.recordingUrl || null;
    const summary = call.analysis?.summary || call.summary || '';
    const cost = call.cost || 0;

    let leadStatus = 'completed';
    let outcomeText = endedReason ? `Call ended: ${endedReason}` : 'Call completed';

    if (endedReason === 'call.start.error-vapi-number-international') {
      leadStatus = 'failed';
      outcomeText = 'Failed: Native Vapi number cannot dial international (+91) numbers. Connect a Twilio phone number in Vapi.';
    } else if (endedReason === 'customer-did-not-answer' || endedReason === 'no-answer') {
      leadStatus = 'no_answer';
      outcomeText = 'No Answer / Ringing timed out';
    } else if (endedReason === 'customer-busy' || endedReason === 'busy') {
      leadStatus = 'busy';
      outcomeText = 'Customer line busy';
    } else if (status === 'in-progress' || status === 'ringing' || status === 'queued') {
      leadStatus = 'calling';
      outcomeText = `Call ${status}...`;
    } else if (status === 'ended') {
      // Analyze conversation content
      const lower = (summary + ' ' + transcript).toLowerCase();

      if (lower.includes('do not call') || lower.includes('stop calling') || lower.includes('remove my number') || lower.includes('not interested at all')) {
        leadStatus = 'dnc';
        outcomeText = 'Customer requested Do Not Contact. Suppressed from future calls.';
        const lead = db.prepare('SELECT phone_number FROM calling_leads WHERE external_call_id = ?').get(callId);
        if (lead) {
          addToDoNotContact(lead.phone_number, 'Customer opt-out during call', 'vapi_call');
        }
      } else if (lower.includes('interested') || lower.includes('send brochure') || lower.includes('whatsapp details') || lower.includes('trial lesson') || lower.includes('sign up')) {
        leadStatus = 'interested';
        outcomeText = 'Interested in program. Follow up on WhatsApp/trial.';
      } else if (lower.includes('call back') || lower.includes('callback') || lower.includes('busy right now') || lower.includes('driving') || lower.includes('tomorrow')) {
        leadStatus = 'needs_follow_up';
        outcomeText = 'Customer requested callback.';
        // Auto-schedule callback 24 hours later if none set
        const d = new Date();
        d.setHours(d.getHours() + 24);
        const fDate = d.toISOString().slice(0, 19).replace('T', ' ');
        db.prepare(`
          UPDATE calling_leads 
          SET follow_up_date = COALESCE(follow_up_date, ?),
              follow_up_notes = COALESCE(follow_up_notes, 'Customer requested callback during call.')
          WHERE external_call_id = ?
        `).run(fDate, callId);
      } else if (lower.includes('not interested')) {
        leadStatus = 'not_interested';
        outcomeText = 'Not interested in current offer.';
      } else {
        leadStatus = 'completed';
        outcomeText = summary || 'Call concluded normally.';
      }
    }

    // Update calling_leads
    db.prepare(`
      UPDATE calling_leads 
      SET call_status = ?,
          call_duration = ?,
          call_transcript = COALESCE(?, call_transcript),
          recording_url = COALESCE(?, recording_url),
          last_call_outcome = ?,
          end_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE external_call_id = ?
    `).run(leadStatus, duration, transcript || null, recordingUrl || null, outcomeText, endedReason, callId);

    // Update call_logs
    db.prepare(`
      UPDATE call_logs 
      SET status = ?,
          duration = ?,
          transcript = COALESCE(?, transcript),
          outcome = ?,
          recording_url = COALESCE(?, recording_url),
          end_reason = ?,
          ai_summary = ?,
          cost = ?
      WHERE external_call_id = ?
    `).run(leadStatus, duration, transcript || null, outcomeText, recordingUrl || null, endedReason, summary || null, cost, callId);

    // Update campaign counts
    const lead = db.prepare('SELECT campaign_id FROM calling_leads WHERE external_call_id = ?').get(callId);
    if (lead?.campaign_id) {
      db.prepare(`
        UPDATE calling_campaigns 
        SET completed_calls = (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = ? AND call_status NOT IN ('pending', 'queued', 'calling')),
            interested_count = (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = ? AND call_status = 'interested'),
            failed_count = (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = ? AND call_status IN ('failed', 'dnc')),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(lead.campaign_id, lead.campaign_id, lead.campaign_id, lead.campaign_id);
    }

    return {
      callId,
      status,
      endedReason,
      duration,
      transcript,
      recordingUrl,
      summary,
      outcomeText,
      leadStatus
    };
  } catch (err) {
    console.error(`Error syncing call ${callId}:`, err.message);
    return null;
  }
}

/**
 * End an ongoing live call on Vapi
 */
async function endVapiCall(callId) {
  const apiKey = getSetting('VAPI_API_KEY') || process.env.VAPI_API_KEY;
  if (!apiKey || !callId) return false;

  try {
    const res = await fetch(`${VAPI_BASE_URL}/call/${callId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await res.json().catch(() => ({}));

    db.prepare(`
      UPDATE calling_leads 
      SET call_status = 'completed', last_call_outcome = 'Manually terminated by agent' 
      WHERE external_call_id = ?
    `).run(callId);

    db.prepare(`
      UPDATE call_logs 
      SET status = 'completed', outcome = 'Manually terminated by agent', end_reason = 'agent_manual_hangup' 
      WHERE external_call_id = ?
    `).run(callId);

    return true;
  } catch (err) {
    console.error(`Failed to terminate call ${callId}:`, err.message);
    return false;
  }
}

module.exports = {
  formatPhoneNumber,
  isNumberSuppressed,
  addToDoNotContact,
  diagnoseVapi,
  buildAssistantOverrides,
  dispatchVapiCall,
  syncCallDetails,
  endVapiCall
};
