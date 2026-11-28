const BaseCallingProvider = require('./baseProvider');
const { NormalizedCallStatus, buildUnifiedBusinessContext } = require('./types');
const { db, getSetting, logActivity } = require('../../db');
const { formatPhoneNumber, isNumberSuppressed, addToDoNotContact } = require('../vapi');

class OmniDimensionProvider extends BaseCallingProvider {
  constructor() {
    super('omnidimension', 'OmniDimension');
  }

  getBaseUrl() {
    return getSetting('OMNIDIMENSION_BASE_URL') || 'https://omnidim.io/api/v1';
  }

  getApiKey() {
    return getSetting('OMNIDIMENSION_API_KEY') || process.env.OMNIDIMENSION_API_KEY || '';
  }

  getAgentId() {
    return getSetting('OMNIDIMENSION_AGENT_ID') || '';
  }

  getPhoneNumber() {
    return getSetting('OMNIDIMENSION_PHONE_NUMBER') || '';
  }

  normalizeStatus(omniStatus) {
    const s = String(omniStatus || '').toLowerCase();
    switch (s) {
      case 'dispatched':
      case 'queued': return NormalizedCallStatus.QUEUED;
      case 'ringing': return NormalizedCallStatus.RINGING;
      case 'in_progress':
      case 'in-progress':
      case 'connected': return NormalizedCallStatus.IN_PROGRESS;
      case 'completed':
      case 'ended': return NormalizedCallStatus.COMPLETED;
      case 'no_answer':
      case 'no-answer': return NormalizedCallStatus.NO_ANSWER;
      case 'busy': return NormalizedCallStatus.BUSY;
      case 'failed':
      case 'error': return NormalizedCallStatus.FAILED;
      default: return NormalizedCallStatus.COMPLETED;
    }
  }

  async validateConfig() {
    const apiKey = this.getApiKey();
    const agentId = this.getAgentId();

    const missing = [];
    if (!apiKey) missing.push('OMNIDIMENSION_API_KEY');
    if (!agentId) missing.push('OMNIDIMENSION_AGENT_ID');

    return {
      isValid: missing.length === 0,
      missing,
      details: {
        hasApiKey: Boolean(apiKey),
        hasAgentId: Boolean(agentId),
        hasPhoneNumber: Boolean(this.getPhoneNumber())
      }
    };
  }

