import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Tv2, 
  Zap, 
  MessageSquare, 
  Clock, 
  Users, 
  PhoneCall, 
  AlertCircle, 
  RefreshCw,
  BarChart3,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Film,
  Layers,
  Info,
  Radio
} from 'lucide-react';
import type { 
  AnalyticsOverview, 
  AnalyticsTimeseriesPoint, 
  YouTubeAnalyticsData,
  InstagramAnalyticsData,
  TelegramAnalyticsData,
  UnifiedAnalyticsData
} from '../types';
import { api } from '../api';

export const AnalyticsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'youtube' | 'instagram' | 'telegram' | 'unified'>('overview');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);

  // Data states
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [timeseries, setTimeseries] = useState<AnalyticsTimeseriesPoint[]>([]);
  const [youtubeData, setYoutubeData] = useState<YouTubeAnalyticsData | null>(null);
  const [instagramData, setInstagramData] = useState<InstagramAnalyticsData | null>(null);
  const [telegramData, setTelegramData] = useState<TelegramAnalyticsData | null>(null);
  const [unifiedData, setUnifiedData] = useState<UnifiedAnalyticsData | null>(null);

  const fetchCurrentData = async () => {
    setLoading(true);
    try {
      const [ovData, tsData, ytData, igData, tgData, unData] = await Promise.all([
        api.getAnalyticsOverview(dateRange, customStart, customEnd).catch(() => null),
        api.getAnalyticsTimeseries(dateRange).catch(() => []),
        api.getYouTubeAnalytics(dateRange, customStart, customEnd).catch(() => null),
        api.getInstagramAnalytics(dateRange, customStart, customEnd).catch(() => null),
        api.getTelegramAnalytics(dateRange, customStart, customEnd).catch(() => null),
        api.getUnifiedAnalytics(dateRange, customStart, customEnd).catch(() => null)
      ]);
      setOverview(ovData);
      setTimeseries(tsData);
      setYoutubeData(ytData);
      setInstagramData(igData);
      setTelegramData(tgData);
      setUnifiedData(unData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentData();
  }, [dateRange]);

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customEnd) {
      fetchCurrentData();
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Global Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Performance & Platform Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real platform analytics, response rates, and verified metrics across YouTube, Instagram, and Telegram.
          </p>
        </div>

        {/* Global Date Range Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
            {(['7d', '30d', '90d', 'custom'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-2.5 py-1.5 rounded-lg uppercase transition ${
                  dateRange === range
                    ? 'bg-white text-slate-800 font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'Custom'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchCurrentData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-xs"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker Bar (if custom selected) */}
      {dateRange === 'custom' && (
        <form onSubmit={handleCustomDateSubmit} className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <span className="font-semibold text-slate-600">Select Date Range:</span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white"
            required
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white"
            required
          />
          <button
            type="submit"
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs"
          >
            Apply Range
          </button>
        </form>
      )}

      {/* 5-Tab Navigation Bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Overview
        </button>

        <button
          onClick={() => setActiveTab('youtube')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition ${
            activeTab === 'youtube'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-600" />
          YouTube
        </button>

        <button
          onClick={() => setActiveTab('instagram')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition ${
            activeTab === 'instagram'
              ? 'border-pink-600 text-pink-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-pink-600" />
          Instagram
        </button>

        <button
          onClick={() => setActiveTab('telegram')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition ${
            activeTab === 'telegram'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          Telegram
        </button>

        <button
          onClick={() => setActiveTab('unified')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition ${
            activeTab === 'unified'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Unified Analytics
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Response Rate</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-800">{overview?.responseRate || 0}%</div>
              <p className="text-[11px] text-slate-500 mt-1">
                {overview?.repliedComments || 0} of {overview?.totalComments || 0} comments replied
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Automation Health</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-800">{overview?.autoSuccessRate || 100}%</div>
              <p className="text-[11px] text-slate-500 mt-1">
                {overview?.successExecs || 0} success · {overview?.failedExecs || 0} failures
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Content Published</span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-800">{overview?.publishedPosts || 0}</div>
              <p className="text-[11px] text-slate-500 mt-1">
                {overview?.pendingPosts || 0} queued · {overview?.failedPosts || 0} failed
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Voice AI Calls</span>
                <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-800">{overview?.completedCalls || 0}</div>
              <p className="text-[11px] text-slate-500 mt-1">
                {overview?.callDurationMinutes || 0} total minutes logged
              </p>
            </div>
          </div>

          {/* Activity Trends Visualization */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Engagement & Operational Activity Trend</h3>
                <p className="text-xs text-slate-500">Daily breakdown of comments, published posts, and operations</p>
              </div>
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Range: {dateRange.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-7 gap-3 pt-4 items-end h-48 border-b border-slate-100 pb-2">
              {timeseries.map((pt, i) => {
                const maxVal = Math.max(...timeseries.map(t => t.activity + t.comments + t.posts), 5);
                const heightPercent = Math.min(Math.round(((pt.activity + pt.comments + pt.posts) / maxVal) * 100), 100);

                return (
                  <div key={i} className="flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="text-[10px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      {pt.activity + pt.comments + pt.posts}
                    </div>
                    <div 
                      style={{ height: `${Math.max(heightPercent, 12)}%` }} 
                      className="w-full max-w-[42px] bg-indigo-500 group-hover:bg-indigo-600 rounded-t-lg transition-all shadow-xs flex flex-col justify-end p-1 text-center"
                    />
                    <span className="text-[11px] font-medium text-slate-600 truncate w-full text-center">
                      {pt.label.split(',')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: YOUTUBE ANALYTICS */}
      {activeTab === 'youtube' && (
        <div className="space-y-6">
          {/* YouTube KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Published Videos</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{youtubeData?.metrics.totalPublished || 0}</div>
              <p className="text-[11px] text-slate-500 mt-1">{youtubeData?.metrics.failedUploads || 0} failed uploads</p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Comments</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{youtubeData?.metrics.totalComments || 0}</div>
              <p className="text-[11px] text-slate-500 mt-1">Across all synced videos</p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">AI / Manual Replies</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{youtubeData?.metrics.repliedComments || 0}</div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">{youtubeData?.metrics.responseRate || 0}% Response Rate</p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Connected Channels</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{youtubeData?.channels.length || 0}</div>
              <p className="text-[11px] text-slate-500 mt-1">Verified Google OAuth 2.0</p>
            </div>
          </div>

          {/* YouTube Channels Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Connected YouTube Channels</h3>
            {(!youtubeData?.channels || youtubeData.channels.length === 0) ? (
              <p className="text-xs text-slate-400">No YouTube channels connected. Visit Connected Accounts to link a channel.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {youtubeData.channels.map(ch => (
                  <div key={ch.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{ch.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {ch.subscribers} Subscribers • {ch.totalViews} Views • {ch.totalVideos} Videos
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Videos Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Published & Scheduled Videos</h3>
            {(!youtubeData?.topVideos || youtubeData.topVideos.length === 0) ? (
              <p className="text-xs text-slate-400">No YouTube videos published or scheduled yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-3 py-2">Video Title</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Scheduled / Published</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {youtubeData.topVideos.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 font-semibold text-slate-800">{v.title || v.content}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            v.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500">{new Date(v.scheduled_at).toLocaleDateString()}</td>
                        <td className="px-3 py-2">
                          {v.published_url && (
                            <a href={v.published_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1">
                              Watch <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
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

      {/* TAB 3: INSTAGRAM ANALYTICS */}
      {activeTab === 'instagram' && (
        <div className="space-y-6">
          {/* Instagram KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Published Posts</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{instagramData?.metrics.totalPublished || 0}</div>
              <p className="text-[11px] text-slate-500 mt-1">{instagramData?.metrics.failedPosts || 0} failed</p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Direct Messages</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{instagramData?.metrics.totalDMs || 0}</div>
              <p className="text-[11px] text-slate-500 mt-1">
                {instagramData?.metrics.inboundDMs || 0} in · {instagramData?.metrics.outboundDMs || 0} out
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Leads Captured</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{instagramData?.metrics.leadsCaptured || 0}</div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">From automated DM triggers</p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Connected Accounts</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{instagramData?.channels.length || 0}</div>
              <p className="text-[11px] text-slate-500 mt-1">Verified Instagram Provider</p>
            </div>
          </div>

          {/* Instagram Accounts */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Connected Instagram Accounts</h3>
            {(!instagramData?.channels || instagramData.channels.length === 0) ? (
              <p className="text-xs text-slate-400">No Instagram accounts connected.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {instagramData.channels.map(ch => (
                  <div key={ch.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{ch.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{ch.followers} Followers • Provider: {ch.provider}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-700">
                      Connected
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notice Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-slate-500" />
              Instagram API Capabilities Notice
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {instagramData?.notice || 'Publishing to Instagram requires photos or videos via the official Content Publishing API. Text-only posts are prohibited by Meta.'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: TELEGRAM ANALYTICS */}
      {activeTab === 'telegram' && (
        <div className="space-y-6">
          {/* Telegram KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Broadcasts Published</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{telegramData?.metrics.totalPublished || 0}</div>
              <p className="text-[11px] text-slate-500 mt-1">{telegramData?.metrics.failedPosts || 0} failed</p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Bot Messages</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{telegramData?.metrics.totalMessages || 0}</div>
              <p className="text-[11px] text-slate-500 mt-1">
                {telegramData?.metrics.inboundMessages || 0} user · {telegramData?.metrics.outboundMessages || 0} bot
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Leads Captured</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{telegramData?.metrics.leadsCaptured || 0}</div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Stored in CRM Pipeline</p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Connected Channels</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{telegramData?.channels.length || 0}</div>
              <p className="text-[11px] text-slate-500 mt-1">Verified Telegram Bot API</p>
            </div>
          </div>

          {/* Telegram Channels */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Connected Telegram Bots & Channels</h3>
            {(!telegramData?.channels || telegramData.channels.length === 0) ? (
              <p className="text-xs text-slate-400">No Telegram channels or bots connected.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {telegramData.channels.map(ch => (
                  <div key={ch.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{ch.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Channel / Chat ID: {ch.channelId}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">
                      {ch.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notice Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-slate-500" />
              Telegram Bot Capabilities Notice
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {telegramData?.notice || 'Telegram channels receive broadcast messages and media instantly via Bot token with administrator privileges.'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 5: UNIFIED ANALYTICS */}
      {activeTab === 'unified' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Content Published</span>
                <div className="text-3xl font-bold text-slate-800 mt-1">
                  {unifiedData?.totalContentPublished || 0}
                </div>
                <p className="text-xs text-slate-500 mt-1">Across all connected social channels</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Leads Generated</span>
                <div className="text-3xl font-bold text-emerald-700 mt-1">
                  {unifiedData?.totalLeadsGenerated || 0}
                </div>
                <p className="text-xs text-slate-500 mt-1">From automated triggers and AI interactions</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Cross-Platform Comparison Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Platform Performance Comparison</h3>
              <span className="text-[11px] text-slate-400 font-medium">Distinct platform metrics (non-aggregated)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5">Platform</th>
                    <th className="px-3 py-2.5">Content Published</th>
                    <th className="px-3 py-2.5">Delivery Failures</th>
                    <th className="px-3 py-2.5">Leads Generated</th>
                    <th className="px-3 py-2.5">Platform Engagement Metric</th>
                    <th className="px-3 py-2.5">Metric Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unifiedData?.comparisonTable.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="px-3 py-3 font-bold text-slate-900">{row.platform}</td>
                      <td className="px-3 py-3 font-semibold text-slate-800">{row.publishedCount}</td>
                      <td className="px-3 py-3">
                        {row.failedCount > 0 ? (
                          <span className="text-rose-600 font-bold">{row.failedCount}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-semibold text-emerald-700">{row.leadsGenerated}</td>
                      <td className="px-3 py-3 text-slate-600 font-medium">{row.interactionMetricName}</td>
                      <td className="px-3 py-3 font-mono font-bold text-indigo-700">{row.interactionValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Metric Definitions Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs text-slate-600">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-600" />
              Non-Misleading Metric Definitions
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              To prevent distorted analytics, each platform maintains independent engagement definitions:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <span className="font-bold text-rose-700 text-[11px] block">YouTube Views:</span>
                <span className="text-[10px] text-slate-500 leading-snug">
                  {unifiedData?.metricDefinitions.youtubeViews || 'Verified video playback count reported by YouTube Data API.'}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <span className="font-bold text-pink-700 text-[11px] block">Instagram Interactions:</span>
                <span className="text-[10px] text-slate-500 leading-snug">
                  {unifiedData?.metricDefinitions.instagramReach || 'Direct message replies and engagement events captured via Uplika / Meta Graph.'}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <span className="font-bold text-sky-700 text-[11px] block">Telegram Messages:</span>
                <span className="text-[10px] text-slate-500 leading-snug">
                  {unifiedData?.metricDefinitions.telegramActivity || 'Messages and broadcast interactions processed through your Telegram Bot.'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
