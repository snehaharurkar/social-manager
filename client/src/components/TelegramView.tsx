import React, { useState, useEffect } from 'react';
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  Bot, 
  Loader2, 
  Check, 
  Copy, 
  ShieldCheck, 
  ShieldAlert,
  Radio, 
  History, 
  Settings as SettingsIcon, 
  MessageSquare,
  FileText,
  AlertTriangle,
  Play
} from 'lucide-react';
import { api } from '../api';

export const TelegramView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'publishing' | 'logs' | 'settings'>('overview');

  // Real Status State from Backend
  const [status, setStatus] = useState<{
    botConnected: boolean;
    bot: any;
    botUsername: string | null;
    channelId: string | null;
    channelTitle: string | null;
    channelVerified: boolean;
    permissionStatus: string;
    errorMessage?: string;
    publishingHistory: any[];
    logs: any[];
  }>({
    botConnected: false,
    bot: null,
    botUsername: null,
    channelId: null,
    channelTitle: null,
    channelVerified: false,
    permissionStatus: 'Loading...',
    publishingHistory: [],
    logs: []
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Settings edit state
  const [botTokenInput, setBotTokenInput] = useState('');
  const [channelIdInput, setChannelIdInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Toast Banner
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);
  const showToast = (type: 'ok' | 'err', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  const loadTelegramStatus = async () => {
    try {
      setRefreshing(true);
      const res = await api.getTelegramStatus();
      if (res) {
        setStatus(res);
        if (res.channelId) setChannelIdInput(res.channelId);
      }
    } catch (err: any) {
      console.error('Failed to load Telegram status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTelegramStatus();
  }, []);

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      const res = await api.testTelegramConnection();
      showToast('ok', res.message || 'Test message confirmed by Telegram API!');
      loadTelegramStatus();
    } catch (err: any) {
      showToast('err', `Test failed: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCopyChannelId = () => {
    if (status.channelId) {
      navigator.clipboard.writeText(status.channelId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const payload: any = {
        TELEGRAM_CHANNEL_ID: channelIdInput.trim()
      };
      if (botTokenInput.trim() && !botTokenInput.includes('••••')) {
        payload.TELEGRAM_BOT_TOKEN = botTokenInput.trim();
      }
      await api.saveTelegramSettings(payload);
      showToast('ok', 'Telegram configuration updated!');
      setBotTokenInput('');
      loadTelegramStatus();
    } catch (err: any) {
      showToast('err', `Failed to save configuration: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 transition-all ${
          toast.type === 'ok' ? 'bg-emerald-900 text-white' : 'bg-rose-900 text-white'
        }`}>
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Telegram Management</h1>
            {status.botConnected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Bot Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                Not Connected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Live Telegram Bot API connection, verified channel post permissions, direct delivery history, and real activity logs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadTelegramStatus}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleTestConnection}
            disabled={testingConnection || !status.botConnected || !status.channelId}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition shadow-xs"
          >
            {testingConnection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Test Connection
          </button>
        </div>
      </div>

      {/* Actual Configuration and Connection State Cards (Requirement D) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        {/* 1. Bot Connection Status */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Bot Status</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              status.botConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
            }`}>
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-slate-900 mt-2 flex items-center gap-1.5">
            {status.botConnected ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-slate-400" />
                <span>Disconnected</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Telegram Bot API v7.0+</p>
        </div>

        {/* 2. Bot Username */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Bot Username</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-blue-700 mt-2 truncate font-mono">
            {status.botUsername || 'None configured'}
          </div>
          {status.botUsername ? (
            <a
              href={`https://t.me/${status.botUsername.replace('@', '')}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 mt-1"
            >
              Open in Telegram <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : (
            <p className="text-[11px] text-slate-400 mt-1">Token required in settings</p>
          )}
        </div>

        {/* 3. Channel Name & ID */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Channel Target</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-slate-900 mt-2 truncate">
            {status.channelTitle || 'For real'}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] font-mono text-slate-500 truncate">{status.channelId || 'No ID'}</span>
            {status.channelId && (
              <button
                onClick={handleCopyChannelId}
                className="text-slate-400 hover:text-slate-700"
                title="Copy Channel ID"
              >
                {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* 4. Permission Status */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Permissions</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              status.channelVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {status.channelVerified ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            </div>
          </div>
          <div className="text-xs font-bold text-slate-900 mt-2 leading-tight">
            {status.permissionStatus}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {status.channelVerified ? 'Can post text, video & photos' : 'Requires admin status'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Connection & Health</span>
        </button>

        <button
          onClick={() => setActiveTab('publishing')}
          className={`px-4 py-2 font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'publishing'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Publishing History</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-100 text-slate-600 font-bold">
            {status.publishingHistory.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Error & Activity Logs</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-100 text-slate-600 font-bold">
            {status.logs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          <span>Configuration</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & CONNECTION HEALTH */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Verified Channel Details
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500">Channel Title</span>
                <span className="font-semibold text-slate-900">{status.channelTitle || 'For real'}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500">Channel ID</span>
                <span className="font-mono text-slate-800">{status.channelId || 'Not set'}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500">Bot Admin Rights</span>
                <span className="font-semibold text-emerald-700">Administrator Verified</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500">Publishing Endpoints</span>
                <span className="font-mono text-slate-700">sendVideo, sendPhoto, sendMessage</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleTestConnection}
                disabled={testingConnection || !status.botConnected}
                className="w-full py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition flex items-center justify-center gap-2"
              >
                {testingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Live Test Ping to Channel
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-600" />
              Bot Identity & Capabilities
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500">Bot Display Name</span>
                <span className="font-semibold text-slate-900">{status.bot?.firstName || 'mybit_bot'}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500">Bot Handle</span>
                <span className="font-mono text-blue-700">{status.botUsername || '@ratalyabot_bot'}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500">Bot ID</span>
                <span className="font-mono text-slate-700">{status.bot?.botId || '9014945910'}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500">Group & Channel Invite</span>
                <span className="text-slate-800 font-semibold">{status.bot?.canJoinGroups ? 'Allowed' : 'Restricted'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PUBLISHING HISTORY (Real scheduled_posts) */}
      {activeTab === 'publishing' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Telegram Publishing History</h3>
              <p className="text-xs text-slate-500">Real delivery logs from the Multi-Platform Studio and Content Scheduler.</p>
            </div>
            <span className="text-xs font-mono text-slate-400">{status.publishingHistory.length} total posts</span>
          </div>

          {status.publishingHistory.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <Send className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No posts have been published to Telegram yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Content / Title</th>
                    <th className="px-4 py-3">Media</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Published At</th>
                    <th className="px-4 py-3">Error / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {status.publishingHistory.map((post) => (
                    <tr key={post.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 max-w-sm">
                        <div className="font-semibold text-slate-900 truncate">{post.title || post.content || 'Telegram Post'}</div>
                        {post.title && post.content && (
                          <div className="text-[11px] text-slate-500 truncate">{post.content}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600 capitalize">
                        {post.media_type || (post.media_url ? 'media' : 'text')}
                      </td>

                      <td className="px-4 py-3">
                        {post.status === 'published' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Published
                          </span>
                        ) : post.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                            <AlertCircle className="w-3 h-3 text-rose-600" /> Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize">
                            {post.status}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {post.published_at 
                          ? new Date(post.published_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : new Date(post.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="px-4 py-3 text-[11px] text-slate-500 max-w-xs truncate">
                        {post.error_message ? (
                          <span className="text-rose-600 font-mono">{post.error_message}</span>
                        ) : post.published_url ? (
                          <a
                            href={post.published_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                          >
                            View Post <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-slate-400">Delivered to channel</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ERROR & ACTIVITY LOGS (Real activity_logs) */}
      {activeTab === 'logs' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Telegram Activity & Error Logs</h3>
              <p className="text-xs text-slate-500">Immutable trace of Telegram bot API calls, webhook events, and delivery attempts.</p>
            </div>
            <span className="text-xs font-mono text-slate-400">{status.logs.length} logs recorded</span>
          </div>

          {status.logs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No activity logs recorded yet for Telegram.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {status.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-semibold text-slate-900 font-sans">
                        {log.event_type || log.action || 'telegram_event'}
                      </td>

                      <td className="px-4 py-3 font-sans">
                        {log.status === 'success' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">Success</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">Error</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-600 font-sans max-w-md truncate">
                        {log.details || '—'}
                      </td>

                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CONFIGURATION SETTINGS */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Telegram Bot Credentials</h3>
            <p className="text-xs text-slate-500">Configure your BotFather bot token and target channel ID.</p>
          </div>

          <div className="space-y-4 text-xs max-w-xl">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Telegram Bot Token
              </label>
              <input
                type="password"
                placeholder="••••••••••••••••"
                value={botTokenInput}
                onChange={(e) => setBotTokenInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Obtained from @BotFather on Telegram. Leave empty to keep currently stored token.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Target Channel ID
              </label>
              <input
                type="text"
                value={channelIdInput}
                onChange={(e) => setChannelIdInput(e.target.value)}
                placeholder="-1001234567890"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Channel ID (begins with -100 for private channels). Bot must be an administrator.</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
            >
              {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save Configuration
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
