export interface Channel {
  id: string;
  platform: 'youtube' | 'instagram' | 'telegram';
  platform_id: string;
  display_name: string;
  username?: string;
  avatar_url?: string;
  status: 'active' | 'needs_reauth' | 'paused';
  token_expires_at?: number;
  isTokenValid: boolean;
  meta?: {
    subscriberCount?: string;
    videoCount?: string;
    viewCount?: string;
    customUrl?: string;
    description?: string;
  };
  created_at: string;
}

export interface Rule {
  id: number;
  name: string;
  platform: 'all' | 'youtube' | 'instagram' | 'telegram';
  trigger_type: 'contains' | 'exact' | 'starts_with' | 'regex';
  keywords: string;
  reply_template: string;
  use_ai_polish: number;
  ai_prompt?: string;
  cooldown_seconds: number;
  is_active: number;
  match_count: number;
  created_at: string;
}

export interface ScheduledPost {
  id: number;
  platform: 'youtube' | 'instagram' | 'telegram';
  channel_id: string;
  channel_name?: string;
  channel_avatar?: string;
  title?: string;
  content: string;
  media_url?: string;
  privacy_status?: 'public' | 'unlisted' | 'private';
  media_type?: 'video' | 'image';
  published_url?: string;
  scheduled_at: string;
  status: 'pending' | 'published' | 'failed';
  published_at?: string;
  error_message?: string;
  created_at: string;
}

export interface CommentItem {
  id: string;
  platform: 'youtube' | 'instagram' | 'telegram';
  channel_id: string;
  video_or_post_id: string;
  post_title?: string;
  author_name: string;
  author_avatar?: string;
  text: string;
  replied: number;
  reply_text?: string;
  published_at: string;
}

export interface ActivityLog {
  id: number;
  platform: string;
  event_type: string;
  status: string;
  details: string;
  created_at: string;
}

export interface DashboardStats {
  activeChannels: number;
  activeRules: number;
  totalReplies: number;
  pendingScheduled: number;
  totalComments: number;
}

export interface WhatsAppContact {
  id: number;
  phone_number: string;
  name?: string;
  source: string;
  status: 'new' | 'contacted' | 'engaged' | 'escalated' | 'closed';
  tags?: string;
  notes?: string;
  last_contacted_at?: string;
  created_at: string;
}

export interface WhatsAppMessage {
  id: string;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  sender_name?: string;
  message_text: string;
  status: 'sent' | 'delivered' | 'read' | 'received' | 'failed';
  is_escalated: number;
  created_at: string;
}

export interface WhatsAppSettings {
  WHATSAPP_AUTO_REPLY_ENABLED: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_VERIFY_TOKEN: string;
  WHATSAPP_HUMAN_HELP_NAME: string;
  WHATSAPP_HUMAN_HELP_PHONE: string;
  WHATSAPP_HUMAN_HELP_EMAIL: string;
  WHATSAPP_WELCOME_MESSAGE: string;
  WHATSAPP_KNOWLEDGE_BASE: string;
}

export interface InstagramLead {
  id: number;
  ig_username: string;
  full_name?: string;
  source: 'direct_message' | 'post_comment' | 'story_reply' | 'manual';
  status: 'new' | 'contacted' | 'qualified' | 'customer' | 'escalated';
  tags?: string;
  notes?: string;
  last_interaction_at?: string;
  created_at: string;
}

export interface InstagramMessage {
  id: string;
  ig_username: string;
  direction: 'inbound' | 'outbound';
  sender_name?: string;
  message_text: string;
  status: 'sent' | 'delivered' | 'read' | 'received' | 'failed';
  is_escalated: number;
  created_at: string;
}

export interface InstagramSettings {
  INSTAGRAM_AUTO_REPLY_ENABLED: string;
  INSTAGRAM_HUMAN_HELP_NAME: string;
  INSTAGRAM_HUMAN_HELP_PHONE: string;
  INSTAGRAM_HUMAN_HELP_EMAIL: string;
  INSTAGRAM_HUMAN_HELP_HANDLE: string;
  INSTAGRAM_WELCOME_MESSAGE: string;
  INSTAGRAM_KNOWLEDGE_BASE: string;
  INSTAGRAM_VERIFY_TOKEN: string;
}

export interface TelegramLead {
  id: number;
  chat_id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  source: 'bot_direct' | 'channel' | 'group' | 'manual';
  status: 'new' | 'contacted' | 'qualified' | 'customer' | 'escalated';
  tags?: string;
  notes?: string;
  last_interaction_at?: string;
  created_at: string;
}

export interface TelegramMessage {
  id: string;
  chat_id: string;
  direction: 'inbound' | 'outbound';
  sender_name?: string;
  message_text: string;
  status: 'sent' | 'delivered' | 'received' | 'failed';
  is_escalated: number;
  created_at: string;
}

export interface TelegramSettings {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_BOT_USERNAME: string;
  TELEGRAM_CHANNEL_ID: string;
  TELEGRAM_AUTO_REPLY_ENABLED: string;
  TELEGRAM_HUMAN_HELP_NAME: string;
  TELEGRAM_HUMAN_HELP_PHONE: string;
  TELEGRAM_HUMAN_HELP_EMAIL: string;
  TELEGRAM_HUMAN_HELP_HANDLE: string;
  TELEGRAM_WELCOME_MESSAGE: string;
  TELEGRAM_KNOWLEDGE_BASE: string;
}

export type CallingLeadStatus = 'pending' | 'calling' | 'interested' | 'needs_follow_up' | 'busy' | 'completed' | 'not_interested';

export interface CallingLead {
  id: number;
  campaign_id: number;
  name: string;
  phone_number: string;
  email?: string;
  interest?: string;
  notes?: string;
  call_status: CallingLeadStatus;
  call_duration?: number;
  call_attempts: number;
  last_called_at?: string;
  call_transcript?: string;
  recording_url?: string;
  external_call_id?: string;
  follow_up_date?: string;
  follow_up_notes?: string;
  follow_up_status?: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  campaign_title?: string;
}

export interface CallingCampaign {
  id: number;
  title: string;
  file_name?: string;
  total_leads: number;
  completed_calls: number;
  status: 'idle' | 'running' | 'paused' | 'completed';
  call_script: string;
  delay_seconds: number;
  created_at: string;
  updated_at: string;
  count_interested?: number;
  count_needs_follow_up?: number;
  count_busy?: number;
  count_completed?: number;
  count_not_interested?: number;
  count_pending?: number;
}

export interface CallingSettings {
  agentName: string;
  defaultScript: string;
  systemPrompt?: string;
  delayBetweenCalls: number;
  voiceGender: string;
  callingMode?: 'live' | 'simulation';
  callingProvider?: 'vapi' | 'twilio';
  vapiApiKey?: string;
  vapiPhoneNumberId?: string;
  vapiAssistantId?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
}

export interface ParsedSheetPreview {
  success: boolean;
  fileName: string;
  storedFileName: string;
  filePath: string;
  sheetName: string;
  totalRows: number;
  detectedColumns: string[];
  validLeads: Array<{
    name: string;
    phone_number: string;
    email?: string;
    interest?: string;
    notes?: string;
    follow_up_date?: string | null;
  }>;
}

export interface FollowUpsResponse {
  success: boolean;
  followUps: CallingLead[];
  counts: {
    total: number;
    overdue: number;
    today: number;
    upcoming: number;
    completed: number;
  };
  categorized: {
    overdue: CallingLead[];
    today: CallingLead[];
    upcoming: CallingLead[];
    completed: CallingLead[];
  };
}
