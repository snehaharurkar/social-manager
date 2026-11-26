const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, getSetting, setSetting, logActivity } = require('../db');
const {
  parseExcelFile,
  createCampaign,
  dispatchCallToLead,
  simulateCallToLead,
  scheduleLeadFollowUp,
  exportCampaignToExcelBuffer,
  formatPhoneNumber
} = require('../services/calling');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage for spreadsheet uploads (.xlsx, .xls, .csv)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `sheet_${Date.now()}_${cleanBase}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (req, file, cb) => {
    const allowed = /\.(xlsx|xls|csv)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Please upload an Excel spreadsheet (.xlsx, .xls) or CSV file.'));
    }
  }
});

// 1. Upload & Parse Excel / CSV Sheet
router.post('/upload-sheet', upload.single('sheet'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No spreadsheet file uploaded.' });
    }

    const filePath = req.file.path;
    const parsedData = parseExcelFile(filePath);

    res.json({
      success: true,
      fileName: req.file.originalname,
      storedFileName: req.file.filename,
      filePath,
      sheetName: parsedData.sheetName,
      totalRows: parsedData.totalRows,
      detectedColumns: parsedData.detectedColumns,
      validLeads: parsedData.validLeads
    });
  } catch (err) {
    console.error('Error parsing uploaded sheet:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to parse Excel sheet.' });
  }
});

// 2. Create Calling Campaign from parsed leads
router.post('/campaigns', (req, res) => {
  try {
    const { title, fileName, leads, customScript, delaySeconds } = req.body;
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ success: false, error: 'No leads provided to create campaign.' });
    }

    const result = createCampaign(title, fileName, leads, customScript, delaySeconds);
    res.json({
      success: true,
      campaignId: result.campaignId,
      totalLeads: result.totalLeads,
      message: `Campaign created with ${result.totalLeads} leads!`
    });
  } catch (err) {
    console.error('Error creating calling campaign:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. List All Calling Campaigns
router.get('/campaigns', (req, res) => {
  try {
    const campaigns = db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id) as total_leads,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status != 'pending') as completed_calls,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'interested') as count_interested,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'needs_follow_up') as count_needs_follow_up,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'busy') as count_busy,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'completed') as count_completed,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'not_interested') as count_not_interested,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'pending') as count_pending
      FROM calling_campaigns c
      ORDER BY c.created_at DESC
    `).all();

    res.json({ success: true, campaigns });
  } catch (err) {
    console.error('Error listing campaigns:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Single Campaign Details & Stats
router.get('/campaigns/:id', (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id) as total_leads,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status != 'pending') as completed_calls,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'interested') as count_interested,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'needs_follow_up') as count_needs_follow_up,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'busy') as count_busy,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'completed') as count_completed,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'not_interested') as count_not_interested,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'pending') as count_pending
      FROM calling_campaigns c
      WHERE c.id = ?
    `).get(campaignId);

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({ success: true, campaign });
  } catch (err) {
    console.error('Error fetching campaign:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Get Leads for a Campaign
router.get('/campaigns/:id/leads', (req, res) => {
  try {
    const campaignId = req.params.id;
    const { status, search } = req.query;

    let query = `SELECT * FROM calling_leads WHERE campaign_id = ?`;
    const params = [campaignId];

    if (status && status !== 'all') {
      query += ` AND call_status = ?`;
      params.push(status);
    }

    if (search && search.trim()) {
      query += ` AND (name LIKE ? OR phone_number LIKE ? OR email LIKE ? OR interest LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY id ASC`;

    const leads = db.prepare(query).all(...params);
    res.json({ success: true, leads });
  } catch (err) {
    console.error('Error fetching leads:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Trigger AI Call to a Single Lead (Live Voice AI or Simulation)
router.post('/leads/:id/call', async (req, res) => {
  try {
    const leadId = req.params.id;
    const callResult = await dispatchCallToLead(leadId);
    res.json({ success: true, callResult });
  } catch (err) {
    console.error('Error making call to lead:', err);
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6b. Add a Single Individual Lead Manually
router.post('/leads', (req, res) => {
  try {
    const { campaign_id, name, phone_number, email, interest, notes, follow_up_date, follow_up_notes } = req.body;
    if (!name || !phone_number) {
      return res.status(400).json({ success: false, error: 'Lead name and phone number are required.' });
    }

    let cId = campaign_id ? Number(campaign_id) : null;
    if (!cId) {
      let defaultCamp = db.prepare("SELECT id FROM calling_campaigns WHERE title = 'Direct Inquiries & Manual Leads'").get();
      if (!defaultCamp) {
        const campRes = db.prepare(`
          INSERT INTO calling_campaigns (title, file_name, total_leads, completed_calls, status, delay_seconds)
          VALUES ('Direct Inquiries & Manual Leads', 'manual_entry', 0, 0, 'idle', 6)
        `).run();
        cId = Number(campRes.lastInsertRowid);
      } else {
        cId = defaultCamp.id;
      }
    }

    const cleanPhone = formatPhoneNumber(phone_number);

    const stmt = db.prepare(`
      INSERT INTO calling_leads (
        campaign_id, name, phone_number, email, interest, notes, call_status, follow_up_date, follow_up_notes
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `);

    const result = stmt.run(
      cId,
      name.trim(),
      cleanPhone,
      email ? email.trim() : null,
      interest ? interest.trim() : 'Guitar & Music Inquiry',
      notes ? notes.trim() : null,
      follow_up_date || null,
      follow_up_notes || null
    );

    const leadId = Number(result.lastInsertRowid);

    // Update campaign total_leads count
    db.prepare(`
      UPDATE calling_campaigns 
      SET total_leads = (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = ?)
      WHERE id = ?
    `).run(cId, cId);

    const createdLead = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(leadId);
    logActivity('calling', 'lead_added_manually', 'success', `Added individual lead ${name} (${cleanPhone})`);

    res.json({ success: true, lead: createdLead, message: 'Individual lead added successfully!' });
  } catch (err) {
    console.error('Error adding individual lead:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6c. Quick Direct Call to an Individual Number
router.post('/call-direct', async (req, res) => {
  try {
    const { name, phone_number, email, interest, notes, campaign_id } = req.body;
    if (!phone_number) {
      return res.status(400).json({ success: false, error: 'Phone number is required to place a call.' });
    }

    const cleanPhone = formatPhoneNumber(phone_number);
    const leadName = (name && name.trim()) ? name.trim() : 'Direct Caller';

    let cId = campaign_id ? Number(campaign_id) : null;
    if (!cId) {
      let defaultCamp = db.prepare("SELECT id FROM calling_campaigns WHERE title = 'Direct Inquiries & Manual Leads'").get();
      if (!defaultCamp) {
        const campRes = db.prepare(`
          INSERT INTO calling_campaigns (title, file_name, total_leads, completed_calls, status, delay_seconds)
          VALUES ('Direct Inquiries & Manual Leads', 'manual_entry', 0, 0, 'idle', 6)
        `).run();
        cId = Number(campRes.lastInsertRowid);
      } else {
        cId = defaultCamp.id;
      }
    }

    // Check if lead already exists with this phone
    let lead = db.prepare('SELECT * FROM calling_leads WHERE phone_number = ? ORDER BY id DESC LIMIT 1').get(cleanPhone);
    if (!lead) {
      const insert = db.prepare(`
        INSERT INTO calling_leads (
          campaign_id, name, phone_number, email, interest, notes, call_status
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        cId,
        leadName,
        cleanPhone,
        email || null,
        interest || 'Guitar Lessons Inquiry',
        notes || 'Direct quick call'
      );
      lead = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(Number(insert.lastInsertRowid));
    } else {
      // Update name if provided
      if (name && name.trim()) {
        db.prepare('UPDATE calling_leads SET name = ? WHERE id = ?').run(leadName, lead.id);
        lead.name = leadName;
      }
    }

    // Now dispatch call immediately
    const callResult = await dispatchCallToLead(lead.id);

    res.json({
      success: true,
      lead,
      callResult,
      message: `Call placed to ${leadName} (${cleanPhone})`
    });
  } catch (err) {
    console.error('Error placing direct individual call:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Update Lead Status, Notes, or Follow-up manually
router.put('/leads/:id', (req, res) => {
  try {
    const leadId = req.params.id;
    const {
      call_status,
      notes,
      follow_up_date,
      follow_up_notes,
      follow_up_status
    } = req.body;

    const current = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(leadId);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    db.prepare(`
      UPDATE calling_leads
      SET call_status = COALESCE(?, call_status),
          notes = COALESCE(?, notes),
          follow_up_date = COALESCE(?, follow_up_date),
          follow_up_notes = COALESCE(?, follow_up_notes),
          follow_up_status = COALESCE(?, follow_up_status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      call_status !== undefined ? call_status : current.call_status,
      notes !== undefined ? notes : current.notes,
      follow_up_date !== undefined ? follow_up_date : current.follow_up_date,
      follow_up_notes !== undefined ? follow_up_notes : current.follow_up_notes,
      follow_up_status !== undefined ? follow_up_status : current.follow_up_status,
      leadId
    );

    const updated = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(leadId);
    res.json({ success: true, lead: updated });
  } catch (err) {
    console.error('Error updating lead:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Delete a Lead
router.delete('/leads/:id', (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    db.prepare('DELETE FROM calling_leads WHERE id = ?').run(leadId);
    if (lead.campaign_id) {
      db.prepare(`
        UPDATE calling_campaigns
        SET total_leads = (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = ?)
        WHERE id = ?
      `).run(lead.campaign_id, lead.campaign_id);
    }

    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    console.error('Error deleting lead:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Schedule Follow-up for a Lead
router.post('/leads/:id/follow-up', (req, res) => {
  try {
    const leadId = req.params.id;
    const { followUpDate, notes } = req.body;
    if (!followUpDate) {
      return res.status(400).json({ success: false, error: 'Follow-up date/time is required.' });
    }

    const updated = scheduleLeadFollowUp(leadId, followUpDate, notes || '');
    res.json({ success: true, lead: updated });
  } catch (err) {
    console.error('Error scheduling follow-up:', err);
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. List All Follow-Ups across campaigns
router.get('/follow-ups', (req, res) => {
  try {
    const { campaignId, status } = req.query;

    let query = `
      SELECT 
        l.*,
        c.title as campaign_title
      FROM calling_leads l
      LEFT JOIN calling_campaigns c ON l.campaign_id = c.id
      WHERE (l.follow_up_date IS NOT NULL OR l.call_status = 'needs_follow_up')
    `;
    const params = [];

    if (campaignId && campaignId !== 'all') {
      query += ` AND l.campaign_id = ?`;
      params.push(campaignId);
    }

    if (status && status !== 'all') {
      query += ` AND l.follow_up_status = ?`;
      params.push(status);
    }

    query += ` ORDER BY l.follow_up_date ASC, l.updated_at DESC`;

    const followUps = db.prepare(query).all(...params);

    // Group into categories: Overdue, Today, Upcoming, Completed
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const categorized = {
      overdue: [],
      today: [],
      upcoming: [],
      completed: []
    };

    followUps.forEach(f => {
      if (f.follow_up_status === 'completed') {
        categorized.completed.push(f);
      } else if (!f.follow_up_date) {
        categorized.today.push(f);
      } else {
        const dStr = f.follow_up_date.slice(0, 10);
        if (dStr < todayStr) {
          categorized.overdue.push(f);
        } else if (dStr === todayStr) {
          categorized.today.push(f);
        } else {
          categorized.upcoming.push(f);
        }
      }
    });

    res.json({
      success: true,
      followUps,
      counts: {
        total: followUps.length,
        overdue: categorized.overdue.length,
        today: categorized.today.length,
        upcoming: categorized.upcoming.length,
        completed: categorized.completed.length
      },
      categorized
    });
  } catch (err) {
    console.error('Error fetching follow-ups:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Export Campaign Results to Excel (.xlsx)
router.get('/campaigns/:id/export', (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = db.prepare('SELECT * FROM calling_campaigns WHERE id = ?').get(campaignId);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const buffer = exportCampaignToExcelBuffer(campaignId);
    const cleanTitle = (campaign.title || 'campaign').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanTitle}_results_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting campaign to Excel:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Delete Entire Campaign
router.delete('/campaigns/:id', (req, res) => {
  try {
    const campaignId = req.params.id;
    db.prepare('DELETE FROM calling_leads WHERE campaign_id = ?').run(campaignId);
    db.prepare('DELETE FROM calling_campaigns WHERE id = ?').run(campaignId);
    res.json({ success: true, message: 'Campaign and its leads deleted successfully.' });
  } catch (err) {
    console.error('Error deleting campaign:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Get Calling Settings
router.get('/settings', (req, res) => {
  try {
    const agentName = getSetting('CALLING_AGENT_NAME') || 'Aria (Sneharmony AI Caller)';
    const defaultScript = getSetting('CALLING_DEFAULT_SCRIPT') || 'Hello {name}! This is Aria from Sneha Harmony calling to see if you had any questions about our music classes or guitar sessions.';
    const systemPrompt = getSetting('CALLING_SYSTEM_PROMPT') || '';
    const delayBetweenCalls = Number(getSetting('CALLING_DELAY_BETWEEN_CALLS')) || 8;
    const voiceGender = getSetting('CALLING_VOICE_GENDER') || 'female';
    const callingMode = getSetting('CALLING_MODE') || 'simulation';
    const callingProvider = getSetting('CALLING_PROVIDER') || 'vapi';
    const vapiApiKey = getSetting('VAPI_API_KEY') || '';
    const vapiPhoneNumberId = getSetting('VAPI_PHONE_NUMBER_ID') || '';
    const vapiAssistantId = getSetting('VAPI_ASSISTANT_ID') || '';
    const twilioAccountSid = getSetting('TWILIO_ACCOUNT_SID') || '';
    const twilioAuthToken = getSetting('TWILIO_AUTH_TOKEN') || '';
    const twilioPhoneNumber = getSetting('TWILIO_PHONE_NUMBER') || '';

    res.json({
      success: true,
      settings: {
        agentName,
        defaultScript,
        systemPrompt,
        delayBetweenCalls,
        voiceGender,
        callingMode,
        callingProvider,
        vapiApiKey: vapiApiKey ? '••••••••••••••••' : '',
        vapiPhoneNumberId,
        vapiAssistantId,
        twilioAccountSid,
        twilioAuthToken: twilioAuthToken ? '••••••••••••••••' : '',
        twilioPhoneNumber
      }
    });
  } catch (err) {
    console.error('Error fetching calling settings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Update Calling Settings
router.post('/settings', (req, res) => {
  try {
    const {
      agentName,
      defaultScript,
      systemPrompt,
      delayBetweenCalls,
      voiceGender,
      callingMode,
      callingProvider,
      vapiApiKey,
      vapiPhoneNumberId,
      vapiAssistantId,
      twilioAccountSid,
      twilioAuthToken,
      twilioPhoneNumber
    } = req.body;

    if (agentName !== undefined) setSetting('CALLING_AGENT_NAME', agentName);
    if (defaultScript !== undefined) setSetting('CALLING_DEFAULT_SCRIPT', defaultScript);
    if (systemPrompt !== undefined) setSetting('CALLING_SYSTEM_PROMPT', systemPrompt);
    if (delayBetweenCalls !== undefined) setSetting('CALLING_DELAY_BETWEEN_CALLS', String(delayBetweenCalls));
    if (voiceGender !== undefined) setSetting('CALLING_VOICE_GENDER', voiceGender);
    if (callingMode !== undefined) setSetting('CALLING_MODE', callingMode);
    if (callingProvider !== undefined) setSetting('CALLING_PROVIDER', callingProvider);
    if (vapiApiKey !== undefined && !vapiApiKey.includes('••••')) setSetting('VAPI_API_KEY', vapiApiKey.trim());
    if (vapiPhoneNumberId !== undefined) setSetting('VAPI_PHONE_NUMBER_ID', vapiPhoneNumberId.trim());
    if (vapiAssistantId !== undefined) setSetting('VAPI_ASSISTANT_ID', vapiAssistantId.trim());
    if (twilioAccountSid !== undefined) setSetting('TWILIO_ACCOUNT_SID', twilioAccountSid.trim());
    if (twilioAuthToken !== undefined && !twilioAuthToken.includes('••••')) setSetting('TWILIO_AUTH_TOKEN', twilioAuthToken.trim());
    if (twilioPhoneNumber !== undefined) setSetting('TWILIO_PHONE_NUMBER', twilioPhoneNumber.trim());

    res.json({ success: true, message: 'Calling agent and Voice AI settings updated!' });
  } catch (err) {
    console.error('Error saving calling settings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. Webhook for Vapi.ai (End of Call Reports & Transcripts)
router.post('/webhook/vapi', (req, res) => {
  try {
    const configuredSecret = getSetting('VAPI_WEBHOOK_SECRET');
    if (configuredSecret) {
      const providedSecret = req.headers['x-vapi-secret'] || req.query.secret;
      if (providedSecret !== configuredSecret) {
        return res.status(401).json({ error: 'Unauthorized webhook secret' });
      }
    }

    const payload = req.body;
    const message = payload?.message;
    if (message?.type === 'end-of-call-report' || message?.type === 'call-ended') {
      const call = message.call;
      const callId = call?.id;
      const duration = message.durationSeconds || call?.duration || 0;
      const transcript = message.transcript || call?.transcript || '';
      const summary = message.analysis?.summary || message.summary || '';
      const recordingUrl = message.recordingUrl || call?.recordingUrl || '';

      if (callId) {
        let status = 'completed';
        const lower = (summary + ' ' + transcript).toLowerCase();
        if (lower.includes('interested') || lower.includes('send brochure') || lower.includes('fees') || lower.includes('trial')) {
          status = 'interested';
        } else if (lower.includes('call back') || lower.includes('callback') || lower.includes('driving') || lower.includes('busy')) {
          status = 'needs_follow_up';
        } else if (lower.includes('voicemail') || lower.includes('no answer') || lower.includes('unanswered')) {
          status = 'busy';
        } else if (lower.includes('not interested') || lower.includes('wrong number')) {
          status = 'not_interested';
        }

        db.prepare(`
          UPDATE calling_leads
          SET call_status = ?,
              call_duration = ?,
              call_transcript = COALESCE(?, call_transcript),
              recording_url = COALESCE(?, recording_url),
              updated_at = CURRENT_TIMESTAMP
          WHERE external_call_id = ?
        `).run(status, Math.round(duration), transcript, recordingUrl, callId);

        db.prepare(`
          UPDATE call_logs
          SET status = ?,
              duration = ?,
              transcript = COALESCE(?, transcript),
              outcome = COALESCE(?, outcome),
              recording_url = COALESCE(?, recording_url)
          WHERE external_call_id = ?
        `).run(status, Math.round(duration), transcript, summary || status, recordingUrl, callId);

        logActivity('calling', 'vapi_call_ended', 'success', `Vapi call ${callId} ended: ${status} (${Math.round(duration)}s)`);
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Vapi webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 16. Webhook for Twilio Status Callbacks
router.post('/webhook/twilio', (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;
    if (CallSid) {
      let status = 'completed';
      if (CallStatus === 'busy' || CallStatus === 'no-answer') status = 'busy';
      else if (CallStatus === 'failed') status = 'not_interested';

      db.prepare(`
        UPDATE calling_leads
        SET call_status = ?,
            call_duration = COALESCE(?, call_duration),
            recording_url = COALESCE(?, recording_url),
            updated_at = CURRENT_TIMESTAMP
        WHERE external_call_id = ?
      `).run(status, Number(CallDuration) || 0, RecordingUrl || null, CallSid);

      logActivity('calling', 'twilio_call_status', 'success', `Twilio call ${CallSid} status: ${CallStatus}`);
    }
    res.type('text/xml').send('<Response/>');
  } catch (err) {
    console.error('Twilio webhook error:', err);
    res.status(500).send(err.message);
  }
});

module.exports = router;
