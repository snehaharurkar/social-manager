import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './components/OverviewView';
import { ChannelsView } from './components/ChannelsView';
import { RulesView } from './components/RulesView';
import { SchedulerView } from './components/SchedulerView';
import { InboxView } from './components/InboxView';
import { WhatsAppView } from './components/WhatsAppView';
import { InstagramView } from './components/InstagramView';
import { TelegramView } from './components/TelegramView';
import { CallingAgentView } from './components/CallingAgentView';
import { SettingsView } from './components/SettingsView';
import { CrmView } from './components/CrmView';
import { AutomationsView } from './components/AutomationsView';
import { AnalyticsView } from './components/AnalyticsView';
import { ActivityLogView } from './components/ActivityLogView';
import { CopilotDrawer } from './components/CopilotDrawer';
import { api } from './api';
import type { DashboardStats, ActivityLog, Channel, Rule, ScheduledPost, CommentItem } from './types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  // Global State
  const [stats, setStats] = useState<DashboardStats>({
    activeChannels: 0,
    activeRules: 0,
    totalReplies: 0,
    pendingScheduled: 0,
    totalComments: 0
  });
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);

  // Modals
  const [showCreateRuleModal, setShowCreateRuleModal] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);

  // Toast / Notification banner from OAuth redirect
  const [notification, setNotification] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Load initial data
  const refreshAllData = async () => {
    try {
      const [statsData, channelsData, rulesData, postsData, commentsData] = await Promise.all([
        api.getStats().catch(() => ({ stats: { activeChannels: 0, activeRules: 0, totalReplies: 0, pendingScheduled: 0, totalComments: 0 }, recentLogs: [] })),
        api.getChannels().catch(() => []),
        api.getRules().catch(() => []),
        api.getPosts().catch(() => []),
        api.getComments('all').catch(() => [])
      ]);

      if (statsData) {
        setStats(statsData.stats);
        setLogs(statsData.recentLogs);
      }
      setChannels(channelsData);
      setRules(rulesData);
      setPosts(postsData);
      setComments(commentsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();

    // Check URL params for OAuth results
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) {
      const platform = params.get('connected') || 'channel';
      const name = params.get('name') || '';
      setNotification({
        type: 'ok',
        text: `Successfully connected ${platform.toUpperCase()} ${name ? `(${name})` : ''}!`
      });
      setCurrentTab('channels');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('error')) {
      setNotification({
        type: 'err',
        text: `Connection failed: ${params.get('error')}`
      });
      setCurrentTab('channels');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Auto-refresh stats every 30 seconds
    const interval = setInterval(refreshAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  const unrepliedCount = comments.filter(c => c.replied === 0).length;

  const getHeaderMeta = () => {
    switch (currentTab) {
      case 'overview':
        return { title: 'Overview', subtitle: 'Live automation metrics and real-time operations health' };
      case 'scheduler':
        return { title: 'Content & Scheduler', subtitle: 'Compose, preview, and schedule multi-platform posts' };
      case 'inbox':
        return { title: 'Unified Inbox', subtitle: 'Cross-platform conversation stream, sentiment analysis, and AI replies' };
      case 'crm':
        return { title: 'Leads & CRM Pipeline', subtitle: 'Cross-platform captured leads, scoring, stages, and export' };
      case 'automations':
        return { title: 'AI Automations Builder', subtitle: 'Visual triggers, conditions, prebuilt templates, and sandbox simulation' };
      case 'calling':
        return { title: 'AI Calling Agent & Auto-Dialer', subtitle: 'Outbound voice calling, lead compliance safeguards, and call logs' };
      case 'analytics':
        return { title: 'Performance Analytics', subtitle: 'Real platform metrics, engagement timeseries, and conversion rates' };
      case 'channels':
        return { title: 'Connected Accounts', subtitle: 'YouTube, Instagram (Uplika), WhatsApp, and Telegram integrations' };
      case 'activity':
        return { title: 'Activity Audit Log', subtitle: 'Immutable chronological trace of all automations, posts, and webhooks' };
      case 'settings':
        return { title: 'Settings & Knowledge Base', subtitle: 'Brand voice, business FAQ memory, and API credentials' };
      case 'whatsapp':
        return { title: 'WhatsApp Automation & Leads', subtitle: 'Automated messaging, AI FAQ answering & human help escalation' };
      case 'instagram':
        return { title: 'Instagram Automation & Leads', subtitle: 'Automated DMs, AI FAQ answering & human help escalation' };
      case 'telegram':
        return { title: 'Telegram Automation & Leads', subtitle: 'Bot auto-reply, AI FAQ answering, broadcast & channel scheduling' };
      case 'rules':
        return { title: 'Legacy Auto-Reply Rules', subtitle: 'Keyword triggers and AI rephrasing' };
      default:
        return { title: 'SocialManager', subtitle: 'Self-hosted AI social automation platform' };
    }
  };

  const headerMeta = getHeaderMeta();

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-800 antialiased overflow-hidden select-none">
      {/* Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingPostsCount={stats.pendingScheduled}
        unrepliedCount={unrepliedCount}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        onOpenCopilot={() => setCopilotOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          title={headerMeta.title}
          subtitle={headerMeta.subtitle}
          onOpenNewRule={() => {
            if (currentTab === 'automations') {
              setShowCreateRuleModal(true);
            } else {
              setCurrentTab('automations');
              setShowCreateRuleModal(true);
            }
          }}
          onOpenNewPost={() => {
            if (currentTab === 'scheduler') {
              setShowCreatePostModal(true);
            } else {
              setCurrentTab('scheduler');
              setShowCreatePostModal(true);
            }
          }}
          onOpenAddLead={() => {
            setCurrentTab('crm');
          }}
          onOpenCopilot={() => setCopilotOpen(true)}
          onRefresh={refreshAllData}
          onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
          onNavigate={setCurrentTab}
        />

        {/* Global Notification Banner */}
        {notification && (
          <div className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
            notification.type === 'ok' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{notification.text}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-700 font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Active Tab View Body */}
        <main className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Loading workspace...
            </div>
          ) : (
            <>
              {currentTab === 'overview' && (
                <OverviewView
                  stats={stats}
                  logs={logs}
                  channels={channels}
                  onNavigate={setCurrentTab}
                />
              )}

              {currentTab === 'scheduler' && (
                <SchedulerView
                  posts={posts}
                  channels={channels}
                  onRefresh={refreshAllData}
                  showCreateModal={showCreatePostModal}
                  onCloseCreateModal={() => setShowCreatePostModal(false)}
                />
              )}

              {currentTab === 'inbox' && (
                <InboxView
                  comments={comments}
                  onRefresh={refreshAllData}
                  onNavigate={setCurrentTab}
                />
              )}

              {currentTab === 'crm' && (
                <CrmView
                  onNavigate={setCurrentTab}
                />
              )}

              {currentTab === 'automations' && (
                <AutomationsView
                  rules={rules}
                  onRefresh={refreshAllData}
                  showCreateModal={showCreateRuleModal}
                  onCloseCreateModal={() => setShowCreateRuleModal(false)}
                />
              )}

              {currentTab === 'calling' && (
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                  <CallingAgentView />
                </div>
              )}

              {currentTab === 'analytics' && (
                <AnalyticsView />
              )}

              {currentTab === 'channels' && (
                <ChannelsView
                  channels={channels}
                  onRefresh={refreshAllData}
                  onNavigate={setCurrentTab}
                />
              )}

              {currentTab === 'activity' && (
                <ActivityLogView
                  logs={logs}
                  onRefresh={refreshAllData}
                  onNavigate={setCurrentTab}
                />
              )}

              {currentTab === 'settings' && (
                <SettingsView />
              )}

              {/* Dedicated / Platform-Specific Channels */}
              {currentTab === 'whatsapp' && (
                <WhatsAppView />
              )}

              {currentTab === 'instagram' && (
                <InstagramView />
              )}

              {currentTab === 'telegram' && (
                <TelegramView />
              )}

              {currentTab === 'rules' && (
                <RulesView
                  rules={rules}
                  onRefresh={refreshAllData}
                  showCreateModal={showCreateRuleModal}
                  onCloseCreateModal={() => setShowCreateRuleModal(false)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Grounded AI Copilot Slide-Over Drawer */}
      <CopilotDrawer
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onNavigate={(tab) => {
          setCurrentTab(tab);
          setCopilotOpen(false);
        }}
      />
    </div>
  );
};

export default App;
