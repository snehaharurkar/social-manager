import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Filter, 
  Share2, 
  PhoneCall, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Send
} from 'lucide-react';
import { api } from '../api';
import type { AppNotification } from '../types';

interface NotificationsViewProps {
  onNavigate?: (tab: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'all' | 'unread' | 'publishing' | 'calling' | 'telegram' | 'system'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      setRefreshing(true);
      const res = await api.getNotifications({ limit: 100 });
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleNotificationClick = (item: AppNotification) => {
    if (item.is_read === 0) {
      handleMarkRead(item.id);
    }
    if (onNavigate && item.link_tab) {
      onNavigate(item.link_tab);
    }
  };

  const filteredNotifications = notifications.filter(item => {
    if (activeCategory === 'unread') return item.is_read === 0;
    if (activeCategory === 'publishing') return item.category === 'publishing' || item.category === 'scheduler';
    if (activeCategory === 'calling') return item.category === 'calling';
    if (activeCategory === 'telegram') return item.category === 'telegram';
    if (activeCategory === 'system') return item.category === 'system' || item.category === 'general';
    return true;
  });

  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  const getCategoryIcon = (category: string, level: string) => {
    if (category === 'calling') {
      return <PhoneCall className="w-4 h-4 text-sky-600" />;
    }
    if (category === 'publishing' || category === 'scheduler') {
      return <Share2 className="w-4 h-4 text-purple-600" />;
    }
    if (category === 'telegram') {
      return <Send className="w-4 h-4 text-blue-600" />;
    }
    if (level === 'error') {
      return <AlertCircle className="w-4 h-4 text-rose-600" />;
    }
    if (level === 'warning') {
      return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    }
    if (level === 'success') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    }
    return <Info className="w-4 h-4 text-indigo-600" />;
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time delivery status, call outcomes, and automated alert logs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchNotifications}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded-lg hover:bg-indigo-100 transition shadow-2xs"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200/60 pb-2 overflow-x-auto text-xs">
        {[
          { id: 'all', label: 'All', count: notifications.length },
          { id: 'unread', label: 'Unread', count: unreadCount },
          { id: 'publishing', label: 'Publishing', count: notifications.filter(n => n.category === 'publishing' || n.category === 'scheduler').length },
          { id: 'calling', label: 'AI Calling', count: notifications.filter(n => n.category === 'calling').length },
          { id: 'telegram', label: 'Telegram', count: notifications.filter(n => n.category === 'telegram').length },
          { id: 'system', label: 'System', count: notifications.filter(n => n.category === 'system' || n.category === 'general').length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeCategory === tab.id
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeCategory === tab.id ? 'bg-slate-700 text-slate-100' : 'bg-slate-200 text-slate-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          Loading notification logs...
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No notifications found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeCategory === 'unread' 
              ? 'You are all caught up! No unread notifications.' 
              : 'Notifications from publishing, voice agent calls, and system events will appear here.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-2xl divide-y divide-slate-100 shadow-2xs overflow-hidden">
          {filteredNotifications.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNotificationClick(item)}
              className={`p-4 flex items-start gap-3.5 transition cursor-pointer hover:bg-slate-50/80 ${
                item.is_read === 0 ? 'bg-indigo-50/20' : ''
              }`}
            >
              <div className="p-2 bg-slate-100 rounded-xl shrink-0 mt-0.5">
                {getCategoryIcon(item.category, item.level)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-xs ${item.is_read === 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                      {item.title}
                    </h4>
                    {item.is_read === 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0"></span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono shrink-0">
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {item.message}
                </p>

                <div className="flex items-center gap-3 mt-2.5 text-[11px]">
                  <span className="text-slate-400 capitalize">
                    {item.category}
                  </span>
                  {item.link_tab && (
                    <span className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1">
                      View in {item.link_tab} <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 self-center">
                <button
                  onClick={(e) => handleDelete(item.id, e)}
                  className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Delete notification"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
