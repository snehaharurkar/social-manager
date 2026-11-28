const BaseCallingProvider = require('./baseProvider');
const { NormalizedCallStatus, buildUnifiedBusinessContext } = require('./types');
const { db, getSetting, logActivity } = require('../../db');
const { formatPhoneNumber, isNumberSuppressed, addToDoNotContact } = require('../vapi');

const RETELL_BASE_URL = 'https://api.retellai.com';

class RetellProvider extends BaseCallingProvider {
  constructor() {
    super('retell', 'Retell AI');
  }

  getApiKey() {
    return getSetting('RETELL_API_KEY') || process.env.RETELL_API_KEY || '';
  }

  getAgentId() {
    return getSetting('RETELL_AGENT_ID') || '';
  }

  getPhoneNumber() {
    return getSetting('RETELL_PHONE_NUMBER') || '';
  }

  normalizeStatus(retellStatus) {
    const s = String(retellStatus || '').toLowerCase();
    switch (s) {
      case 'registered': return NormalizedCallStatus.QUEUED;
      case 'ongoing': return NormalizedCallStatus.IN_PROGRESS;
      case 'ended': return NormalizedCallStatus.COMPLETED;
      case 'error': return NormalizedCallStatus.FAILED;
      default: return NormalizedCallStatus.COMPLETED;
    }
  }

  async validateConfig() {
    const apiKey = this.getApiKey();
    const agentId = this.getAgentId();
    const fromNumber = this.getPhoneNumber();

    const missing = [];
    if (!apiKey) missing.push('RETELL_API_KEY');
    if (!agentId) missing.push('RETELL_AGENT_ID');
    if (!fromNumber) missing.push('RETELL_PHONE_NUMBER');

    return {
      isValid: missing.length === 0,
      missing,
      details: {
        hasApiKey: Boolean(apiKey),
        hasAgentId: Boolean(agentId),
        hasPhoneNumber: Boolean(fromNumber)
      }
    };
  }

