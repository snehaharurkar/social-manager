import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, 
  CalendarPlus, 
  Menu, 
  Bot, 
  UserPlus, 
  Bell, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  Info,
  Trash2,
  Check,
  ExternalLink,
  X,
  Radio
} from 'lucide-react';
import { api } from '../api';
import type { AppNotification } from '../types';

interface HeaderProps {
  title: string;
  subtitle: string;
  onOpenNewRule?: () => void;
  onOpenNewPost?: () => void;
  onOpenAddLead?: () => void;
  onOpenCopilot?: () => void;
  onRefresh?: () => void;
  onToggleMobileMenu?: () => void;
  onNavigate?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onOpenNewRule,
  onOpenNewPost,
  onOpenAddLead,
  onOpenCopilot,
  onRefresh,
  onToggleMobileMenu,
  onNavigate
}) => {
  const [syncing, setSyncing] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeCategory, setActiveCategory] = useState<'all' | 'unread' | 'publishing' | 'calling' | 'system'>('all');
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.getNotifications({ limit: 40 });
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Keep silent for background polling
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationsOpen]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.triggerSync();
      if (onRefresh) onRefresh();
      fetchNotifications();
    } finally {
      setTimeout(() => setSyncing(false), 800);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all as read', e);
    }
  };

  const handleMarkOneRead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationRead(id, 1);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteOne = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => {
        const item = notifications.find(n => n.id === id);
        return item && !item.is_read ? Math.max(0, prev - 1) : prev;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    try {
      await api.clearNotifications(false);
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      handleMarkOneRead(notif.id);
    }
    if (notif.link_tab && onNavigate) {
      onNavigate(notif.link_tab);
      setNotificationsOpen(false);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeCategory === 'unread') return n.is_read === 0;
    if (activeCategory === 'publishing') return n.category === 'publishing' || n.category === 'scheduler';
    if (activeCategory === 'calling') return n.category === 'calling' || n.category === 'lead';
    if (activeCategory === 'system') return n.category === 'system' || n.category === 'account' || n.category === 'sync' || n.category === 'automation';
    return true;
  });

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-indigo-500 shrink-0" />;
    }
  };

  const formatRelativeTime = (iso: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 md:px-8 flex items-center justify-between shrink-0 relative z-30">
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="text-sm md:text-base font-bold text-slate-800 tracking-tight truncate">{title}</h2>
          <p className="text-[11px] text-slate-500 truncate hidden sm:block">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Sync Now */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-xs disabled:opacity-50"
          title="Sync all connected accounts and comments"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
          <span className="hidden md:inline">{syncing ? 'Syncing...' : 'Sync'}</span>
        </button>

        {/* In-App Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              setNotificationsOpen(prev => !prev);
              if (!notificationsOpen) fetchNotifications();
            }}
            className={`relative p-2 rounded-xl border transition ${
              notificationsOpen 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900'
            }`}
            title="In-App Notification Center"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-xs border-2 border-white animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              {/* Dropdown Header */}
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-[11px] text-slate-400 hover:text-rose-600 transition"
                      title="Clear all notifications"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 bg-white text-[11px] font-medium overflow-x-auto">
                {(['all', 'unread', 'publishing', 'calling', 'system'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2 py-1 rounded-lg capitalize whitespace-nowrap transition ${
                      activeCategory === cat
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-500">No notifications in this view</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Events like post publishing and call alerts will appear here</p>
                  </div>
                ) : (
                  filteredNotifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 flex items-start gap-3 transition cursor-pointer hover:bg-slate-50/80 ${
                        !notif.is_read ? 'bg-indigo-50/30' : 'bg-white'
                      }`}
                    >
                      <div className="pt-0.5">
                        {getLevelBadge(notif.level)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-slate-800 truncate">{notif.title}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{formatRelativeTime(notif.created_at)}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">{notif.message}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {notif.category}
                          </span>
                          {notif.link_tab && (
                            <span className="text-[10px] text-indigo-600 flex items-center gap-0.5 hover:underline font-medium">
                              Open {notif.link_tab} <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100">
                        {!notif.is_read && (
                          <button
                            onClick={(e) => handleMarkOneRead(notif.id, e)}
                            className="p-1 text-indigo-600 hover:bg-indigo-100 rounded"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeleteOne(notif.id, e)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete notification"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Dropdown Footer */}
              <div className="p-2 border-t border-slate-100 bg-slate-50/50 text-center">
                <p className="text-[10px] text-slate-400">Notifications are stored in your secure local database</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Copilot Button */}
        {onOpenCopilot && (
          <button
            onClick={onOpenCopilot}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-200/70 rounded-xl transition shadow-xs"
            title="Ask AI Copilot for recommendations, post status, or draft replies"
          >
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Ask Copilot</span>
          </button>
        )}

        {/* Add Lead Shortcut */}
        {onOpenAddLead && (
          <button
            onClick={onOpenAddLead}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
            <span>+ Lead</span>
          </button>
        )}

        {/* Schedule Post Shortcut */}
        {onOpenNewPost && (
          <button
            onClick={onOpenNewPost}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs shadow-indigo-200"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Schedule Post</span>
            <span className="sm:hidden">Post</span>
          </button>
        )}
      </div>
    </header>
  );
};
