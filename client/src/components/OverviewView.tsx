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
  FileText
} from 'lucide-react';
import type { DashboardStats, ActivityLog, Channel, ScheduledPost, CommentItem } from '../types';
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
  const [unrepliedComments, setUnrepliedComments] = useState<CommentItem[]>([]);
  const [crmStats, setCrmStats] = useState<{ totalLeads: number; byPlatform: any; byStage: any } | null>(null);
  const [analyticsOverview, setAnalyticsOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Quick Rule Test State
  const [testComment, setTestComment] = useState('');
  const [testPlatform, setTestPlatform] = useState('all');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const fetchDashboardDetails = async () => {
      try {
        const [postsData, commentsData, crmData, analyticsData] = await Promise.all([
          api.getPosts().catch(() => []),
          api.getComments('unreplied').catch(() => []),
          api.getCrmStats().catch(() => null),
          api.getAnalyticsOverview().catch(() => null)
        ]);

        const pending = postsData.filter(p => p.status === 'pending');
        setUpcomingPosts(pending.slice(0, 4));
        setUnrepliedComments(commentsData.slice(0, 4));
        setCrmStats(crmData);
        setAnalyticsOverview(analyticsData);
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

  const totalLeadsCount = crmStats?.totalLeads || 0;
  const callsCompleted = analyticsOverview?.completedCalls || 0;
  const publishedPostsCount = analyticsOverview?.publishedPosts || 0;
  const failedPostsCount = analyticsOverview?.failedPosts || 0;
  const activeAutomationsCount = stats.activeRules;
  const autoSuccessRate = analyticsOverview?.autoSuccessRate || 100;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* SaaS Welcome & Quick Command Header */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-white to-sky-50/60 border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Executive Operations Center
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-medium">Real-time SQLite Data</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Social Media Operations Command</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Monitor accounts, review scheduled publishing, manage multi-channel conversations, and qualify incoming leads across YouTube, Instagram, WhatsApp, and Telegram.
          </p>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigate('scheduler')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs shadow-indigo-200"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Create Post</span>
          </button>

          <button
            onClick={() => onNavigate('crm')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-xs"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>View Leads ({totalLeadsCount})</span>
          </button>

          <button
            onClick={() => onNavigate('inbox')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-xs"
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
            <span>Open Inbox</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Connected Accounts */}
        <div 
          onClick={() => onNavigate('channels')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Connected Accounts</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Tv2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{channels.length}</div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="font-semibold text-slate-700">{ytChannels.length} YT</span> · 
            <span className="font-semibold text-slate-700">{igChannels.length} IG</span> · 
            <span className="font-semibold text-slate-700">{tgChannels.length} TG</span>
          </p>
        </div>

        {/* Metric 2: Content Queue */}
        <div 
          onClick={() => onNavigate('scheduler')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Scheduled Queue</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.pendingScheduled}</div>
          <p className="text-[11px] text-slate-500 mt-1">
            {publishedPostsCount} published · {failedPostsCount} failed
          </p>
        </div>

        {/* Metric 3: Unanswered Feedback */}
        <div 
          onClick={() => onNavigate('inbox')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-rose-300 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unanswered Feedback</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{unrepliedComments.length}</div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-rose-600 font-semibold">{unrepliedComments.length}</span> awaiting reply
          </p>
        </div>

        {/* Metric 4: Total CRM Leads */}
        <div 
          onClick={() => onNavigate('crm')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total CRM Leads</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{totalLeadsCount}</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <PhoneCall className="w-3 h-3" /> {callsCompleted} calls completed
          </p>
        </div>
      </div>

      {/* Main Multi-Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Content Schedule + Inbox Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Upcoming Content Queue */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Upcoming Content Queue</h3>
              </div>
              <button
                onClick={() => onNavigate('scheduler')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>Full Scheduler</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingPosts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-2">
                <Clock className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600 font-medium">No posts currently pending in the schedule queue.</p>
                <button
                  onClick={() => onNavigate('scheduler')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition"
                >
                  Schedule a Video or Reel
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingPosts.map((post) => (
                  <div key={post.id} className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
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
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Inbox Overview (Awaiting Action) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-800">Unanswered Conversations & Comments</h3>
              </div>
              <button
                onClick={() => onNavigate('inbox')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>View Inbox</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {unrepliedComments.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                <p className="text-xs text-slate-600 font-semibold">Inbox is clear!</p>
                <p className="text-[11px] text-slate-400">All comments and messages have been handled.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {unrepliedComments.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{c.author_name}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                          c.platform === 'youtube' ? 'bg-rose-50 text-rose-700' : 'bg-pink-50 text-pink-700'
                        }`}>
                          {c.platform}
                        </span>
                      </div>
                      <p className="text-slate-600 truncate">{c.text}</p>
                    </div>
                    <button
                      onClick={() => onNavigate('inbox')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-white border border-slate-200 hover:bg-indigo-50 rounded-lg shrink-0"
                    >
                      Reply
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Interactive Automation Test Simulator */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-800">Automation Rule Simulator</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">Zero Side-Effects</span>
            </div>
            <p className="text-xs text-slate-500">Test hypothetical messages to verify trigger matching and AI tone polish before activating rules.</p>

            <form onSubmit={handleTestSimulation} className="flex gap-2">
              <input
                type="text"
                placeholder="Type a test comment or inquiry (e.g. 'How much are acoustic guitar lessons?')"
                value={testComment}
                onChange={(e) => setTestComment(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={testing || !testComment.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition"
              >
                {testing ? 'Simulating...' : 'Simulate'}
              </button>
            </form>

            {testResult && (
              <div className="pt-2">
                {testResult.matched ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs space-y-1.5 text-emerald-900">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Matched Rule: {testResult.rule?.name}</span>
                      {testResult.usedAi && <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-semibold">AI Polished</span>}
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-100 text-slate-700">
                      "{testResult.finalReply}"
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>No rule matched this message. Add a new keyword trigger under <strong>AI Automations</strong>.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Account Health + Activity Stream */}
        <div className="space-y-6">
          {/* Section 4: Account Health Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Account Health</h3>
              <button onClick={() => onNavigate('channels')} className="text-[11px] font-semibold text-indigo-600 hover:underline">
                Manage
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {/* YouTube */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[10px]">YT</div>
                  <div>
                    <p className="font-semibold text-slate-800">YouTube</p>
                    <p className="text-[10px] text-slate-400">{ytChannels.length > 0 ? ytChannels[0].display_name : 'Not connected'}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  ytChannels.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {ytChannels.length > 0 ? 'Active' : 'Offline'}
                </span>
              </div>

              {/* Instagram */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[10px]">IG</div>
                  <div>
                    <p className="font-semibold text-slate-800">Instagram</p>
                    <p className="text-[10px] text-slate-400">{igChannels.length > 0 ? igChannels[0].display_name : 'Not connected'}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  igChannels.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {igChannels.length > 0 ? 'Active' : 'Offline'}
                </span>
              </div>

              {/* Telegram */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-[10px]">TG</div>
                  <div>
                    <p className="font-semibold text-slate-800">Telegram Bot</p>
                    <p className="text-[10px] text-slate-400">{tgChannels.length > 0 ? tgChannels[0].display_name : 'Polling Ready'}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                  Ready
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Activity Feed */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Audit Stream</h3>
              <button onClick={() => onNavigate('activity')} className="text-[11px] font-semibold text-indigo-600 hover:underline">
                View All
              </button>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400">No events recorded yet.</p>
              ) : (
                logs.slice(0, 7).map((log) => (
                  <div key={log.id} className="p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl text-xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 capitalize">{log.event_type.replace('_', ' ')}</span>
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
