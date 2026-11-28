const BaseCallingProvider = require('./baseProvider');
const { NormalizedCallStatus, buildUnifiedBusinessContext } = require('./types');
const { db, getSetting, logActivity } = require('../../db');
const { formatPhoneNumber, isNumberSuppressed, addToDoNotContact } = require('../vapi');

const VAPI_BASE_URL = 'https://api.vapi.ai';

class VapiProvider extends BaseCallingProvider {
  constructor() {
    super('vapi', 'Vapi');
  }

  getApiKey() {
    return getSetting('VAPI_API_KEY') || process.env.VAPI_API_KEY || '';
  }

  getAssistantId() {
    return getSetting('VAPI_ASSISTANT_ID') || '';
  }

  getPhoneNumberId() {
    return getSetting('VAPI_PHONE_NUMBER_ID') || '';
  }

  normalizeStatus(vapiStatus) {
    const s = String(vapiStatus || '').toLowerCase();
    switch (s) {
      case 'queued': return NormalizedCallStatus.QUEUED;
      case 'ringing': return NormalizedCallStatus.RINGING;
      case 'in-progress':
      case 'in_progress': return NormalizedCallStatus.IN_PROGRESS;
      case 'ended': return NormalizedCallStatus.COMPLETED;
      default: return NormalizedCallStatus.COMPLETED;
    }
  }

  async validateConfig() {
    const apiKey = this.getApiKey();
    const assistantId = this.getAssistantId();
    const phoneNumberId = this.getPhoneNumberId();

    const missing = [];
    if (!apiKey) missing.push('VAPI_API_KEY');
    if (!phoneNumberId) missing.push('VAPI_PHONE_NUMBER_ID');

    return {
      isValid: missing.length === 0,
      missing,
      details: {
        hasApiKey: Boolean(apiKey),
        hasAssistantId: Boolean(assistantId),
        hasPhoneNumberId: Boolean(phoneNumberId)
      }
    };
  }

