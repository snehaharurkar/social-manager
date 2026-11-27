import React, { useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  Filter, 
  RefreshCw, 
  Bot, 
  UserPlus, 
  Tag, 
  Sparkles, 
  ArrowLeft,
  ChevronRight,
  Search,
  Check,
  Loader2,
  LifeBuoy
} from 'lucide-react';
import type { CommentItem } from '../types';
import { api } from '../api';

interface InboxViewProps {
  comments: CommentItem[];
  onRefresh: () => void;
  onNavigate?: (tab: string) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  comments,
  onRefresh,
  onNavigate
}) => {
  const [filter, setFilter] = useState<'all' | 'unreplied' | 'replied'>('all');
  const [platform, setPlatform] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(comments.length > 0 ? comments[0].id : null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const selectedComment = comments.find(c => c.id === selectedCommentId) || (comments.length > 0 ? comments[0] : null);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await api.triggerSync();
      setTimeout(onRefresh, 1000);
    } finally {
      setTimeout(() => setSyncing(false), 800);
    }
  };

  const handleSendReply = async () => {
    if (!selectedComment || !replyText.trim()) return;

    setSending(true);
    try {
      await api.replyToComment(selectedComment.id, replyText.trim());
      setReplyText('');
      onRefresh();
    } catch (err: any) {
      alert(`Reply error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleGenerateAiReply = async () => {
    if (!selectedComment) return;

    setGeneratingAi(true);
    try {
      const res = await api.askCopilot(
        `Draft a polite, engaging, 1-2 sentence response to this comment from ${selectedComment.author_name}: "${selectedComment.text}". Mention music or acoustic guitar if relevant.`
      );
      setReplyText(res.reply.replace(/^["']|["']$/g, ''));
    } catch (err: any) {
      alert(`AI suggestion error: ${err.message}`);
    } finally {
      setGeneratingAi(false);
    }
  };

  const filtered = comments.filter((c) => {
    const matchesPlatform = platform === 'all' || c.platform === platform;
    const matchesStatus = 
      filter === 'all' ? true :
      filter === 'unreplied' ? c.replied === 0 :
      c.replied === 1;
    const matchesSearch = 
      c.author_name.toLowerCase().includes(search.toLowerCase()) ||
      c.text.toLowerCase().includes(search.toLowerCase());
    return matchesPlatform && matchesStatus && matchesSearch;
  });

  return (
    <div className="p-6 md:p-8 space-y-4 max-w-7xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            Unified Social Inbox
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
            {filtered.length} threads
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {(['all', 'unreplied', 'replied'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg capitalize transition ${
                  filter === tab ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab === 'unreplied' ? 'Needs Reply' : tab}
              </button>
            ))}
          </div>

          {/* Platform Selector */}
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="px-3 py-1 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none"
          >
            <option value="all">All Platforms</option>
            <option value="youtube">YouTube</option>
            <option value="instagram">Instagram</option>
            <option value="telegram">Telegram</option>
          </select>

          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="p-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 shadow-xs"
            title="Fetch latest comments"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3-Panel Main Inbox Workspace */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Panel 1: Thread List (4 Cols) */}
        <div className="md:col-span-4 bg-white border border-slate-200/90 rounded-2xl flex flex-col min-h-0 shadow-xs overflow-hidden">
          {/* Search Box */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search username or message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Thread Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                <MessageSquare className="w-6 h-6 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">No conversations found</p>
                <p className="text-[11px]">Sync channels or adjust your filter selection.</p>
              </div>
            ) : (
              filtered.map(c => {
                const isSelected = selectedComment?.id === c.id;
                const isUnreplied = c.replied === 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => { setSelectedCommentId(c.id); setReplyText(''); }}
                    className={`p-3.5 cursor-pointer transition flex items-start gap-3 ${
                      isSelected ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                      {c.author_name?.charAt(0) || 'U'}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs truncate">{c.author_name}</span>
                        <span className="text-[10px] text-slate-400">
                          {c.published_at ? new Date(c.published_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{c.text}</p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                          c.platform === 'youtube' ? 'bg-rose-100 text-rose-700' :
                          c.platform === 'instagram' ? 'bg-pink-100 text-pink-700' : 'bg-sky-100 text-sky-700'
                        }`}>
                          {c.platform}
                        </span>
                        {isUnreplied ? (
                          <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Unanswered
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Replied
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Panel 2: Selected Conversation Thread (5 Cols) */}
        <div className="md:col-span-5 bg-white border border-slate-200/90 rounded-2xl flex flex-col min-h-0 shadow-xs overflow-hidden">
          {selectedComment ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    {selectedComment.author_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-xs">{selectedComment.author_name}</h3>
                    <p className="text-[10px] text-slate-400">
                      Platform: <span className="font-semibold uppercase">{selectedComment.platform}</span> · {selectedComment.post_title || 'Post Comment'}
                    </p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedComment.replied === 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {selectedComment.replied === 0 ? 'Needs Reply' : 'Resolved'}
                </span>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Inbound Message Bubble */}
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                    {selectedComment.author_name.charAt(0)}
                  </div>
                  <div className="bg-slate-100 rounded-2xl rounded-tl-sm p-3.5 max-w-[85%] text-xs text-slate-800 leading-relaxed shadow-2xs">
                    <p className="font-semibold text-slate-600 text-[10px] mb-1">{selectedComment.author_name}</p>
                    <p>{selectedComment.text}</p>
                    <span className="text-[10px] text-slate-400 block text-right mt-1">
                      {selectedComment.published_at ? new Date(selectedComment.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </div>

                {/* Replied Message Bubble if already answered */}
                {selectedComment.replied === 1 && selectedComment.reply_text && (
                  <div className="flex items-start justify-end gap-2.5">
                    <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm p-3.5 max-w-[85%] text-xs leading-relaxed shadow-xs">
                      <p className="font-semibold text-indigo-200 text-[10px] mb-1">Your Reply</p>
                      <p>{selectedComment.reply_text}</p>
                      <span className="text-[10px] text-indigo-300 block text-right mt-1">Sent</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Reply Composer Box */}
              <div className="p-3.5 border-t border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-600">Draft Response</span>
                  <button
                    type="button"
                    onClick={handleGenerateAiReply}
                    disabled={generatingAi}
                    className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    {generatingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span>AI Suggest Reply</span>
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder={`Reply to ${selectedComment.author_name}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={sending || !replyText.trim()}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                  >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Approve & Send Reply</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Select a conversation to inspect and reply.
            </div>
          )}
        </div>

        {/* Panel 3: Context & CRM Lead Conversion (3 Cols) */}
        <div className="md:col-span-3 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-4 overflow-y-auto">
          {selectedComment ? (
            <>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Author Context</h4>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Name</span>
                    <span className="font-bold text-slate-800">{selectedComment.author_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Source Platform</span>
                    <span className="font-semibold uppercase text-slate-700">{selectedComment.platform}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Thread Post</span>
                    <span className="font-medium text-slate-600 truncate block">{selectedComment.post_title || 'Post / Reel'}</span>
                  </div>
                </div>
              </div>

              {/* Lead Conversion Action */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">CRM Conversion</h4>
                <p className="text-[11px] text-slate-500">Add this commenter directly to your Leads & CRM pipeline for follow-up.</p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.createIndividualLead({
                        name: selectedComment.author_name,
                        phone_number: '+91 98765 00000',
                        interest: selectedComment.post_title || 'Social Inquiry',
                        notes: `Converted from ${selectedComment.platform} comment: "${selectedComment.text}"`
                      });
                      alert(`Added ${selectedComment.author_name} to CRM pipeline!`);
                      if (onNavigate) onNavigate('crm');
                    } catch (e: any) {
                      alert(`Error creating lead: ${e.message}`);
                    }
                  }}
                  className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Convert to CRM Lead</span>
                </button>
              </div>

              {/* Human Escalation Notice */}
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <LifeBuoy className="w-3.5 h-3.5 text-amber-600" />
                  Human Help Escalation
                </div>
                <p className="text-[11px] text-amber-700">
                  If the inquiry is complex, refer the commenter to Sneha on WhatsApp at +91 98765 43210.
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400">No context available.</p>
          )}
        </div>
      </div>
    </div>
  );
};