  async testConnection() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, message: 'OmniDimension API Key is missing. Configure it in Provider Settings.' };
    }

    try {
      const baseUrl = this.getBaseUrl();
      const res = await fetch(`${baseUrl}/agents`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (res.ok) {
        const data = await res.json();
        const count = Array.isArray(data) ? data.length : (data.agents?.length || 0);
        return {
          success: true,
          message: `Connected to OmniDimension successfully! Found ${count} agent(s).`,
          data: { agentCount: count }
        };
      } else {
        const text = await res.text();
        return { success: false, message: `OmniDimension rejected API key (${res.status}): ${text}` };
      }
    } catch (err) {
      return { success: false, message: `Failed to reach OmniDimension API: ${err.message}` };
    }
  }

  async listAssistants() {
    const apiKey = this.getApiKey();
    if (!apiKey) return [];

    try {
      const baseUrl = this.getBaseUrl();
      const res = await fetch(`${baseUrl}/agents`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (!res.ok) return [];
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.agents || []);

      return list.map(a => ({
        id: String(a.id || a.agent_id),
        name: a.name || a.agent_name || `Agent #${a.id}`,
        voice: a.voice || 'default',
        model: a.model || 'omni-voice'
      }));
    } catch (err) {
      console.error('OmniDimension listAssistants error:', err.message);
      return [];
    }
  }

  async listPhoneNumbers() {
    const configuredPhone = this.getPhoneNumber();
    if (configuredPhone) {
      return [{
        id: configuredPhone,
        number: configuredPhone,
        provider: 'omnidimension',
        name: 'Configured OmniDimension Caller ID',
        status: 'active'
      }];
    }
    return [];
  }

  async dispatchCall({ lead, campaign, customOpeningMessage, assistantId: overrideAgentId, fromNumber: overrideFromNumber }) {
    const apiKey = this.getApiKey();
    const agentId = overrideAgentId || this.getAgentId();
    const fromNumber = overrideFromNumber || this.getPhoneNumber();

    if (!apiKey) {
      throw new Error('OmniDimension API Key is missing. Please configure it in Provider Settings.');
    }
    if (!agentId) {
      throw new Error('OmniDimension Agent ID is missing. Please select an Agent in Provider Settings.');
    }

    // 1. Consent and DND verification
    const dndEntry = isNumberSuppressed(lead.phone_number);
    if (dndEntry || lead.do_not_contact === 1) {
      db.prepare("UPDATE calling_leads SET call_status = 'dnc' WHERE id = ?").run(lead.id);
      throw new Error(`Call blocked: Number ${lead.phone_number} is on the Do Not Contact list (${dndEntry?.reason || 'Opted out'}).`);
    }

    const toPhone = formatPhoneNumber(lead.phone_number);
    const cleanFrom = fromNumber ? formatPhoneNumber(fromNumber) : undefined;

    // 2. Build unified business context
    const context = buildUnifiedBusinessContext(lead, customOpeningMessage || campaign?.call_script);

    const payload = {
      agent_id: isNaN(Number(agentId)) ? agentId : Number(agentId),
      to_number: toPhone,
      from_number: cleanFrom,
      prompt_variables: context.dynamicVariables
    };

    const baseUrl = this.getBaseUrl();
    const res = await fetch(`${baseUrl}/calls/dispatch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const resJson = await res.json();
    if (!res.ok) {
      const errorMsg = resJson.message || resJson.error || 'OmniDimension call dispatch failed';
      throw new Error(`OmniDimension Dispatch Error: ${errorMsg}`);
    }

    const callId = String(resJson.call_id || resJson.id || `omni_${Date.now()}`);
    const initialStatus = this.normalizeStatus(resJson.status || 'dispatched');

    return {
      success: true,
      callId,
      status: initialStatus,
      provider: 'omnidimension',
      raw: resJson
    };
  }

  async syncCallDetails(callId) {
    const apiKey = this.getApiKey();
    if (!apiKey || !callId) return null;

    try {
      const baseUrl = this.getBaseUrl();
      const res = await fetch(`${baseUrl}/calls/${callId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (!res.ok) return null;
      const call = await res.json();

      const status = this.normalizeStatus(call.status);
      const duration = Number(call.duration_seconds || call.duration || 0);
      const transcript = call.transcript || '';
      const recordingUrl = call.recording_url || null;
      const summary = call.summary || '';

      let outcomeText = call.end_reason ? `Call ended: ${call.end_reason}` : (summary || 'Call completed');
      let leadStatus = 'completed';

      if (call.status === 'failed') {
        leadStatus = 'failed';
        outcomeText = call.error || 'Call failed';
      } else if (status === 'no_answer') {
        leadStatus = 'no_answer';
        outcomeText = 'No answer';
      } else if (status === 'busy') {
        leadStatus = 'busy';
        outcomeText = 'Busy';
      } else if (status === 'in_progress') {
        leadStatus = 'calling';
        outcomeText = 'In progress...';
      } else if (status === 'completed') {
        const lower = (summary + ' ' + transcript).toLowerCase();
        if (lower.includes('do not call') || lower.includes('stop calling')) {
          leadStatus = 'dnc';
          outcomeText = 'Customer requested Do Not Contact.';
          const lead = db.prepare('SELECT phone_number FROM calling_leads WHERE external_call_id = ?').get(callId);
          if (lead) addToDoNotContact(lead.phone_number, 'Customer opt-out via OmniDimension', 'omnidimension');
        } else if (lower.includes('interested') || lower.includes('trial lesson')) {
          leadStatus = 'interested';
          outcomeText = 'Interested in services.';
        } else if (lower.includes('call back') || lower.includes('busy right now')) {
          leadStatus = 'needs_follow_up';
          outcomeText = 'Callback requested.';
        }
      }

      return {
        callId,
        status,
        leadStatus,
        endedReason: call.end_reason || null,
        duration,
        transcript,
        recordingUrl,
        summary,
        outcomeText,
        cost: Number(call.cost || 0),
        provider: 'omnidimension',
        raw: call
      };
    } catch (err) {
      console.error(`OmniDimension sync error for call ${callId}:`, err.message);
      return null;
    }
  }

  async endCall(callId) {
    const apiKey = this.getApiKey();
    if (!apiKey || !callId) return false;

    try {
      const baseUrl = this.getBaseUrl();
      const res = await fetch(`${baseUrl}/calls/${callId}/terminate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return res.ok;
    } catch (err) {
      console.error(`OmniDimension endCall error for ${callId}:`, err.message);
      return false;
    }
  }

  async processWebhook(payload, headers) {
    const callId = String(payload?.call_id || payload?.id || '');
    if (callId) {
      const details = await this.syncCallDetails(callId);
      return { received: true, callId, eventType: payload?.event || 'call_update', details };
    }
    return { received: true };
  }
}

module.exports = OmniDimensionProvider;
