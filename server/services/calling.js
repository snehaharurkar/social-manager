const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { db, getSetting, setSetting, logActivity } = require('../db');

// Clean and normalize phone numbers into E.164
function formatPhoneNumber(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/[^0-9+]/g, '');
  if (!digits.startsWith('+')) {
    // If 10 digits typical Indian mobile starting with 6, 7, 8, 9
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      digits = `+91${digits}`;
    } else {
      digits = `+${digits}`;
    }
  }
  return digits;
}

// Parse Excel (.xlsx, .xls) or CSV file
function parseExcelFile(filePath) {
  const normalizedPath = path.isAbsolute(filePath) ? path.normalize(filePath) : path.join(process.cwd(), filePath);
  if (!fs.existsSync(normalizedPath)) {
    throw new Error(`File not found: ${normalizedPath}`);
  }

  const workbook = XLSX.readFile(normalizedPath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel sheet contains no pages.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (!rows || rows.length === 0) {
    throw new Error('The uploaded Excel sheet contains no rows.');
  }

  const detectedColumns = Object.keys(rows[0] || {});

  // Heuristic column matcher
  const findKey = (row, candidates) => {
    const keys = Object.keys(row);
    for (const cand of candidates) {
      const match = keys.find(k => k.toLowerCase().trim().replace(/[_\s-]/g, '') === cand.toLowerCase());
      if (match && row[match]) return String(row[match]).trim();
    }
    return '';
  };

  const validLeads = [];
  rows.forEach((row, idx) => {
    const name = findKey(row, ['name', 'fullname', 'firstname', 'leadname', 'client', 'customer', 'student']) || `Lead #${idx + 1}`;
    const rawPhone = findKey(row, ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contact', 'contactnumber', 'cell', 'tel']);
    const email = findKey(row, ['email', 'emailaddress', 'mail']);
    const interest = findKey(row, ['interest', 'course', 'service', 'subject', 'program', 'product', 'category']) || 'Music & Lessons';
    const notes = findKey(row, ['notes', 'remarks', 'comment', 'description', 'message']);
    const followUp = findKey(row, ['followup', 'followupdate', 'callback', 'calltime']);

    const cleanPhone = formatPhoneNumber(rawPhone);

    if (cleanPhone || name) {
      validLeads.push({
        name,
        phone_number: cleanPhone || 'Not Provided',
        email: email || '',
        interest: interest || 'Acoustic Guitar Lessons',
        notes: notes || '',
        follow_up_date: followUp || null,
        raw_row: row
      });
    }
  });

  return {
    sheetName,
    totalRows: rows.length,
    validLeads,
    detectedColumns
  };
}

// Create a Campaign from parsed leads
function createCampaign(title, fileName, leads, customScript, delaySeconds = 8) {
  const stmt = db.prepare(`
    INSERT INTO calling_campaigns (title, file_name, total_leads, completed_calls, status, call_script, delay_seconds)
    VALUES (?, ?, ?, 0, 'idle', ?, ?)
  `);

  const result = stmt.run(
    title || `Calling Campaign - ${new Date().toLocaleDateString()}`,
    fileName || 'leads.xlsx',
    leads.length,
    customScript || getSetting('CALLING_DEFAULT_SCRIPT'),
    Number(delaySeconds) || 8
  );

  const campaignId = Number(result.lastInsertRowid);

  // Bulk insert leads
  const insertLead = db.prepare(`
    INSERT INTO calling_leads (
      campaign_id, name, phone_number, email, interest, notes, call_status, follow_up_date
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `);

  for (const lead of leads) {
    insertLead.run(
      campaignId,
      lead.name,
      lead.phone_number,
      lead.email || null,
      lead.interest || null,
      lead.notes || null,
      lead.follow_up_date || null
    );
  }

  logActivity('calling', 'campaign_created', 'success', `Created campaign "${title}" with ${leads.length} leads`);
  return { campaignId, totalLeads: leads.length };
}

// ----------------------------------------------------
// 1. LIVE VAPI.AI VOICE AGENT INTEGRATION
// ----------------------------------------------------
async function callVapiVoiceAgent(lead, campaign) {
  const apiKey = getSetting('VAPI_API_KEY');
  const phoneNumberId = getSetting('VAPI_PHONE_NUMBER_ID');
  const assistantId = getSetting('VAPI_ASSISTANT_ID');
  const callerName = getSetting('CALLING_AGENT_NAME') || 'Aria (Sneharmony)';
  const scriptTemplate = campaign?.call_script || getSetting('CALLING_DEFAULT_SCRIPT');
  const greeting = scriptTemplate.replace(/\{name\}/gi, lead.name);
  const systemPrompt = getSetting('CALLING_SYSTEM_PROMPT') || 'You are Aria, an AI phone assistant for Sneha Harmony.';

  if (!apiKey) {
    throw new Error('Vapi API Key is missing. Please add it in Agent Settings.');
  }

  const e164Phone = formatPhoneNumber(lead.phone_number);

  const payload = {
    phoneNumberId: phoneNumberId || undefined,
    customer: {
      number: e164Phone,
      name: lead.name
    }
  };

  if (assistantId && assistantId.trim()) {
    payload.assistantId = assistantId.trim();
  } else {
    payload.assistant = {
      name: callerName,
      firstMessage: greeting,
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\n\nCustomer Name: ${lead.name}\nCustomer Interest: ${lead.interest || 'Guitar Lessons'}`
          }
        ]
      },
      voice: {
        provider: '11labs',
        voiceId: 'sarah'
      }
    };
  }

  const response = await fetch('https://api.vapi.ai/call/phone', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const resJson = await response.json();
  if (!response.ok) {
    throw new Error(resJson.message || resJson.error || 'Vapi call dispatch failed');
  }

  const callId = resJson.id;

  // Mark in-call with external call ID
  db.prepare(`
    UPDATE calling_leads 
    SET call_status = 'calling',
        external_call_id = ?,
        call_attempts = call_attempts + 1,
        last_called_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(callId, lead.id);

  // Log in call_logs
  db.prepare(`
    INSERT INTO call_logs (id, lead_id, phone_number, lead_name, direction, status, transcript, outcome, external_call_id)
    VALUES (?, ?, ?, ?, 'outbound', 'calling', ?, 'Real-time Voice AI call placed via Vapi.ai', ?)
  `).run(`call_${Date.now()}`, lead.id, lead.phone_number, lead.name, `[Vapi Outbound AI]: Dialing ${e164Phone}...`, callId);

  logActivity('calling', 'live_call_dispatched', 'success', `Vapi live call dispatched to ${lead.name} (${e164Phone}) [Call ID: ${callId}]`);

  return {
    isLive: true,
    provider: 'vapi',
    callId,
    name: lead.name,
    phoneNumber: e164Phone,
    status: 'calling',
    transcript: `[Live Call Dispatched via Vapi.ai]\nAI Agent: ${callerName}\nDialing Number: ${e164Phone}\nStatus: Ringing...`,
    outcome: 'Real-time Voice AI call dispatched to phone. Conversation in progress.'
  };
}

// ----------------------------------------------------
// 2. LIVE TWILIO VOICE INTEGRATION
// ----------------------------------------------------
async function callTwilioVoice(lead, campaign) {
  const accountSid = getSetting('TWILIO_ACCOUNT_SID');
  const authToken = getSetting('TWILIO_AUTH_TOKEN');
  const fromNumber = getSetting('TWILIO_PHONE_NUMBER');
  const scriptTemplate = campaign?.call_script || getSetting('CALLING_DEFAULT_SCRIPT');
  const greeting = scriptTemplate.replace(/\{name\}/gi, lead.name);

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio Account SID, Auth Token, or From Number missing. Please check Agent Settings.');
  }

  const toPhone = formatPhoneNumber(lead.phone_number);
  const twiml = `<Response><Say voice="Polly.Aditi">${greeting}</Say><Pause length="1"/><Say voice="Polly.Aditi">Sneha Harmony will send you lesson details on WhatsApp. Have a great day!</Say></Response>`;

  const formData = new URLSearchParams();
  formData.append('To', toPhone);
  formData.append('From', fromNumber);
  formData.append('Twiml', twiml);

  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  });

  const resJson = await response.json();
  if (!response.ok) {
    throw new Error(resJson.message || 'Twilio call placement failed');
  }

  const callSid = resJson.sid;

  db.prepare(`
    UPDATE calling_leads 
    SET call_status = 'calling',
        external_call_id = ?,
        call_attempts = call_attempts + 1,
        last_called_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(callSid, lead.id);

  db.prepare(`
    INSERT INTO call_logs (id, lead_id, phone_number, lead_name, direction, status, transcript, outcome, external_call_id)
    VALUES (?, ?, ?, ?, 'outbound', 'calling', ?, 'Real-time Twilio voice call placed', ?)
  `).run(`call_${Date.now()}`, lead.id, lead.phone_number, lead.name, `[Twilio Outbound]: Dialing ${toPhone}...`, callSid);

  logActivity('calling', 'live_call_dispatched', 'success', `Twilio live call dispatched to ${lead.name} (${toPhone}) [SID: ${callSid}]`);

  return {
    isLive: true,
    provider: 'twilio',
    callId: callSid,
    name: lead.name,
    phoneNumber: toPhone,
    status: 'calling',
    transcript: `[Live Call Dispatched via Twilio]\nCalling Number: ${toPhone}\nCall SID: ${callSid}\nStatus: ${resJson.status}`,
    outcome: 'Twilio call initiated.'
  };
}

// ----------------------------------------------------
// 3. SIMULATED TEST CALL ENGINE (Fallback / Free Demo)
// ----------------------------------------------------
async function simulateCallToLead(leadId) {
  const lead = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(leadId);
  if (!lead) {
    throw new Error(`Lead #${leadId} not found`);
  }

  const campaign = db.prepare('SELECT * FROM calling_campaigns WHERE id = ?').get(lead.campaign_id);
  const scriptTemplate = campaign?.call_script || getSetting('CALLING_DEFAULT_SCRIPT');
  const greeting = scriptTemplate.replace(/\{name\}/gi, lead.name);

  // Mark in-call
  db.prepare("UPDATE calling_leads SET call_status = 'calling', call_attempts = call_attempts + 1, last_called_at = CURRENT_TIMESTAMP WHERE id = ?").run(leadId);

  const callDuration = Math.floor(Math.random() * 70) + 25;

  const scenarios = [
    {
      status: 'interested',
      outcome: 'Interested in beginner acoustic lessons. Wants course outline sent on WhatsApp.',
      followUpHours: 48,
      followUpNotes: 'Send WhatsApp brochure and price package. Call back Friday 4 PM.',
      transcript: `[Agent]: "${greeting}"
[${lead.name}]: "Hi Aria! Yes, I was actually looking at Sneha's guitar covers on YouTube! Do you teach complete beginners?"
[Agent]: "Absolutely! Sneha teaches step-by-step acoustic guitar from scratch, holding chords, strumming rhythms, and playing your favorite songs. We have 1-on-1 online sessions available."
[${lead.name}]: "That sounds perfect! Can you send me the schedule and fees so I can pick a slot?"
[Agent]: "I'd love to! I'll send the details over WhatsApp right after this call, and our team will follow up to help you book your first trial session."
[${lead.name}]: "Awesome, thank you so much!"`
    },
    {
      status: 'needs_follow_up',
      outcome: 'Lead requested a callback tomorrow afternoon.',
      followUpHours: 24,
      followUpNotes: 'Call back tomorrow between 3:00 PM - 5:00 PM.',
      transcript: `[Agent]: "${greeting}"
[${lead.name}]: "Hello! Yes, I am interested, but I'm driving right now. Can you call me back tomorrow afternoon?"
[Agent]: "Of course, ${lead.name}! I completely understand. I will schedule a follow-up call for tomorrow afternoon around 3:30 PM. Drive safe!"
[${lead.name}]: "Thanks a lot, speak to you then."`
    },
    {
      status: 'interested',
      outcome: 'Collaborator inquiry: Wants to collaborate on an acoustic YouTube / Reel video.',
      followUpHours: 72,
      followUpNotes: 'Discuss creator collab track and dates. Send email to support@sneharmony.com.',
      transcript: `[Agent]: "${greeting}"
[${lead.name}]: "Hey! Yes, I'm a music producer and creator, loved Sneha's acoustic tone. Wanted to see if she does collaborations?"
[Agent]: "Yes! Sneha actively collaborates with artists, vocalists, and creators. Could you share a quick link to your channel or portfolio?"
[${lead.name}]: "Sure, I'll send it over WhatsApp or email."
[Agent]: "Perfect! Sneha's manager contact is also noted, and we will follow up with you on collaboration dates."`
    },
    {
      status: 'completed',
      outcome: 'Information provided. Lead will review channel and sign up online.',
      followUpHours: null,
      followUpNotes: 'Information provided, no urgent callback needed.',
      transcript: `[Agent]: "${greeting}"
[${lead.name}]: "Hi Aria! I was just curious about lesson timings."
[Agent]: "Our sessions run Monday through Saturday between 10 AM and 7 PM IST, with flexible evening slots."
[${lead.name}]: "Got it, that fits my routine. I'll check the channel and book a slot online."
[Agent]: "Wonderful! Have a great day and happy strumming!"`
    },
    {
      status: 'busy',
      outcome: 'Call rang out / Voicemail reached.',
      followUpHours: 6,
      followUpNotes: 'No answer. Retry call later today.',
      transcript: `[Call Dialing]: +${lead.phone_number}...
[System]: Ringing (4 rings)...
[Voicemail]: "Please leave your message after the tone."
[Agent]: "Hi ${lead.name}, this is Aria from Sneharmony calling regarding your music inquiry. We will try reaching you again later today, or feel free to message us on WhatsApp!"`
    }
  ];

  const scenario = scenarios[leadId % scenarios.length];

  let followUpDate = null;
  if (scenario.followUpHours) {
    const d = new Date();
    d.setHours(d.getHours() + scenario.followUpHours);
    followUpDate = d.toISOString().slice(0, 19).replace('T', ' ');
  }

  // Update lead in DB
  db.prepare(`
    UPDATE calling_leads 
    SET call_status = ?,
        call_duration = ?,
        call_transcript = ?,
        follow_up_date = COALESCE(?, follow_up_date),
        follow_up_notes = COALESCE(?, follow_up_notes),
        follow_up_status = CASE WHEN ? IS NOT NULL THEN 'pending' ELSE follow_up_status END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    scenario.status,
    callDuration,
    scenario.transcript,
    followUpDate,
    scenario.followUpNotes,
    followUpDate,
    leadId
  );

  // Update campaign completed_calls count
  if (lead.campaign_id) {
    db.prepare(`
      UPDATE calling_campaigns 
      SET completed_calls = (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = ? AND call_status != 'pending'),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(lead.campaign_id, lead.campaign_id);
  }

  // Log to call_logs
  const logId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(`
    INSERT INTO call_logs (id, lead_id, phone_number, lead_name, direction, duration, status, transcript, outcome)
    VALUES (?, ?, ?, ?, 'outbound', ?, ?, ?, ?)
  `).run(
    logId,
    lead.id,
    lead.phone_number,
    lead.name,
    callDuration,
    scenario.status,
    scenario.transcript,
    scenario.outcome
  );

  logActivity('calling', 'call_completed', 'success', `Called ${lead.name} (${lead.phone_number}): ${scenario.status} [${callDuration}s]`);

  return {
    isLive: false,
    leadId,
    name: lead.name,
    phoneNumber: lead.phone_number,
    status: scenario.status,
    duration: callDuration,
    transcript: scenario.transcript,
    outcome: scenario.outcome,
    followUpDate,
    followUpNotes: scenario.followUpNotes
  };
}

// ----------------------------------------------------
// 4. MAIN DISPATCHER: LIVE OR SIMULATION
// ----------------------------------------------------
async function dispatchCallToLead(leadId) {
  const lead = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(leadId);
  if (!lead) {
    throw new Error(`Lead #${leadId} not found`);
  }

  const campaign = db.prepare('SELECT * FROM calling_campaigns WHERE id = ?').get(lead.campaign_id);
  const callingMode = getSetting('CALLING_MODE') || 'simulation';
  const provider = getSetting('CALLING_PROVIDER') || 'vapi';

  if (callingMode === 'live') {
    if (provider === 'vapi' && getSetting('VAPI_API_KEY')) {
      return await callVapiVoiceAgent(lead, campaign);
    } else if (provider === 'twilio' && getSetting('TWILIO_ACCOUNT_SID')) {
      return await callTwilioVoice(lead, campaign);
    } else {
      console.warn('Live mode enabled but API credentials are empty. Running simulation.');
      return await simulateCallToLead(leadId);
    }
  }

  return await simulateCallToLead(leadId);
}

// Schedule or update Follow-Up for a lead
function scheduleLeadFollowUp(leadId, followUpDate, notes) {
  const existing = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(leadId);
  if (!existing) {
    throw new Error(`Lead #${leadId} not found`);
  }

  db.prepare(`
    UPDATE calling_leads 
    SET follow_up_date = ?,
        follow_up_notes = ?,
        call_status = 'needs_follow_up',
        follow_up_status = 'pending',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(followUpDate, notes, leadId);

  const lead = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(leadId);
  logActivity('calling', 'followup_scheduled', 'success', `Scheduled follow-up for ${lead?.name} on ${followUpDate}`);
  return lead;
}

// Generate Exportable Excel File buffer with updated statuses & follow-ups
function exportCampaignToExcelBuffer(campaignId) {
  const campaign = db.prepare('SELECT * FROM calling_campaigns WHERE id = ?').get(campaignId);
  const leads = db.prepare('SELECT * FROM calling_leads WHERE campaign_id = ? ORDER BY id ASC').all(campaignId);

  const exportRows = leads.map((l, idx) => ({
    'No.': idx + 1,
    'Lead Name': l.name,
    'Phone Number': l.phone_number,
    'Email': l.email || '',
    'Interest': l.interest || '',
    'Call Status': (l.call_status || 'pending').toUpperCase(),
    'Call Duration (sec)': l.call_duration || 0,
    'Call Attempts': l.call_attempts || 0,
    'Last Called At': l.last_called_at || '',
    'Follow-Up Date': l.follow_up_date || '',
    'Follow-Up Notes': l.follow_up_notes || '',
    'Follow-Up Status': (l.follow_up_status || '').toUpperCase(),
    'Lead Notes': l.notes || '',
    'Call Transcript Summary': (l.call_transcript || '').slice(0, 300)
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Call_Results_&_FollowUps');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  formatPhoneNumber,
  parseExcelFile,
  createCampaign,
  dispatchCallToLead,
  simulateCallToLead,
  callVapiVoiceAgent,
  callTwilioVoice,
  scheduleLeadFollowUp,
  exportCampaignToExcelBuffer
};
