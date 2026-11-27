import type {
  Channel,
  Rule,
  ScheduledPost,
  CommentItem,
  DashboardStats,
  ActivityLog,
  CallingLead,
  CallingCampaign,
  CallingSettings,
  ParsedSheetPreview,
  FollowUpsResponse,
  CrmLead,
  CrmStats,
  BrandKnowledgeItem,
  BrandVoiceSettings,
  AnalyticsOverview,
  AnalyticsTimeseriesPoint,
  AutomationExecution,
  AutomationTemplate,
  AppNotification,
  MultiPublishRequest,
  MultiPublishResult,
  YouTubeAnalyticsData,
  InstagramAnalyticsData,
  TelegramAnalyticsData,
  UnifiedAnalyticsData,
  TelegramChannelVerification
} from './types';

export const getApiBase = (): string => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('custom_backend_url');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '') + '/api';
    }
  }
  const envUrl = import.meta.env?.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return `${envUrl.trim().replace(/\/+$/, '')}/api`;
  }
  return '/api';
};

export async function safeJson(res: Response, defaultErrMsg: string = 'Request failed') {
  const text = await res.text();
  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || text.includes('DOCTYPE html')) {
    throw new Error(
      'Backend server is not connected on this URL. Netlify only hosts the frontend UI. Please test on http://localhost:5000 (where the backend is running) or set your Render backend URL in settings.'
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(defaultErrMsg);
  }
}

const API_BASE = getApiBase();

