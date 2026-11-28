const express = require('express');
const router = express.Router();
const { db, logActivity } = require('../db');

// Helper to normalize lead from any platform into Unified Lead format
function normalizeCallingLead(row) {
  const isManual = (row.campaign_title || '').includes('Manual') || (row.notes || '').toLowerCase().includes('manual');
  return {
    id: String(row.id),
    original_id: row.id,
    platform: isManual ? 'manual' : 'calling',
    name: row.name || 'Anonymous Lead',
    identifier: row.phone_number,
    contact_details: row.phone_number,
    email: row.email || null,
    source: isManual ? 'Manual entry' : (row.campaign_title || 'AI Calling'),
    stage: mapToPipelineStage(row.call_status),
    status: row.call_status,
    interest: row.interest || 'Music Lessons',
    tags: row.interest ? [row.interest, isManual ? 'manual' : 'calling'] : [isManual ? 'manual' : 'calling'],
    notes: row.notes || row.call_transcript || '',
    score: calculateLeadScore({ status: row.call_status, interest: row.interest, transcript: row.call_transcript }),
    follow_up_date: row.follow_up_date || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeWhatsAppLead(row) {
  return {
    id: `wa_${row.id}`,
    original_id: row.id,
    platform: 'whatsapp',
    name: row.name || `WhatsApp User (${row.phone_number})`,
    identifier: row.phone_number,
    contact_details: row.phone_number,
    email: null,
    source: row.source || 'WhatsApp Inbound',
    stage: mapToPipelineStage(row.status),
    status: row.status,
    interest: 'WhatsApp Chat',
    tags: row.tags ? row.tags.split(',').map(t => t.trim()) : ['whatsapp'],
    notes: row.notes || '',
    score: calculateLeadScore({ status: row.status, tags: row.tags }),
    follow_up_date: null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeInstagramLead(row) {
  return {
    id: `ig_${row.id}`,
    original_id: row.id,
    platform: 'instagram',
    name: row.full_name || `@${row.ig_username}`,
    identifier: `@${row.ig_username}`,
    contact_details: `@${row.ig_username}`,
    email: null,
    source: row.source || 'Instagram Direct',
    stage: mapToPipelineStage(row.status),
    status: row.status,
    interest: 'Instagram DM',
    tags: row.tags ? row.tags.split(',').map(t => t.trim()) : ['instagram'],
    notes: row.notes || '',
    score: calculateLeadScore({ status: row.status, tags: row.tags }),
    follow_up_date: null,
    created_at: row.created_at,
    updated_at: row.created_at
  };
}

function normalizeTelegramLead(row) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || (row.username ? `@${row.username}` : `Chat ${row.chat_id}`);
  return {
    id: `tg_${row.id}`,
    original_id: row.id,
    platform: 'telegram',
    name: name,
    identifier: row.username ? `@${row.username}` : row.chat_id,
    contact_details: row.username ? `@${row.username}` : row.chat_id,
    email: null,
    source: row.source || 'Telegram Bot',
    stage: mapToPipelineStage(row.status),
    status: row.status,
    interest: 'Telegram Inquiry',
    tags: row.tags ? row.tags.split(',').map(t => t.trim()) : ['telegram'],
    notes: row.notes || '',
    score: calculateLeadScore({ status: row.status, tags: row.tags }),
    follow_up_date: null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapToPipelineStage(status) {
  if (!status) return 'new';
  const s = status.toLowerCase();
  if (['interested', 'qualified'].includes(s)) return 'interested';
  if (['needs_follow_up', 'contacted', 'engaged'].includes(s)) return 'contacted';
  if (['customer', 'converted', 'closed'].includes(s)) return 'converted';
  if (['not_interested', 'busy', 'no_answer', 'cancelled'].includes(s)) return 'lost';
  return 'new';
}

function calculateLeadScore(data) {
  let score = 20; // Base score
  const s = (data.status || '').toLowerCase();
  if (['interested', 'qualified'].includes(s)) score += 45;
  if (['contacted', 'engaged', 'needs_follow_up'].includes(s)) score += 25;
  if (['customer', 'converted'].includes(s)) score += 60;
  if (['not_interested'].includes(s)) score -= 15;

  if (data.interest && data.interest.toLowerCase().includes('guitar')) score += 15;
  if (data.tags && data.tags.toLowerCase().includes('pricing')) score += 20;
  return Math.min(Math.max(score, 5), 100);
}

// 1. GET /api/crm/leads - Unified CRM list across all platforms with clear source identification
router.get('/leads', (req, res) => {
  try {
    const { platform = 'all', stage = 'all', search = '', limit = 500 } = req.query;
    let unifiedLeads = [];

    // Fetch Calling & Manual Leads
    if (platform === 'all' || platform === 'calling' || platform === 'manual') {
      const callingQuery = `
        SELECT l.*, c.title as campaign_title 
        FROM calling_leads l
        LEFT JOIN calling_campaigns c ON l.campaign_id = c.id
        ORDER BY l.id DESC LIMIT ?
      `;
      const callingRows = db.prepare(callingQuery).all(Number(limit));
      const normalizedCalling = callingRows.map(normalizeCallingLead);
      if (platform === 'manual') {
        unifiedLeads.push(...normalizedCalling.filter(l => l.platform === 'manual'));
      } else if (platform === 'calling') {
        unifiedLeads.push(...normalizedCalling.filter(l => l.platform === 'calling'));
      } else {
        unifiedLeads.push(...normalizedCalling);
      }
    }

    // Fetch WhatsApp Leads
    if (platform === 'all' || platform === 'whatsapp') {
      const waRows = db.prepare('SELECT * FROM whatsapp_contacts ORDER BY id DESC LIMIT ?').all(Number(limit));
      unifiedLeads.push(...waRows.map(normalizeWhatsAppLead));
    }

    // Fetch Instagram Leads
    if (platform === 'all' || platform === 'instagram') {
      const igRows = db.prepare('SELECT * FROM instagram_leads ORDER BY id DESC LIMIT ?').all(Number(limit));
      unifiedLeads.push(...igRows.map(normalizeInstagramLead));
    }

    // Fetch Telegram Leads
    if (platform === 'all' || platform === 'telegram') {
      const tgRows = db.prepare('SELECT * FROM telegram_leads ORDER BY id DESC LIMIT ?').all(Number(limit));
      unifiedLeads.push(...tgRows.map(normalizeTelegramLead));
    }

    // Fetch YouTube Leads (Inquiries from YouTube comments)
    if (platform === 'all' || platform === 'youtube') {
      const ytComments = db.prepare(`
        SELECT * FROM comments 
        WHERE platform = 'youtube' AND (
          text LIKE '%phone%' OR 
          text LIKE '%call%' OR 
          text LIKE '%class%' OR 
          text LIKE '%lesson%' OR 
          text LIKE '%fees%' OR 
          text LIKE '%price%' OR 
          text LIKE '%whatsapp%' OR 
          text LIKE '%contact%' OR 
          text LIKE '%learn%'
        )
        ORDER BY id DESC LIMIT ?
      `).all(Number(limit));

      unifiedLeads.push(...ytComments.map(c => ({
        id: `yt_${c.id}`,
        original_id: c.id,
        platform: 'youtube',
        name: c.author_name || 'YouTube Inquirer',
        identifier: c.author_name || `@user_${c.id}`,
        contact_details: c.author_name || 'YouTube Commenter',
        email: null,
        source: 'YouTube',
        stage: c.replied ? 'contacted' : 'new',
        status: c.replied ? 'contacted' : 'new',
        interest: c.text ? (c.text.slice(0, 50) + '...') : 'YouTube Comment Inquiry',
        tags: ['youtube', 'video'],
        notes: c.text || '',
        score: 45,
        follow_up_date: null,
        created_at: c.published_at || c.created_at || new Date().toISOString(),
        updated_at: c.created_at || new Date().toISOString()
      })));
    }

    // Sort by latest created_at
    unifiedLeads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Filter by Pipeline Stage
    if (stage !== 'all') {
      unifiedLeads = unifiedLeads.filter(l => l.stage === stage);
    }

    // Filter by Search Query (name, phone/identifier, notes, or source)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      unifiedLeads = unifiedLeads.filter(l => 
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.identifier && l.identifier.toLowerCase().includes(q)) ||
        (l.source && l.source.toLowerCase().includes(q)) ||
        (l.interest && l.interest.toLowerCase().includes(q)) ||
        (l.notes && l.notes.toLowerCase().includes(q))
      );
    }

    res.json({
      success: true,
      total: unifiedLeads.length,
      leads: unifiedLeads
    });
  } catch (err) {
    console.error('Error fetching unified CRM leads:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET /api/crm/stats - Aggregate CRM statistics & Pipeline Breakdown
router.get('/stats', (req, res) => {
  try {
    const callingCount = db.prepare("SELECT COUNT(*) as c FROM calling_leads WHERE campaign_id != (SELECT id FROM calling_campaigns WHERE title LIKE '%Manual%' LIMIT 1) OR campaign_id IS NULL").get()?.c || 0;
    const manualCount = db.prepare("SELECT COUNT(*) as c FROM calling_leads WHERE campaign_id = (SELECT id FROM calling_campaigns WHERE title LIKE '%Manual%' LIMIT 1) OR notes LIKE '%manual%'").get()?.c || 0;
    const waCount = db.prepare('SELECT COUNT(*) as c FROM whatsapp_contacts').get()?.c || 0;
    const igCount = db.prepare('SELECT COUNT(*) as c FROM instagram_leads').get()?.c || 0;
    const tgCount = db.prepare('SELECT COUNT(*) as c FROM telegram_leads').get()?.c || 0;
    const ytCount = db.prepare(`
      SELECT COUNT(*) as c FROM comments 
      WHERE platform = 'youtube' AND (
        text LIKE '%phone%' OR 
        text LIKE '%call%' OR 
        text LIKE '%class%' OR 
        text LIKE '%lesson%' OR 
        text LIKE '%fees%' OR 
        text LIKE '%whatsapp%' OR 
        text LIKE '%contact%'
      )
    `).get()?.c || 0;

    const totalLeads = callingCount + manualCount + waCount + igCount + tgCount + ytCount;

    // Stage counts across all leads
    const stages = {
      new: 0,
      contacted: 0,
      interested: 0,
      qualified: 0,
      converted: 0,
      lost: 0
    };

    const callStatusRows = db.prepare('SELECT call_status, COUNT(*) as cnt FROM calling_leads GROUP BY call_status').all();
    for (const row of callStatusRows) {
      const stage = mapToPipelineStage(row.call_status);
      stages[stage] = (stages[stage] || 0) + row.cnt;
    }

    const waStatusRows = db.prepare('SELECT status, COUNT(*) as cnt FROM whatsapp_contacts GROUP BY status').all();
    for (const row of waStatusRows) {
      const stage = mapToPipelineStage(row.status);
      stages[stage] = (stages[stage] || 0) + row.cnt;
    }

    const igStatusRows = db.prepare('SELECT status, COUNT(*) as cnt FROM instagram_leads GROUP BY status').all();
    for (const row of igStatusRows) {
      const stage = mapToPipelineStage(row.status);
      stages[stage] = (stages[stage] || 0) + row.cnt;
    }

    const tgStatusRows = db.prepare('SELECT status, COUNT(*) as cnt FROM telegram_leads GROUP BY status').all();
    for (const row of tgStatusRows) {
      const stage = mapToPipelineStage(row.status);
      stages[stage] = (stages[stage] || 0) + row.cnt;
    }

    res.json({
      success: true,
      totalLeads,
      byPlatform: {
        all: totalLeads,
        calling: callingCount,
        instagram: igCount,
        whatsapp: waCount,
        telegram: tgCount,
        youtube: ytCount,
        manual: manualCount,
        website: 0
      },
      byStage: stages
    });
  } catch (err) {
    console.error('Error fetching CRM stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. PUT /api/crm/leads/:platform/:id - Update lead stage, notes, tags
router.put('/leads/:platform/:id', (req, res) => {
  try {
    const { platform, id } = req.params;
    const { stage, status, notes, tags, follow_up_date } = req.body;
    const rawId = id.replace(/^(wa_|ig_|tg_)/, '');

    if (platform === 'calling') {
      const newStatus = status || (stage === 'interested' ? 'interested' : stage === 'contacted' ? 'needs_follow_up' : stage === 'converted' ? 'completed' : 'pending');
      db.prepare(`
        UPDATE calling_leads 
        SET call_status = COALESCE(?, call_status),
            notes = COALESCE(?, notes),
            follow_up_date = COALESCE(?, follow_up_date),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStatus, notes, follow_up_date, Number(rawId));
    } else if (platform === 'whatsapp') {
      const newStatus = status || (stage === 'interested' ? 'engaged' : stage === 'contacted' ? 'contacted' : stage === 'converted' ? 'closed' : 'new');
      db.prepare(`
        UPDATE whatsapp_contacts
        SET status = COALESCE(?, status),
            notes = COALESCE(?, notes),
            tags = COALESCE(?, tags),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStatus, notes, tags, Number(rawId));
    } else if (platform === 'instagram') {
      const newStatus = status || (stage === 'interested' ? 'qualified' : stage === 'contacted' ? 'contacted' : stage === 'converted' ? 'customer' : 'new');
      db.prepare(`
        UPDATE instagram_leads
        SET status = COALESCE(?, status),
            notes = COALESCE(?, notes),
            tags = COALESCE(?, tags)
        WHERE id = ?
      `).run(newStatus, notes, tags, Number(rawId));
    } else if (platform === 'telegram') {
      const newStatus = status || (stage === 'interested' ? 'qualified' : stage === 'contacted' ? 'contacted' : stage === 'converted' ? 'customer' : 'new');
      db.prepare(`
        UPDATE telegram_leads
        SET status = COALESCE(?, status),
            notes = COALESCE(?, notes),
            tags = COALESCE(?, tags),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStatus, notes, tags, Number(rawId));
    }

    logActivity('crm', 'lead_updated', 'success', `Updated lead ${id} on platform ${platform}`);
    res.json({ success: true, message: 'Lead updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. DELETE /api/crm/leads/:platform/:id - Delete lead
router.delete('/leads/:platform/:id', (req, res) => {
  try {
    const { platform, id } = req.params;
    const rawId = id.replace(/^(wa_|ig_|tg_)/, '');

    if (platform === 'calling') {
      db.prepare('DELETE FROM calling_leads WHERE id = ?').run(Number(rawId));
    } else if (platform === 'whatsapp') {
      db.prepare('DELETE FROM whatsapp_contacts WHERE id = ?').run(Number(rawId));
    } else if (platform === 'instagram') {
      db.prepare('DELETE FROM instagram_leads WHERE id = ?').run(Number(rawId));
    } else if (platform === 'telegram') {
      db.prepare('DELETE FROM telegram_leads WHERE id = ?').run(Number(rawId));
    }

    logActivity('crm', 'lead_deleted', 'success', `Deleted lead ${id} from platform ${platform}`);
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. GET /api/crm/export - Export unified CSV
router.get('/export', (req, res) => {
  try {
    const calling = db.prepare('SELECT * FROM calling_leads').all().map(normalizeCallingLead);
    const wa = db.prepare('SELECT * FROM whatsapp_contacts').all().map(normalizeWhatsAppLead);
    const ig = db.prepare('SELECT * FROM instagram_leads').all().map(normalizeInstagramLead);
    const tg = db.prepare('SELECT * FROM telegram_leads').all().map(normalizeTelegramLead);

    const all = [...calling, ...wa, ...ig, ...tg];

    let csv = 'ID,Platform,Name,Contact,Stage,Status,Interest,Score,Notes,Created At\n';
    for (const l of all) {
      const cleanNotes = (l.notes || '').replace(/"/g, '""').replace(/\n/g, ' ');
      csv += `"${l.id}","${l.platform}","${l.name}","${l.identifier}","${l.stage}","${l.status}","${l.interest || ''}",${l.score},"${cleanNotes}","${l.created_at}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="social_manager_crm_leads.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
