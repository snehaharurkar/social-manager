import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  CalendarClock, 
  MessageSquare, 
  Users, 
  Zap, 
  PhoneCall, 
  TrendingUp, 
  Tv2, 
  History, 
  Settings, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Bot
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  pendingPostsCount?: number;
  unrepliedCount?: number;
  leadAlertsCount?: number;
  mobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
  onOpenCopilot?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingPostsCount = 0,
  unrepliedCount = 0,
  leadAlertsCount = 0,
  mobileMenuOpen = false,
  onCloseMobileMenu,
  onOpenCopilot
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const mainWorkspaceItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { 
      id: 'scheduler', 
      label: 'Content & Scheduler', 
      icon: CalendarClock,
      badge: pendingPostsCount > 0 ? pendingPostsCount : undefined,
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    { 
      id: 'inbox', 
      label: 'Unified Inbox', 
      icon: MessageSquare,
      badge: unrepliedCount > 0 ? unrepliedCount : undefined,
      badgeColor: 'bg-indigo-100 text-indigo-800'
    },
    { 
      id: 'crm', 
      label: 'Leads & CRM', 
      icon: Users,
      badge: leadAlertsCount > 0 ? leadAlertsCount : undefined,
      badgeColor: 'bg-emerald-100 text-emerald-800'
    },
    { id: 'automations', label: 'AI Automations', icon: Zap },
    { 
      id: 'calling', 
      label: 'AI Calling Agent', 
      icon: PhoneCall,
      badge: 'Active',
      badgeColor: 'bg-sky-100 text-sky-800'
    },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];

  const managementItems = [
    { id: 'channels', label: 'Connected Accounts', icon: Tv2 },
    { id: 'activity', label: 'Activity Log', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleTabClick = (tabId: string) => {
    onSelectTab(tabId);
    if (onCloseMobileMenu) onCloseMobileMenu();
  };

  const renderNavList = (items: typeof mainWorkspaceItems, sectionTitle?: string) => (
    <div className="space-y-1">
      {sectionTitle && !collapsed && (
        <div className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {sectionTitle}
        </div>
      )}
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id)}
            title={collapsed ? item.label : undefined}
            className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2 rounded-xl text-xs font-medium transition-all group relative ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </div>

            {!collapsed && item.badge !== undefined && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${item.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                {item.badge}
              </span>
            )}

            {/* Collapsed Tooltip Pill */}
            {collapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-medium rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                {item.label}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  const sidebarContent = (
    <div className={`${collapsed ? 'w-16' : 'w-60'} bg-white border-r border-slate-200/90 flex flex-col h-full select-none shrink-0 transition-all duration-200`}>
      {/* Brand Header */}
      <div className={`h-16 flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-5'} border-b border-slate-100 gap-2`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="truncate">
              <h1 className="font-bold text-slate-800 text-[14px] tracking-tight leading-tight">SocialManager</h1>
              <p className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                AI SaaS Suite
              </p>
            </div>
          )}
        </div>

        {/* Mobile Close Button */}
        {onCloseMobileMenu && (
          <button
            onClick={onCloseMobileMenu}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Close Navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Desktop Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {renderNavList(mainWorkspaceItems, 'Main Workspace')}
        <div className="pt-2 border-t border-slate-100">
          {renderNavList(managementItems, 'Management')}
        </div>
      </nav>

      {/* AI Copilot & Status Footer */}
      <div className="p-3 border-t border-slate-100 space-y-2">
        {onOpenCopilot && (
          <button
            onClick={onOpenCopilot}
            className={`w-full flex items-center ${collapsed ? 'justify-center p-2' : 'justify-between px-3 py-2'} bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border border-indigo-100 rounded-xl text-indigo-700 text-xs font-semibold transition shadow-xs group`}
          >
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
              {!collapsed && <span>AI Copilot</span>}
            </div>
            {!collapsed && <span className="text-[10px] bg-indigo-200/60 px-1.5 py-0.5 rounded text-indigo-800">Ask</span>}
          </button>
        )}

        {!collapsed && (
          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Engine Active
              </span>
              <span className="text-[10px] text-slate-400 font-mono">v1.2</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">SQLite WAL · Localhost:5000</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar */}
      <aside className="hidden md:flex flex-col h-screen shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            onClick={onCloseMobileMenu}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white z-10 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