export const api = {
  // Stats & Dashboard
  async getStats(): Promise<{ stats: DashboardStats; recentLogs: ActivityLog[] }> {
    const res = await fetch(`${getApiBase()}/settings/stats`);
    const data = await safeJson(res, 'Failed to fetch stats');
    return data;
  },

  // Channels
  async getChannels(): Promise<Channel[]> {
    const res = await fetch(`${getApiBase()}/channels`);
    const data = await safeJson(res, 'Failed to fetch channels');
    return data.channels || [];
  },

  async deleteChannel(id: string): Promise<void> {
    await fetch(`${getApiBase()}/channels/${id}`, { method: 'DELETE' });
  },

  async triggerSync(): Promise<void> {
    await fetch(`${getApiBase()}/channels/sync`, { method: 'POST' });
  },

  async connectUplika(data: { apiKey?: string; mcpUrl?: string; customUsername?: string }): Promise<any> {
    const res = await fetch(`${getApiBase()}/channels/connect-uplika`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await safeJson(res, 'Failed to connect Uplika');
    if (!json.success) throw new Error(json.error);
    return json;
  },

  // Rules
  async getRules(): Promise<Rule[]> {
    const res = await fetch(`${API_BASE}/rules`);
    const data = await res.json();
    return data.rules || [];
  },

  async createRule(rule: Partial<Rule>): Promise<void> {
    const res = await fetch(`${API_BASE}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },

  async updateRule(id: number, rule: Partial<Rule>): Promise<void> {
    const res = await fetch(`${API_BASE}/rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },

  async deleteRule(id: number): Promise<void> {
    await fetch(`${API_BASE}/rules/${id}`, { method: 'DELETE' });
  },

  async testRule(text: string, platform = 'all'): Promise<any> {
    const res = await fetch(`${API_BASE}/rules/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, platform })
    });
    return res.json();
  },

  // Scheduled Posts
  async getPosts(): Promise<ScheduledPost[]> {
    const res = await fetch(`${API_BASE}/posts`);
    const data = await res.json();
    return data.posts || [];
  },

  async createPost(post: Partial<ScheduledPost>): Promise<void> {
    const res = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },

  async deletePost(id: number): Promise<void> {
    await fetch(`${API_BASE}/posts/${id}`, { method: 'DELETE' });
  },

  async publishPostNow(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/posts/${id}/publish-now`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },

  // Media Upload
  async uploadMedia(file: File): Promise<{
    filename: string;
    originalName: string;
    size: number;
    mimeType: string;
    mediaType: 'video' | 'image';
    url: string;
    localPath: string;
  }> {
    const formData = new FormData();
    formData.append('media', file);

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to upload media');
    return data.file;
  },

  // Comments / Inbox
  async getComments(filter = 'all', platform = 'all'): Promise<CommentItem[]> {
    const res = await fetch(`${API_BASE}/comments?filter=${filter}&platform=${platform}`);
    const data = await res.json();
    return data.comments || [];
  },

  async replyToComment(id: string, text: string): Promise<void> {
    const res = await fetch(`${API_BASE}/comments/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },

  // Settings
  async getSettings(): Promise<Record<string, string>> {
    const res = await fetch(`${API_BASE}/settings`);
    const data = await res.json();
    return data.settings || {};
  },

  async updateSettings(settings: Record<string, string>): Promise<void> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },

  // WhatsApp Automation & Leads
  async getWhatsAppContacts(status = 'all', search = ''): Promise<any[]> {
    const params = new URLSearchParams();
    if (status !== 'all') params.append('status', status);
    if (search) params.append('search', search);

    const res = await fetch(`${API_BASE}/whatsapp/contacts?${params.toString()}`);
    const data = await res.json();
    return data.contacts || [];
  },

  async saveWhatsAppContact(contact: any): Promise<void> {
    const res = await fetch(`${API_BASE}/whatsapp/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },

  async deleteWhatsAppContact(id: number): Promise<void> {
    await fetch(`${API_BASE}/whatsapp/contacts/${id}`, { method: 'DELETE' });
  },

  async getWhatsAppMessages(phone: string): Promise<{ contact: any; messages: any[] }> {
    const res = await fetch(`${API_BASE}/whatsapp/messages/${encodeURIComponent(phone)}`);
    const data = await res.json();
    return { contact: data.contact, messages: data.messages || [] };
  },

  async sendWhatsAppMessage(phone: string, message: string): Promise<any> {
    const res = await fetch(`${API_BASE}/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phone, message })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async broadcastWhatsApp(template: string, status = 'all', tag = ''): Promise<{ sentCount: number }> {
    const res = await fetch(`${API_BASE}/whatsapp/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_template: template, filter_status: status, filter_tag: tag })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async simulateWhatsApp(phone: string, senderName: string, message: string): Promise<any> {
    const res = await fetch(`${API_BASE}/whatsapp/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phone, sender_name: senderName, message })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async getWhatsAppSettings(): Promise<any> {
    const res = await fetch(`${API_BASE}/whatsapp/settings`);
    const data = await res.json();
    return data.settings || {};
  },

  async saveWhatsAppSettings(settings: any): Promise<void> {
    const res = await fetch(`${API_BASE}/whatsapp/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },

  // WhatsApp Web QR Code Link
  async getWhatsAppWebStatus(): Promise<{ status: string; qrCode: string | null; user: any }> {
    const res = await fetch(`${API_BASE}/whatsapp/web/status`);
    const data = await res.json();
    return data;
  },

  async connectWhatsAppWeb(): Promise<{ status: string; qrCode: string | null; user: any }> {
    const res = await fetch(`${API_BASE}/whatsapp/web/connect`, { method: 'POST' });
    const data = await res.json();
    return data;
  },

  async disconnectWhatsAppWeb(): Promise<void> {
    await fetch(`${API_BASE}/whatsapp/web/disconnect`, { method: 'POST' });
  },

  // Instagram Leads & DM Automation
  async getInstagramLeads(status = 'all', search = ''): Promise<any[]> {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (search) params.append('search', search);
    const res = await fetch(`${API_BASE}/instagram/leads?${params.toString()}`);
    const data = await res.json();
    return data.leads || [];
  },

  async createInstagramLead(lead: any): Promise<any> {
    const res = await fetch(`${API_BASE}/instagram/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.lead;
  },

  async updateInstagramLead(id: number, lead: any): Promise<void> {
    const res = await fetch(`${API_BASE}/instagram/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },

  async deleteInstagramLead(id: number): Promise<void> {
    await fetch(`${API_BASE}/instagram/leads/${id}`, { method: 'DELETE' });
  },

  async getInstagramMessages(username: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/instagram/messages/${encodeURIComponent(username)}`);
    const data = await res.json();
    return data.messages || [];
  },

  async sendInstagramMessage(username: string, text: string): Promise<any> {
    const res = await fetch(`${API_BASE}/instagram/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, text })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.result;
  },

  async simulateInstagram(username: string, fullName: string, messageText: string): Promise<any> {
    const res = await fetch(`${API_BASE}/instagram/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, fullName, messageText })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async broadcastInstagram(template: string, targetStatus = 'all', targetTag = ''): Promise<{ count: number }> {
    const res = await fetch(`${API_BASE}/instagram/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, targetStatus, targetTag })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async getInstagramSettings(): Promise<any> {
    const res = await fetch(`${API_BASE}/instagram/settings`);
    const data = await res.json();
    return data.settings || {};
  },

  async saveInstagramSettings(settings: any): Promise<void> {
    const res = await fetch(`${API_BASE}/instagram/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },

  // Telegram Integration & Leads Automation
  async connectTelegram(botToken: string, channelId = ''): Promise<any> {
    const res = await fetch(`${API_BASE}/channels/connect-telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, channelId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async verifyTelegramBot(botToken: string): Promise<any> {
    const res = await fetch(`${API_BASE}/telegram/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.bot;
  },

  async verifyTelegramChannel(channelId: string, botToken?: string, saveIfValid: boolean = false): Promise<TelegramChannelVerification> {
    const res = await fetch(`${getApiBase()}/telegram/verify-channel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, botToken, saveIfValid })
    });
    const data = await safeJson(res, 'Failed to verify Telegram channel');
    if (!data.success) throw new Error(data.error || 'Failed to verify Telegram channel');
    return data.verification;
  },

  async getTelegramLeads(status = 'all', search = ''): Promise<any[]> {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (search) params.append('search', search);
    const res = await fetch(`${API_BASE}/telegram/leads?${params.toString()}`);
    const data = await res.json();
    return data.leads || [];
  },

  async createTelegramLead(lead: any): Promise<any> {
    const res = await fetch(`${API_BASE}/telegram/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.lead;
  },

  async updateTelegramLead(id: number, lead: any): Promise<void> {
    const res = await fetch(`${API_BASE}/telegram/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },

  async deleteTelegramLead(id: number): Promise<void> {
    await fetch(`${API_BASE}/telegram/leads/${id}`, { method: 'DELETE' });
  },

  async getTelegramMessages(chatId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/telegram/messages/${encodeURIComponent(chatId)}`);
    const data = await res.json();
    return data.messages || [];
  },

  async sendTelegramMessage(chatId: string, text: string): Promise<any> {
    const res = await fetch(`${API_BASE}/telegram/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, text })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.result;
  },

  async simulateTelegram(chatId: string, username: string, firstName: string, messageText: string): Promise<any> {
    const res = await fetch(`${API_BASE}/telegram/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, username, firstName, messageText })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async broadcastTelegram(template: string, targetStatus = 'all', targetTag = ''): Promise<{ count: number }> {
    const res = await fetch(`${API_BASE}/telegram/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, targetStatus, targetTag })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async getTelegramSettings(): Promise<any> {
    const res = await fetch(`${API_BASE}/telegram/settings`);
    const data = await res.json();
    return data.settings || {};
  },

  async saveTelegramSettings(settings: any): Promise<void> {
    const res = await fetch(`${API_BASE}/telegram/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  },

  // Calling Agent & Outbound Dialer
  async uploadCallingSheet(file: File): Promise<ParsedSheetPreview> {
    const formData = new FormData();
    formData.append('sheet', file);
    const res = await fetch(`${API_BASE}/calling/upload-sheet`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to upload sheet');
    return data;
  },

  async createCallingCampaign(data: {
    title: string;
    fileName: string;
    leads: any[];
    customScript?: string;
    delaySeconds?: number;
  }): Promise<{ success: boolean; campaignId: number; totalLeads: number; message: string }> {
    const res = await fetch(`${API_BASE}/calling/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to create campaign');
    return json;
  },

  async getCallingCampaigns(): Promise<CallingCampaign[]> {
    const res = await fetch(`${API_BASE}/calling/campaigns`);
    const data = await res.json();
    return data.campaigns || [];
  },

  async getCallingCampaign(id: number): Promise<CallingCampaign> {
    const res = await fetch(`${getApiBase()}/calling/campaigns/${id}`);
    const data = await safeJson(res, 'Campaign not found');
    if (!data.success) throw new Error(data.error || 'Campaign not found');
    return data.campaign;
  },

  async getAllCallingLeads(filter?: { status?: string; search?: string }): Promise<CallingLead[]> {
    const params = new URLSearchParams();
    if (filter?.status) params.append('status', filter.status);
    if (filter?.search) params.append('search', filter.search);

    const res = await fetch(`${getApiBase()}/calling/leads?${params.toString()}`);
    const data = await safeJson(res, 'Failed to fetch calling leads');
    return data.leads || [];
  },

  async getCampaignLeads(campaignId: number, filter?: { status?: string; search?: string }): Promise<CallingLead[]> {
    const params = new URLSearchParams();
    if (filter?.status) params.append('status', filter.status);
    if (filter?.search) params.append('search', filter.search);

    const res = await fetch(`${getApiBase()}/calling/campaigns/${campaignId}/leads?${params.toString()}`);
    const data = await safeJson(res, 'Failed to fetch campaign leads');
    return data.leads || [];
  },

  async callLead(leadId: number): Promise<any> {
    const res = await fetch(`${API_BASE}/calling/leads/${leadId}/call`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Call failed');
    return data.callResult;
  },

  async updateCallingLead(leadId: number, update: Partial<CallingLead>): Promise<CallingLead> {
    const res = await fetch(`${API_BASE}/calling/leads/${leadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update lead');
    return data.lead;
  },

  async deleteCallingLead(leadId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/calling/leads/${leadId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete lead');
  },

  async scheduleCallingFollowUp(leadId: number, followUpDate: string, notes?: string): Promise<CallingLead> {
    const res = await fetch(`${API_BASE}/calling/leads/${leadId}/follow-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followUpDate, notes })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to schedule follow-up');
    return data.lead;
  },

  async getCallingFollowUps(filter?: { campaignId?: string; status?: string }): Promise<FollowUpsResponse> {
    const params = new URLSearchParams();
    if (filter?.campaignId) params.append('campaignId', filter.campaignId);
    if (filter?.status) params.append('status', filter.status);

    const res = await fetch(`${API_BASE}/calling/follow-ups?${params.toString()}`);
    const data = await res.json();
    return data;
  },

  async deleteCallingCampaign(campaignId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/calling/campaigns/${campaignId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete campaign');
  },

  getCallingExportUrl(campaignId: number): string {
    return `${getApiBase()}/calling/campaigns/${campaignId}/export`;
  },

  async getCallingSettings(): Promise<CallingSettings> {
    const res = await fetch(`${getApiBase()}/calling/settings`);
    const data = await safeJson(res, 'Failed to fetch calling settings');
    return data.settings;
  },

  async saveCallingSettings(settings: Partial<CallingSettings>): Promise<void> {
    const res = await fetch(`${getApiBase()}/calling/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await safeJson(res, 'Failed to save calling settings');
    if (!data.success) throw new Error(data.error || 'Failed to save calling settings');
  },

  async createIndividualLead(leadData: {
    campaign_id?: number | null;
    name: string;
    phone_number: string;
    email?: string;
    interest?: string;
    notes?: string;
    follow_up_date?: string | null;
    follow_up_notes?: string;
  }): Promise<{ success: boolean; lead: CallingLead; message: string }> {
    const res = await fetch(`${getApiBase()}/calling/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData)
    });
    const data = await safeJson(res, 'Failed to add lead');
    if (!data.success) throw new Error(data.error || 'Failed to add lead');
    return data;
  },

  async callDirectIndividual(data: {
    name?: string;
    phone_number: string;
    email?: string;
    interest?: string;
    notes?: string;
    campaign_id?: number | null;
  }): Promise<{ success: boolean; lead: CallingLead; callResult: any; message: string }> {
    const res = await fetch(`${getApiBase()}/calling/call-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await safeJson(res, 'Failed to place direct call');
    if (!json.success) throw new Error(json.error || 'Failed to place direct call');
    return json;
  },

  // CRM Unified Leads
  async getCrmLeads(filter?: { platform?: string; stage?: string; search?: string }): Promise<{ total: number; leads: CrmLead[] }> {
    const params = new URLSearchParams();
    if (filter?.platform) params.append('platform', filter.platform);
    if (filter?.stage) params.append('stage', filter.stage);
    if (filter?.search) params.append('search', filter.search);
    const res = await fetch(`${getApiBase()}/crm/leads?${params.toString()}`);
    return await safeJson(res, 'Failed to fetch CRM leads');
  },

  async getCrmStats(): Promise<CrmStats> {
    const res = await fetch(`${getApiBase()}/crm/stats`);
    return await safeJson(res, 'Failed to fetch CRM stats');
  },

  async updateCrmLead(platform: string, id: string, data: { stage?: string; status?: string; notes?: string; tags?: string; follow_up_date?: string | null }): Promise<void> {
    const res = await fetch(`${getApiBase()}/crm/leads/${platform}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await safeJson(res, 'Failed to update CRM lead');
    if (!json.success) throw new Error(json.error || 'Failed to update lead');
  },

  async deleteCrmLead(platform: string, id: string): Promise<void> {
    const res = await fetch(`${getApiBase()}/crm/leads/${platform}/${id}`, {
      method: 'DELETE'
    });
    const json = await safeJson(res, 'Failed to delete CRM lead');
    if (!json.success) throw new Error(json.error || 'Failed to delete lead');
  },

  getCrmExportUrl(): string {
    return `${getApiBase()}/crm/export`;
  },

  // Brand Voice & Knowledge Base
  async getBrandKnowledge(category?: string): Promise<{ items: BrandKnowledgeItem[]; brandVoice: BrandVoiceSettings }> {
    const url = category && category !== 'all' ? `${getApiBase()}/brand/knowledge?category=${category}` : `${getApiBase()}/brand/knowledge`;
    const res = await fetch(url);
    return await safeJson(res, 'Failed to fetch brand knowledge');
  },

  async addBrandKnowledge(data: { title: string; category: string; content: string; tags?: string }): Promise<BrandKnowledgeItem> {
    const res = await fetch(`${getApiBase()}/brand/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await safeJson(res, 'Failed to add knowledge item');
    if (!json.success) throw new Error(json.error || 'Failed to add knowledge item');
    return json.item;
  },

  async updateBrandKnowledge(id: number, data: Partial<BrandKnowledgeItem>): Promise<BrandKnowledgeItem> {
    const res = await fetch(`${getApiBase()}/brand/knowledge/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await safeJson(res, 'Failed to update knowledge item');
    if (!json.success) throw new Error(json.error || 'Failed to update knowledge item');
    return json.item;
  },

  async deleteBrandKnowledge(id: number): Promise<void> {
    const res = await fetch(`${getApiBase()}/brand/knowledge/${id}`, {
      method: 'DELETE'
    });
    const json = await safeJson(res, 'Failed to delete knowledge item');
    if (!json.success) throw new Error(json.error || 'Failed to delete knowledge item');
  },

  async saveBrandVoice(settings: Partial<BrandVoiceSettings>): Promise<void> {
    const res = await fetch(`${getApiBase()}/brand/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const json = await safeJson(res, 'Failed to save brand voice');
    if (!json.success) throw new Error(json.error || 'Failed to save brand voice');
  },

  // Analytics Engine
  async getAnalyticsOverview(range: string = '30d', start?: string, end?: string): Promise<AnalyticsOverview> {
    const q = new URLSearchParams({ range });
    if (start && end) { q.set('start', start); q.set('end', end); }
    const res = await fetch(`${getApiBase()}/analytics/overview?${q.toString()}`);
    const json = await safeJson(res, 'Failed to fetch analytics overview');
    return json.summary;
  },

  async getAnalyticsTimeseries(range: string = '7d'): Promise<AnalyticsTimeseriesPoint[]> {
    const q = new URLSearchParams({ range });
    const res = await fetch(`${getApiBase()}/analytics/timeseries?${q.toString()}`);
    const json = await safeJson(res, 'Failed to fetch timeseries');
    return json.timeseries || [];
  },

  async getAnalyticsPlatforms(): Promise<{ channels: any[]; unsupportedMetricsNotice: string }> {
    const res = await fetch(`${getApiBase()}/analytics/platforms`);
    return await safeJson(res, 'Failed to fetch platform metrics');
  },

  // Automations & Simulation Sandbox
  async getAutomationExecutions(status?: string): Promise<AutomationExecution[]> {
    const url = status && status !== 'all' ? `${getApiBase()}/automations/executions?status=${status}` : `${getApiBase()}/automations/executions`;
    const res = await fetch(url);
    const json = await safeJson(res, 'Failed to fetch automation executions');
    return json.executions || [];
  },

  async getAutomationTemplates(): Promise<AutomationTemplate[]> {
    const res = await fetch(`${getApiBase()}/automations/templates`);
    const json = await safeJson(res, 'Failed to fetch automation templates');
    return json.templates || [];
  },

  async testAutomation(data: { message: string; platform?: string; authorName?: string }): Promise<{ matched: boolean; rule?: any; usedAi?: boolean; finalReply?: string; actions: string[]; executionTimeMs: number }> {
    const res = await fetch(`${getApiBase()}/automations/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await safeJson(res, 'Failed to run automation simulation');
  },

  async clearAutomationExecutions(): Promise<void> {
    const res = await fetch(`${getApiBase()}/automations/clear-executions`, {
      method: 'POST'
    });
    await safeJson(res, 'Failed to clear executions');
  },

  // AI Copilot
  async askCopilot(prompt: string): Promise<{ reply: string; groundedData: any }> {
    const res = await fetch(`${getApiBase()}/copilot/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    return await safeJson(res, 'Copilot failed to respond');
  },

  // ----------------------------------------------------
  // In-App Notifications
  // ----------------------------------------------------
  async getNotifications(params?: { category?: string; is_read?: string; limit?: number; offset?: number }): Promise<{ notifications: AppNotification[]; unreadCount: number; totalCount: number }> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    if (params?.is_read !== undefined && params.is_read !== '') query.set('is_read', params.is_read);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const qs = query.toString();
    const url = qs ? `${getApiBase()}/notifications?${qs}` : `${getApiBase()}/notifications`;
    const res = await fetch(url);
    const json = await safeJson(res, 'Failed to fetch notifications');
    return {
      notifications: json.notifications || [],
      unreadCount: json.unreadCount || 0,
      totalCount: json.totalCount || 0
    };
  },

  async markNotificationRead(id: number, is_read: number = 1): Promise<void> {
    const res = await fetch(`${getApiBase()}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read })
    });
    await safeJson(res, 'Failed to update notification');
  },

  async markAllNotificationsRead(): Promise<void> {
    const res = await fetch(`${getApiBase()}/notifications/mark-all-read`, {
      method: 'POST'
    });
    await safeJson(res, 'Failed to mark all as read');
  },

  async deleteNotification(id: number): Promise<void> {
    const res = await fetch(`${getApiBase()}/notifications/${id}`, {
      method: 'DELETE'
    });
    await safeJson(res, 'Failed to delete notification');
  },

  async clearNotifications(onlyRead: boolean = false): Promise<void> {
    const url = onlyRead ? `${getApiBase()}/notifications?only_read=true` : `${getApiBase()}/notifications`;
    const res = await fetch(url, { method: 'DELETE' });
    await safeJson(res, 'Failed to clear notifications');
  },

  // ----------------------------------------------------
  // Multi-Platform Publishing
  // ----------------------------------------------------
  async multiPublishPosts(data: MultiPublishRequest): Promise<MultiPublishResult> {
    const res = await fetch(`${getApiBase()}/posts/multi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await safeJson(res, 'Failed to execute multi-platform publishing');
    if (!json.success && !json.batchId) throw new Error(json.error || 'Publishing failed');
    return json;
  },

  async retryFailedBatch(batchId: string): Promise<any> {
    const res = await fetch(`${getApiBase()}/posts/retry-batch/${batchId}`, {
      method: 'POST'
    });
    return await safeJson(res, 'Failed to retry batch');
  },

  // ----------------------------------------------------
  // Calling Agent: Column Mapping & Sheet Cleanup
  // ----------------------------------------------------
  async applyCallingColumnMapping(data: { filePath: string; mapping: any; headerRowIndex?: number }): Promise<ParsedSheetPreview> {
    const res = await fetch(`${getApiBase()}/calling/apply-mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await safeJson(res, 'Failed to apply column mapping');
    if (!json.success) throw new Error(json.error || 'Failed to apply column mapping');
    return json;
  },

  async cleanupUploadedSheet(filePath: string): Promise<void> {
    try {
      await fetch(`${getApiBase()}/calling/cleanup-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
    } catch {}
  },

  // ----------------------------------------------------
  // Platform & Unified Analytics
  // ----------------------------------------------------
  async getYouTubeAnalytics(range: string = '30d', start?: string, end?: string): Promise<YouTubeAnalyticsData> {
    const q = new URLSearchParams({ range });
    if (start && end) { q.set('start', start); q.set('end', end); }
    const res = await fetch(`${getApiBase()}/analytics/youtube?${q.toString()}`);
    return await safeJson(res, 'Failed to fetch YouTube analytics');
  },

  async getInstagramAnalytics(range: string = '30d', start?: string, end?: string): Promise<InstagramAnalyticsData> {
    const q = new URLSearchParams({ range });
    if (start && end) { q.set('start', start); q.set('end', end); }
    const res = await fetch(`${getApiBase()}/analytics/instagram?${q.toString()}`);
    return await safeJson(res, 'Failed to fetch Instagram analytics');
  },

  async getTelegramAnalytics(range: string = '30d', start?: string, end?: string): Promise<TelegramAnalyticsData> {
    const q = new URLSearchParams({ range });
    if (start && end) { q.set('start', start); q.set('end', end); }
    const res = await fetch(`${getApiBase()}/analytics/telegram?${q.toString()}`);
    return await safeJson(res, 'Failed to fetch Telegram analytics');
  },

  async getUnifiedAnalytics(range: string = '30d', start?: string, end?: string): Promise<UnifiedAnalyticsData> {
    const q = new URLSearchParams({ range });
    if (start && end) { q.set('start', start); q.set('end', end); }
    const res = await fetch(`${getApiBase()}/analytics/unified?${q.toString()}`);
    return await safeJson(res, 'Failed to fetch unified analytics');
  }
};
