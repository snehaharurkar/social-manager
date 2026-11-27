const express = require('express');
const router = express.Router();
const { db, getSetting } = require('../db');
const { polishReplyWithAi } = require('../services/ai');

// POST /api/copilot/chat - Grounded AI Copilot assistant
router.post('/chat', async (req, res) => {
  try {
    const { prompt, history = [] } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'User prompt is required' });
    }

    const q = prompt.trim().toLowerCase();

    // 1. Gather Real System Context from SQLite
    const activeChannels = db.prepare("SELECT platform, display_name, status FROM channels").all();
    const pendingPosts = db.prepare("SELECT title, platform, scheduled_at FROM scheduled_posts WHERE status = 'pending' ORDER BY scheduled_at ASC LIMIT 5").all();
    const failedPosts = db.prepare("SELECT title, platform, error_message FROM scheduled_posts WHERE status = 'failed' ORDER BY id DESC LIMIT 5").all();
    const unrepliedComments = db.prepare("SELECT author_name, platform, text, post_title FROM comments WHERE replied = 0 ORDER BY id DESC LIMIT 5").all();
    const hotLeads = db.prepare("SELECT name, phone_number, interest, call_status FROM calling_leads WHERE call_status IN ('interested', 'needs_follow_up') ORDER BY id DESC LIMIT 5").all();
    const activeRules = db.prepare("SELECT name, platform, match_count FROM rules WHERE is_active = 1 LIMIT 5").all();
    const recentErrors = db.prepare("SELECT event_type, platform, details, created_at FROM activity_logs WHERE status = 'failed' ORDER BY id DESC LIMIT 5").all();

    // 2. Prepare Context Digest
    const systemContext = `
REAL SYSTEM STATE:
- Connected Channels: ${activeChannels.map(c => `${c.display_name} (${c.platform})`).join(', ') || 'None connected'}
- Pending Posts in Queue: ${pendingPosts.length} post(s) ${pendingPosts.map(p => `[${p.platform}] "${p.title}" at ${p.scheduled_at}`).join(', ')}
- Failed Posts: ${failedPosts.length} post(s) ${failedPosts.map(p => `[${p.platform}] "${p.title}" (Reason: ${p.error_message || 'Unknown'})`).join(', ')}
- Unanswered Comments: ${unrepliedComments.length} comment(s) ${unrepliedComments.map(c => `From ${c.author_name} on ${c.platform}: "${c.text}"`).join('; ')}
- High-Intent / Follow-Up Leads: ${hotLeads.length} lead(s) ${hotLeads.map(l => `${l.name} (${l.interest || 'Inquiry'}) - Status: ${l.call_status}`).join(', ')}
- Active Automations: ${activeRules.length} rule(s) (${activeRules.map(r => r.name).join(', ')})
- Recent System Errors: ${recentErrors.length === 0 ? 'None' : recentErrors.map(e => `[${e.platform}] ${e.details}`).join(', ')}
`;

    // 3. Fallback deterministic answer for common queries if LLM key is absent
    let reply = '';
    const hasAiKey = Boolean(process.env.GEMINI_API_KEY || getSetting('GEMINI_API_KEY') || process.env.GROQ_API_KEY || getSetting('GROQ_API_KEY'));

    if (hasAiKey) {
      const copilotPrompt = `You are the SocialManager AI Copilot, a calm, analytical, and highly capable operations assistant.
You have access to the verified live database state of this workspace.
Answer the user's question accurately using ONLY the facts provided in the REAL SYSTEM STATE.
Never invent follower counts, never invent posts or comments that do not exist, and never pretend an action was executed.
If the user asks to perform an action, explain clearly what needs to be confirmed or provide the recommended next step.

${systemContext}

User Query: "${prompt}"`;

      try {
        reply = await polishReplyWithAi(prompt, '', copilotPrompt);
      } catch (err) {
        console.warn('Copilot LLM generation error, falling back to deterministic answer:', err.message);
      }
    }

    if (!reply) {
      // Deterministic reasoning engine
      if (q.includes('failed') || q.includes('error') || q.includes('issue')) {
        if (failedPosts.length > 0) {
          reply = `Found ${failedPosts.length} failed post(s):\n` +
            failedPosts.map(p => `• **${p.title || 'Untitled Post'}** (${p.platform.toUpperCase()}): ${p.error_message || 'Unknown network error'}`).join('\n') +
            `\nYou can retry or reschedule them under **Content & Scheduler**.`;
        } else if (recentErrors.length > 0) {
          reply = `No failed posts, but found ${recentErrors.length} recent system alert(s):\n` +
            recentErrors.map(e => `• **${e.event_type}** (${e.platform}): ${e.details}`).join('\n');
        } else {
          reply = `All systems are healthy! Zero failed posts and zero system errors detected in the current activity log.`;
        }
      } else if (q.includes('comment') || q.includes('inbox') || q.includes('unanswered') || q.includes('unread')) {
        if (unrepliedComments.length > 0) {
          reply = `You have ${unrepliedComments.length} unanswered comment(s) waiting for feedback:\n` +
            unrepliedComments.map(c => `• **${c.author_name}** on ${c.platform.toUpperCase()} ("${c.post_title || 'Post'}"): "${c.text}"`).join('\n') +
            `\nYou can review, generate AI replies, or approve responses in the **Unified Inbox**.`;
        } else {
          reply = `Great news! There are currently no unanswered comments waiting in your inbox.`;
        }
      } else if (q.includes('lead') || q.includes('interested') || q.includes('crm')) {
        if (hotLeads.length > 0) {
          reply = `Here are your most recent high-intent leads:\n` +
            hotLeads.map(l => `• **${l.name}** (${l.phone_number}) - Interested in *${l.interest || 'Guitar Lessons'}* (Status: ${l.call_status})`).join('\n') +
            `\nYou can trigger follow-up calls or message them directly in **Leads & CRM**.`;
        } else {
          reply = `No active high-intent leads found right now. You can upload an Excel lead sheet or add a lead in **Leads & CRM**.`;
        }
      } else if (q.includes('today') || q.includes('summary') || q.includes('overview') || q.includes('status')) {
        reply = `**Workspace Operations Summary**:\n` +
          `• **Connected Accounts**: ${activeChannels.length} active\n` +
          `• **Scheduled Posts**: ${pendingPosts.length} pending in queue\n` +
          `• **Failed Posts**: ${failedPosts.length}\n` +
          `• **Unanswered Comments**: ${unrepliedComments.length}\n` +
          `• **Active Automations**: ${activeRules.length} rules live\n` +
          `• **High-Intent Leads**: ${hotLeads.length} leads requiring attention.`;
      } else {
        reply = `Here is what I found in your workspace:\n` +
          `• ${pendingPosts.length} post(s) queued for publishing.\n` +
          `• ${unrepliedComments.length} comment(s) awaiting replies.\n` +
          `• ${hotLeads.length} lead(s) with follow-ups scheduled.\n` +
          `How would you like to proceed? I can help you draft replies, inspect scheduled posts, or review hot leads.`;
      }
    }

    res.json({
      success: true,
      reply,
      groundedData: {
        activeChannelsCount: activeChannels.length,
        pendingPostsCount: pendingPosts.length,
        failedPostsCount: failedPosts.length,
        unrepliedCommentsCount: unrepliedComments.length,
        hotLeadsCount: hotLeads.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
