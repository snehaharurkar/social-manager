import React, { useState } from 'react';
import { 
  Tv2, 
  Zap, 
  MessageSquareCheck, 
  Clock, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import type { DashboardStats, ActivityLog, Channel } from '../types';
import { api } from '../api';

interface OverviewViewProps {
  stats: DashboardStats;
  logs: ActivityLog[];
  channels: Channel[];
  onNavigate: (tab: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  stats,
  logs,
  channels,
  onNavigate
}) => {
  const [testComment, setTestComment] = useState('');
  const [testPlatform, setTestPlatform] = useState('all');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testComment.trim()) return;

    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testRule(testComment, testPlatform);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const ytChannels = channels.filter(c => c.platform === 'youtube');
  const igChannels = channels.filter(c => c.platform === 'instagram');

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-pink-50/40 border border-indigo-100/80 rounded-2xl p-6 shadow-xs flex items-center justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100/80 text-indigo-800 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Free Self-Hosted Suite
          </span>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Your Social Media Command Center</h2>
          <p className="text-xs text-slate-600 mt-1 max-w-xl">
            Automating your YouTube & Instagram comments, managing schedule queues, and running AI rephrasing with zero paywalls.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate('scheduler')}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs shadow-indigo-200"
          >
            Create Scheduled Post
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Active Channels */}
        <div 
          onClick={() => onNavigate('channels')}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-slate-300 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Connected Accounts</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Tv2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.activeChannels}</div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="font-medium text-slate-700">{ytChannels.length} YouTube</span> · 
            <span className="font-medium text-slate-700">{igChannels.length} Instagram</span>
          </p>
        </div>

        {/* Active Rules */}
        <div 
          onClick={() => onNavigate('rules')}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-slate-300 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Rules</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.activeRules}</div>
          <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Ready to auto-reply
          </p>
        </div>

        {/* Total Replies Sent */}
        <div 
          onClick={() => onNavigate('inbox')}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-slate-300 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Auto-Replies Delivered</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <MessageSquareCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.totalReplies}</div>
          <p className="text-xs text-slate-500 mt-1">Across all videos & posts</p>
        </div>

        {/* Queue / Scheduled Posts */}
        <div 
          onClick={() => onNavigate('scheduler')}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-slate-300 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scheduled Posts</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.pendingScheduled}</div>
          <p className="text-xs text-slate-500 mt-1">Pending in publishing queue</p>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Simulator + Connected Accounts Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rule Testing Simulator */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Auto-Reply Simulator
                </h3>
                <p className="text-xs text-slate-500">Test any hypothetical comment to preview which rule matches and what reply is produced.</p>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">Interactive Sandbox</span>
            </div>

            <form onSubmit={handleTest} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testComment}
                  onChange={(e) => setTestComment(e.target.value)}
                  placeholder="Type a test comment, e.g.: 'Can you send me the price link?'"
                  className="flex-1 px-3.5 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <select
                  value={testPlatform}
                  onChange={(e) => setTestPlatform(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none"
                >
                  <option value="all">All Platforms</option>
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                </select>
                <button
                  type="submit"
                  disabled={testing || !testComment.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testing ? 'Testing...' : 'Test Match'}
                </button>
              </div>
            </form>

            {/* Test Results Display */}
            {testResult && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                {testResult.matched ? (
                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Matched Rule: <span className="underline">{testResult.rule.name}</span>
                      {testResult.usedAi && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                          ✨ AI Polished
                        </span>
                      )}
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-emerald-100/80 text-slate-700 font-sans shadow-2xs">
                      <span className="font-semibold text-slate-500 block text-[10px] uppercase mb-1">Generated Output:</span>
                      "{testResult.finalReply}"
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100 text-xs flex items-center gap-2 text-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>No rule matched this comment. You can add a new keyword trigger under <strong>Auto-Reply Rules</strong>.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Platform Status Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* YouTube Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
                      YT
                    </div>
                    <span className="font-semibold text-slate-800 text-sm">YouTube</span>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    ytChannels.length > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {ytChannels.length > 0 ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                {ytChannels.length > 0 ? (
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="font-semibold text-slate-800">{ytChannels[0].display_name}</div>
                    <div className="text-slate-400">{ytChannels[0].username}</div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Connect with your Google OAuth credentials to start polling and replying to video comments.</p>
                )}
              </div>
              <button
                onClick={() => onNavigate('channels')}
                className="mt-4 flex items-center justify-between text-xs font-semibold text-indigo-600 hover:text-indigo-700 pt-3 border-t border-slate-100"
              >
                <span>{ytChannels.length > 0 ? 'Manage Channel' : 'Connect YouTube'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Instagram Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center font-bold text-xs">
                      IG
                    </div>
                    <span className="font-semibold text-slate-800 text-sm">Instagram</span>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    igChannels.length > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {igChannels.length > 0 ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                {igChannels.length > 0 ? (
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="font-semibold text-slate-800">{igChannels[0].display_name}</div>
                    <div className="text-slate-400">{igChannels[0].username}</div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Connect your Instagram account to auto-reply to post comments and schedule photo updates.</p>
                )}
              </div>
              <button
                onClick={() => onNavigate('channels')}
                className="mt-4 flex items-center justify-between text-xs font-semibold text-indigo-600 hover:text-indigo-700 pt-3 border-t border-slate-100"
              >
                <span>{igChannels.length > 0 ? 'Manage Account' : 'Connect Instagram'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Activity Feed */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Activity Stream</h3>
            <span className="text-[11px] text-slate-400">Recent events</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[460px]">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No activity recorded yet. Sync channels or test a rule to see live logs.
              </div>
            ) : (
              logs.map((log) => {
                const isSuccess = log.status === 'success';
                const isYt = log.platform === 'youtube';
                const isIg = log.platform === 'instagram';

                return (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isYt ? 'bg-rose-100 text-rose-700' : isIg ? 'bg-pink-100 text-pink-700' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {log.platform.toUpperCase()}
                        </span>
                        <span className="text-slate-700 capitalize">{log.event_type.replace('_', ' ')}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className={`text-slate-600 leading-relaxed font-sans ${isSuccess ? '' : 'text-rose-600'}`}>
                      {log.details}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
