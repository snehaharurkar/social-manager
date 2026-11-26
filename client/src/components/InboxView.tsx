import React, { useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  Filter, 
  RefreshCw
} from 'lucide-react';
import type { CommentItem } from '../types';
import { api } from '../api';

interface InboxViewProps {
  comments: CommentItem[];
  onRefresh: () => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  comments,
  onRefresh
}) => {
  const [filter, setFilter] = useState<'all' | 'unreplied' | 'replied'>('all');
  const [platform, setPlatform] = useState<string>('all');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await api.triggerSync();
      setTimeout(onRefresh, 1200);
    } finally {
      setTimeout(() => setSyncing(false), 800);
    }
  };

  const handleSendReply = async (commentId: string) => {
    if (!replyText.trim()) return;

    setSending(true);
    try {
      await api.replyToComment(commentId, replyText.trim());
      setActiveReplyId(null);
      setReplyText('');
      onRefresh();
    } catch (err: any) {
      alert(`Reply error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const filtered = comments.filter((c) => {
    const matchesPlatform = platform === 'all' || c.platform === platform;
    const matchesStatus = 
      filter === 'all' ? true :
      filter === 'unreplied' ? c.replied === 0 :
      c.replied === 1;
    return matchesPlatform && matchesStatus;
  });

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Comments & Inbox</h2>
          <p className="text-xs text-slate-500 mt-1">Unified live feed of comments from your YouTube videos and Instagram posts.</p>
        </div>
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
          <span>{syncing ? 'Syncing...' : 'Fetch Latest Comments'}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium">
          {(['all', 'unreplied', 'replied'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-lg capitalize transition-all ${
                filter === tab 
                  ? 'bg-white text-slate-800 font-semibold shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab === 'unreplied' ? 'Needs Reply' : tab}
            </button>
          ))}
        </div>

        {/* Platform Selector */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none"
          >
            <option value="all">All Platforms</option>
            <option value="youtube">YouTube Only</option>
            <option value="instagram">Instagram Only</option>
          </select>
        </div>
      </div>

      {/* Comments Feed */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center max-w-md mx-auto space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No comments found</h3>
          <p className="text-xs text-slate-500">
            {comments.length === 0 
              ? 'Connect a channel and click "Fetch Latest Comments" to pull in viewer comments.'
              : 'No comments match your current filter selection.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((item) => {
            const isYt = item.platform === 'youtube';
            const isReplying = activeReplyId === item.id;

            return (
              <div 
                key={item.id} 
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3 hover:border-slate-300 transition-all"
              >
                {/* Author & Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {item.author_avatar ? (
                      <img src={item.author_avatar} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-100" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                        {item.author_name ? item.author_name[0] : 'U'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">{item.author_name}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                          isYt ? 'bg-rose-100 text-rose-700' : 'bg-pink-100 text-pink-700'
                        }`}>
                          {item.platform}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(item.published_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>

                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    item.replied 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                      : 'bg-amber-50 text-amber-700 border border-amber-100'
                  }`}>
                    {item.replied ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Replied
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-amber-600" /> Needs Reply
                      </>
                    )}
                  </span>
                </div>

                {/* Comment Text */}
                <p className="text-xs text-slate-800 leading-relaxed font-sans pl-12 whitespace-pre-line">
                  {item.text}
                </p>

                {/* Delivered Reply Display */}
                {item.replied === 1 && item.reply_text && (
                  <div className="ml-12 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/80 text-xs text-slate-700 space-y-1">
                    <span className="font-semibold text-emerald-800 text-[10px] uppercase block">Sent Response:</span>
                    <p className="italic">"{item.reply_text}"</p>
                  </div>
                )}

                {/* Manual Reply Form */}
                {item.replied === 0 && (
                  <div className="pl-12 pt-1">
                    {!isReplying ? (
                      <button
                        onClick={() => {
                          setActiveReplyId(item.id);
                          setReplyText('');
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 py-1"
                      >
                        <Send className="w-3 h-3" /> Reply manually
                      </button>
                    ) : (
                      <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                        <textarea
                          rows={2}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Write a reply to @${item.author_name}...`}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveReplyId(null)}
                            className="px-3 py-1 text-xs text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={sending || !replyText.trim()}
                            onClick={() => handleSendReply(item.id)}
                            className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            {sending ? 'Sending...' : 'Send Reply'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
