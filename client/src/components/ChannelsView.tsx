import React, { useState } from 'react';
import { 
  Tv2, 
  Trash2, 
  ExternalLink, 
  AlertCircle, 
  Plus, 
  RefreshCw, 
  Eye, 
  Video, 
  Users, 
  Sparkles, 
  Loader2,
  Bot
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
  const [connectingPlatform, setConnectingPlatform] = useState<'youtube' | null>(null);
  const [uplikaModalOpen, setUplikaModalOpen] = useState(false);
  const [uplikaKey, setUplikaKey] = useState('');
  const [uplikaUsername, setUplikaUsername] = useState('');
  const [connectingUplika, setConnectingUplika] = useState(false);

  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChannel, setTelegramChannel] = useState('');
  const [connectingTelegram, setConnectingTelegram] = useState(false);

  const [syncing, setSyncing] = useState(false);

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

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Connected Accounts</h2>
          <p className="text-xs text-slate-500 mt-1">Manage your connected YouTube channels, Instagram profiles, and Telegram bots. No paywalls or account limits.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
            <span>{syncing ? 'Syncing...' : 'Sync All Accounts'}</span>
          </button>

          <button
            onClick={() => setConnectingPlatform('youtube')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs shadow-rose-200"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect YouTube</span>
          </button>

          <button
            onClick={() => setUplikaModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 rounded-xl transition-all shadow-xs shadow-purple-200"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Connect Instagram (Uplika)</span>
          </button>

          <button
            onClick={() => setTelegramModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl transition-all shadow-xs shadow-sky-200"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Connect Telegram Bot</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {channels.length === 0 && (
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
              className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs flex items-center gap-1.5"
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
              <span className="w-3 h-3 rounded-full bg-rose-600"></span>
              <h3 className="font-bold text-slate-800 text-sm tracking-tight">YouTube Channels ({ytChannels.length})</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {ytChannels.map((ch) => (
              <div 
                key={ch.id} 
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={ch.avatar_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80'} 
                        alt={ch.display_name} 
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-100 shadow-2xs"
                      />
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{ch.display_name}</h4>
                        <p className="text-xs text-slate-400 font-mono">{ch.username || 'Channel'}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  </div>

                  {/* Channel Metrics */}
                  <div className="grid grid-cols-3 gap-2 py-3 px-3 bg-slate-50/80 rounded-xl mb-4 border border-slate-100 text-center">
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
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Connected {new Date(ch.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDelete(ch.id, ch.display_name)}
                    className="flex items-center gap-1 text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="Disconnect channel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium">Disconnect</span>
                  </button>
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
              <span className="w-3 h-3 rounded-full bg-pink-500"></span>
              <h3 className="font-bold text-slate-800 text-sm tracking-tight">Instagram Accounts ({igChannels.length})</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {igChannels.map((ch) => (
              <div 
                key={ch.id} 
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={ch.avatar_url || 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=120&auto=format&fit=crop&q=80'} 
                        alt={ch.display_name} 
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-100 shadow-2xs"
                      />
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{ch.display_name}</h4>
                        <p className="text-xs text-slate-400 font-mono">{ch.username || 'Instagram'}</p>
                      </div>
                    </div>
                    
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50/70 rounded-xl text-xs text-slate-600 mb-4 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-500">Provider:</span>
                      <span className="font-semibold text-slate-800">Uplika MCP</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-500">Features:</span>
                      <span className="text-emerald-700 font-medium">Post Scheduling, DM & Comment Auto-Reply</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Connected {new Date(ch.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDelete(ch.id, ch.display_name)}
                    className="flex items-center gap-1 text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="Disconnect account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium">Disconnect</span>
                  </button>
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
              <span className="w-3 h-3 rounded-full bg-sky-500"></span>
              <h3 className="font-bold text-slate-800 text-sm tracking-tight">Telegram Bots & Channels ({tgChannels.length})</h3>
            </div>
            <button
              onClick={() => setTelegramModalOpen(true)}
              className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Telegram Bot</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tgChannels.map((ch) => (
              <div
                key={ch.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs shadow-sky-200">
                        TG
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{ch.display_name}</h4>
                        <p className="text-xs text-slate-400 font-mono">{ch.username || ch.platform_id}</p>
                      </div>
                    </div>

                    <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                      Telegram Bot
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50/70 rounded-xl text-xs text-slate-600 mb-4 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-500">Target Chat / Channel:</span>
                      <span className="font-semibold text-slate-800">{ch.platform_id}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-500">Features:</span>
                      <span className="text-emerald-700 font-medium">Auto-Reply, Channel Publishing</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Connected {new Date(ch.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDelete(ch.id, ch.display_name)}
                    className="flex items-center gap-1 text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="Disconnect account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium">Disconnect</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: CONNECT INSTAGRAM VIA UPLIKA / MCP */}
      {uplikaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
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
                  className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs shadow-purple-200 flex items-center gap-1.5"
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
                  placeholder="e.g. @mychannel or -100123456789"
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
                  className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs shadow-sky-200 flex items-center gap-1.5"
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