  async testConnection() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, message: 'Retell API Key is missing. Please configure it in Provider Settings.' };
    }

    try {
      // Retell v2 list agents
      let res = await fetch(`${RETELL_BASE_URL}/v2/list-agents?limit=10`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        // Fallback to GET /list-agents or GET /v2/list-agents
        res = await fetch(`${RETELL_BASE_URL}/list-agents`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
      }

      if (res.ok) {
        const agents = await res.json();
        const count = Array.isArray(agents) ? agents.length : (agents.agents?.length || 0);
        return {
          success: true,
          message: `Connected to Retell AI successfully! Found ${count} agent(s).`,
          data: { agentCount: count }
        };
      } else {
        const text = await res.text();
        return { success: false, message: `Retell API authentication failed (${res.status}): ${text}` };
      }
    } catch (err) {
      return { success: false, message: `Network error connecting to Retell AI: ${err.message}` };
    }
  }

  async listAssistants() {
    const apiKey = this.getApiKey();
    if (!apiKey) return [];

    try {
      let res = await fetch(`${RETELL_BASE_URL}/v2/list-agents?limit=50`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        res = await fetch(`${RETELL_BASE_URL}/list-agents`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
      }

      if (!res.ok) return [];
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.agents || []);

      return list.map(a => ({
        id: a.agent_id || a.id,
        name: a.agent_name || a.name || 'Retell Agent',
        voice: a.voice_id || 'default',
        model: a.llm_model || 'gpt-4o'
      }));
    } catch (err) {
      console.error('Retell listAssistants error:', err.message);
      return [];
    }
  }

  async listPhoneNumbers() {
    const apiKey = this.getApiKey();
    if (!apiKey) return [];

    try {
      const res = await fetch(`${RETELL_BASE_URL}/list-phone-numbers`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (!res.ok) return [];
      const list = await res.json();
      const arr = Array.isArray(list) ? list : (list.phone_numbers || []);
      return arr.map(n => ({
        id: n.phone_number,
        number: n.phone_number_pretty || n.phone_number,
        provider: 'retell',
        name: n.nickname || n.phone_number,
        status: 'active'
      }));
    } catch (err) {
      console.error('Retell listPhoneNumbers error:', err.message);
      return [];
    }
  }

  async dispatchCall({ lead, campaign, customOpeningMessage, assistantId: overrideAgentId, fromNumber: overrideFromNumber }) {
    const apiKey = this.getApiKey();
    const agentId = overrideAgentId || this.getAgentId();
    const fromNumber = overrideFromNumber || this.getPhoneNumber();

    if (!apiKey) {
      throw new Error('Retell API Key is missing. Please configure it in Provider Settings.');
    }
    if (!fromNumber) {
      throw new Error('Retell From Phone Number is missing. Please configure a caller ID in Provider Settings.');
    }

    // 1. Consent and DND verification
    const dndEntry = isNumberSuppressed(lead.phone_number);
    if (dndEntry || lead.do_not_contact === 1) {
      db.prepare("UPDATE calling_leads SET call_status = 'dnc' WHERE id = ?").run(lead.id);
      throw new Error(`Call blocked: Number ${lead.phone_number} is on the Do Not Contact list (${dndEntry?.reason || 'Opted out'}).`);
    }

    const toPhone = formatPhoneNumber(lead.phone_number);
    const cleanFrom = formatPhoneNumber(fromNumber);

    // 2. Build unified dynamic context
    const context = buildUnifiedBusinessContext(lead, customOpeningMessage || campaign?.call_script);

    const payload = {
      from_number: cleanFrom,
      to_number: toPhone,
      override_agent_id: agentId || undefined,
      retell_llm_dynamic_variables: context.dynamicVariables
    };

    const res = await fetch(`${RETELL_BASE_URL}/v2/create-phone-call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const resJson = await res.json();
    if (!res.ok) {
      const errorMsg = resJson.error_message || resJson.message || 'Retell outbound call creation failed';
      throw new Error(`Retell Dispatch Error: ${errorMsg}`);
    }

    const callId = resJson.call_id;
    const initialStatus = this.normalizeStatus(resJson.call_status || 'registered');

    return {
      success: true,
      callId,
      status: initialStatus,
      provider: 'retell',
      raw: resJson
    };
  }

  async syncCallDetails(callId) {
    const apiKey = this.getApiKey();
    if (!apiKey || !callId) return null;

    try {
      const res = await fetch(`${RETELL_BASE_URL}/v2/get-call/${callId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (!res.ok) return null;
      const call = await res.json();

      const status = this.normalizeStatus(call.call_status);
      const disconnectionReason = call.disconnection_reason || null;
      const duration = Math.round((call.duration_ms || 0) / 1000);
      const transcript = call.transcript || '';
      const recordingUrl = call.recording_url || null;
      const analysis = call.call_analysis || {};
      const summary = analysis.call_summary || '';
      const sentiment = analysis.user_sentiment || '';

      let outcomeText = disconnectionReason ? `Call ended: ${disconnectionReason}` : 'Call completed';
      let leadStatus = 'completed';

      if (disconnectionReason === 'user_did_not_answer' || disconnectionReason === 'no_answer') {
        leadStatus = 'no_answer';
        outcomeText = 'No Answer / Ringing timed out';
      } else if (disconnectionReason === 'busy' || disconnectionReason === 'congested') {
        leadStatus = 'busy';
        outcomeText = 'Line busy';
      } else if (status === 'in_progress') {
        leadStatus = 'calling';
        outcomeText = 'Call in progress...';
      } else if (status === 'completed') {
        const lower = (summary + ' ' + transcript).toLowerCase();
        if (lower.includes('do not call') || lower.includes('stop calling') || lower.includes('not interested at all')) {
          leadStatus = 'dnc';
          outcomeText = 'Customer requested Do Not Contact.';
          const lead = db.prepare('SELECT phone_number FROM calling_leads WHERE external_call_id = ?').get(callId);
          if (lead) addToDoNotContact(lead.phone_number, 'Customer opt-out via Retell', 'retell');
        } else if (lower.includes('interested') || lower.includes('send brochure') || sentiment.toLowerCase() === 'positive') {
          leadStatus = 'interested';
          outcomeText = summary || 'Customer interested in program.';
        } else if (lower.includes('call back') || lower.includes('callback') || lower.includes('busy right now')) {
          leadStatus = 'needs_follow_up';
          outcomeText = 'Customer requested callback.';
        } else if (lower.includes('not interested') || sentiment.toLowerCase() === 'negative') {
          leadStatus = 'not_interested';
          outcomeText = 'Not interested.';
        }
      }

      return {
        callId,
        status,
        leadStatus,
        endedReason: disconnectionReason,
        duration,
        transcript,
        recordingUrl,
        summary,
        outcomeText,
        cost: 0,
        provider: 'retell',
        raw: call
      };
    } catch (err) {
      console.error(`Retell sync error for call ${callId}:`, err.message);
      return null;
    }
  }

  async endCall(callId) {
    const apiKey = this.getApiKey();
    if (!apiKey || !callId) return false;

    try {
      // In Retell, end call can be called via POST /v2/end-call or DELETE
      const res = await fetch(`${RETELL_BASE_URL}/v2/end-call`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ call_id: callId })
      });
      return res.ok;
    } catch (err) {
      console.error(`Retell endCall error for ${callId}:`, err.message);
      return false;
    }
  }

  async processWebhook(payload, headers) {
    const event = payload?.event || payload?.type;
    const call = payload?.call || payload?.data;
    const callId = call?.call_id || payload?.call_id;

    if (callId) {
      const details = await this.syncCallDetails(callId);
      return { received: true, callId, eventType: event, details };
    }
    return { received: true };
  }
}

module.exports = RetellProvider;
