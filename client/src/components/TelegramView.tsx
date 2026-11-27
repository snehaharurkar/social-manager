import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Send, 
  LifeBuoy, 
  Plus, 
  Search, 
  Trash2, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw,
  Radio,
  ShieldCheck,
  Smartphone,
  MessageCircle,
  ExternalLink,
  Bot,
  Loader2,
  Check,
  Copy,
  AlertTriangle,
  HelpCircle,
  Info,
  Lock,
  Shield
} from 'lucide-react';
import type { TelegramLead, TelegramMessage, TelegramSettings, TelegramChannelVerification } from '../types';
import { api } from '../api';

const TelegramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

export const TelegramView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'connect' | 'chats' | 'leads' | 'broadcast' | 'knowledge' | 'simulator'>('simulator');
  const [leads, setLeads] = useState<TelegramLead[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [activeMessages, setActiveMessages] = useState<TelegramMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sending, setSending] = useState(false);

  // Bot Connection Form State
  const [botTokenInput, setBotTokenInput] = useState('');
  const [channelIdInput, setChannelIdInput] = useState('');
  const [connectingBot, setConnectingBot] = useState(false);
  const [botConnectSuccess, setBotConnectSuccess] = useState<string | null>(null);

  // Channel Verification State
  const [verifyingChannel, setVerifyingChannel] = useState(false);
  const [channelVerification, setChannelVerification] = useState<TelegramChannelVerification | null>(null);
  const [verifyChannelError, setVerifyChannelError] = useState<string | null>(null);
  const [verifyChannelSuccess, setVerifyChannelSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Lead Modal
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({
    chat_id: '',
    username: '',
    first_name: '',
    last_name: '',
    source: 'bot_direct',
    status: 'new',
    tags: 'lead, music',
    notes: ''
  });

  // Broadcast State
  const [broadcastTemplate, setBroadcastTemplate] = useState('Hello {name}! 🌷 Hope you are having a wonderful week! Check out our latest acoustic cover and reply here if you have any questions!');
  const [broadcastStatus, setBroadcastStatus] = useState('all');
  const [broadcastTag, setBroadcastTag] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  // Settings State
  const [settings, setSettings] = useState<TelegramSettings>({
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_BOT_USERNAME: '',
    TELEGRAM_CHANNEL_ID: '',
    TELEGRAM_AUTO_REPLY_ENABLED: '1',
    TELEGRAM_HUMAN_HELP_NAME: 'Sneha (Support Manager)',
    TELEGRAM_HUMAN_HELP_PHONE: '+91 98765 43210',
    TELEGRAM_HUMAN_HELP_EMAIL: 'support@sneharmony.com',
    TELEGRAM_HUMAN_HELP_HANDLE: '@sneharmony',
    TELEGRAM_WELCOME_MESSAGE: 'Hello {name}! 🌷 Welcome to Sneharmony on Telegram! How can we assist you today?',
    TELEGRAM_KNOWLEDGE_BASE: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // Simulator State
  const [simChatId] = useState('883920194');
  const [simUsername, setSimUsername] = useState('rohit_music');
  const [simName, setSimName] = useState('Rohit');
  const [simInput, setSimInput] = useState('');
  const [simMessages, setSimMessages] = useState<Array<{ sender: 'lead' | 'bot'; text: string; time: string; isEscalated?: boolean }>>([
    {
      sender: 'bot',
      text: 'Hello Rohit! 🌷 Welcome to Sneharmony on Telegram. How can we help you today? Feel free to ask about our music, collaborations, acoustic guitar lessons, or bookings!',
      time: 'Just now'
    }
  ]);
  const [simLoading, setSimLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const simEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLeads();
    loadSettings();
  }, []);

  useEffect(() => {
    if (selectedChatId) {
      loadMessages(selectedChatId);
    }
  }, [selectedChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  useEffect(() => {
    simEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simMessages]);

  const loadLeads = async () => {
    try {
      const data = await api.getTelegramLeads(statusFilter, searchQuery);
      setLeads(data);
      if (data.length > 0 && !selectedChatId) {
        setSelectedChatId(data[0].chat_id);
      }
    } catch (err) {
      console.error('Failed to load Telegram leads:', err);
    }
  };

  const loadMessages = async (chatId: string) => {
    try {
      const data = await api.getTelegramMessages(chatId);
      setActiveMessages(data);
    } catch (err) {
      console.error('Failed to load Telegram messages:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await api.getTelegramSettings();
      setSettings(prev => ({ ...prev, ...data }));
      if (data.TELEGRAM_BOT_TOKEN) {
        setBotTokenInput(data.TELEGRAM_BOT_TOKEN);
      }
      if (data.TELEGRAM_CHANNEL_ID) {
        setChannelIdInput(data.TELEGRAM_CHANNEL_ID);
      }
    } catch (err) {
      console.error('Failed to load Telegram settings:', err);
    }
  };

  const handleVerifyAndConnectBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botTokenInput.trim()) {
      alert('Please enter your Telegram Bot Token');
      return;
    }

    setConnectingBot(true);
    try {
      const bot = await api.verifyTelegramBot(botTokenInput.trim());
      await api.connectTelegram(botTokenInput.trim(), channelIdInput.trim());
      setBotConnectSuccess(`Successfully connected @${bot.username} (${bot.firstName})! ✨`);
      setTimeout(() => setBotConnectSuccess(null), 5000);
      loadSettings();
    } catch (err: any) {
      alert(`Telegram Connection Error: ${err.message}`);
    } finally {
      setConnectingBot(false);
    }
  };

  const handleVerifyChannel = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!channelIdInput.trim()) {
      alert('Please enter your Telegram Channel ID or message link (e.g. -1001234567890).');
      return;
    }

    setVerifyingChannel(true);
    setVerifyChannelError(null);
    setVerifyChannelSuccess(null);
    setChannelVerification(null);

    try {
      const res = await api.verifyTelegramChannel(
        channelIdInput.trim(),
        botTokenInput.trim() || undefined,
        true
      );
      setChannelVerification(res);
      setChannelIdInput(res.chatId);
      setVerifyChannelSuccess(`Successfully verified "${res.title}" (${res.chatId})! Bot @${res.botUsername} has administrator posting privileges.`);
      await loadSettings();
    } catch (err: any) {
      setVerifyChannelError(err.message);
    } finally {
      setVerifyingChannel(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.saveTelegramSettings(settings);
      setSettingsSavedToast(true);
      setTimeout(() => setSettingsSavedToast(false), 2500);
    } catch (err: any) {
      alert(`Error saving settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedChatId) return;

    setSending(true);
    try {
      await api.sendTelegramMessage(selectedChatId, replyText.trim());
      setReplyText('');
      loadMessages(selectedChatId);
      loadLeads();
    } catch (err: any) {
      alert(`Failed to send message: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.chat_id.trim()) {
      alert('Chat ID or Telegram user ID is required');
      return;
    }

    try {
      await api.createTelegramLead(leadForm);
      setLeadModalOpen(false);
      setLeadForm({
        chat_id: '',
        username: '',
        first_name: '',
        last_name: '',
        source: 'bot_direct',
        status: 'new',
        tags: 'lead, music',
        notes: ''
      });
      loadLeads();
    } catch (err: any) {
      alert(`Failed to save lead: ${err.message}`);
    }
  };

  const handleDeleteLead = async (id: number) => {
    if (!confirm('Are you sure you want to delete this Telegram lead and history?')) return;
    try {
      await api.deleteTelegramLead(id);
      loadLeads();
      if (leads.find(l => l.id === id)?.chat_id === selectedChatId) {
        setSelectedChatId('');
        setActiveMessages([]);
      }
    } catch (err: any) {
      alert(`Failed to delete lead: ${err.message}`);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTemplate.trim()) return;

    try {
      const res = await api.broadcastTelegram(broadcastTemplate, broadcastStatus, broadcastTag);
      setBroadcastSuccess(`Successfully sent Telegram broadcast to ${res.count} leads/members! ✨`);
      setTimeout(() => setBroadcastSuccess(null), 4000);
      loadLeads();
    } catch (err: any) {
      alert(`Broadcast failed: ${err.message}`);
    }
  };

  // Run Simulator Step
  const handleSimulateSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simInput.trim() || simLoading) return;

    const userText = simInput.trim();
    setSimInput('');

    // Add user message to UI immediately
    setSimMessages(prev => [
      ...prev,
      {
        sender: 'lead',
        text: userText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    setSimLoading(true);
    try {
      const res = await api.simulateTelegram(simChatId, simUsername, simName, userText);
      const isEsc = res.botAction === 'escalated';

      if (res.reply) {
        setSimMessages(prev => [
          ...prev,
          {
            sender: 'bot',
            text: res.reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isEscalated: isEsc
          }
        ]);
      }
      loadLeads();
    } catch (err: any) {
      setSimMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `[Error processing message]: ${err.message}`,
          time: 'Now',
          isEscalated: true
        }
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  const tabs = [
    { id: 'simulator', label: 'Telegram Bot Simulator', icon: Smartphone, badge: 'Interactive' },
    { id: 'connect', label: 'Connect Bot & Channel', icon: Bot, badge: settings.TELEGRAM_BOT_USERNAME ? `@${settings.TELEGRAM_BOT_USERNAME}` : undefined },
    { id: 'leads', label: 'Telegram Leads CRM', icon: Users, badge: leads.length > 0 ? leads.length : undefined },
    { id: 'chats', label: 'Live Chats & DMs', icon: MessageCircle },
    { id: 'knowledge', label: 'AI & Knowledge Base', icon: Sparkles },
    { id: 'broadcast', label: 'Broadcast & Channel Updates', icon: Radio },
  ];

  const selectedLead = leads.find(l => l.chat_id === selectedChatId);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-sm shadow-sky-200">
              <TelegramIcon className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Telegram Automation & Leads</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
              100% Free & Unlimited
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Connect your free Telegram Bot in 30 seconds via @BotFather. Auto-reply to inquiries, answer with AI Knowledge Base, and escalate stuck leads to a human support manager.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('connect')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-xs"
          >
            <Bot className="w-3.5 h-3.5 text-sky-500" />
            <span>{settings.TELEGRAM_BOT_USERNAME ? `@${settings.TELEGRAM_BOT_USERNAME}` : 'Connect Telegram Bot'}</span>
          </button>

          <button
            onClick={() => setLeadModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl transition-all shadow-xs shadow-sky-200"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Telegram Lead</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-sky-600 text-sky-700 bg-sky-50/60'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-sky-200/70 text-sky-900' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: INTERACTIVE TELEGRAM SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Test Controls */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-sky-600 font-bold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>Test Telegram Inquiry & Support Escalation</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Test how your Telegram Bot engages with users. When a user asks about your music, guitar lessons, or services, the bot uses your <strong>Knowledge Base</strong>. If they need a real person or get stuck, it immediately presents the <strong>Human Support Card</strong>.
              </p>

              {/* Simulated Telegram User Profile */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Simulated Telegram User</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block">Username</label>
                    <input
                      type="text"
                      value={simUsername}
                      onChange={(e) => setSimUsername(e.target.value)}
                      className="w-full mt-0.5 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-mono"
                      placeholder="rohit_music"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">First Name</label>
                    <input
                      type="text"
                      value={simName}
                      onChange={(e) => setSimName(e.target.value)}
                      className="w-full mt-0.5 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                      placeholder="Rohit"
                    />
                  </div>
                </div>
              </div>

              {/* Sample Prompt Chips */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-700">Quick Test Prompts (Click to try):</div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Do you teach online guitar lessons?",
                    "How can we collaborate on an acoustic project?",
                    "What are your working hours?",
                    "Can I speak with a real person?",
                    "I am stuck with booking and need manager help"
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSimInput(chip)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/60 transition-all text-left"
                    >
                      "{chip}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Human Escalation Preview */}
              <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-purple-900 text-[11px]">
                  <LifeBuoy className="w-3.5 h-3.5 text-purple-600" />
                  <span>Configured Human Escalation Contact</span>
                </div>
                <div className="text-slate-600 text-[11px] space-y-0.5 font-sans">
                  <div><strong>Support Manager:</strong> {settings.TELEGRAM_HUMAN_HELP_NAME}</div>
                  <div><strong>Phone / WhatsApp:</strong> {settings.TELEGRAM_HUMAN_HELP_PHONE}</div>
                  <div><strong>Email:</strong> {settings.TELEGRAM_HUMAN_HELP_EMAIL}</div>
                  <div><strong>Telegram:</strong> {settings.TELEGRAM_HUMAN_HELP_HANDLE}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Telegram Mobile Chat Mockup */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[580px]">
              {/* Telegram App Header */}
              <div className="bg-sky-600 text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white">
                    <TelegramIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-xs flex items-center gap-1">
                      <span>Sneharmony Bot</span>
                      <span className="text-[10px] bg-sky-700/80 px-1 rounded text-sky-200">bot</span>
                    </div>
                    <span className="text-[10px] text-sky-100 font-medium">bot · automated service</span>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e4ecf2]/50">
                {simMessages.map((msg, idx) => {
                  const isLead = msg.sender === 'lead';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isLead ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                          isLead
                            ? 'bg-[#e3f2fd] text-slate-800 rounded-br-xs border border-sky-100 font-sans'
                            : msg.isEscalated
                            ? 'bg-purple-50 text-purple-950 border border-purple-200/80 rounded-bl-xs font-sans'
                            : 'bg-white text-slate-800 border border-slate-200/70 rounded-bl-xs font-sans'
                        }`}
                      >
                        {msg.isEscalated && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-purple-700 mb-1 border-b border-purple-200/50 pb-1">
                            <LifeBuoy className="w-3 h-3 text-purple-600" />
                            <span>HUMAN ESCALATION TRIGGERED</span>
                          </div>
                        )}
                        <p className="whitespace-pre-line">{msg.text}</p>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 px-1 font-mono">{msg.time}</span>
                    </div>
                  );
                })}
                {simLoading && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs italic p-2 bg-white rounded-xl border border-slate-100 max-w-fit animate-pulse">
                    <Sparkles className="w-3.5 h-3.5 text-sky-500 animate-spin" />
                    <span>Sneharmony Bot is typing...</span>
                  </div>
                )}
                <div ref={simEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSimulateSend} className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  value={simInput}
                  onChange={(e) => setSimInput(e.target.value)}
                  placeholder={`Send message as @${simUsername}...`}
                  className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-full focus:bg-white focus:outline-none focus:border-sky-500 transition-all font-sans"
                />
                <button
                  type="submit"
                  disabled={!simInput.trim() || simLoading}
                  className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center hover:bg-sky-700 disabled:opacity-40 transition-all shadow-xs shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONNECT BOT & CHANNEL */}
      {activeTab === 'connect' && (
        <div className="space-y-6 max-w-4xl">
          {/* Section 1: Bot Connection Status */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4 text-sky-600" />
                  1. Telegram Bot Token Setup
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your Telegram Bot credentials powered by Telegram Bot API.
                </p>
              </div>
              {settings.TELEGRAM_BOT_USERNAME && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Bot Connected (@{settings.TELEGRAM_BOT_USERNAME})
                </span>
              )}
            </div>

            {settings.TELEGRAM_BOT_USERNAME && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                    <TelegramIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs">@{settings.TELEGRAM_BOT_USERNAME}</h4>
                    <p className="text-[11px] text-slate-500">
                      Token stored securely in SQLite • Poller active & ready for auto-replies
                    </p>
                  </div>
                </div>

                <a
                  href={`https://t.me/${settings.TELEGRAM_BOT_USERNAME}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs self-start sm:self-auto"
                >
                  <span>Open Bot</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </div>
            )}

            <form onSubmit={handleVerifyAndConnectBot} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Telegram Bot API Token <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={botTokenInput}
                  onChange={(e) => setBotTokenInput(e.target.value)}
                  placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Your token is stored locally in your SQLite database and never exposed.
                </span>
              </div>

              {botConnectSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{botConnectSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={connectingBot}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {connectingBot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>{connectingBot ? 'Verifying with Telegram...' : 'Update & Verify Bot Token'}</span>
              </button>
            </form>
          </div>

          {/* Section 2: Channel Verification via getChat & getChatMember */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Radio className="w-4 h-4 text-sky-600" />
                  2. Verify Telegram Channel & Posting Privileges
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verifies that your bot can access your channel and has administrator rights to publish posts. Verified safely via <code>getChat</code> & <code>getChatMember</code> (zero <code>getUpdates</code> conflict).
                </p>
              </div>
              {settings.TELEGRAM_CHANNEL_ID && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 font-mono">
                  ID: {settings.TELEGRAM_CHANNEL_ID}
                </span>
              )}
            </div>

            {/* Input & Verification Action */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Target Channel ID or Private Message Link <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={channelIdInput}
                    onChange={(e) => setChannelIdInput(e.target.value)}
                    placeholder="e.g. -1002345678901 or paste link https://t.me/c/2345678901/10"
                    className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    disabled={verifyingChannel || !channelIdInput.trim()}
                    onClick={() => handleVerifyChannel()}
                    className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50 transition flex items-center justify-center gap-2 shrink-0"
                  >
                    {verifyingChannel ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>{verifyingChannel ? 'Verifying Channel...' : 'Verify Channel Access'}</span>
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Accepts channel IDs (e.g. <code>-1002345678901</code>), web URLs (<code>#-100...</code>), or copied message links.
                </span>
              </div>

              {/* Error Banner */}
              {verifyChannelError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold">Verification Failed:</span> {verifyChannelError}
                  </div>
                </div>
              )}

              {/* Verification Success Card */}
              {(verifyChannelSuccess || channelVerification) && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Channel Verified & Connected Successfully!</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200/80 text-emerald-900">
                      Ready for Publishing
                    </span>
                  </div>

                  {channelVerification && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-xs">
                      <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Channel Name</span>
                        <span className="font-bold text-slate-800 text-sm truncate block mt-0.5">{channelVerification.title}</span>
                      </div>

                      <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Channel ID</span>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="font-mono font-bold text-sky-800 text-xs truncate">{channelVerification.chatId}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(channelVerification.chatId);
                              setCopiedId(true);
                              setTimeout(() => setCopiedId(false), 2000);
                            }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500"
                            title="Copy Channel ID"
                          >
                            {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>

                      <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Bot Role</span>
                        <span className="font-semibold text-emerald-700 text-xs flex items-center gap-1 mt-0.5">
                          <Check className="w-3 h-3" /> Administrator
                        </span>
                      </div>

                      <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Post Permission</span>
                        <span className="font-semibold text-emerald-700 text-xs flex items-center gap-1 mt-0.5">
                          <Check className="w-3 h-3" /> Enabled (can_post)
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-emerald-800 leading-snug">
                    SocialManager will automatically publish to <strong>"{channelVerification?.title || 'your channel'}"</strong> when selecting Telegram in the Content & Scheduler view.
                  </p>
                </div>
              )}
            </div>

            {/* Clear Step-by-Step Instructions on How to Get Private Channel ID */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <HelpCircle className="w-4 h-4 text-indigo-600" />
                  <span>How to Retrieve Your Private Channel ID (Without getUpdates)</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                  Conflict-Free Methods
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Because private Telegram channels do not have a public <code>@username</code>, Telegram requires their unique numeric ID (which always starts with <code>-100</code>). Use any of these 3 safe methods:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Method 1: Forward to ID Bot */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] flex items-center justify-center font-bold">1</span>
                    <span>Forward to an ID Bot (Easiest)</span>
                  </div>
                  <ol className="text-[11px] text-slate-600 space-y-1 list-decimal list-inside pl-0.5 leading-relaxed">
                    <li>In Telegram, open your channel (<strong>For real</strong>).</li>
                    <li>Forward any message to <strong>@userinfobot</strong>, <strong>@getmyid_bot</strong>, or <strong>@JsonDumpBot</strong>.</li>
                    <li>The bot instantly replies with <code>Forwarded from chat ID: -100xxxxxxxxxx</code>.</li>
                    <li>Copy and paste that ID above.</li>
                  </ol>
                </div>

                {/* Method 2: Telegram Web */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] flex items-center justify-center font-bold">2</span>
                    <span>Telegram Web (Browser URL)</span>
                  </div>
                  <ol className="text-[11px] text-slate-600 space-y-1 list-decimal list-inside pl-0.5 leading-relaxed">
                    <li>Open <a href="https://web.telegram.org/a" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">web.telegram.org/a</a> or <a href="https://web.telegram.org/k" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">/k</a>.</li>
                    <li>Click on your private channel.</li>
                    <li>Look at your browser's address bar: the URL will show <code>#-100xxxxxxxxxx</code>.</li>
                    <li>Copy the full number starting with <code>-100</code>.</li>
                  </ol>
                </div>

                {/* Method 3: Copy Post Link */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] flex items-center justify-center font-bold">3</span>
                    <span>Copy Post Link (Auto-Parsed)</span>
                  </div>
                  <ol className="text-[11px] text-slate-600 space-y-1 list-decimal list-inside pl-0.5 leading-relaxed">
                    <li>Right-click any post in your channel and click <strong>Copy Link</strong>.</li>
                    <li>The link looks like: <code>https://t.me/c/2456789012/10</code>.</li>
                    <li>Paste the full link directly into the box above; SocialManager will automatically convert it into <code>-1002456789012</code>!</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LEADS CRM DIRECTORY */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadLeads()}
                placeholder="Search leads by username, ID, tags..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-sans"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setTimeout(loadLeads, 100);
                }}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-sans"
              >
                <option value="all">All Lead Statuses</option>
                <option value="new">New Inquiries</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="escalated">Escalated to Human</option>
                <option value="customer">Customers</option>
              </select>

              <button
                onClick={loadLeads}
                className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-xl border border-slate-200"
                title="Refresh leads"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Leads Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {leads.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">No Telegram leads found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When Telegram users message your bot or interact in your channel, they appear here automatically.
                </p>
                <button
                  onClick={() => setLeadModalOpen(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl"
                >
                  Add Your First Lead
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Telegram User</th>
                      <th className="py-3 px-4">Chat ID</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Source</th>
                      <th className="py-3 px-4">Tags</th>
                      <th className="py-3 px-4">Last Activity</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                              {(lead.first_name || lead.username || 'TG').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">
                                {lead.first_name ? `${lead.first_name} ${lead.last_name || ''}` : `@${lead.username || lead.chat_id}`}
                              </div>
                              {lead.username && <div className="text-[11px] text-slate-400">@{lead.username}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {lead.chat_id}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            lead.status === 'escalated' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            lead.status === 'new' ? 'bg-sky-100 text-sky-800 border border-sky-200' :
                            lead.status === 'qualified' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 capitalize">
                          {lead.source.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {(lead.tags || 'lead').split(',').map((tag, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {lead.last_interaction_at ? new Date(lead.last_interaction_at).toLocaleDateString() : 'New'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedChatId(lead.chat_id);
                                setActiveTab('chats');
                              }}
                              className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg font-semibold text-[11px] transition-all"
                            >
                              Open Chat
                            </button>
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Delete lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: CHATS & INBOX */}
      {activeTab === 'chats' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[600px] bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Left Column: Leads List */}
          <div className="md:col-span-4 border-r border-slate-100 flex flex-col h-full bg-slate-50/40">
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {leads.map((lead) => {
                const isSelected = lead.chat_id === selectedChatId;
                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedChatId(lead.chat_id)}
                    className={`p-3 cursor-pointer transition-all flex items-center justify-between ${
                      isSelected ? 'bg-sky-50/80 border-l-4 border-sky-600' : 'hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {(lead.first_name || lead.username || 'TG').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 text-xs truncate">
                          {lead.first_name || (lead.username ? `@${lead.username}` : `Chat ${lead.chat_id}`)}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">ID: {lead.chat_id}</div>
                      </div>
                    </div>
                    {lead.status === 'escalated' && (
                      <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0" title="Escalated to human" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Chat Thread */}
          <div className="md:col-span-8 flex flex-col h-full bg-white">
            {selectedChatId ? (
              <>
                {/* Chat Top Bar */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                      {(selectedLead?.first_name || selectedChatId).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">
                        {selectedLead?.first_name || (selectedLead?.username ? `@${selectedLead.username}` : `Chat ${selectedChatId}`)}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">Chat ID: {selectedChatId}</span>
                    </div>
                  </div>

                  {selectedLead?.status === 'escalated' && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 flex items-center gap-1 border border-purple-200">
                      <LifeBuoy className="w-3 h-3 text-purple-600" />
                      <span>Escalated to Support Manager</span>
                    </span>
                  )}
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                  {activeMessages.map((msg) => {
                    const isOutbound = msg.direction === 'outbound';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                            isOutbound
                              ? 'bg-sky-600 text-white rounded-br-xs'
                              : 'bg-white text-slate-800 border border-slate-200/70 rounded-bl-xs shadow-2xs'
                          }`}
                        >
                          <p className="whitespace-pre-line">{msg.message_text}</p>
                        </div>
                        <span className="text-[9px] text-slate-400 mt-1 px-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 flex items-center gap-2 bg-white">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply directly to ${selectedLead?.first_name || selectedChatId}...`}
                    className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-sans"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || sending}
                    className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold text-xs rounded-xl hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
                <MessageCircle className="w-8 h-8 text-slate-300 mb-2" />
                <span className="text-xs">Select a Telegram contact to view chat history</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: AI & KNOWLEDGE BASE */}
      {activeTab === 'knowledge' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Telegram Automated Answering & Knowledge Base</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  The AI uses this knowledge base to answer incoming Telegram questions automatically.
                </p>
              </div>

              {/* Master Auto-Reply Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.TELEGRAM_AUTO_REPLY_ENABLED === '1'}
                  onChange={(e) => setSettings({ ...settings, TELEGRAM_AUTO_REPLY_ENABLED: e.target.checked ? '1' : '0' })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600 relative"></div>
                <span className="text-xs font-semibold text-slate-700">Auto-Reply Active</span>
              </label>
            </div>

            {/* Human Escalation Settings */}
            <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-purple-900 text-xs">
                <LifeBuoy className="w-4 h-4 text-purple-600" />
                <span>Human Helping Person Escalation (Presented When Stuck or Requested)</span>
              </div>
              <p className="text-[11px] text-slate-600">
                When a user asks to speak to a person or asks something outside your knowledge base, the bot automatically sends this contact info.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-1">Support Person Name</label>
                  <input
                    type="text"
                    value={settings.TELEGRAM_HUMAN_HELP_NAME}
                    onChange={(e) => setSettings({ ...settings, TELEGRAM_HUMAN_HELP_NAME: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                    placeholder="e.g. Sneha"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-1">Phone / WhatsApp</label>
                  <input
                    type="text"
                    value={settings.TELEGRAM_HUMAN_HELP_PHONE}
                    onChange={(e) => setSettings({ ...settings, TELEGRAM_HUMAN_HELP_PHONE: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-mono"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-1">Support Email</label>
                  <input
                    type="email"
                    value={settings.TELEGRAM_HUMAN_HELP_EMAIL}
                    onChange={(e) => setSettings({ ...settings, TELEGRAM_HUMAN_HELP_EMAIL: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                    placeholder="support@sneharmony.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-1">Telegram Handle</label>
                  <input
                    type="text"
                    value={settings.TELEGRAM_HUMAN_HELP_HANDLE}
                    onChange={(e) => setSettings({ ...settings, TELEGRAM_HUMAN_HELP_HANDLE: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-mono"
                    placeholder="@sneharmony"
                  />
                </div>
              </div>
            </div>

            {/* Welcome Message */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Welcome Message Template</label>
              <input
                type="text"
                value={settings.TELEGRAM_WELCOME_MESSAGE}
                onChange={(e) => setSettings({ ...settings, TELEGRAM_WELCOME_MESSAGE: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-sans"
                placeholder="Use {name} placeholder..."
              />
            </div>

            {/* Knowledge Base */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Knowledge Base (Services, Lessons, Collabs, Policies)</label>
                <span className="text-[10px] text-slate-400">Plain text / bullet points</span>
              </div>
              <textarea
                rows={7}
                value={settings.TELEGRAM_KNOWLEDGE_BASE}
                onChange={(e) => setSettings({ ...settings, TELEGRAM_KNOWLEDGE_BASE: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono leading-relaxed"
                placeholder="Add your brand FAQ, pricing, music lesson details, collaboration criteria..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              {settingsSavedToast && (
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Settings saved successfully!
                </span>
              )}
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-xs"
              >
                {savingSettings ? 'Saving...' : 'Save Telegram Settings'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 6: BROADCAST & ANNOUNCEMENTS */}
      {activeTab === 'broadcast' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5 max-w-3xl">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Send Telegram Broadcast</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Send a personalized direct message to all Telegram leads or subscribers with support for <code>{'{name}'}</code> and <code>{'{username}'}</code> placeholders.
            </p>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Filter by Status</label>
                <select
                  value={broadcastStatus}
                  onChange={(e) => setBroadcastStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                >
                  <option value="all">All Leads ({leads.length})</option>
                  <option value="new">New Inquiries</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="customer">Customers</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Filter by Tag (Optional)</label>
                <input
                  type="text"
                  value={broadcastTag}
                  onChange={(e) => setBroadcastTag(e.target.value)}
                  placeholder="e.g. music, collabs"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Message Template</label>
              <textarea
                rows={4}
                value={broadcastTemplate}
                onChange={(e) => setBroadcastTemplate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-sans"
              />
            </div>

            {broadcastSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{broadcastSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold text-xs rounded-xl hover:opacity-90 transition-all flex items-center gap-2 shadow-xs"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Send Broadcast Messages</span>
            </button>
          </form>
        </div>
      )}

      {/* Manual Lead Creation Modal */}
      {leadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Add New Telegram Lead</h3>
              <button
                onClick={() => setLeadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Chat ID or User ID *</label>
                <input
                  type="text"
                  required
                  value={leadForm.chat_id}
                  onChange={(e) => setLeadForm({ ...leadForm, chat_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                  placeholder="e.g. 123456789 or @channelusername"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Username (Optional)</label>
                  <input
                    type="text"
                    value={leadForm.username}
                    onChange={(e) => setLeadForm({ ...leadForm, username: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                    placeholder="without @"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">First Name</label>
                  <input
                    type="text"
                    value={leadForm.first_name}
                    onChange={(e) => setLeadForm({ ...leadForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                    placeholder="e.g. Rohit"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Source</label>
                  <select
                    value={leadForm.source}
                    onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  >
                    <option value="bot_direct">Bot Direct Message</option>
                    <option value="channel">Channel Subscriber</option>
                    <option value="group">Group Member</option>
                    <option value="manual">Manual Entry</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
                  <select
                    value={leadForm.status}
                    onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="escalated">Escalated</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={leadForm.tags}
                  onChange={(e) => setLeadForm({ ...leadForm, tags: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  placeholder="music, collab, lessons"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-sans"
                  placeholder="Inquiry notes..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLeadModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 rounded-xl shadow-xs"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
