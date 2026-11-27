import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import type { ActivityLog } from '../types';

interface ActivityLogViewProps {
  logs: ActivityLog[];
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({
  logs,
  onRefresh,
  onNavigate
}) => {
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.details.toLowerCase().includes(search.toLowerCase()) ||
                          log.event_type.toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || log.platform.toLowerCase() === platformFilter;
    const matchesStatus = statusFilter === 'all' || log.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesPlatform && matchesStatus;
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Operations Audit Log
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Complete chronological audit trail of all background jobs, published posts, AI replies, and lead interactions.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-xs self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Refresh Log</span>
        </button>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search events or descriptions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Platform Filter */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none shadow-2xs flex-1 sm:flex-initial"
          >
            <option value="all">All Platforms</option>
            <option value="youtube">YouTube</option>
            <option value="instagram">Instagram</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="telegram">Telegram</option>
            <option value="calling">Calling</option>
            <option value="crm">CRM</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none shadow-2xs flex-1 sm:flex-initial"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success Only</option>
            <option value="failed">Errors Only</option>
            <option value="skipped">Skipped Only</option>
          </select>
        </div>
      </div>

      {/* Events Table / Timeline List */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <History className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600">No audit records match your filters.</p>
            <p className="text-[11px]">System events will appear here as automations, posts, or calls execute.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => {
              const isSuccess = log.status === 'success';
              const isFailed = log.status === 'failed';

              return (
                <div key={log.id} className="p-4 hover:bg-slate-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isSuccess ? 'bg-emerald-50 text-emerald-600' :
                      isFailed ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {isSuccess ? <CheckCircle2 className="w-4 h-4" /> :
                       isFailed ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.platform === 'youtube' ? 'bg-rose-100 text-rose-800' :
                          log.platform === 'instagram' ? 'bg-pink-100 text-pink-800' :
                          log.platform === 'whatsapp' ? 'bg-emerald-100 text-emerald-800' :
                          log.platform === 'telegram' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {log.platform}
                        </span>
                        <span className="font-bold text-slate-800 capitalize">
                          {log.event_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className={`text-slate-600 font-sans leading-relaxed break-words ${isFailed ? 'text-rose-600 font-medium' : ''}`}>
                        {log.details}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 text-[11px] text-slate-400 pl-11 sm:pl-0">
                    <div>{new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    <div className="font-mono">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
