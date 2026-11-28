const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { db, getSetting, setSetting, logActivity, createNotification } = require('../db');
const {
  formatPhoneNumber,
  isNumberSuppressed,
  addToDoNotContact,
  diagnoseVapi,
  dispatchVapiCall,
  syncCallDetails,
  endVapiCall
} = require('../services/vapi');
const providerManager = require('../services/calling/providerManager');
const {
  startCampaign,
  pauseCampaign,
  stopCampaign,
  retryLead,
  activeCampaigns
} = require('../services/campaignRunner');
const {
  inspectSpreadsheet,
  importLeadsToCampaign
} = require('../services/sheetImporter');

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

// ----------------------------------------------------
// 0. SUMMARY DASHBOARD STATS (Real DB values only)
// ----------------------------------------------------
router.get('/stats', (req, res) => {
  try {
    const totalLeads = db.prepare('SELECT COUNT(*) as count FROM calling_leads').get().count;
    const eligibleLeads = db.prepare("SELECT COUNT(*) as count FROM calling_leads WHERE do_not_contact = 0 AND call_status != 'dnc'").get().count;
    const pendingCalls = db.prepare("SELECT COUNT(*) as count FROM calling_leads WHERE call_status = 'pending' AND do_not_contact = 0").get().count;
    const inProgressCalls = db.prepare("SELECT COUNT(*) as count FROM calling_leads WHERE call_status = 'calling'").get().count;
    const completedCalls = db.prepare("SELECT COUNT(*) as count FROM calling_leads WHERE call_status NOT IN ('pending', 'queued', 'calling')").get().count;
    const interestedLeads = db.prepare("SELECT COUNT(*) as count FROM calling_leads WHERE call_status = 'interested'").get().count;
    const failedCalls = db.prepare("SELECT COUNT(*) as count FROM calling_leads WHERE call_status IN ('failed', 'dnc')").get().count;
    const followUpsDue = db.prepare(`
      SELECT COUNT(*) as count FROM calling_leads 
      WHERE follow_up_date IS NOT NULL 
        AND follow_up_status = 'pending' 
        AND do_not_contact = 0
    `).get().count;
    const totalCampaigns = db.prepare('SELECT COUNT(*) as count FROM calling_campaigns').get().count;
    const totalCallLogs = db.prepare('SELECT COUNT(*) as count FROM call_logs').get().count;

    res.json({
      success: true,
      stats: {
        totalLeads,
        eligibleLeads,
        pendingCalls,
        inProgressCalls,
        completedCalls,
        interestedLeads,
        failedCalls,
        followUpsDue,
        totalCampaigns,
        totalCallLogs
      }
    });
  } catch (err) {
    console.error('Error fetching calling stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 1. VAPI TELEPHONY DIAGNOSTICS & SYSTEM HEALTH
// ----------------------------------------------------
router.get('/diagnostics', async (req, res) => {
  try {
    const diagnostics = await diagnoseVapi();
    res.json({ success: true, diagnostics });
  } catch (err) {
    console.error('Vapi diagnostics error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 1. MULTI-PROVIDER AI CALLING (VAPI, RETELL, OMNIDIMENSION)
// ----------------------------------------------------
router.get('/providers', async (req, res) => {
  try {
    const activeProvider = providerManager.getActiveProviderId();
    const providers = await providerManager.listProviders();
    res.json({ success: true, activeProvider, providers });
  } catch (err) {
    console.error('Error listing providers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/providers/active', (req, res) => {
  try {
    const { providerId } = req.body;
    const result = providerManager.setActiveProviderId(providerId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/providers/:provider/test', async (req, res) => {
  try {
    const result = await providerManager.testProvider(req.params.provider);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/providers/:provider/assistants', async (req, res) => {
  try {
    const assistants = await providerManager.listAssistants(req.params.provider);
    res.json({ success: true, assistants });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/providers/:provider/phone-numbers', async (req, res) => {
  try {
    const phoneNumbers = await providerManager.listPhoneNumbers(req.params.provider);
    res.json({ success: true, phoneNumbers });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/providers/:provider/config', (req, res) => {
  try {
    const result = providerManager.saveProviderConfig(req.params.provider, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Auto-select or fix default assistant and phone number
router.post('/diagnostics/auto-configure', async (req, res) => {
  try {
    const diag = await diagnoseVapi();
    if (!diag.apiKeyValid) {
      return res.status(400).json({ success: false, error: 'Cannot auto-configure: Vapi API Key is invalid.' });
    }

    if (diag.assistants.length > 0 && !getSetting('VAPI_ASSISTANT_ID')) {
      setSetting('VAPI_ASSISTANT_ID', diag.assistants[0].id);
    }
    if (diag.phoneNumbers.length > 0 && !getSetting('VAPI_PHONE_NUMBER_ID')) {
      setSetting('VAPI_PHONE_NUMBER_ID', diag.phoneNumbers[0].id);
    }
    setSetting('CALLING_MODE', 'live');

    const updated = await diagnoseVapi();
    res.json({ success: true, message: 'Vapi assistant & phone number auto-configured successfully.', diagnostics: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 2. INDIVIDUAL LEAD CALLING & MANAGEMENT
// ----------------------------------------------------
router.post('/leads/:id/call', async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const { provider, customOpeningMessage, assistantId, fromNumber } = req.body;

    const result = await providerManager.dispatchCall({
      leadId,
      providerId: provider,
      customOpeningMessage,
      assistantId,
      fromNumber
    });

    res.json({ success: true, call: result });
  } catch (err) {
    console.error(`Error calling lead #${req.params.id}:`, err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Retry a lead
router.post('/leads/:id/retry', async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const result = await retryLead(leadId);
    res.json({ success: true, call: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Suppress a lead (Mark as Do Not Contact)
router.post('/leads/:id/dnc', (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const lead = db.prepare('SELECT phone_number, name FROM calling_leads WHERE id = ?').get(leadId);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

    addToDoNotContact(lead.phone_number, req.body.reason || 'Manually marked Do Not Contact', 'crm_ui');
    res.json({ success: true, message: `${lead.name} (${lead.phone_number}) marked as Do Not Contact.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sync live call details from provider
router.get('/calls/:callId/sync', async (req, res) => {
  try {
    const details = await providerManager.syncCall(req.params.callId, req.query.provider);
    if (!details) return res.status(404).json({ success: false, error: 'Call not found' });
    res.json({ success: true, call: details });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Terminate live call
router.post('/calls/:callId/end', async (req, res) => {
  try {
    const success = await providerManager.endCall(req.params.callId, req.body.provider);
    res.json({ success, message: success ? 'Call terminated successfully' : 'Failed to terminate call' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch all calling leads with search and filters
router.get('/leads', (req, res) => {
  try {
    const { campaignId, status, search, limit = 500, offset = 0 } = req.query;
    let query = `
      SELECT 
        l.*,
        c.title as campaign_title
      FROM calling_leads l
      LEFT JOIN calling_campaigns c ON l.campaign_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (campaignId && campaignId !== 'all') {
      query += ` AND l.campaign_id = ?`;
      params.push(campaignId);
    }

    if (status && status !== 'all') {
      query += ` AND l.call_status = ?`;
      params.push(status);
    }

    if (search && search.trim()) {
      query += ` AND (l.name LIKE ? OR l.phone_number LIKE ? OR l.email LIKE ? OR l.notes LIKE ? OR l.interest LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    query += ` ORDER BY l.id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const leads = db.prepare(query).all(...params);
    res.json({ success: true, leads });
  } catch (err) {
    console.error('Error fetching leads:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch single lead details with call history
router.get('/leads/:id', (req, res) => {
  try {
    const lead = db.prepare(`
      SELECT l.*, c.title as campaign_title 
      FROM calling_leads l
      LEFT JOIN calling_campaigns c ON l.campaign_id = c.id
      WHERE l.id = ?
    `).get(req.params.id);

    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

    // Fetch full call history for this lead
    const callHistory = db.prepare(`
      SELECT * FROM call_logs 
      WHERE lead_id = ? OR phone_number = ?
      ORDER BY datetime(created_at) DESC
    `).all(lead.id, lead.phone_number);

    res.json({ success: true, lead, callHistory });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create single manual lead
router.post('/leads', (req, res) => {
  try {
    const { name, phone_number, email, company, interest, notes, campaign_id, provider } = req.body;
    if (!phone_number) return res.status(400).json({ success: false, error: 'Phone number is required.' });

    const cleanPhone = formatPhoneNumber(phone_number);
    const isDnd = isNumberSuppressed(cleanPhone) ? 1 : 0;
    const resolvedProvider = provider || providerManager.getActiveProviderId();

    const stmt = db.prepare(`
      INSERT INTO calling_leads (
        campaign_id, name, phone_number, email, company, interest, notes, 
        lead_source, call_status, do_not_contact, provider
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?)
    `);

    const result = stmt.run(
      campaign_id ? Number(campaign_id) : null,
      name ? name.trim() : 'Unnamed Lead',
      cleanPhone,
      email ? email.trim() : null,
      company ? company.trim() : null,
      interest ? interest.trim() : 'General Inquiry',
      notes ? notes.trim() : null,
      isDnd ? 'dnc' : 'pending',
      isDnd,
      resolvedProvider
    );

    const leadId = Number(result.lastInsertRowid);
    const lead = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(leadId);
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update lead
router.put('/leads/:id', (req, res) => {
  try {
    const { name, phone_number, email, company, interest, notes, call_status, follow_up_date, follow_up_notes } = req.body;
    
    db.prepare(`
      UPDATE calling_leads
      SET name = COALESCE(?, name),
          phone_number = COALESCE(?, phone_number),
          email = COALESCE(?, email),
          company = COALESCE(?, company),
          interest = COALESCE(?, interest),
          notes = COALESCE(?, notes),
          call_status = COALESCE(?, call_status),
          follow_up_date = COALESCE(?, follow_up_date),
          follow_up_notes = COALESCE(?, follow_up_notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      phone_number ? formatPhoneNumber(phone_number) : null,
      email ? email.trim() : null,
      company ? company.trim() : null,
      interest ? interest.trim() : null,
      notes ? notes.trim() : null,
      call_status || null,
      follow_up_date || null,
      follow_up_notes || null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(req.params.id);
    res.json({ success: true, lead: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete lead
router.delete('/leads/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM calling_leads WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 3. EXCEL / CSV BULK LEAD IMPORT WORKFLOW
// ----------------------------------------------------
router.post('/upload-sheet', upload.single('sheet'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const inspection = inspectSpreadsheet(req.file.path);
    res.json({
      success: true,
      filePath: req.file.path,
      fileName: req.file.originalname,
      ...inspection
    });
  } catch (err) {
    console.error('Error uploading sheet:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Re-apply custom mapping on an uploaded spreadsheet
router.post('/apply-mapping', (req, res) => {
  try {
    const { filePath, mapping } = req.body;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ success: false, error: 'Spreadsheet file session has expired. Please re-upload.' });
    }

    const inspection = inspectSpreadsheet(filePath, mapping);
    res.json({ success: true, ...inspection });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Confirm import and create campaign queue
router.post('/import-confirmed', (req, res) => {
  try {
    const { campaignTitle, fileName, leads, customScript, delaySeconds, assistantId, provider } = req.body;
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ success: false, error: 'No leads provided for import.' });
    }

    const resolvedProvider = provider || providerManager.getActiveProviderId();

    const imported = importLeadsToCampaign({
      campaignTitle,
      fileName,
      leads,
      customScript,
      delaySeconds,
      assistantId,
      provider: resolvedProvider
    });

    res.json({ success: true, ...imported });
  } catch (err) {
    console.error('Error importing leads:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 4. CAMPAIGN CONTROLS (START / PAUSE / RESUME / STOP)
// ----------------------------------------------------
router.get('/campaigns', (req, res) => {
  try {
    const campaigns = db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id) as total_lead_count,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'pending') as pending_count,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status NOT IN ('pending', 'queued', 'calling')) as completed_count,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status = 'interested') as interested_count,
        (SELECT COUNT(*) FROM calling_leads WHERE campaign_id = c.id AND call_status IN ('failed', 'dnc')) as failed_count
      FROM calling_campaigns c
      ORDER BY c.id DESC
    `).all();

    res.json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/campaigns/:id', (req, res) => {
  try {
    const campaign = db.prepare('SELECT * FROM calling_campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/campaigns/:id/start', async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const result = await startCampaign(campaignId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/campaigns/:id/pause', (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const result = pauseCampaign(campaignId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/campaigns/:id/stop', (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const result = stopCampaign(campaignId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/campaigns/:id', (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    stopCampaign(campaignId);
    db.prepare('DELETE FROM calling_leads WHERE campaign_id = ?').run(campaignId);
    db.prepare('DELETE FROM calling_campaigns WHERE id = ?').run(campaignId);
    res.json({ success: true, message: 'Campaign and associated leads deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export campaign leads to Excel buffer
router.get('/campaigns/:id/export', (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const campaign = db.prepare('SELECT * FROM calling_campaigns WHERE id = ?').get(campaignId);
    const leads = db.prepare('SELECT * FROM calling_leads WHERE campaign_id = ? ORDER BY id ASC').all(campaignId);

    const exportRows = leads.map((l, idx) => ({
      'No.': idx + 1,
      'Name': l.name,
      'Phone': l.phone_number,
      'Email': l.email || '',
      'Company': l.company || '',
      'Call Status': l.call_status,
      'Last Outcome': l.last_call_outcome || '',
      'Duration (sec)': l.call_duration || 0,
      'Follow-up Date': l.follow_up_date || '',
      'Follow-up Notes': l.follow_up_notes || '',
      'Notes': l.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Campaign Leads');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="campaign_${campaignId}_leads.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 5. CALL HISTORY & TRANSCRIPTS
// ----------------------------------------------------
router.get('/history', (req, res) => {
  try {
    const { limit = 200, status, search, campaignId, provider } = req.query;
    let query = `
      SELECT 
        l.*,
        c.title as campaign_title
      FROM call_logs l
      LEFT JOIN calling_campaigns c ON l.campaign_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND l.status = ?`;
      params.push(status);
    }

    if (provider && provider !== 'all') {
      query += ` AND l.provider = ?`;
      params.push(provider);
    }

    if (campaignId && campaignId !== 'all') {
      query += ` AND l.campaign_id = ?`;
      params.push(campaignId);
    }

    if (search && search.trim()) {
      query += ` AND (l.lead_name LIKE ? OR l.phone_number LIKE ? OR l.outcome LIKE ? OR l.transcript LIKE ? OR l.ai_summary LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    query += ` ORDER BY l.created_at DESC LIMIT ?`;
    params.push(Number(limit));

    const logs = db.prepare(query).all(...params);
    res.json({ success: true, logs });
  } catch (err) {
    console.error('Error fetching call history:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 6. FOLLOW-UP MANAGEMENT
// ----------------------------------------------------
router.get('/follow-ups', (req, res) => {
  try {
    const followUps = db.prepare(`
      SELECT 
        l.id as lead_id,
        l.name as lead_name,
        l.phone_number,
        l.email,
        l.follow_up_date,
        l.follow_up_notes,
        l.follow_up_status,
        l.call_status,
        l.last_call_outcome,
        l.last_called_at,
        c.id as campaign_id,
        c.title as campaign_title
      FROM calling_leads l
      LEFT JOIN calling_campaigns c ON l.campaign_id = c.id
      WHERE l.follow_up_date IS NOT NULL 
        AND l.do_not_contact = 0
      ORDER BY datetime(l.follow_up_date) ASC
    `).all();

    res.json({ success: true, followUps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/leads/:id/follow-up', (req, res) => {
  try {
    const { follow_up_date, notes } = req.body;
    db.prepare(`
      UPDATE calling_leads 
      SET follow_up_date = ?,
          follow_up_notes = ?,
          follow_up_status = 'pending',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(follow_up_date, notes || null, req.params.id);

    res.json({ success: true, message: 'Follow-up saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/follow-ups/:leadId/complete', (req, res) => {
  try {
    db.prepare(`
      UPDATE calling_leads 
      SET follow_up_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.params.leadId);
    res.json({ success: true, message: 'Follow-up completed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/follow-ups/:leadId/cancel', (req, res) => {
  try {
    db.prepare(`
      UPDATE calling_leads 
      SET follow_up_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.params.leadId);
    res.json({ success: true, message: 'Follow-up cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 7. DO NOT CONTACT (DND / SUPPRESSION) LIST
// ----------------------------------------------------
router.get('/dnc', (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM do_not_contact ORDER BY created_at DESC').all();
    res.json({ success: true, list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/dnc', (req, res) => {
  try {
    const { phone_number, reason } = req.body;
    if (!phone_number) return res.status(400).json({ success: false, error: 'Phone number required' });

    addToDoNotContact(phone_number, reason || 'Manually added to suppression list', 'manual');
    res.json({ success: true, message: 'Phone number added to Do Not Contact list' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/dnc/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT phone_number FROM do_not_contact WHERE id = ?').get(req.params.id);
    if (row) {
      db.prepare('DELETE FROM do_not_contact WHERE id = ?').run(req.params.id);
      db.prepare('UPDATE calling_leads SET do_not_contact = 0 WHERE phone_number = ?').run(row.phone_number);
    }
    res.json({ success: true, message: 'Number removed from Do Not Contact list' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 8. CALLER KNOWLEDGE & TELEPHONY SETTINGS
// ----------------------------------------------------
router.get('/settings', (req, res) => {
  try {
    const settings = {
      ACTIVE_CALLING_PROVIDER: providerManager.getActiveProviderId(),
      CALLING_MODE: getSetting('CALLING_MODE') || 'live',
      CALLING_PROVIDER: getSetting('CALLING_PROVIDER') || 'vapi',
      VAPI_API_KEY: getSetting('VAPI_API_KEY') || '',
      VAPI_PHONE_NUMBER_ID: getSetting('VAPI_PHONE_NUMBER_ID') || '',
      VAPI_ASSISTANT_ID: getSetting('VAPI_ASSISTANT_ID') || '',
      RETELL_API_KEY: getSetting('RETELL_API_KEY') || '',
      RETELL_AGENT_ID: getSetting('RETELL_AGENT_ID') || '',
      RETELL_PHONE_NUMBER: getSetting('RETELL_PHONE_NUMBER') || '',
      OMNIDIMENSION_API_KEY: getSetting('OMNIDIMENSION_API_KEY') || '',
      OMNIDIMENSION_AGENT_ID: getSetting('OMNIDIMENSION_AGENT_ID') || '',
      OMNIDIMENSION_PHONE_NUMBER: getSetting('OMNIDIMENSION_PHONE_NUMBER') || '',
      OMNIDIMENSION_BASE_URL: getSetting('OMNIDIMENSION_BASE_URL') || 'https://omnidim.io/api/v1',
      CALLING_AGENT_NAME: getSetting('CALLING_AGENT_NAME') || 'Aria',
      CALLING_AGENT_VOICE: getSetting('CALLING_AGENT_VOICE') || 'Elliot',
      CALLING_COMPANY_NAME: getSetting('CALLING_COMPANY_NAME') || '',
      CALLING_BUSINESS_DESCRIPTION: getSetting('CALLING_BUSINESS_DESCRIPTION') || '',
      CALLING_PRODUCT_DETAILS: getSetting('CALLING_PRODUCT_DETAILS') || '',
      CALLING_PRICING: getSetting('CALLING_PRICING') || '',
      CALLING_OFFERS: getSetting('CALLING_OFFERS') || '',
      CALLING_ELIGIBILITY: getSetting('CALLING_ELIGIBILITY') || '',
      CALLING_FAQS: getSetting('CALLING_FAQS') || '',
      CALLING_SALES_OBJECTIVES: getSetting('CALLING_SALES_OBJECTIVES') || '',
      CALLING_DEFAULT_SCRIPT: getSetting('CALLING_DEFAULT_SCRIPT') || '',
      CALLING_QUALIFICATION_QUESTIONS: getSetting('CALLING_QUALIFICATION_QUESTIONS') || '',
      CALLING_OBJECTION_HANDLING: getSetting('CALLING_OBJECTION_HANDLING') || '',
      CALLING_HUMAN_HANDOFF_CONTACT: getSetting('CALLING_HUMAN_HANDOFF_CONTACT') || '',
      CALLING_CLOSING_MESSAGE: getSetting('CALLING_CLOSING_MESSAGE') || '',
      CALLING_DELAY_BETWEEN_CALLS: getSetting('CALLING_DELAY_BETWEEN_CALLS') || '8',
      CALLING_MAX_ATTEMPTS: getSetting('CALLING_MAX_ATTEMPTS') || '3',
      CALLING_WINDOW_START: getSetting('CALLING_WINDOW_START') || '10:00',
      CALLING_WINDOW_END: getSetting('CALLING_WINDOW_END') || '19:00',
      CALLING_TIMEZONE: getSetting('CALLING_TIMEZONE') || 'Asia/Kolkata',
      CALLING_RECORDING_ENABLED: getSetting('CALLING_RECORDING_ENABLED') || '1',
      TWILIO_ACCOUNT_SID: getSetting('TWILIO_ACCOUNT_SID') || '',
      TWILIO_AUTH_TOKEN: getSetting('TWILIO_AUTH_TOKEN') || '',
      TWILIO_PHONE_NUMBER: getSetting('TWILIO_PHONE_NUMBER') || ''
    };

    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/settings', (req, res) => {
  try {
    const newSettings = req.body;
    for (const [k, v] of Object.entries(newSettings)) {
      if (typeof v === 'string' || typeof v === 'number') {
        setSetting(k, String(v));
      }
    }

    logActivity('calling', 'settings_updated', 'success', 'Updated AI Telecaller knowledge & voice configuration.');
    res.json({ success: true, message: 'Calling settings saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 9. MULTI-PROVIDER WEBHOOK HANDLERS (VAPI, RETELL, OMNIDIMENSION)
// ----------------------------------------------------
const handleProviderWebhook = (providerId) => async (req, res) => {
  try {
    console.log(`[${providerId.toUpperCase()} Webhook Received] Payload keys:`, Object.keys(req.body || {}));
    const result = await providerManager.processWebhook(providerId, req.body, req.headers);
    res.status(200).json(result);
  } catch (err) {
    console.error(`[${providerId}] Webhook processing warning:`, err.message);
    res.status(200).json({ received: true, warning: err.message });
  }
};

router.post('/webhook/vapi', handleProviderWebhook('vapi'));
router.post('/webhook/retell', handleProviderWebhook('retell'));
router.post('/webhook/omnidimension', handleProviderWebhook('omnidimension'));
router.post('/webhook/:provider', async (req, res) => {
  return handleProviderWebhook(req.params.provider)(req, res);
});
router.post('/webhook', handleProviderWebhook('vapi'));

module.exports = router;
