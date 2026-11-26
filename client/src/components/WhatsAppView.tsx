import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
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
  QrCode,
  LogOut,
  Loader2,
  Check
} from 'lucide-react';
import type { WhatsAppContact, WhatsAppMessage, WhatsAppSettings } from '../types';
import { api } from '../api';

export const WhatsAppView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'connect' | 'chats' | 'leads' | 'broadcast' | 'knowledge' | 'simulator'>('connect');
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [activeMessages, setActiveMessages] = useState<WhatsAppMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sending, setSending] = useState(false);

  // WhatsApp Web QR Code Link State
  const [webStatus, setWebStatus] = useState<{ status: string; qrCode: string | null; user: any }>({
    status: 'disconnected',
    qrCode: null,
    user: null
  });
  const [connectingWeb, setConnectingWeb] = useState(false);

  // Lead Modal
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({
    name: '',
    phone_number: '',
    source: 'manual',
    status: 'new',
    tags: '',
    notes: ''
  });

  // Broadcast State
  const [broadcastTemplate, setBroadcastTemplate] = useState('Hello {name}! 🌷 Hope you are having a wonderful week! Check out our latest video update and reply here if you have any questions!');
  const [broadcastStatus, setBroadcastStatus] = useState('all');
  const [broadcastTag, setBroadcastTag] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  // Settings & Knowledge Base State
  const [settings, setSettings] = useState<WhatsAppSettings>({
    WHATSAPP_AUTO_REPLY_ENABLED: '1',
    WHATSAPP_PHONE_NUMBER_ID: '',
    WHATSAPP_ACCESS_TOKEN: '',
    WHATSAPP_VERIFY_TOKEN: 'social_manager_wa_token',
    WHATSAPP_HUMAN_HELP_NAME: 'Sneha (Support Manager)',
    WHATSAPP_HUMAN_HELP_PHONE: '+91 98765 43210',
    WHATSAPP_HUMAN_HELP_EMAIL: 'support@sneharmony.com',
    WHATSAPP_WELCOME_MESSAGE: 'Hello {name}! 🌷 Welcome to Sneharmony! How can we assist you today?',
    WHATSAPP_KNOWLEDGE_BASE: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Simulator State
  const [simPhone, setSimPhone] = useState('919876543210');
  const [simName, setSimName] = useState('Ananya (Lead)');
  const [simInput, setSimInput] = useState('');
  const [simMessages, setSimMessages] = useState<Array<{ sender: 'lead' | 'bot'; text: string; time: string; isEscalated?: boolean }>>([
    {
      sender: 'bot',
      text: 'Hello Ananya! 🌷 Welcome to Sneharmony. How can we help you today? Feel free to ask about our music, collaborations, tutorials, or services!',
      time: 'Just now'
    }
  ]);
  const [simLoading, setSimLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const simEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadContacts();
    loadSettings();
    loadWebStatus();

    // Poll WhatsApp Web connection status every 3 seconds
    const interval = setInterval(() => {
      loadWebStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadWebStatus = async () => {
    try {
      const data = await api.getWhatsAppWebStatus();
      setWebStatus(data);
    } catch {}
  };

  const handleStartConnectWeb = async () => {
    setConnectingWeb(true);
    try {
      const data = await api.connectWhatsAppWeb();
      setWebStatus(data);
    } catch (err: any) {
      alert(`Error starting connection: ${err.message}`);
    } finally {
      setConnectingWeb(false);
    }
  };

  const handleDisconnectWeb = async () => {
    if (confirm('Disconnect WhatsApp on this computer?')) {
      try {
        await api.disconnectWhatsAppWeb();
        await loadWebStatus();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  useEffect(() => {
    if (selectedPhone) {
      loadMessages(selectedPhone);
    }
  }, [selectedPhone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  useEffect(() => {
    simEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simMessages]);

  const loadContacts = async () => {
    try {
      const data = await api.getWhatsAppContacts(statusFilter, searchQuery);
      setContacts(data);
      if (data.length > 0 && !selectedPhone) {
        setSelectedPhone(data[0].phone_number);
      }
    } catch (err: any) {
      console.error('Error loading contacts:', err);
    }
  };

  const loadMessages = async (phone: string) => {
    try {
      const data = await api.getWhatsAppMessages(phone);
      setActiveMessages(data.messages);
    } catch (err: any) {
      console.error('Error loading messages:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await api.getWhatsAppSettings();
      setSettings(prev => ({ ...prev, ...data }));
    } catch (err: any) {
      console.error('Error loading settings:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPhone || !replyText.trim()) return;

    setSending(true);
    try {
      await api.sendWhatsAppMessage(selectedPhone, replyText.trim());
      setReplyText('');
      await loadMessages(selectedPhone);
      await loadContacts();
    } catch (err: any) {
      alert(`Send error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleEscalateContact = async () => {
    if (!selectedPhone) return;
    const helpName = settings.WHATSAPP_HUMAN_HELP_NAME || 'Support Manager';
    const helpPhone = settings.WHATSAPP_HUMAN_HELP_PHONE || '+91 98765 43210';
    const helpEmail = settings.WHATSAPP_HUMAN_HELP_EMAIL || 'support@brand.com';

    const escalationMsg = `I understand you'd like to speak with our team! 🤝\n\nYou can reach our human specialist, *${helpName}*, directly:\n📞 Phone/WhatsApp: ${helpPhone}\n✉️ Email: ${helpEmail}\n\nOur team has been alerted and will reach out to you directly! ✨`;

    try {
      await api.sendWhatsAppMessage(selectedPhone, escalationMsg);
      await api.saveWhatsAppContact({ phone_number: selectedPhone, status: 'escalated' });
      await loadMessages(selectedPhone);
      await loadContacts();
    } catch (err: any) {
      alert(`Error escalating: ${err.message}`);
    }
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveWhatsAppContact(leadForm);
      setLeadModalOpen(false);
      setLeadForm({ name: '', phone_number: '', source: 'manual', status: 'new', tags: '', notes: '' });
      await loadContacts();
    } catch (err: any) {
      alert(`Failed to save lead: ${err.message}`);
    }
  };

  const handleDeleteLead = async (id: number) => {
    if (confirm('Delete this contact/lead?')) {
      try {
        await api.deleteWhatsAppContact(id);
        await loadContacts();
        if (contacts.find(c => c.id === id)?.phone_number === selectedPhone) {
          setSelectedPhone('');
          setActiveMessages([]);
        }
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTemplate.trim()) return;
    if (confirm(`Send broadcast message to matching leads?`)) {
      setSending(true);
      try {
        const res = await api.broadcastWhatsApp(broadcastTemplate, broadcastStatus, broadcastTag);
        setBroadcastSuccess(`Broadcast successfully sent to ${res.sentCount} leads!`);
        setTimeout(() => setBroadcastSuccess(null), 4000);
        await loadContacts();
      } catch (err: any) {
        alert(`Broadcast error: ${err.message}`);
      } finally {
        setSending(false);
      }
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.saveWhatsAppSettings(settings);
      setSettingsSavedToast(true);
      setTimeout(() => setSettingsSavedToast(false), 3000);
    } catch (err: any) {
      alert(`Error saving settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSimulateSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || simInput;
    if (!textToSend.trim()) return;

    const userEntry = {
      sender: 'lead' as const,
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setSimMessages(prev => [...prev, userEntry]);
    if (!customPrompt) setSimInput('');
    setSimLoading(true);

    try {
      const res = await api.simulateWhatsApp(simPhone, simName, textToSend);
      const isEscalated = res.result?.type?.includes('escalated');
      const botText = res.result?.reply || 'Received your inquiry!';

      setSimMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: botText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isEscalated
        }
      ]);
      await loadContacts();
    } catch (err: any) {
      setSimMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `[Error]: ${err.message}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  const selectedContact = contacts.find(c => c.phone_number === selectedPhone);
  const webhookUrl = `${window.location.protocol}//${window.location.host}/api/whatsapp/webhook`;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-xs">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">WhatsApp Automation & Lead Messenger</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated messaging to leads, AI FAQ answering, and instant escalation to your helping person.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLeadModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs shadow-emerald-200"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Lead</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-1">
        <div className="flex items-center gap-1 text-xs font-medium">
          {[
            { 
              id: 'connect', 
              label: webStatus.status === 'connected' ? `Connected (+${webStatus.user?.phone || 'Phone'})` : 'Connect Phone (QR)', 
              icon: QrCode, 
              badge: webStatus.status === 'connected' ? 'Active' : undefined,
              highlight: webStatus.status !== 'connected'
            },
            { id: 'chats', label: 'Live Conversations', icon: MessageSquare, badge: contacts.filter(c => c.status === 'escalated').length },
            { id: 'leads', label: 'Leads & CRM', icon: Users, badge: contacts.length },
            { id: 'simulator', label: 'Interactive Simulator', icon: Smartphone },
            { id: 'broadcast', label: 'Broadcast Campaign', icon: Radio },
            { id: 'knowledge', label: 'AI Knowledge & Escalation', icon: LifeBuoy }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  active 
                    ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-2xs border border-emerald-200/60' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (typeof tab.badge === 'number' ? tab.badge > 0 : Boolean(tab.badge)) && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    tab.id === 'chats' ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.badge}
                  </span>
                )}
                {tab.highlight && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 0: CONNECT WHATSAPP VIA QR CODE */}
      {activeTab === 'connect' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xs max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Connect your WhatsApp (QR Code)</h3>
              <p className="text-xs text-slate-400">
                Link your personal or business WhatsApp in 5 seconds without needing Meta API keys or verification.
              </p>
            </div>
          </div>

          {/* Connected State */}
          {webStatus.status === 'connected' ? (
            <div className="p-6 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Your WhatsApp is Connected!</h4>
                <p className="text-xs text-slate-600 mt-1">
                  Active Phone Number: <strong className="font-mono text-emerald-700">+{webStatus.user?.phone}</strong>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Incoming messages from leads will automatically receive smart FAQ answers and escalate to your helping person if stuck.
                </p>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('chats')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs"
                >
                  View Live Chats
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectWeb}
                  className="px-4 py-2 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect Phone</span>
                </button>
              </div>
            </div>
          ) : webStatus.status === 'scan_qr' && webStatus.qrCode ? (
            /* QR Code Ready for Scan */
            <div className="space-y-6 text-center">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl inline-block shadow-xs">
                <img
                  src={webStatus.qrCode}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64 mx-auto rounded-xl"
                />
                <span className="text-[11px] text-slate-400 mt-2 block animate-pulse">
                  ● Code updates automatically
                </span>
              </div>

              {/* Instructions */}
              <div className="text-left bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs">How to connect with your phone:</h4>
                <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>Open <strong>WhatsApp</strong> on your mobile phone.</li>
                  <li>Tap <strong>Settings (⚙️)</strong> on iPhone or <strong>Menu (⋮)</strong> on Android.</li>
                  <li>Tap <strong>Linked Devices</strong>.</li>
                  <li>Tap <strong>Link a Device</strong> and point your camera at the QR code above!</li>
                </ol>
              </div>
            </div>
          ) : (
            /* Disconnected / Ready to Start */
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <Smartphone className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto">
                <h4 className="font-bold text-slate-800 text-sm">Ready to link your WhatsApp</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Click the button below to generate a QR code. Then open WhatsApp on your phone and scan the code.
                </p>
              </div>

              <button
                type="button"
                onClick={handleStartConnectWeb}
                disabled={connectingWeb}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                {connectingWeb ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating QR Code...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4" />
                    <span>Generate WhatsApp QR Code</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: LIVE CHATS & INBOX */}
      {activeTab === 'chats' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden min-h-[580px]">
          {/* Left: Contacts List */}
          <div className="md:col-span-4 border-r border-slate-100 flex flex-col">
            {/* Search Box */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search lead name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyUp={(e) => e.key === 'Enter' && loadContacts()}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Contacts Scrollable */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {contacts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No WhatsApp contacts yet. Use the simulator or add a lead to start!
                </div>
              ) : (
                contacts.map(c => {
                  const active = selectedPhone === c.phone_number;
                  const isEscalated = c.status === 'escalated';

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedPhone(c.phone_number)}
                      className={`p-3.5 cursor-pointer transition-all flex items-start gap-3 hover:bg-slate-50 ${
                        active ? 'bg-emerald-50/50 border-l-4 border-emerald-500' : ''
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        isEscalated ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {c.name ? c.name.charAt(0).toUpperCase() : 'U'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-slate-800 truncate">{c.name || 'Unknown Lead'}</h4>
                          <span className="text-[10px] text-slate-400">
                            {c.last_contacted_at ? new Date(c.last_contacted_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono truncate">{c.phone_number}</p>

                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase ${
                            isEscalated ? 'bg-rose-100 text-rose-700 font-bold' :
                            c.status === 'engaged' ? 'bg-emerald-100 text-emerald-700' :
                            c.status === 'contacted' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {isEscalated ? 'Needs Human' : c.status}
                          </span>

                          {c.tags && (
                            <span className="text-[9px] text-slate-400 truncate">
                              #{c.tags.split(',')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Active Chat Conversation */}
          <div className="md:col-span-8 flex flex-col bg-slate-50/40">
            {selectedContact ? (
              <>
                {/* Chat Header */}
                <div className="p-3.5 bg-white border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      {selectedContact.name?.charAt(0) || 'L'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800 text-xs">{selectedContact.name || 'Lead'}</h3>
                        <span className="text-[11px] text-slate-400 font-mono">+{selectedContact.phone_number}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span>Source: {selectedContact.source}</span>
                        {selectedContact.status === 'escalated' && (
                          <span className="text-rose-600 font-bold flex items-center gap-1">
                            • Escalated to Helping Person
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Top Chat Quick Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleEscalateContact}
                      className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1 transition-all"
                      title="Send human support contact info immediately"
                    >
                      <LifeBuoy className="w-3 h-3 text-amber-600" />
                      <span>Send Human Help Info</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => loadMessages(selectedContact.phone_number)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                      title="Refresh messages"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[400px]">
                  {activeMessages.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs">
                      No messages in this chat yet. Send an opening message below!
                    </div>
                  ) : (
                    activeMessages.map(msg => {
                      const isOutbound = msg.direction === 'outbound';
                      const isEscalatedMsg = msg.is_escalated === 1;

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[78%] rounded-2xl p-3 text-xs leading-relaxed shadow-2xs whitespace-pre-line ${
                              isOutbound
                                ? isEscalatedMsg 
                                  ? 'bg-amber-50 text-amber-900 border border-amber-200' 
                                  : 'bg-emerald-600 text-white rounded-br-xs'
                                : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                            }`}
                          >
                            {msg.message_text}
                          </div>

                          <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-400">
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isOutbound && (
                              <span className="text-emerald-600 font-bold">✓✓</span>
                            )}
                            {isEscalatedMsg && (
                              <span className="text-amber-600 font-semibold">• Human Escalation</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Box */}
                <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${selectedContact.name || selectedContact.phone_number}...`}
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 text-xs">
                <MessageSquare className="w-10 h-10 text-slate-200 mb-2" />
                <span>Select a contact from the left to view conversation.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LEADS & CRM TABLE */}
      {activeTab === 'leads' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Leads Directory ({contacts.length})</h3>
              <p className="text-[11px] text-slate-400">All captured leads and contacts with their status and tags.</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setTimeout(loadContacts, 50);
                }}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="engaged">Engaged</option>
                <option value="escalated">Escalated (Needs Human)</option>
                <option value="closed">Closed</option>
              </select>

              <button
                onClick={() => setLeadModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Lead</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 text-slate-500 uppercase text-[10px] tracking-wider border-y border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Lead Name</th>
                  <th className="py-2.5 px-3">WhatsApp Number</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Tags</th>
                  <th className="py-2.5 px-3">Last Contacted</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                      No leads matching filter.
                    </td>
                  </tr>
                ) : (
                  contacts.map(lead => (
                    <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {lead.name || 'Unnamed'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        +{lead.phone_number}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          lead.status === 'escalated' ? 'bg-rose-100 text-rose-700 font-bold' :
                          lead.status === 'engaged' ? 'bg-emerald-100 text-emerald-700' :
                          lead.status === 'contacted' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {lead.status === 'escalated' ? 'Needs Human' : lead.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 capitalize text-slate-500">
                        {lead.source}
                      </td>
                      <td className="py-3 px-3">
                        {lead.tags ? (
                          <div className="flex gap-1 flex-wrap">
                            {lead.tags.split(',').map((t, idx) => (
                              <span key={idx} className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px]">
                                {t.trim()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                      </td>
                      <td className="py-3 px-3 text-right space-x-1">
                        <button
                          onClick={() => {
                            setSelectedPhone(lead.phone_number);
                            setActiveTab('chats');
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
                        >
                          Chat
                        </button>
                        <button
                          onClick={() => handleDeleteLead(lead.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INTERACTIVE SIMULATOR (TRY IT LIVE!) */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Simulator Controls & Quick Prompts */}
          <div className="md:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Interactive Bot Simulator</h3>
                  <p className="text-[11px] text-slate-400">Test how your bot responds to leads in real time.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Simulated Lead Name</label>
                  <input
                    type="text"
                    value={simName}
                    onChange={(e) => setSimName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Simulated Phone</label>
                  <input
                    type="text"
                    value={simPhone}
                    onChange={(e) => setSimPhone(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                  />
                </div>
              </div>

              {/* Quick Prompt Testing Scenarios */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-2">1-Click Test Scenarios</label>
                <div className="space-y-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSimulateSend('Hi, can you tell me what services you offer and your pricing?')}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50/60 hover:bg-emerald-50/40 text-slate-700 transition-all"
                  >
                    <span className="font-semibold text-slate-800 block text-xs">💡 Ask about Services & Pricing</span>
                    <span className="text-[10px] text-slate-400">Tests AI Knowledge Base answering</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSimulateSend('I am completely stuck and this is not working. Can I talk to a real person please?')}
                    className="w-full text-left p-2.5 rounded-xl border border-rose-200 hover:border-rose-400 bg-rose-50/30 hover:bg-rose-50/70 text-slate-700 transition-all"
                  >
                    <span className="font-semibold text-rose-700 block text-xs">🚨 "I am stuck, let me talk to someone"</span>
                    <span className="text-[10px] text-rose-500">Tests Human Escalation & Helping Person reply</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSimulateSend('How do I book a guitar lesson collaboration?')}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50/60 hover:bg-emerald-50/40 text-slate-700 transition-all"
                  >
                    <span className="font-semibold text-slate-800 block text-xs">🎵 Ask to book a session</span>
                    <span className="text-[10px] text-slate-400">Tests Booking & Inquiries answering</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Virtual Phone View */}
          <div className="md:col-span-7 flex flex-col items-center">
            <div className="w-full max-w-sm rounded-[36px] border-4 border-slate-800 bg-slate-900 shadow-xl overflow-hidden p-2 flex flex-col h-[560px]">
              {/* Phone Header Notch */}
              <div className="flex justify-between items-center px-4 py-1.5 text-white/60 text-[10px]">
                <span>12:00</span>
                <div className="w-16 h-3 bg-slate-800 rounded-full" />
                <span>5G 100%</span>
              </div>

              {/* WhatsApp App Bar */}
              <div className="bg-[#075e54] text-white p-2.5 rounded-t-2xl flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#075e54] flex items-center justify-center font-bold text-xs">
                    S
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-tight">Sneharmony Bot 🌷</h4>
                    <span className="text-[9px] text-emerald-200">Online • AI Assistant</span>
                  </div>
                </div>
              </div>

              {/* Chat Canvas (WhatsApp Background pattern feel) */}
              <div className="flex-1 bg-[#efeae2] p-3 overflow-y-auto space-y-2.5">
                {simMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.sender === 'lead' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl p-2.5 text-[11px] leading-relaxed shadow-xs whitespace-pre-line ${
                        msg.sender === 'lead'
                          ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-xs'
                          : msg.isEscalated
                            ? 'bg-amber-50 text-amber-950 border border-amber-300 rounded-tl-xs font-medium'
                            : 'bg-white text-slate-900 rounded-tl-xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[8px] text-slate-400 mt-0.5 px-1">{msg.time}</span>
                  </div>
                ))}
                {simLoading && (
                  <div className="flex items-center gap-1.5 p-2 bg-white rounded-xl text-[10px] text-slate-500 w-fit">
                    <span className="animate-spin text-emerald-600">●</span>
                    <span>Sneharmony bot is typing...</span>
                  </div>
                )}
                <div ref={simEndRef} />
              </div>

              {/* Simulated Chat Input */}
              <div className="bg-[#f0f2f5] p-2 rounded-b-2xl flex items-center gap-1.5">
                <input
                  type="text"
                  value={simInput}
                  onChange={(e) => setSimInput(e.target.value)}
                  onKeyUp={(e) => e.key === 'Enter' && handleSimulateSend()}
                  placeholder="Type a message as lead..."
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-full focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSimulateSend()}
                  disabled={simLoading || !simInput.trim()}
                  className="w-8 h-8 rounded-full bg-[#00a884] text-white flex items-center justify-center disabled:opacity-50 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BROADCAST CAMPAIGN */}
      {activeTab === 'broadcast' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6 max-w-2xl mx-auto">
          <div className="pb-3 border-b border-slate-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Send Automated Broadcast to Leads</h3>
              <p className="text-[11px] text-slate-400">Send personalized broadcast announcements or updates to filtered leads.</p>
            </div>
          </div>

          {broadcastSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{broadcastSuccess}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Status</label>
                <select
                  value={broadcastStatus}
                  onChange={(e) => setBroadcastStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="all">All Leads ({contacts.length})</option>
                  <option value="new">Only New Leads</option>
                  <option value="engaged">Only Engaged Leads</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Tag Filter (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. pricing, vip"
                  value={broadcastTag}
                  onChange={(e) => setBroadcastTag(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">Broadcast Message Template</label>
                <span className="text-[10px] text-slate-400">Use {'{name}'} for personalized recipient name</span>
              </div>
              <textarea
                rows={5}
                value={broadcastTemplate}
                onChange={(e) => setBroadcastTemplate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-sans"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl text-xs space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Message Preview:</span>
              <p className="text-slate-700 italic font-mono text-[11px]">
                {broadcastTemplate.replace(/\{name\}/gi, 'Ananya')}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSendBroadcast}
              disabled={sending || contacts.length === 0}
              className="w-full py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? 'Sending Broadcast...' : 'Launch Broadcast'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: KNOWLEDGE BASE & HUMAN ESCALATION SETUP */}
      {activeTab === 'knowledge' && (
        <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl mx-auto">
          {settingsSavedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp & Human Escalation settings successfully saved!</span>
            </div>
          )}

          {/* Section 1: Human Help / Escalation Contact */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <LifeBuoy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Human Helping Person Contact (Escalation)</h3>
                <p className="text-[11px] text-slate-400">
                  When a customer is stuck, asks for a real person, or if AI cannot answer, the bot sends these contact details.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Helping Person Name</label>
                <input
                  type="text"
                  value={settings.WHATSAPP_HUMAN_HELP_NAME}
                  onChange={(e) => setSettings({ ...settings, WHATSAPP_HUMAN_HELP_NAME: e.target.value })}
                  placeholder="e.g. Sneha (Support Lead)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone / WhatsApp Number</label>
                <input
                  type="text"
                  value={settings.WHATSAPP_HUMAN_HELP_PHONE}
                  onChange={(e) => setSettings({ ...settings, WHATSAPP_HUMAN_HELP_PHONE: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Support Email</label>
                <input
                  type="email"
                  value={settings.WHATSAPP_HUMAN_HELP_EMAIL}
                  onChange={(e) => setSettings({ ...settings, WHATSAPP_HUMAN_HELP_EMAIL: e.target.value })}
                  placeholder="help@sneharmony.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: AI Knowledge Base */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Business Knowledge Base (AI Answers)</h3>
                <p className="text-[11px] text-slate-400">
                  Google Gemini uses this knowledge base to answer customer questions accurately. Anything not found here is escalated to human help.
                </p>
              </div>
            </div>

            <div>
              <textarea
                rows={7}
                value={settings.WHATSAPP_KNOWLEDGE_BASE}
                onChange={(e) => setSettings({ ...settings, WHATSAPP_KNOWLEDGE_BASE: e.target.value })}
                placeholder="Write your FAQ, services, prices, working hours, and refund policies here..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono leading-relaxed"
              />
            </div>
          </div>

          {/* Section 3: Official Meta WhatsApp Cloud API (Optional) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Meta WhatsApp Cloud API (Free 1,000/mo)</h3>
                  <p className="text-[11px] text-slate-400">Direct integration from Meta Developer Dashboard.</p>
                </div>
              </div>

              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                100% Free Tier
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Phone Number ID</label>
                <input
                  type="text"
                  value={settings.WHATSAPP_PHONE_NUMBER_ID}
                  onChange={(e) => setSettings({ ...settings, WHATSAPP_PHONE_NUMBER_ID: e.target.value })}
                  placeholder="e.g. 104829104829104"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Permanent Access Token</label>
                <input
                  type="password"
                  value={settings.WHATSAPP_ACCESS_TOKEN}
                  onChange={(e) => setSettings({ ...settings, WHATSAPP_ACCESS_TOKEN: e.target.value })}
                  placeholder="EAA..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>
            </div>

            {/* Webhook URL Helper */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Your Inbound Webhook Callback URL:</span>
                <p className="text-xs font-mono text-slate-800 mt-0.5">{webhookUrl}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  setCopiedWebhook(true);
                  setTimeout(() => setCopiedWebhook(false), 2000);
                }}
                className="px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedWebhook ? 'Copied!' : 'Copy URL'}</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {savingSettings ? 'Saving Settings...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      )}

      {/* Modal: Add Lead */}
      {leadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Add New WhatsApp Lead</h3>
              <button
                onClick={() => setLeadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 919876543210 (country code + number)"
                  value={leadForm.phone_number}
                  onChange={(e) => setLeadForm({ ...leadForm, phone_number: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Source</label>
                  <select
                    value={leadForm.source}
                    onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="instagram">Instagram</option>
                    <option value="website">Website</option>
                    <option value="manual">Manual Entry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tags</label>
                  <input
                    type="text"
                    placeholder="pricing, student, collab"
                    value={leadForm.tags}
                    onChange={(e) => setLeadForm({ ...leadForm, tags: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLeadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
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
