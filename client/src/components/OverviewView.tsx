import React, { useState, useEffect } from 'react';
import { 
  Tv2, 
  Zap, 
  MessageSquare, 
  Clock, 
  Sparkles, 
  Users, 
  PhoneCall, 
  TrendingUp, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  ExternalLink, 
  Send,
  Plus,
  Play,
  RotateCw,
  MessageCircle,
  FileText,
  Bot,
  Activity,
  Layers,
  ChevronRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import type { DashboardStats, ActivityLog, Channel, ScheduledPost, CommentItem, CrmStats } from '../types';
import { api } from '../api';

interface OverviewViewProps {
  stats: DashboardStats;
  logs: ActivityLog[];
  channels: Channel[];
  onNavigate: (tab: string) => void;
  onOpenNewPost?: () => void;
  onOpenNewRule?: () => void;
  onOpenAddLead?: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  stats,
  logs,
  channels,
  onNavigate,
  onOpenNewPost,
  onOpenNewRule,
  onOpenAddLead
}) => {
  const [upcomingPosts, setUpcomingPosts] = useState<ScheduledPost[]>([]);
  const [recentPublished, setRecentPublished] = useState<ScheduledPost[]>([]);
  const [unrepliedComments, setUnrepliedComments] = useState<CommentItem[]>([]);
  const [crmStats, setCrmStats] = useState<CrmStats | null>(null);
  const [callingStats, setCallingStats] = useState<{
    totalLeads: number;
    pendingCalls: number;
    completedCalls: number;
    interestedLeads: number;
    totalCampaigns?: number;
  } | null>(null);
  const [waStatus, setWaStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Quick Rule Test Simulator State
  const [testComment, setTestComment] = useState('');
  const [testPlatform, setTestPlatform] = useState('all');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const fetchDashboardDetails = async () => {
      try {
        const [postsData, commentsData, crmData, callingData, waData] = await Promise.all([
          api.getPosts().catch(() => []),
          api.getComments('unreplied').catch(() => []),
          api.getCrmStats().catch(() => null),
          api.getCallingStats().catch(() => null),
          api.getWhatsAppWebStatus().catch(() => null)
        ]);

        const pending = postsData.filter((p: ScheduledPost) => p.status === 'pending');
        const published = postsData.filter((p: ScheduledPost) => p.status === 'published');
        setUpcomingPosts(pending.slice(0, 4));
        setRecentPublished(published.slice(0, 4));
        setUnrepliedComments(commentsData.slice(0, 4));
        setCrmStats(crmData);
        setCallingStats(callingData);
        setWaStatus(waData);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardDetails();
  }, []);

  const handleTestSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testComment.trim()) return;

    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testAutomation({
        message: testComment.trim(),
        platform: testPlatform
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const ytChannels = channels.filter(c => c.platform === 'youtube');
  const igChannels = channels.filter(c => c.platform === 'instagram');
  const tgChannels = channels.filter(c => c.platform === 'telegram');
  const tgPrimary = tgChannels[0] || null;

  const totalLeadsCount = crmStats?.totalLeads || 0;
  const platformCounts = crmStats?.byPlatform || {};

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* SaaS Executive Operations Header & Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Unified Operations Command
            </span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Live System
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">SocialManager Command Center</h2>
          <p className="text-xs text-slate-400 max-w-xl">
            Real-time status across multi-platform publishing, AI voice calling, audience inbox, and automated CRM pipelines.
          </p>
        </div>

        {/* Primary Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => onNavigate('content-publishing')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-xs shadow-indigo-500/30"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Create Post</span>
          </button>

          <button
            onClick={() => onNavigate('crm')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-slate-300" />
            <span>Add Lead</span>
          </button>

          <button
            onClick={() => onNavigate('channels')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition shadow-xs"
          >
            <Layers className="w-3.5 h-3.5 text-slate-300" />
            <span>Manage Integrations</span>
          </button>
        </div>
      </div>

      {/* Top 4 Real-time Status Modules (Connected Accounts, Telegram Bot, AI Caller, Publishing Queue) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Module 1: Connected Platforms */}
        <div 
          onClick={() => onNavigate('channels')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-xs transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Connected Accounts</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Tv2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{channels.length}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold">{ytChannels.length} YouTube</span>
            <span className="px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 font-semibold">{igChannels.length} Instagram</span>
            <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-semibold">{tgChannels.length} Telegram</span>
          </div>
        </div>

        {/* Module 2: Telegram Bot Status */}
        <div 
          onClick={() => onNavigate('channels')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xs transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Telegram Bot</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-800 truncate">
              {tgPrimary ? tgPrimary.username || tgPrimary.display_name : 'No Bot Linked'}
            </span>
            <span className={`w-2 h-2 rounded-full ${tgPrimary ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {tgPrimary ? `Target: ${tgPrimary.platform_id || 'Configured'}` : 'Click to connect Telegram'}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-sky-700 font-medium">
            <Check className="w-3 h-3 text-sky-600" /> Auto-reply & channel posting ready
          </div>
        </div>

        {/* Module 3: AI Calling Agent Status */}
        <div 
          onClick={() => onNavigate('calling')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-amber-300 hover:shadow-xs transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">AI Calling Agent</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{callingStats?.totalLeads || 0}</div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{callingStats?.completedCalls || 0} calls completed</span>
            <span className="text-amber-700 font-semibold">{callingStats?.interestedLeads || 0} interested</span>
          </div>
          <div className="mt-2 text-[10px] text-emerald-700 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Aria Voice Assistant Active
          </div>
        </div>

        {/* Module 4: Content & Publishing Pipeline */}
        <div 
          onClick={() => onNavigate('content-publishing')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-xs transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Publishing Pipeline</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.pendingScheduled}</div>
          <p className="text-[11px] text-slate-500 mt-1">
            {stats.pendingScheduled} scheduled in queue
          </p>
          <div className="mt-2 text-[10px] text-indigo-600 font-medium flex items-center gap-1">
            <span>Multi-platform calendar view</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Main 2-Column Section: Left (Publishing & Leads) / Right (Inbox & Audit) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Content & Leads Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section A: Scheduled Posts & Recent Publishing Activity */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Publishing Activity & Queue</h3>
              </div>
              <button
                onClick={() => onNavigate('content-publishing')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>Open Content & Publishing</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingPosts.length === 0 && recentPublished.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-2">
                <Clock className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600 font-medium">No posts currently pending or published.</p>
                <button
                  onClick={() => onNavigate('content-publishing')}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
                >
                  Create & Publish Post
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingPosts.map((post) => (
                  <div key={`sched-${post.id}`} className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                        post.platform === 'youtube' ? 'bg-rose-100 text-rose-800' :
                        post.platform === 'instagram' ? 'bg-pink-100 text-pink-800' : 'bg-sky-100 text-sky-800'
                      }`}>
                        {post.platform}
                      </span>
                      <div className="truncate">
                        <p className="font-semibold text-slate-800 truncate">{post.title || post.content}</p>
                        <p className="text-[11px] text-slate-400">Scheduled for {new Date(post.scheduled_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                      Scheduled
                    </span>
                  </div>
                ))}

                {recentPublished.map((post) => (
                  <div key={`pub-${post.id}`} className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                        post.platform === 'youtube' ? 'bg-rose-100 text-rose-800' :
                        post.platform === 'instagram' ? 'bg-pink-100 text-pink-800' : 'bg-sky-100 text-sky-800'
                      }`}>
                        {post.platform}
                      </span>
                      <div className="truncate">
                        <p className="font-semibold text-slate-800 truncate">{post.title || post.content}</p>
                        <p className="text-[11px] text-slate-400">Published {post.published_at ? new Date(post.published_at).toLocaleString() : ''}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      Published
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Unified Lead Counts & Source Breakdown */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">Lead Generation Breakdown ({totalLeadsCount} Total)</h3>
              </div>
              <button
                onClick={() => onNavigate('crm')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>Open CRM</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Individual Source Breakdown Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* AI Calling */}
              <div 
                onClick={() => onNavigate('crm')}
                className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/60 cursor-pointer hover:bg-amber-50 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-amber-800 font-semibold mb-1">
                  <span>AI Calling</span>
                  <PhoneCall className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-lg font-bold text-slate-800 font-mono">{platformCounts['calling'] || 0}</div>
                <p className="text-[10px] text-amber-700/80 mt-0.5">Automated calls</p>
              </div>

              {/* Instagram */}
              <div 
                onClick={() => onNavigate('crm')}
                className="p-3 rounded-xl bg-pink-50/60 border border-pink-200/60 cursor-pointer hover:bg-pink-50 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-pink-800 font-semibold mb-1">
                  <span>Instagram</span>
                  <Sparkles className="w-3.5 h-3.5 text-pink-600" />
                </div>
                <div className="text-lg font-bold text-slate-800 font-mono">{platformCounts['instagram'] || 0}</div>
                <p className="text-[10px] text-pink-700/80 mt-0.5">DMs & Comments</p>
              </div>

              {/* WhatsApp */}
              <div 
                onClick={() => onNavigate('crm')}
                className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60 cursor-pointer hover:bg-emerald-50 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-emerald-800 font-semibold mb-1">
                  <span>WhatsApp</span>
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-lg font-bold text-slate-800 font-mono">{platformCounts['whatsapp'] || 0}</div>
                <p className="text-[10px] text-emerald-700/80 mt-0.5">Inbound chats</p>
              </div>

              {/* Telegram */}
              <div 
                onClick={() => onNavigate('crm')}
                className="p-3 rounded-xl bg-sky-50/60 border border-sky-200/60 cursor-pointer hover:bg-sky-50 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-sky-800 font-semibold mb-1">
                  <span>Telegram</span>
                  <Bot className="w-3.5 h-3.5 text-sky-600" />
                </div>
                <div className="text-lg font-bold text-slate-800 font-mono">{platformCounts['telegram'] || 0}</div>
                <p className="text-[10px] text-sky-700/80 mt-0.5">Bot discussions</p>
              </div>

              {/* YouTube */}
              <div 
                onClick={() => onNavigate('crm')}
                className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/60 cursor-pointer hover:bg-rose-50 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-rose-800 font-semibold mb-1">
                  <span>YouTube</span>
                  <Tv2 className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <div className="text-lg font-bold text-slate-800 font-mono">{platformCounts['youtube'] || 0}</div>
                <p className="text-[10px] text-rose-700/80 mt-0.5">Inquiry comments</p>
              </div>

              {/* Manual Entry */}
              <div 
                onClick={() => onNavigate('crm')}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 cursor-pointer hover:bg-slate-100/60 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-700 font-semibold mb-1">
                  <span>Manual Entry</span>
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="text-lg font-bold text-slate-800 font-mono">{platformCounts['manual'] || 0}</div>
                <p className="text-[10px] text-slate-500 mt-0.5">Admin added</p>
              </div>

              {/* Website / Landing */}
              <div 
                onClick={() => onNavigate('crm')}
                className="p-3 rounded-xl bg-violet-50/60 border border-violet-200/60 cursor-pointer hover:bg-violet-50 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-violet-800 font-semibold mb-1">
                  <span>Website</span>
                  <ExternalLink className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <div className="text-lg font-bold text-slate-800 font-mono">{platformCounts['website'] || 0}</div>
                <p className="text-[10px] text-violet-700/80 mt-0.5">Inquiry forms</p>
              </div>

              {/* Total Summary */}
              <div 
                onClick={() => onNavigate('crm')}
                className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/60 cursor-pointer hover:bg-indigo-50 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-indigo-800 font-semibold mb-1">
                  <span>Total Leads</span>
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="text-lg font-bold text-indigo-900 font-mono">{totalLeadsCount}</div>
                <p className="text-[10px] text-indigo-700 mt-0.5">Aggregated in CRM</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Unreplied Inbox & Audit Activity Stream */}
        <div className="space-y-6">
          {/* Section C: Unreplied Conversations / Feedback */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-800">Unanswered Feedback</h3>
              </div>
              <button
                onClick={() => onNavigate('inbox')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>Inbox</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {unrepliedComments.length === 0 ? (
              <div className="p-6 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-xs text-slate-600 font-semibold">Inbox is clear</p>
                <p className="text-[11px] text-slate-400">All comments and inquiries handled.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unrepliedComments.map((c) => (
                  <div key={c.id} className="p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl flex items-start justify-between gap-2.5 text-xs">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 truncate">{c.author_name}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase ${
                          c.platform === 'youtube' ? 'bg-rose-50 text-rose-700' : 'bg-pink-50 text-pink-700'
                        }`}>
                          {c.platform}
                        </span>
                      </div>
                      <p className="text-slate-600 truncate text-[11px]">{c.text}</p>
                    </div>
                    <button
                      onClick={() => onNavigate('inbox')}
                      className="px-2 py-0.5 text-[10px] font-semibold text-indigo-600 bg-white border border-slate-200 hover:bg-indigo-50 rounded-lg shrink-0"
                    >
                      Reply
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section D: Recent Activities Audit Stream */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Audit Stream</h3>
              </div>
              <button onClick={() => onNavigate('activity')} className="text-[11px] font-semibold text-indigo-600 hover:underline">
                View All
              </button>
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400">No events recorded yet.</p>
              ) : (
                logs.slice(0, 6).map((log) => (
                  <div key={log.id} className="p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl text-xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 capitalize text-[11px]">{log.event_type.replace('_', ' ')}</span>
                      <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate">{log.details}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
