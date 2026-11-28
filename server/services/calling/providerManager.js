const VapiProvider = require('./vapiProvider');
const RetellProvider = require('./retellProvider');
const OmniDimensionProvider = require('./omniDimensionProvider');
const { db, getSetting, setSetting, logActivity } = require('../../db');
const { formatPhoneNumber, isNumberSuppressed } = require('../vapi');

class ProviderManager {
  constructor() {
    this.providers = {
      vapi: new VapiProvider(),
      retell: new RetellProvider(),
      omnidimension: new OmniDimensionProvider()
    };
  }

  /**
   * Get the ID of the currently active default calling provider.
   * @returns {string} 'vapi' | 'retell' | 'omnidimension'
   */
  getActiveProviderId() {
    const active = getSetting('ACTIVE_CALLING_PROVIDER');
    if (active && this.providers[active.toLowerCase()]) {
      return active.toLowerCase();
    }
    return 'vapi';
  }

  /**
   * Set the active default calling provider.
   * @param {string} providerId
   */
  setActiveProviderId(providerId) {
    const id = String(providerId || '').toLowerCase();
    if (!this.providers[id]) {
      throw new Error(`Unsupported calling provider: ${providerId}. Supported: ${Object.keys(this.providers).join(', ')}`);
    }
    setSetting('ACTIVE_CALLING_PROVIDER', id);
    logActivity('calling', 'provider_switched', 'success', `Switched active calling provider to ${this.providers[id].name}`);
    return { success: true, activeProvider: id, name: this.providers[id].name };
  }

  /**
   * Resolve a provider instance by ID, or fallback to the active provider.
   * @param {string} [providerId]
   */
  getProvider(providerId) {
    if (providerId && this.providers[providerId.toLowerCase()]) {
      return this.providers[providerId.toLowerCase()];
    }
    const activeId = this.getActiveProviderId();
    return this.providers[activeId] || this.providers.vapi;
  }

  /**
   * Get diagnostic and configuration state for all registered providers.
   */
  async listProviders() {
    const activeId = this.getActiveProviderId();
    const result = [];

    for (const [id, provider] of Object.entries(this.providers)) {
      const configValidation = await provider.validateConfig().catch(err => ({
        isValid: false,
        missing: [err.message],
        details: {}
      }));

      result.push({
        id: provider.id,
        name: provider.name,
        isActive: id === activeId,
        isConfigured: configValidation.isValid,
        missingFields: configValidation.missing || [],
        details: configValidation.details || {},
        capabilities: {
          supportsRecordings: true,
          supportsTranscripts: true,
          supportsEndingCall: true,
          supportsDynamicPrompts: true,
          supportsWebhooks: true
        }
      });
    }

    return result;
  }

  /**
   * Test connection to a specific provider.
   * @param {string} providerId
   */
  async testProvider(providerId) {
    const provider = this.getProvider(providerId);
    return await provider.testConnection();
  }

  /**
   * List assistants / agents for a specific provider.
   * @param {string} providerId
   */
  async listAssistants(providerId) {
    const provider = this.getProvider(providerId);
    return await provider.listAssistants();
  }

  /**
   * List phone numbers for a specific provider.
   * @param {string} providerId
   */
  async listPhoneNumbers(providerId) {
    const provider = this.getProvider(providerId);
    return await provider.listPhoneNumbers();
  }

