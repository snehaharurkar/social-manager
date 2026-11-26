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
  Copy, 
  RefreshCw,
  Radio,
  ShieldCheck,
  Smartphone,
  Check,
  MessageCircle
} from 'lucide-react';
import type { InstagramLead, InstagramMessage, InstagramSettings } from '../types';
import { api } from '../api';

const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

export const InstagramView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'connect' | 'chats' | 'leads' | 'broadcast' | 'knowledge' | 'simulator'>('simulator');
  const [leads, setLeads] = useState<InstagramLead[]>([]);
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [activeMessages, setActiveMessages] = useState<InstagramMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sending, setSending] = useState(false);

  // Lead Modal
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({
    ig_username: '',
    full_name: '',
    source: 'direct_message',
    status: 'new',
    tags: 'lead, music',
    notes: ''
  });

  // Broadcast State
  const [broadcastTemplate, setBroadcastTemplate] = useState('Hey {name}! ✨ Hope you are having an amazing week! We just dropped a new video, check it out and let us know what you think! 🌸');
  const [broadcastStatus, setBroadcastStatus] = useState('all');
  const [broadcastTag, setBroadcastTag] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  // Settings & Knowledge Base State
  const [settings, setSettings] = useState<InstagramSettings>({
    INSTAGRAM_AUTO_REPLY_ENABLED: '1',
    INSTAGRAM_HUMAN_HELP_NAME: 'Sneha (Support Manager)',
    INSTAGRAM_HUMAN_HELP_PHONE: '+91 98765 43210',
    INSTAGRAM_HUMAN_HELP_EMAIL: 'support@sneharmony.com',
    INSTAGRAM_HUMAN_HELP_HANDLE: '@sneharmony-x5d',
    INSTAGRAM_WELCOME_MESSAGE: 'Hey {name}! ✨ Welcome to Sneharmony! How can we help you today? Ask about music, covers, tutorials, or collabs!',
    INSTAGRAM_KNOWLEDGE_BASE: '',
    INSTAGRAM_VERIFY_TOKEN: 'social_manager_ig_token'
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Simulator State
  const [simUsername, setSimUsername] = useState('ananya_music');
  const [simName, setSimName] = useState('Ananya');
  const [simInput, setSimInput] = useState('');
  const [simMessages, setSimMessages] = useState<Array<{ sender: 'lead' | 'bot'; text: string; time: string; isEscalated?: boolean }>>([
    {
      sender: 'bot',
      text: 'Hey Ananya! ✨ Welcome to Sneharmony. How can we help you today? Feel free to ask about our music, collaborations, tutorials, or bookings!',
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
    if (selectedUsername) {
      loadMessages(selectedUsername);
    }
  }, [selectedUsername]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  useEffect(() => {
    simEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simMessages]);

  const loadLeads = async () => {
    try {
      const data = await api.getInstagramLeads(statusFilter, searchQuery);
      setLeads(data);
      if (data.length > 0 && !selectedUsername) {
        setSelectedUsername(data[0].ig_username);
      }
    } catch (err) {
      console.error('Failed to load Instagram leads:', err);
    }
  };

  const loadMessages = async (username: string) => {
    try {
      const data = await api.getInstagramMessages(username);
      setActiveMessages(data);
    } catch (err) {
      console.error('Failed to load Instagram messages:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await api.getInstagramSettings();
      setSettings(prev => ({ ...prev, ...data }));
    } catch (err) {
      console.error('Failed to load Instagram settings:', err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.saveInstagramSettings(settings);
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
    if (!replyText.trim() || !selectedUsername) return;

    setSending(true);
    try {
      await api.sendInstagramMessage(selectedUsername, replyText.trim());
      setReplyText('');
      loadMessages(selectedUsername);
      loadLeads();
    } catch (err: any) {
      alert(`Failed to send message: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.ig_username.trim()) {
      alert('Instagram username is required');
      return;
    }

    try {
      await api.createInstagramLead(leadForm);
      setLeadModalOpen(false);
      setLeadForm({
        ig_username: '',
        full_name: '',
        source: 'manual',
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
    if (!confirm('Are you sure you want to delete this lead and their message history?')) return;
    try {
      await api.deleteInstagramLead(id);
      loadLeads();
      if (leads.find(l => l.id === id)?.ig_username === selectedUsername) {
        setSelectedUsername('');
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
      const res = await api.broadcastInstagram(broadcastTemplate, broadcastStatus, broadcastTag);
      setBroadcastSuccess(`Successfully sent DM broadcast to ${res.count} leads! ✨`);
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
      const res = await api.simulateInstagram(simUsername, simName, userText);
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

  const webhookUrl = `${window.location.origin}/api/instagram/webhook`;

  const tabs = [
    { id: 'simulator', label: 'DM & Escalation Simulator', icon: Smartphone, badge: 'Interactive' },
    { id: 'leads', label: 'Instagram Leads', icon: Users, badge: leads.length > 0 ? leads.length : undefined },
    { id: 'chats', label: 'DMs & Inbox', icon: MessageCircle },
    { id: 'knowledge', label: 'AI & Knowledge Base', icon: Sparkles },
    { id: 'broadcast', label: 'DM Broadcast', icon: Radio },
    { id: 'connect', label: 'Setup & Webhooks', icon: ShieldCheck },
  ];

  const selectedLead = leads.find(l => l.ig_username === selectedUsername);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-sm shadow-pink-200">
              <InstagramIcon className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Instagram Leads & DM Automation</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-pink-50 text-pink-700 border border-pink-200/60">
              100% Free
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automate Instagram DMs, answer lead inquiries with AI & Knowledge Base, and route stuck leads to a human support manager.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLeadModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 rounded-xl transition-all shadow-xs shadow-pink-200"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Instagram Lead</span>
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
                  ? 'border-pink-600 text-pink-700 bg-pink-50/60'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-pink-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-pink-200/70 text-pink-900' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: INTERACTIVE DM & ESCALATION SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Explanations & Trigger Controls */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-pink-600 font-bold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>Test Instagram DM Lead Journey</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Test how your Instagram bot handles follower DMs in real-time. If the follower asks a question answered in your 
                <strong> Knowledge Base</strong>, the bot answers politely. If they ask something unknown or mention <em>"talk to person"</em>, <em>"human"</em>, or <em>"stuck"</em>, the bot presents your <strong>Human Support Card</strong>!
              </p>

              {/* Lead Profile in Test */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Simulated Instagram Profile</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block">Username</label>
                    <input
                      type="text"
                      value={simUsername}
                      onChange={(e) => setSimUsername(e.target.value)}
                      className="w-full mt-0.5 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-mono"
                      placeholder="username"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Full Name</label>
                    <input
                      type="text"
                      value={simName}
                      onChange={(e) => setSimName(e.target.value)}
                      className="w-full mt-0.5 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                      placeholder="Name"
                    />
                  </div>
                </div>
              </div>

              {/* Sample Prompt Chips */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-700">Quick Test Prompts (Click to try):</div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Do you teach beginner acoustic guitar lessons?",
                    "How can we collaborate on an Instagram Reel?",
                    "What are your working hours?",
                    "Can I speak with a real human person?",
                    "I am stuck with booking and need manager help"
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSimInput(chip)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200/60 transition-all text-left"
                    >
                      "{chip}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Human Escalation Details Preview */}
              <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-purple-900 text-[11px]">
                  <LifeBuoy className="w-3.5 h-3.5 text-purple-600" />
                  <span>Configured Human Escalation Contact</span>
                </div>
                <div className="text-slate-600 text-[11px] space-y-0.5 font-sans">
                  <div><strong>Support Manager:</strong> {settings.INSTAGRAM_HUMAN_HELP_NAME}</div>
                  <div><strong>Phone / WhatsApp:</strong> {settings.INSTAGRAM_HUMAN_HELP_PHONE}</div>
                  <div><strong>Email:</strong> {settings.INSTAGRAM_HUMAN_HELP_EMAIL}</div>
                  <div><strong>Support Handle:</strong> {settings.INSTAGRAM_HUMAN_HELP_HANDLE}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Instagram Phone DM Mockup */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[580px]">
              {/* Instagram App Top Header */}
              <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 p-0.5">
                    <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                      <span className="font-bold text-xs text-pink-600">SH</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <h4 className="font-bold text-slate-800 text-xs">sneharmony</h4>
                      <CheckCircle2 className="w-3 h-3 text-sky-500 fill-sky-500" />
                    </div>
                    <span className="text-[10px] text-emerald-600 font-medium">Active now · AI Automated</span>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafafa]">
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
                            ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-br-xs'
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
                    <Sparkles className="w-3.5 h-3.5 text-pink-500 animate-spin" />
                    <span>Sneharmony bot is typing...</span>
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
                  placeholder={`Message as @${simUsername}...`}
                  className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-full focus:bg-white focus:outline-none focus:border-pink-500 transition-all font-sans"
                />
                <button
                  type="submit"
                  disabled={!simInput.trim() || simLoading}
                  className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-600 to-purple-600 text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all shadow-xs shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LEADS CRM DIRECTORY */}
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
                placeholder="Search leads by @handle or tags..."
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
                <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">No Instagram leads found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When followers DM you or interact with your posts, they automatically appear here as CRM leads. You can also add leads manually.
                </p>
                <button
                  onClick={() => setLeadModalOpen(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-pink-600 hover:bg-pink-700 rounded-xl"
                >
                  Add Your First Lead
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Instagram User</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Source</th>
                      <th className="py-3 px-4">Tags</th>
                      <th className="py-3 px-4">Last Interaction</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                              {lead.ig_username.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">@{lead.ig_username}</div>
                              {lead.full_name && <div className="text-[11px] text-slate-400">{lead.full_name}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            lead.status === 'escalated' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            lead.status === 'new' ? 'bg-pink-100 text-pink-800 border border-pink-200' :
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
                                setSelectedUsername(lead.ig_username);
                                setActiveTab('chats');
                              }}
                              className="px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-lg font-semibold text-[11px] transition-all"
                            >
                              Open DM
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

      {/* TAB 3: DMS & LIVE CHATS INBOX */}
      {activeTab === 'chats' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[600px] bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Left Column: Lead List */}
          <div className="md:col-span-4 border-r border-slate-100 flex flex-col h-full bg-slate-50/40">
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search followers..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {leads.map((lead) => {
                const isSelected = lead.ig_username === selectedUsername;
                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedUsername(lead.ig_username)}
                    className={`p-3 cursor-pointer transition-all flex items-center justify-between ${
                      isSelected ? 'bg-pink-50/80 border-l-4 border-pink-600' : 'hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {lead.ig_username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 text-xs truncate">@{lead.ig_username}</div>
                        <div className="text-[10px] text-slate-400 truncate">{lead.full_name || 'Instagram User'}</div>
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
            {selectedUsername ? (
              <>
                {/* Chat Top Bar */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-xs">
                      {selectedUsername.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">@{selectedUsername}</h4>
                      <span className="text-[10px] text-slate-400 capitalize">{selectedLead?.status || 'Lead'}</span>
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
                              ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-br-xs'
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
                    placeholder={`Reply directly to @${selectedUsername}...`}
                    className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-sans"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || sending}
                    className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold text-xs rounded-xl hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
                <MessageCircle className="w-8 h-8 text-slate-300 mb-2" />
                <span className="text-xs">Select an Instagram follower to view DM history</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AI & KNOWLEDGE BASE CONFIGURATION */}
      {activeTab === 'knowledge' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Instagram Automated Answering & Knowledge Base</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  The AI uses this knowledge base to answer incoming follower questions instantly.
                </p>
              </div>

              {/* Master Auto-Reply Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.INSTAGRAM_AUTO_REPLY_ENABLED === '1'}
                  onChange={(e) => setSettings({ ...settings, INSTAGRAM_AUTO_REPLY_ENABLED: e.target.checked ? '1' : '0' })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-600 relative"></div>
                <span className="text-xs font-semibold text-slate-700">Auto-Reply Active</span>
              </label>
            </div>

            {/* Human Escalation Settings */}
            <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-purple-900 text-xs">
                <LifeBuoy className="w-4 h-4 text-purple-600" />
                <span>Human Helping Person Escalation (Shown When Stuck or Requested)</span>
              </div>
              <p className="text-[11px] text-slate-600">
                When a user asks to speak to a person or asks something outside your knowledge base, the bot automatically sends this contact info.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-1">Support Person Name</label>
                  <input
                    type="text"
                    value={settings.INSTAGRAM_HUMAN_HELP_NAME}
                    onChange={(e) => setSettings({ ...settings, INSTAGRAM_HUMAN_HELP_NAME: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                    placeholder="e.g. Sneha"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-1">Phone / WhatsApp</label>
                  <input
                    type="text"
                    value={settings.INSTAGRAM_HUMAN_HELP_PHONE}
                    onChange={(e) => setSettings({ ...settings, INSTAGRAM_HUMAN_HELP_PHONE: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-mono"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-1">Support Email</label>
                  <input
                    type="email"
                    value={settings.INSTAGRAM_HUMAN_HELP_EMAIL}
                    onChange={(e) => setSettings({ ...settings, INSTAGRAM_HUMAN_HELP_EMAIL: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                    placeholder="support@sneharmony.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-1">Instagram Support Handle</label>
                  <input
                    type="text"
                    value={settings.INSTAGRAM_HUMAN_HELP_HANDLE}
                    onChange={(e) => setSettings({ ...settings, INSTAGRAM_HUMAN_HELP_HANDLE: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-mono"
                    placeholder="@sneharmony-x5d"
                  />
                </div>
              </div>
            </div>

            {/* Welcome Message */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Welcome DM Template</label>
              <input
                type="text"
                value={settings.INSTAGRAM_WELCOME_MESSAGE}
                onChange={(e) => setSettings({ ...settings, INSTAGRAM_WELCOME_MESSAGE: e.target.value })}
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
                value={settings.INSTAGRAM_KNOWLEDGE_BASE}
                onChange={(e) => setSettings({ ...settings, INSTAGRAM_KNOWLEDGE_BASE: e.target.value })}
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
                className="px-5 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-xs"
              >
                {savingSettings ? 'Saving...' : 'Save Instagram Settings'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 5: DM BROADCAST */}
      {activeTab === 'broadcast' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5 max-w-3xl">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Send Instagram DM Broadcast</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Send a personalized direct message to your leads list with support for <code>{'{name}'}</code> and <code>{'{username}'}</code> placeholders.
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
              className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold text-xs rounded-xl hover:opacity-90 transition-all flex items-center gap-2 shadow-xs"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Send Broadcast DMs</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 6: SETUP & WEBHOOKS */}
      {activeTab === 'connect' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5 max-w-3xl">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Instagram Connection & Webhook Setup</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect via Uplika MCP or Meta Graph API for automated DM reception.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-xs font-bold text-slate-700">Inbound Webhook URL (For Meta / Uplika Live Events)</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1 text-slate-700"
                >
                  {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="text-[11px] text-slate-500">
                Verify Token: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800">{settings.INSTAGRAM_VERIFY_TOKEN}</code>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-pink-50/60 border border-pink-100 text-xs text-pink-900 space-y-1.5">
              <div className="font-bold">Zero Paywalls & Complete Privacy:</div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                You can test and use the interactive DM simulator right away without needing any paid accounts. 
                When you connect your Instagram channel in <strong>Connected Channels</strong> (via Uplika MCP or direct Meta tokens), live DMs and comments flow right into this dashboard.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Manual Lead Creation Modal */}
      {leadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Add New Instagram Lead</h3>
              <button
                onClick={() => setLeadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Instagram Handle / Username *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">@</span>
                  <input
                    type="text"
                    required
                    value={leadForm.ig_username}
                    onChange={(e) => setLeadForm({ ...leadForm, ig_username: e.target.value })}
                    className="w-full pl-7 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                    placeholder="username"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name (Optional)</label>
                <input
                  type="text"
                  value={leadForm.full_name}
                  onChange={(e) => setLeadForm({ ...leadForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  placeholder="e.g. Priya Sharma"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Source</label>
                  <select
                    value={leadForm.source}
                    onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  >
                    <option value="direct_message">Direct Message (DM)</option>
                    <option value="post_comment">Post / Reel Comment</option>
                    <option value="story_reply">Story Reply</option>
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl shadow-xs"
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
