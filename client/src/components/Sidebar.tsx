import React from 'react';
import { 
  LayoutDashboard, 
  Tv2, 
  Zap, 
  CalendarClock, 
  MessageSquare, 
  MessageCircle,
  Settings,
  Sparkles,
  PhoneCall,
  X
} from 'lucide-react';

const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const TelegramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  pendingPostsCount?: number;
  unrepliedCount?: number;
  mobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingPostsCount = 0,
  unrepliedCount = 0,
  mobileMenuOpen = false,
  onCloseMobileMenu
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'channels', label: 'Connected Channels', icon: Tv2 },
    { 
      id: 'whatsapp', 
      label: 'WhatsApp & Leads', 
      icon: MessageCircle,
      badge: 'Active',
      badgeColor: 'bg-emerald-100 text-emerald-800'
    },
    { 
      id: 'instagram', 
      label: 'Instagram & Leads', 
      icon: InstagramIcon as any,
      badge: 'Active',
      badgeColor: 'bg-pink-100 text-pink-800'
    },
    { 
      id: 'telegram', 
      label: 'Telegram & Leads', 
      icon: TelegramIcon as any,
      badge: 'Active',
      badgeColor: 'bg-sky-100 text-sky-800'
    },
    { 
      id: 'calling', 
      label: 'AI Calling Agent', 
      icon: PhoneCall,
      badge: 'Active',
      badgeColor: 'bg-indigo-100 text-indigo-800'
    },
    { id: 'rules', label: 'Auto-Reply Rules', icon: Zap },
    { 
      id: 'scheduler', 
      label: 'Post Scheduler', 
      icon: CalendarClock,
      badge: pendingPostsCount > 0 ? pendingPostsCount : undefined,
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    { 
      id: 'inbox', 
      label: 'Comments & Inbox', 
      icon: MessageSquare,
      badge: unrepliedCount > 0 ? unrepliedCount : undefined,
      badgeColor: 'bg-indigo-100 text-indigo-800'
    },
    { id: 'settings', label: 'API Keys & Settings', icon: Settings },
  ];

  const handleTabClick = (tabId: string) => {
    onSelectTab(tabId);
    if (onCloseMobileMenu) onCloseMobileMenu();
  };

  const sidebarContent = (
    <div className="w-64 bg-white border-r border-slate-200/90 flex flex-col h-full select-none shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-sm shadow-indigo-100">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-800 text-[15px] tracking-tight">SocialManager</h1>
            <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              100% Free & Self-Hosted
            </p>
          </div>
        </div>
        {onCloseMobileMenu && (
          <button
            onClick={onCloseMobileMenu}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Close Navigation Menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-50/80 text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${item.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 m-2 rounded-xl">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Auto-Sync Engine
          </span>
          <span className="font-mono text-[11px] text-slate-400">Active</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Checking posts & rules every 60s</p>
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
