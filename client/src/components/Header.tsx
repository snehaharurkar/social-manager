import React, { useState } from 'react';
import { RefreshCw, Plus, CalendarPlus, Menu } from 'lucide-react';
import { api } from '../api';

interface HeaderProps {
  title: string;
  subtitle: string;
  onOpenNewRule?: () => void;
  onOpenNewPost?: () => void;
  onRefresh?: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onOpenNewRule,
  onOpenNewPost,
  onRefresh,
  onToggleMobileMenu
}) => {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.triggerSync();
      if (onRefresh) onRefresh();
    } finally {
      setTimeout(() => setSyncing(false), 800);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 md:px-8 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <h2 className="text-base md:text-lg font-semibold text-slate-800 tracking-tight">{title}</h2>
          <p className="text-[11px] md:text-xs text-slate-500 line-clamp-1">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 rounded-lg transition-all shadow-xs disabled:opacity-50"
          title="Manually trigger sync check"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
          <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>

        {onOpenNewRule && (
          <button
            onClick={onOpenNewRule}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>New Rule</span>
          </button>
        )}

        {onOpenNewPost && (
          <button
            onClick={onOpenNewPost}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-xs shadow-indigo-200"
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
