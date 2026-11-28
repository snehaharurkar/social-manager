let Database;
try {
  // Built-in for Node.js v22.5.0+
  const sqlite = require('node:sqlite');
  Database = sqlite.DatabaseSync;
} catch (e) {
  try {
    // Universal fallback for Node.js <= 20
    Database = require('better-sqlite3');
  } catch (err) {
    throw new Error('Neither built-in node:sqlite nor better-sqlite3 is available. Please use Node.js 22+ or install better-sqlite3.');
  }
}
const path = require('node:path');
const fs = require('node:fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'app.db');
const db = new Database(dbPath);

// Enable journal mode safely for both local and cloud environments
try {
  db.exec('PRAGMA journal_mode = WAL;');
} catch (e) {
  try { db.exec('PRAGMA journal_mode = DELETE;'); } catch {}
}
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL, -- 'youtube' | 'instagram'
    platform_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    username TEXT,
    avatar_url TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at INTEGER,
    metadata TEXT,
    status TEXT DEFAULT 'active', -- 'active' | 'needs_reauth' | 'paused'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    platform TEXT DEFAULT 'all', -- 'all' | 'youtube' | 'instagram'
    trigger_type TEXT DEFAULT 'contains', -- 'contains' | 'exact' | 'starts_with' | 'regex'
    keywords TEXT NOT NULL, -- comma-separated keywords
    reply_template TEXT NOT NULL,
    use_ai_polish INTEGER DEFAULT 0, -- 1 = pass template through Gemini/Groq for variation
    ai_prompt TEXT, -- optional custom tone/instruction (e.g. "Friendly and concise")
    cooldown_seconds INTEGER DEFAULT 60,
    is_active INTEGER DEFAULT 1,
    match_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS scheduled_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL, -- 'youtube' | 'instagram'
    channel_id TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    media_url TEXT,
    privacy_status TEXT DEFAULT 'public', -- 'public' | 'unlisted' | 'private'
    media_type TEXT, -- 'video' | 'image'
    published_url TEXT,
    scheduled_at DATETIME NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending' | 'published' | 'failed'
    published_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY, -- platform comment id
    platform TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    parent_id TEXT,
    video_or_post_id TEXT NOT NULL,
    post_title TEXT,
    author_name TEXT NOT NULL,
    author_avatar TEXT,
    author_id TEXT,
    text TEXT NOT NULL,
    replied INTEGER DEFAULT 0,
    reply_text TEXT,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'comment_reply' | 'scheduled_publish' | 'sync' | 'whatsapp_message'
    status TEXT NOT NULL, -- 'success' | 'failed' | 'skipped'
    details TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS whatsapp_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT UNIQUE NOT NULL,
    name TEXT,
    source TEXT DEFAULT 'manual', -- 'manual' | 'inbound' | 'youtube' | 'website'
    status TEXT DEFAULT 'new', -- 'new' | 'contacted' | 'engaged' | 'escalated' | 'closed'
    tags TEXT, -- comma-separated tags e.g. "lead, pricing, vip"
    notes TEXT,
    last_contacted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id TEXT PRIMARY KEY,
    phone_number TEXT NOT NULL,
    direction TEXT NOT NULL, -- 'inbound' | 'outbound'
    sender_name TEXT,
    message_text TEXT NOT NULL,
    status TEXT DEFAULT 'sent', -- 'sent' | 'delivered' | 'read' | 'received' | 'failed'
    is_escalated INTEGER DEFAULT 0, -- 1 if escalated to human
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS instagram_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ig_username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    source TEXT DEFAULT 'direct_message', -- 'direct_message' | 'post_comment' | 'story_reply' | 'manual'
    status TEXT DEFAULT 'new', -- 'new' | 'contacted' | 'qualified' | 'customer' | 'escalated'
    tags TEXT DEFAULT 'lead',
    notes TEXT,
    last_interaction_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS instagram_messages (
    id TEXT PRIMARY KEY,
    ig_username TEXT NOT NULL,
    direction TEXT NOT NULL, -- 'inbound' | 'outbound'
    sender_name TEXT,
    message_text TEXT NOT NULL,
    status TEXT DEFAULT 'sent', -- 'sent' | 'delivered' | 'read' | 'received' | 'failed'
    is_escalated INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS telegram_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    source TEXT DEFAULT 'bot_direct', -- 'bot_direct' | 'channel' | 'group' | 'manual'
    status TEXT DEFAULT 'new', -- 'new' | 'contacted' | 'qualified' | 'customer' | 'escalated'
    tags TEXT DEFAULT 'lead',
    notes TEXT,
    last_interaction_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS telegram_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    direction TEXT NOT NULL, -- 'inbound' | 'outbound'
    sender_name TEXT,
    message_text TEXT NOT NULL,
    status TEXT DEFAULT 'sent', -- 'sent' | 'delivered' | 'received' | 'failed'
    is_escalated INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS calling_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    file_name TEXT,
    total_leads INTEGER DEFAULT 0,
    completed_calls INTEGER DEFAULT 0,
    status TEXT DEFAULT 'idle', -- 'idle' | 'calling' | 'paused' | 'completed'
    call_script TEXT,
    delay_seconds INTEGER DEFAULT 8,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS calling_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    email TEXT,
    interest TEXT,
    notes TEXT,
    call_status TEXT DEFAULT 'pending', -- 'pending' | 'queued' | 'calling' | 'completed' | 'interested' | 'needs_follow_up' | 'busy' | 'no_answer' | 'not_interested' | 'failed' | 'dnc'
    call_attempts INTEGER DEFAULT 0,
    last_called_at DATETIME,
    call_duration INTEGER DEFAULT 0,
    call_transcript TEXT,
    follow_up_date DATETIME,
    follow_up_notes TEXT,
    follow_up_status TEXT DEFAULT 'pending', -- 'pending' | 'completed' | 'cancelled'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS call_logs (
    id TEXT PRIMARY KEY,
    lead_id INTEGER,
    phone_number TEXT NOT NULL,
    lead_name TEXT,
    direction TEXT DEFAULT 'outbound',
    duration INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    transcript TEXT,
    outcome TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS do_not_contact (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT UNIQUE NOT NULL,
    reason TEXT,
    source TEXT DEFAULT 'manual',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS automation_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER,
    rule_name TEXT,
    platform TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    input_content TEXT,
    author_name TEXT,
    status TEXT NOT NULL, -- 'success' | 'failed' | 'simulated' | 'skipped'
    action_taken TEXT,
    output_content TEXT,
    execution_time_ms INTEGER DEFAULT 0,
    error_details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS brand_knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'faq', -- 'faq' | 'curriculum' | 'policy' | 'voice'
    content TEXT NOT NULL,
    tags TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- 'publishing' | 'scheduler' | 'account' | 'sync' | 'automation' | 'lead' | 'calling' | 'system'
    level TEXT DEFAULT 'info', -- 'info' | 'success' | 'warning' | 'error'
    is_read INTEGER DEFAULT 0,
    link_tab TEXT,
    link_id TEXT,
    metadata_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Safe migrations for newly added columns
try { db.exec("ALTER TABLE scheduled_posts ADD COLUMN batch_id TEXT"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read, created_at)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category)"); } catch {}
try { db.exec("ALTER TABLE scheduled_posts ADD COLUMN privacy_status TEXT DEFAULT 'public'"); } catch {}
try { db.exec("ALTER TABLE scheduled_posts ADD COLUMN media_type TEXT"); } catch {}
try { db.exec("ALTER TABLE scheduled_posts ADD COLUMN published_url TEXT"); } catch {}
try { db.exec("ALTER TABLE scheduled_posts ADD COLUMN is_draft INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE scheduled_posts ADD COLUMN retry_count INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE scheduled_posts ADD COLUMN tags TEXT"); } catch {}
try { db.exec("ALTER TABLE rules ADD COLUMN description TEXT"); } catch {}
try { db.exec("ALTER TABLE rules ADD COLUMN conditions_json TEXT"); } catch {}
try { db.exec("ALTER TABLE rules ADD COLUMN actions_json TEXT"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_wa_messages_phone ON whatsapp_messages(phone_number)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_wa_contacts_phone ON whatsapp_contacts(phone_number)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_ig_leads_username ON instagram_leads(ig_username)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_ig_messages_username ON instagram_messages(ig_username)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_tg_leads_chat ON telegram_leads(chat_id)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_tg_messages_chat ON telegram_messages(chat_id)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_calling_leads_campaign ON calling_leads(campaign_id)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_calling_leads_phone ON calling_leads(phone_number)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_calling_leads_followup ON calling_leads(follow_up_date)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_automation_exec_created ON automation_executions(created_at)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_brand_knowledge_cat ON brand_knowledge(category)"); } catch {}
try { db.exec("ALTER TABLE calling_leads ADD COLUMN external_call_id TEXT"); } catch {}
try { db.exec("ALTER TABLE calling_leads ADD COLUMN recording_url TEXT"); } catch {}
try { db.exec("ALTER TABLE call_logs ADD COLUMN external_call_id TEXT"); } catch {}
try { db.exec("ALTER TABLE call_logs ADD COLUMN recording_url TEXT"); } catch {}

// Seed brand knowledge if empty
try {
  const kbCount = db.prepare('SELECT COUNT(*) as cnt FROM brand_knowledge').get();
  if (kbCount && kbCount.cnt === 0) {
    const insertKb = db.prepare(`
      INSERT INTO brand_knowledge (title, category, content, tags)
      VALUES (?, ?, ?, ?)
    `);
    insertKb.run(
      'Acoustic Guitar Learning Curriculum',
      'curriculum',
      'Beginner curriculum covers finger placement, fundamental chords (C, G, Em, Am, D), rhythm strumming patterns, and first song playthrough in 4 weeks. Intermediate curriculum covers fingerstyle, barre chords, acoustic percussive techniques, and ear training.',
      'guitar, lessons, beginner, syllabus'
    );
    insertKb.run(
      'Pricing & Enrollment Options',
      'faq',
      'Online group sessions start at $49/month (4 sessions). One-on-one personalized mentorship sessions with Sneha are $120/month with direct WhatsApp feedback and weekly custom sheet music.',
      'pricing, fees, mentorship, cost'
    );
    insertKb.run(
      'Collaboration & Brand Sponsorship Policy',
      'policy',
      'For brand partnerships, acoustic instrument reviews, or creator collabs, proposals must be submitted with product specifications and desired timeline. We only review instruments and audio tools we genuinely use on the Sneharmony channel.',
      'sponsorship, collab, partnerships, reviews'
    );
    insertKb.run(
      'Brand Voice & Tone Guidelines',
      'voice',
      'Always be warm, encouraging, artistic, and patient. Never sound clinical, robotic, or dismissive. Treat every music student with enthusiasm and positive encouragement.',
      'tone, persona, style'
    );
  }
} catch (e) {
  console.warn('Brand knowledge seed warning:', e.message);
}

// Helpers for Settings (Prefers process.env if set, otherwise checks database)
function getSetting(key) {
  if (process.env[key] !== undefined && process.env[key] !== null && String(process.env[key]).trim() !== '') {
    return String(process.env[key]).trim();
  }
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(key, value);
}

function getAllSettings() {
  const stmt = db.prepare('SELECT key, value FROM settings');
  const rows = stmt.all();
  const result = {};
  for (const r of rows) {
    result[r.key] = r.value;
  }
  return result;
}

// Seed default WhatsApp settings if missing
(function initDefaultWhatsAppSettings() {
  const defaults = {
    WHATSAPP_AUTO_REPLY_ENABLED: '1',
    WHATSAPP_HUMAN_HELP_NAME: 'Sneha (Support Manager)',
    WHATSAPP_HUMAN_HELP_PHONE: '+91 98765 43210',
    WHATSAPP_HUMAN_HELP_EMAIL: 'help@sneharmony.com',
    WHATSAPP_WELCOME_MESSAGE: 'Hello {name}! 🌷 Welcome to Sneharmony! How can we assist you today? Feel free to ask about our music, collaborations, tutorials, or bookings.',
    WHATSAPP_KNOWLEDGE_BASE: `About Sneharmony:
We are a creative channel and brand focused on music, lifestyle, acoustic guitar covers, and creator content.

Frequently Asked Questions & Services:
- Collaborations: For brand or creator collaborations, reach out with project details and expected dates.
- Music Lessons / Guidance: Online beginner and intermediate guitar & vocal sessions available.
- Booking & Inquiries: Custom music production and guest appearances available upon inquiry.
- Working Hours: Mon - Sat, 10:00 AM - 7:00 PM IST.`,

    // Instagram Automation Defaults
    INSTAGRAM_AUTO_REPLY_ENABLED: '1',
    INSTAGRAM_HUMAN_HELP_NAME: 'Sneha (Support Manager)',
    INSTAGRAM_HUMAN_HELP_PHONE: '+91 98765 43210',
    INSTAGRAM_HUMAN_HELP_EMAIL: 'support@sneharmony.com',
    INSTAGRAM_HUMAN_HELP_HANDLE: '@sneharmony-x5d',
    INSTAGRAM_WELCOME_MESSAGE: 'Hey {name}! ✨ Welcome to Sneharmony! How can we help you today? Ask about music, covers, tutorials, or collabs!',
    INSTAGRAM_KNOWLEDGE_BASE: `About Sneharmony:
We are a creative channel and brand focused on music, lifestyle, acoustic guitar covers, and creator content.

Frequently Asked Questions & Services:
- Collaborations: For brand, music, or creator collaborations, DM us your proposal and dates.
- Music Lessons: Online guitar and singing lessons available.
- Bookings: Custom music production and appearances available upon inquiry.
- Support Hours: Mon - Sat, 10:00 AM - 7:00 PM IST.`,

    // Telegram Automation Defaults
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_BOT_USERNAME: '',
    TELEGRAM_CHANNEL_ID: '',
    TELEGRAM_AUTO_REPLY_ENABLED: '1',
    TELEGRAM_HUMAN_HELP_NAME: 'Sneha (Support Manager)',
    TELEGRAM_HUMAN_HELP_PHONE: '+91 98765 43210',
    TELEGRAM_HUMAN_HELP_EMAIL: 'support@sneharmony.com',
    TELEGRAM_HUMAN_HELP_HANDLE: '@sneharmony',
    TELEGRAM_WELCOME_MESSAGE: 'Hello {name}! 🌷 Welcome to Sneharmony on Telegram! How can we assist you today? Feel free to ask about music, acoustic covers, tutorials, or bookings.',
    TELEGRAM_KNOWLEDGE_BASE: `About Sneharmony:
We are a creative channel and brand focused on music, lifestyle, acoustic guitar covers, and creator content.

Frequently Asked Questions & Services:
- Collaborations: For creator, brand, or music collaborations, reach out with project details and dates.
- Music Lessons / Guidance: Online beginner and intermediate guitar & vocal sessions available.
- Booking & Inquiries: Custom acoustic music production and guest appearances available upon inquiry.
- Working Hours: Mon - Sat, 10:00 AM - 7:00 PM IST.`,

    // AI Voice Calling Agent & Outbound Telecaller Defaults
    CALLING_MODE: 'live', // Default to live calling
    CALLING_PROVIDER: 'vapi', // 'vapi' | 'twilio'
    VAPI_API_KEY: '',
    VAPI_PHONE_NUMBER_ID: '2e79a5b3-ba4f-4e5c-8c0c-332ed538c3d9',
    VAPI_ASSISTANT_ID: '4f27a2f3-3248-46a3-b1ec-3612340d4923',
    CALLING_AGENT_NAME: 'Aria (Outbound AI Telecaller)',
    CALLING_AGENT_VOICE: 'Elliot',
    CALLING_COMPANY_NAME: 'Sneharmony Music & Creator Academy',
    CALLING_BUSINESS_DESCRIPTION: 'Premier online acoustic guitar, fingerstyle, and creator academy founded by Sneha Harurkar.',
    CALLING_PRODUCT_DETAILS: 'Beginner to advanced 1-on-1 and cohort acoustic guitar sessions, fingerstyle mastery, and song accompaniment.',
    CALLING_PRICING: 'Trial session: Free 15-min assessment. Beginner 8-session monthly: ₹4,500 ($55). Advanced fingerstyle: ₹7,000 ($85).',
    CALLING_OFFERS: 'Special 15% discount for full 3-month course enrollment this week with free PDF chords & songbook.',
    CALLING_ELIGIBILITY: 'Age 10+, beginners to intermediate learners with access to an acoustic guitar and 20 mins daily practice.',
    CALLING_FAQS: 'Q: Are classes live or recorded? A: All sessions are live interactive 1-on-1 with Sneha.\nQ: What if I miss a class? A: Free reschedule within 7 days.\nQ: Do complete beginners learn? A: Yes, 90% of students start with zero guitar experience.',
    CALLING_SALES_OBJECTIVES: 'Understand customer musical goal, qualify interest, overcome scheduling/price objections, and confirm WhatsApp brochure or free trial booking.',
    CALLING_DEFAULT_SCRIPT: `Hello {name}! This is Aria, an AI assistant calling on behalf of Sneha from Sneharmony.
I noticed you were interested in our acoustic guitar lessons. Is now a good time for a quick 2-minute chat?`,
    CALLING_QUALIFICATION_QUESTIONS: `1. Have you ever played acoustic guitar before, or are you starting from scratch?
2. What is your favorite music genre or specific songs you want to learn to play?
3. How many days a week would you be able to practice?`,
    CALLING_OBJECTION_HANDLING: `Busy / In a meeting / Driving -> Apologize warmly and ask: "I completely understand! Would tomorrow at 3 PM or 6 PM work better for a brief callback?"
Too expensive / Budget concern -> "We also have a flexible split-payment starter plan and a free 15-minute trial session so you can try before deciding!"
Hesitant about online learning -> "Sneha's multi-angle camera setup lets you see hand positions and fretboards clearly. Over 500 students have learned from scratch this way."
Not interested -> "Understood, thank you so much for your time. Have a wonderful day!" (Immediately end call politely)`,
    CALLING_HUMAN_HANDOFF_CONTACT: 'Sneha Harurkar & Advisory Team | WhatsApp/Phone: +91 98765 43210 | Email: support@sneharmony.com',
    CALLING_CLOSING_MESSAGE: 'Thank you so much for your time, {name}! I will send our complete curriculum schedule and WhatsApp brochure right away. Have a wonderful day!',
    CALLING_SYSTEM_PROMPT: `You are Aria, a friendly, empathetic, honest, and professional AI Telecaller representing Sneha from Sneharmony.
Rules:
1. Honestly introduce yourself as an AI assistant calling on behalf of Sneha Harurkar.
2. Confirm if it is a good time to speak. If the customer is driving, busy, or asks to call later, politely schedule a callback time and conclude.
3. Keep answers conversational, natural, and concise (1-2 sentences), exactly like a real human telecaller.
4. Explain course details, pricing, and FAQs using ONLY the provided business knowledge. Never invent pricing, discounts, or guarantees.
5. Ask one qualification question at a time and listen attentively.
6. If the customer is not interested or requests no more calls, respect their wish immediately, thank them warmly, and mark them as Do Not Contact.
7. Offer human assistance for complex requests.`,
    CALLING_DELAY_BETWEEN_CALLS: '8',
    CALLING_MAX_ATTEMPTS: '3',
    CALLING_BATCH_SIZE: '5',
    CALLING_CONCURRENCY_LIMIT: '1',
    CALLING_WINDOW_START: '10:00',
    CALLING_WINDOW_END: '19:00',
    CALLING_TIMEZONE: 'Asia/Kolkata',
    CALLING_RECORDING_ENABLED: '1',
    // Multi-Provider AI Calling Engine Defaults (Vapi, Retell AI, OmniDimension)
    ACTIVE_CALLING_PROVIDER: 'vapi', // 'vapi' | 'retell' | 'omnidimension'
    RETELL_API_KEY: '',
    RETELL_AGENT_ID: '',
    RETELL_PHONE_NUMBER: '',
    OMNIDIMENSION_API_KEY: '',
    OMNIDIMENSION_AGENT_ID: '',
    OMNIDIMENSION_PHONE_NUMBER: '',
    OMNIDIMENSION_BASE_URL: 'https://omnidim.io/api/v1',
    TWILIO_ACCOUNT_SID: '',
    TWILIO_AUTH_TOKEN: '',
    TWILIO_PHONE_NUMBER: ''
  };

  for (const [key, val] of Object.entries(defaults)) {
    if (!getSetting(key)) {
      setSetting(key, val);
    }
  }

  // Safe migrations for table extensions
  try {
    const addCol = (tbl, col, def) => {
      try {
        const existing = db.prepare(`PRAGMA table_info(${tbl});`).all().map(c => c.name);
        if (!existing.includes(col)) {
          db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def};`);
        }
      } catch (err) {
        // Ignored
      }
    };

    // calling_leads
    addCol('calling_leads', 'provider', 'TEXT DEFAULT "vapi"');
    addCol('calling_leads', 'company', 'TEXT');
    addCol('calling_leads', 'lead_source', 'TEXT DEFAULT "manual"');
    addCol('calling_leads', 'consent_status', 'TEXT DEFAULT "consented"');
    addCol('calling_leads', 'do_not_contact', 'INTEGER DEFAULT 0');
    addCol('calling_leads', 'custom_fields', 'TEXT');
    addCol('calling_leads', 'interest_level', 'TEXT DEFAULT "medium"');
    addCol('calling_leads', 'last_call_outcome', 'TEXT');
    addCol('calling_leads', 'end_reason', 'TEXT');
    addCol('calling_leads', 'external_call_id', 'TEXT');
    addCol('calling_leads', 'recording_url', 'TEXT');

    // calling_campaigns
    addCol('calling_campaigns', 'provider', 'TEXT DEFAULT "vapi"');
    addCol('calling_campaigns', 'assistant_id', 'TEXT');
    addCol('calling_campaigns', 'max_attempts', 'INTEGER DEFAULT 3');
    addCol('calling_campaigns', 'batch_size', 'INTEGER DEFAULT 5');
    addCol('calling_campaigns', 'calling_window_start', 'TEXT DEFAULT "10:00"');
    addCol('calling_campaigns', 'calling_window_end', 'TEXT DEFAULT "19:00"');
    addCol('calling_campaigns', 'timezone', 'TEXT DEFAULT "Asia/Kolkata"');
    addCol('calling_campaigns', 'concurrency_limit', 'INTEGER DEFAULT 1');
    addCol('calling_campaigns', 'interested_count', 'INTEGER DEFAULT 0');
    addCol('calling_campaigns', 'failed_count', 'INTEGER DEFAULT 0');

    // call_logs
    addCol('call_logs', 'provider', 'TEXT DEFAULT "vapi"');
    addCol('call_logs', 'campaign_id', 'INTEGER');
    addCol('call_logs', 'end_reason', 'TEXT');
    addCol('call_logs', 'ai_summary', 'TEXT');
    addCol('call_logs', 'customer_intent', 'TEXT');
    addCol('call_logs', 'objections', 'TEXT');
    addCol('call_logs', 'questions_asked', 'TEXT');
    addCol('call_logs', 'interest_level', 'TEXT');
    addCol('call_logs', 'next_action', 'TEXT');
    addCol('call_logs', 'cost', 'REAL DEFAULT 0');
    addCol('call_logs', 'external_call_id', 'TEXT');
    addCol('call_logs', 'recording_url', 'TEXT');
  } catch (migErr) {
    console.error('Calling migration warning:', migErr.message);
  }
})();

// Log helper
function logActivity(platform, eventType, status, details) {
  const stmt = db.prepare(`
    INSERT INTO activity_logs (platform, event_type, status, details)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(platform, eventType, status, typeof details === 'string' ? details : JSON.stringify(details));
}

// Log automation execution helper
function logAutomationExecution(execData) {
  try {
    const stmt = db.prepare(`
      INSERT INTO automation_executions (
        rule_id, rule_name, platform, trigger_type, input_content,
        author_name, status, action_taken, output_content, execution_time_ms, error_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      execData.rule_id || null,
      execData.rule_name || 'Direct Rule',
      execData.platform || 'all',
      execData.trigger_type || 'keyword',
      execData.input_content || '',
      execData.author_name || 'Anonymous',
      execData.status || 'success',
      execData.action_taken || 'replied',
      execData.output_content || '',
      execData.execution_time_ms || 0,
      execData.error_details || null
    );
  } catch (err) {
    console.error('Failed to log automation execution:', err.message);
  }
}

// In-app Notification helper
function createNotification(title, message, category = 'general', level = 'info', linkTab = null, linkId = null, metadata = null) {
  try {
    // De-duplication: check if an identical notification was created in the last 15 seconds
    const existing = db.prepare(`
      SELECT id FROM notifications 
      WHERE title = ? AND category = ? AND created_at >= datetime('now', '-15 seconds')
      LIMIT 1
    `).get(title, category);

    if (existing) {
      return existing.id;
    }

    const stmt = db.prepare(`
      INSERT INTO notifications (title, message, category, level, link_tab, link_id, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title.trim(),
      message.trim(),
      category,
      level,
      linkTab,
      linkId ? String(linkId) : null,
      metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null
    );

    return Number(result.lastInsertRowid);
  } catch (err) {
    console.error('Failed to create in-app notification:', err.message);
    return null;
  }
}

module.exports = {
  Database,
  db,
  getSetting,
  setSetting,
  getAllSettings,
  logActivity,
  logAutomationExecution,
  createNotification
};