  async testConnection() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, message: 'Vapi API key is missing. Add it in Provider Settings.' };
    }

    try {
      const res = await fetch(`${VAPI_BASE_URL}/assistant`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (res.ok) {
        const assistants = await res.json();
        return {
          success: true,
          message: `Connected successfully to Vapi. Found ${assistants.length} assistant(s).`,
          data: { assistantCount: assistants.length }
        };
      } else {
        const text = await res.text();
        return { success: false, message: `Vapi API rejected credentials (${res.status}): ${text}` };
      }
    } catch (err) {
      return { success: false, message: `Failed to reach Vapi API: ${err.message}` };
    }
  }

  async listAssistants() {
    const apiKey = this.getApiKey();
    if (!apiKey) return [];

    try {
      const res = await fetch(`${VAPI_BASE_URL}/assistant`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (!res.ok) return [];
      const list = await res.json();
      return list.map(a => ({
        id: a.id,
        name: a.name || 'Unnamed Assistant',
        model: a.model?.model || 'gpt-4',
        voice: a.voice?.voiceId || a.voice?.provider || 'default'
      }));
    } catch (err) {
      console.error('Vapi listAssistants error:', err.message);
      return [];
    }
  }

  async listPhoneNumbers() {
    const apiKey = this.getApiKey();
    if (!apiKey) return [];

    try {
      const res = await fetch(`${VAPI_BASE_URL}/phone-number`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (!res.ok) return [];
      const list = await res.json();
      return list.map(n => ({
        id: n.id,
        number: n.number,
        provider: n.provider,
        name: n.name || n.number,
        status: n.status || 'active'
      }));
    } catch (err) {
      console.error('Vapi listPhoneNumbers error:', err.message);
      return [];
    }
  }

  async dispatchCall({ lead, campaign, customOpeningMessage, assistantId: overrideAssistantId }) {
    const apiKey = this.getApiKey();
    const phoneNumberId = this.getPhoneNumberId();
    const assistantId = overrideAssistantId || this.getAssistantId();

    if (!apiKey) {
      throw new Error('Vapi API Key is missing. Please configure it in Provider Settings.');
    }

    // 1. Consent and DND verification
    const dndEntry = isNumberSuppressed(lead.phone_number);
    if (dndEntry || lead.do_not_contact === 1) {
      db.prepare("UPDATE calling_leads SET call_status = 'dnc' WHERE id = ?").run(lead.id);
      throw new Error(`Call blocked: Number ${lead.phone_number} is on the Do Not Contact list (${dndEntry?.reason || 'Opted out'}).`);
    }

    // 2. Format phone number
    const e164Phone = formatPhoneNumber(lead.phone_number);
    if (!e164Phone || e164Phone.length < 10) {
      throw new Error(`Invalid destination phone number: ${lead.phone_number}`);
    }

    // 3. Build unified business context and prompt overrides
    const context = buildUnifiedBusinessContext(lead, customOpeningMessage || campaign?.call_script);

    const payload = {
      phoneNumberId: phoneNumberId || undefined,
      customer: {
        number: e164Phone,
        name: lead.name
      },
      assistantId: assistantId || undefined,
      assistantOverrides: {
        firstMessage: customOpeningMessage || context.greeting,
        variableValues: context.dynamicVariables,
        model: {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'system',
              content: context.systemPrompt
            }
          ]
        }
      }
    };

    if (!assistantId) {
      payload.assistant = {
        name: context.callerName,
        firstMessage: payload.assistantOverrides.firstMessage,
        model: payload.assistantOverrides.model,
        voice: {
          provider: 'vapi',
          voiceId: 'Elliot'
        }
      };
      delete payload.assistantId;
    }

    const res = await fetch(`${VAPI_BASE_URL}/call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const resJson = await res.json();
    if (!res.ok) {
      const errorMsg = resJson.message || resJson.error || 'Vapi outbound call failed';
      throw new Error(`Vapi Dispatch Error: ${errorMsg}`);
    }

    const callId = resJson.id;
    const initialStatus = this.normalizeStatus(resJson.status || 'queued');

    return {
      success: true,
      callId,
      status: initialStatus,
      provider: 'vapi',
      raw: resJson
    };
  }

  async syncCallDetails(callId) {
    const apiKey = this.getApiKey();
    if (!apiKey || !callId) return null;

    try {
      const res = await fetch(`${VAPI_BASE_URL}/call/${callId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (!res.ok) return null;
      const call = await res.json();

      const status = this.normalizeStatus(call.status);
      const endedReason = call.endedReason || null;
      const duration = Math.round(call.duration || (call.endedAt && call.startedAt ? (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000 : 0));
      const transcript = call.transcript || '';
      const recordingUrl = call.recordingUrl || null;
      const summary = call.analysis?.summary || call.summary || '';
      const cost = call.cost || 0;

      let outcomeText = endedReason ? `Call ended: ${endedReason}` : 'Call completed';
      let leadStatus = 'completed';

      if (endedReason === 'call.start.error-vapi-number-international') {
        leadStatus = 'failed';
        outcomeText = 'Failed: Native Vapi number cannot dial international (+91) numbers. Connect a Twilio number in Vapi.';
      } else if (endedReason === 'customer-did-not-answer' || endedReason === 'no-answer') {
        leadStatus = 'no_answer';
        outcomeText = 'No Answer / Ringing timed out';
      } else if (endedReason === 'customer-busy' || endedReason === 'busy') {
        leadStatus = 'busy';
        outcomeText = 'Customer line busy';
      } else if (status === 'in_progress' || status === 'ringing' || status === 'queued') {
        leadStatus = 'calling';
        outcomeText = `Call ${status}...`;
      } else if (call.status === 'ended') {
        const lower = (summary + ' ' + transcript).toLowerCase();
        if (lower.includes('do not call') || lower.includes('stop calling') || lower.includes('remove my number')) {
          leadStatus = 'dnc';
          outcomeText = 'Customer requested Do Not Contact.';
          const lead = db.prepare('SELECT phone_number FROM calling_leads WHERE external_call_id = ?').get(callId);
          if (lead) addToDoNotContact(lead.phone_number, 'Customer opt-out via Vapi', 'vapi');
        } else if (lower.includes('interested') || lower.includes('send brochure') || lower.includes('trial lesson')) {
          leadStatus = 'interested';
          outcomeText = 'Interested in program.';
        } else if (lower.includes('call back') || lower.includes('callback') || lower.includes('busy right now')) {
          leadStatus = 'needs_follow_up';
          outcomeText = 'Callback requested.';
        } else if (lower.includes('not interested')) {
          leadStatus = 'not_interested';
          outcomeText = 'Not interested in current offer.';
        }
      }

      return {
        callId,
        status,
        leadStatus,
        endedReason,
        duration,
        transcript,
        recordingUrl,
        summary,
        outcomeText,
        cost,
        provider: 'vapi',
        raw: call
      };
    } catch (err) {
      console.error(`Vapi sync error for call ${callId}:`, err.message);
      return null;
    }
  }

  async endCall(callId) {
    const apiKey = this.getApiKey();
    if (!apiKey || !callId) return false;

    try {
      const res = await fetch(`${VAPI_BASE_URL}/call/${callId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return res.ok;
    } catch (err) {
      console.error(`Vapi endCall error for ${callId}:`, err.message);
      return false;
    }
  }

  async processWebhook(payload, headers) {
    const message = payload?.message || payload;
    const call = message?.call || payload?.call;
    const callId = call?.id || message?.callId || payload?.callId;

    if (callId) {
      const details = await this.syncCallDetails(callId);
      return { received: true, callId, eventType: message?.type || payload?.type, details };
    }
    return { received: true };
  }
}

module.exports = VapiProvider;
