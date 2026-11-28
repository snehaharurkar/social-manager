/**
 * Abstract Base Calling Provider Interface
 * All AI calling adapters (Vapi, Retell, OmniDimension) implement this contract.
 */
class BaseCallingProvider {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  /**
   * Validate that all necessary credentials and parameters are configured for outbound calls.
   * @returns {{ isValid: boolean, missing: string[], details: any }}
   */
  async validateConfig() {
    throw new Error(`${this.name}: validateConfig() must be implemented.`);
  }

  /**
   * Test API connectivity against provider servers using current credentials.
   * @returns {{ success: boolean, message: string, data?: any }}
   */
  async testConnection() {
    throw new Error(`${this.name}: testConnection() must be implemented.`);
  }

  /**
   * List available assistants / agents on the provider account.
   * @returns {Promise<Array<{ id: string, name: string, model?: string, voice?: string }>>}
   */
  async listAssistants() {
    throw new Error(`${this.name}: listAssistants() must be implemented.`);
  }

  /**
   * List available phone numbers configured on the provider account.
   * @returns {Promise<Array<{ id: string, number: string, provider?: string, status?: string }>>}
   */
  async listPhoneNumbers() {
    throw new Error(`${this.name}: listPhoneNumbers() must be implemented.`);
  }

  /**
   * Initiate an outbound phone call.
   * @param {{ lead: any, campaign?: any, customOpeningMessage?: string, assistantId?: string, fromNumber?: string }} params
   * @returns {Promise<{ success: boolean, callId: string, status: string, provider: string, raw?: any }>}
   */
  async dispatchCall(params) {
    throw new Error(`${this.name}: dispatchCall() must be implemented.`);
  }

  /**
   * Fetch live call status, transcript, recording, and outcome from provider API.
   * @param {string} callId
   * @returns {Promise<{ callId: string, status: string, duration: number, transcript?: string, recordingUrl?: string, outcomeText?: string, summary?: string, raw?: any }>}
   */
  async syncCallDetails(callId) {
    throw new Error(`${this.name}: syncCallDetails() must be implemented.`);
  }

  /**
   * Terminate an active in-progress call where supported.
   * @param {string} callId
   * @returns {Promise<boolean>}
   */
  async endCall(callId) {
    throw new Error(`${this.name}: endCall() must be implemented.`);
  }

  /**
   * Process an inbound webhook event from the provider.
   * @param {any} payload
   * @param {any} headers
   * @returns {Promise<{ received: boolean, callId?: string, eventType?: string }>}
   */
  async processWebhook(payload, headers) {
    throw new Error(`${this.name}: processWebhook() must be implemented.`);
  }

  /**
   * Normalize provider-specific call status to SocialManager common status.
   * @param {string} providerStatus
   * @returns {string}
   */
  normalizeStatus(providerStatus) {
    return String(providerStatus || 'completed').toLowerCase();
  }
}

module.exports = BaseCallingProvider;
