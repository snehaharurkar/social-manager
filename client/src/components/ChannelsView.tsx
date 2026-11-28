import React, { useState, useEffect } from 'react';
import { 
  Tv2, 
  Trash2, 
  ExternalLink, 
  AlertCircle, 
  Plus, 
  RefreshCw, 
  Eye, 
  EyeOff,
  Video, 
  Users, 
  Sparkles, 
  Loader2,
  Bot,
  MessageCircle,
  Edit3,
  CheckCircle2,
  X,
  Sliders,
  ShieldCheck,
  Send
} from 'lucide-react';
import type { Channel } from '../types';
import { api } from '../api';

interface ChannelsViewProps {
  channels: Channel[];
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
}

export const ChannelsView: React.FC<ChannelsViewProps> = ({
  channels,
  onRefresh,
  onNavigate
}) => {
  // Connection Modals State
  const [connectingPlatform, setConnectingPlatform] = useState<'youtube' | null>(null);
  const [uplikaModalOpen, setUplikaModalOpen] = useState(false);
  const [uplikaKey, setUplikaKey] = useState('');
  const [uplikaUsername, setUplikaUsername] = useState('');
  const [connectingUplika, setConnectingUplika] = useState(false);

  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChannel, setTelegramChannel] = useState('');
  const [connectingTelegram, setConnectingTelegram] = useState(false);

  // WhatsApp State
  const [waStatus, setWaStatus] = useState<any>(null);
  const [waSettings, setWaSettings] = useState<any>(null);
  const [loadingWa, setLoadingWa] = useState(false);
  const [editWaModalOpen, setEditWaModalOpen] = useState(false);
  const [savingWa, setSavingWa] = useState(false);

  // Syncing
  const [syncing, setSyncing] = useState(false);

  // Universal Channel Edit Modal State
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPlatformId, setEditPlatformId] = useState('');
  const [editToken, setEditToken] = useState('');
  const [showSecretToken, setShowSecretToken] = useState(false);
  const [editTargetChatId, setEditTargetChatId] = useState('');
  const [editAutoReply, setEditAutoReply] = useState(true);
  const [editPublishing, setEditPublishing] = useState(true);
  const [editPrivacyStatus, setEditPrivacyStatus] = useState('public');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSuccessMessage, setEditSuccessMessage] = useState<string | null>(null);
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchWhatsAppInfo();
  }, []);

  const fetchWhatsAppInfo = async () => {
    try {
      const [status, settingsRes] = await Promise.all([
        api.getWhatsAppWebStatus().catch(() => null),
        api.getWhatsAppSettings().catch(() => null)
      ]);
      setWaStatus(status);
      setWaSettings(settingsRes?.settings || null);
    } catch (e) {
      // Non-blocking
    }
  };

  const handleOpenEdit = (ch: Channel) => {
    setEditingChannel(ch);
    setEditDisplayName(ch.display_name || '');
    setEditUsername(ch.username || '');
    setEditPlatformId(ch.platform_id || '');
    setEditToken(''); // Do not expose token in plain text; placeholder indicates unchanged
    setShowSecretToken(false);
    
    const meta = ch.meta || {};
    setEditTargetChatId(meta.targetChatId || ch.platform_id || '');
    setEditAutoReply(meta.autoReplyEnabled !== false && meta.auto_reply_enabled !== false);
    setEditPublishing(meta.publishingEnabled !== false && meta.publishing_enabled !== false);
    setEditPrivacyStatus(meta.privacyStatus || 'public');
    setEditSuccessMessage(null);
    setEditErrorMessage(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel) return;

    if (!editDisplayName.trim()) {
      setEditErrorMessage('Display name cannot be empty.');
      return;
    }

    setSavingEdit(true);
    setEditErrorMessage(null);
    setEditSuccessMessage(null);

    try {
      const payload: any = {
        display_name: editDisplayName.trim(),
        username: editUsername.trim() || undefined,
        platform_id: editPlatformId.trim() || undefined,
        auto_reply_enabled: editAutoReply,
        publishing_enabled: editPublishing,
        target_chat_id: editTargetChatId.trim() || undefined,
        metadata: {
          ...(editingChannel.meta || {}),
          targetChatId: editTargetChatId.trim(),
          autoReplyEnabled: editAutoReply,
          publishingEnabled: editPublishing,
          privacyStatus: editPrivacyStatus
        }
      };

      if (editToken.trim()) {
        payload.access_token = editToken.trim();
      }

      await api.updateChannel(editingChannel.id, payload);
      setEditSuccessMessage('Integration configuration updated successfully!');
      setTimeout(() => {
        setEditingChannel(null);
        onRefresh();
      }, 1000);
    } catch (err: any) {
      setEditErrorMessage(err.message || 'Failed to update account configuration');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveWhatsAppSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWa(true);
    try {
      await api.saveWhatsAppSettings(waSettings);
      setEditWaModalOpen(false);
      fetchWhatsAppInfo();
      onRefresh();
    } catch (err: any) {
      alert(`Failed to save WhatsApp settings: ${err.message}`);
    } finally {
      setSavingWa(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to disconnect "${name}"?`)) {
      try {
        await api.deleteChannel(id);
        onRefresh();
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await api.triggerSync();
      setTimeout(onRefresh, 1000);
    } finally {
      setTimeout(() => setSyncing(false), 800);
    }
  };

  const handleConnectUplika = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uplikaKey.trim()) {
      alert('Please enter your Uplika API Key or MCP Token.');
      return;
    }

    setConnectingUplika(true);
    try {
      await api.connectUplika({
        apiKey: uplikaKey.trim(),
        customUsername: uplikaUsername.trim() || undefined
      });
      setUplikaModalOpen(false);
      setUplikaKey('');
      setUplikaUsername('');
      onRefresh();
    } catch (err: any) {
      alert(`Uplika connection error: ${err.message}`);
    } finally {
      setConnectingUplika(false);
    }
  };

  const handleConnectTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramToken.trim()) {
      alert('Please enter your Telegram Bot Token from @BotFather.');
      return;
    }

    setConnectingTelegram(true);
    try {
      await api.connectTelegram(telegramToken.trim(), telegramChannel.trim());
      setTelegramModalOpen(false);
      setTelegramToken('');
      setTelegramChannel('');
      onRefresh();
    } catch (err: any) {
      alert(`Telegram connection error: ${err.message}`);
    } finally {
      setConnectingTelegram(false);
    }
  };

  const ytChannels = channels.filter(c => c.platform === 'youtube');
  const igChannels = channels.filter(c => c.platform === 'instagram');
  const tgChannels = channels.filter(c => c.platform === 'telegram');

  const isWhatsAppConnected = waStatus?.connected || !!waSettings?.WHATSAPP_PHONE_NUMBER_ID;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Connected Accounts</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage your connected YouTube channels, Instagram profiles, Telegram bots, and WhatsApp accounts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
            <span>{syncing ? 'Syncing...' : 'Sync All'}</span>
          </button>

          <button
            onClick={() => setConnectingPlatform('youtube')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect YouTube</span>
          </button>

          <button
            onClick={() => setUplikaModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-pink-600 hover:bg-pink-700 rounded-xl transition-all shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Connect Instagram</span>
          </button>

          <button
            onClick={() => setTelegramModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-all shadow-xs"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Connect Telegram</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {channels.length === 0 && !isWhatsAppConnected && (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Tv2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">No channels connected yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Connect your YouTube channel, Instagram account, or Telegram bot to start auto-replying to viewer comments and scheduling updates.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={() => setConnectingPlatform('youtube')}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
            >
              Connect YouTube
            </button>
            <button
              onClick={() => setUplikaModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-pink-600 hover:bg-pink-700 rounded-xl shadow-xs flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Connect Instagram</span>
            </button>
            <button
              onClick={() => setTelegramModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs flex items-center gap-1.5"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Connect Telegram</span>
            </button>
          </div>
        </div>
      )}

      {/* Section 1: YouTube Channels */}
      {ytChannels.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              <h3 className="font-bold text-slate-800 text-sm tracking-tight">YouTube Channels ({ytChannels.length})</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ytChannels.map((ch) => (
              <div 
                key={ch.id} 
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={ch.avatar_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80'} 
                        alt={ch.display_name} 
                        className="w-10 h-10 rounded-xl object-cover border border-slate-100 shadow-2xs"
                      />
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{ch.display_name}</h4>
                        <p className="text-xs text-slate-400 font-mono">{ch.username || 'Channel'}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  </div>

                  {/* Channel Metrics */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-2.5 bg-slate-50/80 rounded-xl mb-3 border border-slate-100 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                        <Users className="w-3 h-3" /> Subs
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5 font-mono">
                        {ch.meta?.subscriberCount || '0'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                        <Video className="w-3 h-3" /> Videos
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5 font-mono">
                        {ch.meta?.videoCount || '0'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                        <Eye className="w-3 h-3" /> Views
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5 font-mono">
                        {ch.meta?.viewCount || '0'}
                      </div>
                    </div>
                  </div>

                  {/* Capabilities */}
                  <div className="p-2.5 bg-slate-50/70 rounded-xl text-[11px] text-slate-600 mb-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Channel ID:</span>
                      <span className="font-mono text-slate-700 truncate max-w-[150px]">{ch.platform_id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Capabilities:</span>
                      <span className="text-emerald-700 font-medium">Comments Auto-Reply, Video Upload</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Connected {new Date(ch.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(ch)}
                      className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 px-2 py-1 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors"
                      title="Edit YouTube Configuration"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(ch.id, ch.display_name)}
                      className="flex items-center gap-1 text-slate-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Disconnect channel"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium">Disconnect</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Instagram Profiles */}
      {igChannels.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span>
              <h3 className="font-bold text-slate-800 text-sm tracking-tight">Instagram Accounts ({igChannels.length})</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {igChannels.map((ch) => (
              <div 
                key={ch.id} 
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={ch.avatar_url || 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=120&auto=format&fit=crop&q=80'} 
                        alt={ch.display_name} 
                        className="w-10 h-10 rounded-xl object-cover border border-slate-100 shadow-2xs"
                      />
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{ch.display_name}</h4>
                        <p className="text-xs text-slate-400 font-mono">{ch.username || 'Instagram'}</p>
                      </div>
                    </div>
                    
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50/70 rounded-xl text-[11px] text-slate-600 mb-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Provider:</span>
                      <span className="font-semibold text-slate-800">Uplika MCP</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Account ID:</span>
                      <span className="font-mono text-slate-700 truncate max-w-[150px]">{ch.platform_id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Capabilities:</span>
                      <span className="text-emerald-700 font-medium">Post Scheduling, DM & Comment Auto-Reply</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Connected {new Date(ch.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(ch)}
                      className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 px-2 py-1 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors"
                      title="Edit Instagram Configuration"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(ch.id, ch.display_name)}
                      className="flex items-center gap-1 text-slate-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Disconnect account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium">Disconnect</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Telegram Accounts */}
      {tgChannels.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
              <h3 className="font-bold text-slate-800 text-sm tracking-tight">Telegram Bots ({tgChannels.length})</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tgChannels.map((ch) => (
              <div 
                key={ch.id} 
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-2xs">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{ch.display_name}</h4>
                        <p className="text-xs text-sky-600 font-mono font-medium">{ch.username || '@bot'}</p>
                      </div>
                    </div>
                    
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Polling Active
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50/70 rounded-xl text-[11px] text-slate-600 mb-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Channel / Chat ID:</span>
                      <span className="font-mono text-slate-800 font-semibold">{ch.platform_id || 'Not configured'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Auto-Reply:</span>
                      <span className={`font-semibold ${ch.meta?.autoReplyEnabled !== false ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {ch.meta?.autoReplyEnabled !== false ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Capabilities:</span>
                      <span className="text-sky-700 font-medium">Broadcasts, Channel Publishing, AI Replies</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Connected {new Date(ch.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(ch)}
                      className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 px-2 py-1 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors"
                      title="Edit Telegram Bot Configuration"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(ch.id, ch.display_name)}
                      className="flex items-center gap-1 text-slate-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Disconnect bot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium">Disconnect</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 4: WhatsApp Integration */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <h3 className="font-bold text-slate-800 text-sm tracking-tight">WhatsApp Integration</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {waStatus?.user?.name || waSettings?.WHATSAPP_HUMAN_HELP_NAME || 'WhatsApp Business'}
                    </h4>
                    <p className="text-xs text-emerald-600 font-mono font-medium">
                      {waStatus?.user?.id ? `+${waStatus.user.id.split('@')[0]}` : (waSettings?.WHATSAPP_PHONE_NUMBER_ID ? 'Cloud API Configured' : 'Ready to Connect')}
                    </p>
                  </div>
                </div>

                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  isWhatsAppConnected 
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200/60' 
                    : 'text-slate-600 bg-slate-50 border-slate-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isWhatsAppConnected ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                  {isWhatsAppConnected ? 'Active' : 'Standby'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50/70 rounded-xl text-[11px] text-slate-600 mb-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500">Auto-Reply:</span>
                  <span className={`font-semibold ${waSettings?.WHATSAPP_AUTO_REPLY_ENABLED === '1' ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {waSettings?.WHATSAPP_AUTO_REPLY_ENABLED === '1' ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500">Escalation Agent:</span>
                  <span className="font-medium text-slate-800">
                    {waSettings?.WHATSAPP_HUMAN_HELP_NAME || 'Not assigned'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500">Capabilities:</span>
                  <span className="text-emerald-700 font-medium">Inbound AI Responses, Lead Sync, Broadcasts</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <span className="text-[11px] text-slate-400">
                {isWhatsAppConnected ? 'Multi-device ready' : 'Configure credentials'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditWaModalOpen(true)}
                  className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 px-2 py-1 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors"
                  title="Edit WhatsApp Settings"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold">Edit</span>
                </button>
                {waStatus?.connected && (
                  <button
                    onClick={async () => {
                      if (confirm('Disconnect WhatsApp Web session?')) {
                        await api.disconnectWhatsAppWeb();
                        fetchWhatsAppInfo();
                      }
                    }}
                    className="flex items-center gap-1 text-slate-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium">Disconnect</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* UNIVERSAL EDIT ACCOUNT MODAL (FOR ALL CONNECTED ACCOUNTS) */}
      {editingChannel && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs ${
                  editingChannel.platform === 'youtube' ? 'bg-rose-600' :
                  editingChannel.platform === 'instagram' ? 'bg-pink-600' : 'bg-sky-600'
                }`}>
                  {editingChannel.platform === 'youtube' && <Tv2 className="w-5 h-5" />}
                  {editingChannel.platform === 'instagram' && <Sparkles className="w-5 h-5" />}
                  {editingChannel.platform === 'telegram' && <Bot className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base capitalize">
                    Edit {editingChannel.platform} Integration
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Configure integration credentials, channel IDs, and automation toggles safely.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingChannel(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notifications inside modal */}
            {editSuccessMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{editSuccessMessage}</span>
              </div>
            )}

            {editErrorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editErrorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Display Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Display / Account Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Username / Handle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Username / Handle
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder={editingChannel.platform === 'telegram' ? '@botusername' : '@username'}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Telegram-specific: Target Channel / Chat ID */}
              {editingChannel.platform === 'telegram' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Channel / Chat ID
                  </label>
                  <input
                    type="text"
                    value={editTargetChatId}
                    onChange={(e) => setEditTargetChatId(e.target.value)}
                    placeholder="e.g. -1005938203566 or @channelname"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Channel ID where automated and scheduled posts will be delivered.
                  </p>
                </div>
              )}

              {/* Secret Token / API Key (Masked by default) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {editingChannel.platform === 'telegram' ? 'Bot API Token' : 
                     editingChannel.platform === 'instagram' ? 'Uplika API Key / MCP Token' : 'OAuth Access Token'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecretToken(!showSecretToken)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    {showSecretToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showSecretToken ? 'Hide' : 'Reveal'}</span>
                  </button>
                </div>
                <input
                  type={showSecretToken ? 'text' : 'password'}
                  value={editToken}
                  onChange={(e) => setEditToken(e.target.value)}
                  placeholder="•••••••••••••••• (Leave blank to keep existing)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Your token is securely stored. Leave this field blank to preserve your current credentials without modification.
                </p>
              </div>

              {/* YouTube-specific: Default Privacy */}
              {editingChannel.platform === 'youtube' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Video Privacy Status
                  </label>
                  <select
                    value={editPrivacyStatus}
                    onChange={(e) => setEditPrivacyStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              )}

              {/* Feature Toggles */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-semibold text-slate-800">Auto-Reply Automation</h5>
                    <p className="text-[10px] text-slate-400">Allow AI rules to auto-respond to comments or messages.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editAutoReply}
                    onChange={(e) => setEditAutoReply(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-semibold text-slate-800">Publishing & Scheduling</h5>
                    <p className="text-[10px] text-slate-400">Enable this account as a publishing target in Content & Publishing.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editPublishing}
                    onChange={(e) => setEditPublishing(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingChannel(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingEdit ? 'Saving...' : 'Save Configuration'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WHATSAPP SETTINGS MODAL */}
      {editWaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">WhatsApp Configuration</h3>
              </div>
              <button onClick={() => setEditWaModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWhatsAppSettings} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Human Help Name</label>
                <input
                  type="text"
                  value={waSettings?.WHATSAPP_HUMAN_HELP_NAME || ''}
                  onChange={(e) => setWaSettings({ ...waSettings, WHATSAPP_HUMAN_HELP_NAME: e.target.value })}
                  placeholder="e.g. Sneha Harurkar"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Human Help Phone</label>
                <input
                  type="text"
                  value={waSettings?.WHATSAPP_HUMAN_HELP_PHONE || ''}
                  onChange={(e) => setWaSettings({ ...waSettings, WHATSAPP_HUMAN_HELP_PHONE: e.target.value })}
                  placeholder="e.g. +91 9876543210"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="font-semibold text-slate-800">Auto-Reply Enabled</span>
                  <p className="text-[10px] text-slate-400">Respond to incoming inquiries via AI rules</p>
                </div>
                <input
                  type="checkbox"
                  checked={waSettings?.WHATSAPP_AUTO_REPLY_ENABLED === '1'}
                  onChange={(e) => setWaSettings({ ...waSettings, WHATSAPP_AUTO_REPLY_ENABLED: e.target.checked ? '1' : '0' })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditWaModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWa}
                  className="px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                >
                  {savingWa ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: CONNECT INSTAGRAM VIA UPLIKA / MCP */}
      {uplikaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Connect Instagram via Uplika / MCP</h3>
                  <p className="text-[11px] text-slate-400">No Meta Developer account or Facebook verification required.</p>
                </div>
              </div>
              <button
                onClick={() => setUplikaModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConnectUplika} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Uplika API Key <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={uplikaKey}
                  onChange={(e) => setUplikaKey(e.target.value)}
                  placeholder="sk_..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instagram Handle / Username <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={uplikaUsername}
                  onChange={(e) => setUplikaUsername(e.target.value)}
                  placeholder="e.g. @sneharmony"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUplikaModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectingUplika}
                  className="px-5 py-2 text-xs font-semibold text-white bg-pink-600 hover:bg-pink-700 rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  {connectingUplika && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{connectingUplika ? 'Connecting...' : 'Connect Instagram'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONNECT TELEGRAM BOT */}
      {telegramModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Connect Telegram Bot</h3>
                  <p className="text-[11px] text-slate-400">100% free bot via @BotFather in 30 seconds.</p>
                </div>
              </div>
              <button
                onClick={() => setTelegramModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-sky-50 text-xs text-sky-900 space-y-1">
              <strong>Quick instructions:</strong>
              <p className="text-[11px] text-slate-600">
                1. Open Telegram and search <strong>@BotFather</strong>. Send <code>/newbot</code>.<br />
                2. Copy the bot HTTP API token and paste it below.
              </p>
            </div>

            <form onSubmit={handleConnectTelegram} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telegram Bot API Token <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Channel or Group Username/ID <span className="font-normal text-slate-400">(Optional for posting)</span>
                </label>
                <input
                  type="text"
                  value={telegramChannel}
                  onChange={(e) => setTelegramChannel(e.target.value)}
                  placeholder="e.g. -1001234567890 or @mychannel"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTelegramModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectingTelegram}
                  className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  {connectingTelegram && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{connectingTelegram ? 'Verifying...' : 'Connect Bot'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONNECT YOUTUBE */}
      {connectingPlatform === 'youtube' && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs bg-rose-600">
                  YT
                </div>
                <h3 className="font-bold text-slate-800 text-base">Connect YouTube Channel</h3>
              </div>
              <button
                onClick={() => setConnectingPlatform(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                Connecting will allow SocialManager to fetch your recent videos, poll incoming comments, and send automated responses on your behalf.
              </p>

              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                  Prerequisite: API Keys in Settings
                </div>
                <p className="text-[11px] text-indigo-800/90">
                  Make sure you have saved your Google Client ID & Secret in API Keys & Settings.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConnectingPlatform(null);
                  onNavigate('settings');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl"
              >
                Check Settings First
              </button>
              <a
                href="/api/auth/youtube"
                className="px-5 py-2 text-xs font-semibold text-white rounded-xl shadow-xs flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700"
              >
                <span>Authorize & Connect</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