  /**
   * Save credentials and configuration for a specific provider.
   */
  saveProviderConfig(providerId, config = {}) {
    const id = String(providerId || '').toLowerCase();
    if (!this.providers[id]) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    if (id === 'vapi') {
      if (config.apiKey !== undefined) setSetting('VAPI_API_KEY', config.apiKey);
      if (config.assistantId !== undefined) setSetting('VAPI_ASSISTANT_ID', config.assistantId);
      if (config.phoneNumberId !== undefined) setSetting('VAPI_PHONE_NUMBER_ID', config.phoneNumberId);
    } else if (id === 'retell') {
      if (config.apiKey !== undefined) setSetting('RETELL_API_KEY', config.apiKey);
      if (config.agentId !== undefined) setSetting('RETELL_AGENT_ID', config.agentId);
      if (config.phoneNumber !== undefined) setSetting('RETELL_PHONE_NUMBER', config.phoneNumber);
    } else if (id === 'omnidimension') {
      if (config.apiKey !== undefined) setSetting('OMNIDIMENSION_API_KEY', config.apiKey);
      if (config.agentId !== undefined) setSetting('OMNIDIMENSION_AGENT_ID', config.agentId);
      if (config.phoneNumber !== undefined) setSetting('OMNIDIMENSION_PHONE_NUMBER', config.phoneNumber);
      if (config.baseUrl !== undefined) setSetting('OMNIDIMENSION_BASE_URL', config.baseUrl);
    }

    logActivity('calling', 'provider_config_saved', 'success', `Updated settings for ${this.providers[id].name}`);
    return { success: true, message: `Configuration saved for ${this.providers[id].name}` };
  }

  /**
   * Initiate an outbound call to an individual lead via the chosen provider.
   */
  async dispatchCall({ leadId, providerId, customOpeningMessage, assistantId, fromNumber, campaignId }) {
    const lead = db.prepare('SELECT * FROM calling_leads WHERE id = ?').get(leadId);
    if (!lead) {
      throw new Error(`Lead #${leadId} not found`);
    }

    // Check DNC suppression
    const formattedPhone = formatPhoneNumber(lead.phone);
    if (isNumberSuppressed(formattedPhone) || lead.status === 'dnc') {
      throw new Error(`Phone number ${formattedPhone} is on the Do Not Call (DNC) list.`);
    }

    // Resolve target provider: parameter > campaign setting > default active provider
    let resolvedProviderId = providerId;
    let campaign = null;
    if (campaignId || lead.campaign_id) {
      campaign = db.prepare('SELECT * FROM calling_campaigns WHERE id = ?').get(campaignId || lead.campaign_id);
      if (!resolvedProviderId && campaign && campaign.provider) {
        resolvedProviderId = campaign.provider;
      }
    }
    const provider = this.getProvider(resolvedProviderId);

    // Call validation on the provider
    const validation = await provider.validateConfig();
    if (!validation.isValid) {
      throw new Error(`${provider.name} is missing configuration: ${validation.missing.join(', ')}`);
    }

    // Dispatch via provider
    const dispatchResult = await provider.dispatchCall({
      lead,
      campaign,
      customOpeningMessage,
      assistantId,
      fromNumber
    });

    return dispatchResult;
  }

  /**
   * Sync call outcome, transcript, recording, and duration from provider API.
   */
  async syncCall(callId, providerId) {
    // If providerId not given, lookup call in call_logs to detect provider
    let targetProviderId = providerId;
    if (!targetProviderId) {
      const callLog = db.prepare('SELECT provider FROM call_logs WHERE vapi_call_id = ?').get(callId);
      if (callLog && callLog.provider) {
        targetProviderId = callLog.provider;
      }
    }

    const provider = this.getProvider(targetProviderId);
    return await provider.syncCallDetails(callId);
  }

  /**
   * End an active call.
   */
  async endCall(callId, providerId) {
    let targetProviderId = providerId;
    if (!targetProviderId) {
      const callLog = db.prepare('SELECT provider FROM call_logs WHERE vapi_call_id = ?').get(callId);
      if (callLog && callLog.provider) {
        targetProviderId = callLog.provider;
      }
    }

    const provider = this.getProvider(targetProviderId);
    return await provider.endCall(callId);
  }

  /**
   * Route incoming provider webhook to the appropriate provider adapter.
   */
  async processWebhook(providerId, payload, headers) {
    const provider = this.getProvider(providerId);
    return await provider.processWebhook(payload, headers);
  }
}

// Export singleton instance
const providerManager = new ProviderManager();
module.exports = providerManager;
