import React, { useState } from 'react';
import { 
  Zap, 
  Plus, 
  Trash2, 
  Sparkles, 
  Search,
  MessageSquare
} from 'lucide-react';
import type { Rule } from '../types';
import { api } from '../api';

interface RulesViewProps {
  rules: Rule[];
  onRefresh: () => void;
  showCreateModal?: boolean;
  onCloseCreateModal?: () => void;
}

export const RulesView: React.FC<RulesViewProps> = ({
  rules,
  onRefresh,
  showCreateModal = false,
  onCloseCreateModal
}) => {
  const [modalOpen, setModalOpen] = useState(showCreateModal);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');

  // New Rule Form State
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<'all' | 'youtube' | 'instagram'>('all');
  const [triggerType, setTriggerType] = useState<'contains' | 'exact' | 'starts_with' | 'regex'>('contains');
  const [keywords, setKeywords] = useState('');
  const [replyTemplate, setReplyTemplate] = useState('');
  const [useAiPolish, setUseAiPolish] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(60);

  const isModalVisible = modalOpen || showCreateModal;

  const handleClose = () => {
    setModalOpen(false);
    if (onCloseCreateModal) onCloseCreateModal();
    // Reset form
    setName('');
    setKeywords('');
    setReplyTemplate('');
    setUseAiPolish(false);
    setAiPrompt('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !keywords.trim() || !replyTemplate.trim()) {
      alert('Please fill out Name, Keywords, and Reply Template');
      return;
    }

    setSaving(true);
    try {
      await api.createRule({
        name,
        platform,
        trigger_type: triggerType,
        keywords,
        reply_template: replyTemplate,
        use_ai_polish: useAiPolish ? 1 : 0,
        ai_prompt: aiPrompt,
        cooldown_seconds: cooldownSeconds
      });
      handleClose();
      onRefresh();
    } catch (err: any) {
      alert(`Error creating rule: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: Rule) => {
    try {
      await api.updateRule(rule.id, { is_active: rule.is_active ? 0 : 1 });
      onRefresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id: number, ruleName: string) => {
    if (confirm(`Delete rule "${ruleName}"?`)) {
      try {
        await api.deleteRule(id);
        onRefresh();
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  const filteredRules = rules.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || 
                          r.keywords.toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || r.platform === platformFilter || r.platform === 'all';
    return matchesSearch && matchesPlatform;
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Auto-Reply Automation Rules</h2>
          <p className="text-xs text-slate-500 mt-1">Configure keyword triggers to automatically respond to comments across YouTube and Instagram.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs shadow-indigo-200"
        >
          <Plus className="w-4 h-4" />
          <span>Create Auto-Reply Rule</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules or keywords..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium self-stretch sm:self-auto">
          {['all', 'youtube', 'instagram'].map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`px-3 py-1 rounded-lg capitalize transition-all ${
                platformFilter === p 
                  ? 'bg-white text-slate-800 font-semibold shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Rules List */}
      {filteredRules.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No matching rules</h3>
          <p className="text-xs text-slate-500">
            Create your first auto-reply rule to trigger instant answers to common questions like links, pricing, or greetings.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Create Rule
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRules.map((rule) => {
            const keywordList = rule.keywords.split(',').map(k => k.trim()).filter(Boolean);

            return (
              <div 
                key={rule.id} 
                className={`bg-white border rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between ${
                  rule.is_active ? 'border-slate-200/90' : 'border-slate-200/50 opacity-75'
                }`}
              >
                <div>
                  {/* Top Bar: Name, Platform Badge, Toggle */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900 text-sm">{rule.name}</h4>
                        {rule.use_ai_polish === 1 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                            <Sparkles className="w-3 h-3 text-purple-600" /> AI Polish
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="uppercase font-semibold text-slate-600">{rule.platform}</span> · 
                        <span>Trigger: <strong>{rule.trigger_type}</strong></span> · 
                        <span>Delivered: <strong>{rule.match_count}</strong> times</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggle(rule)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        rule.is_active ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                      title={rule.is_active ? 'Disable rule' : 'Enable rule'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          rule.is_active ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Keywords Pills */}
                  <div className="flex flex-wrap gap-1.5 mb-3.5">
                    {keywordList.map((kw, i) => (
                      <span key={i} className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60">
                        {kw}
                      </span>
                    ))}
                  </div>

                  {/* Reply Message Box */}
                  <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed font-sans mb-3">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Reply Message
                    </div>
                    "{rule.reply_template}"
                  </div>

                  {rule.ai_prompt && (
                    <div className="text-[11px] text-purple-700 bg-purple-50/60 border border-purple-100 px-2.5 py-1 rounded-lg mb-3">
                      <span className="font-semibold">AI Instruction:</span> {rule.ai_prompt}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Cooldown: {rule.cooldown_seconds}s
                  </span>
                  <button
                    onClick={() => handleDelete(rule.id, rule.name)}
                    className="flex items-center gap-1 text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="Delete rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Rule Modal */}
      {isModalVisible && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">New Auto-Reply Rule</h3>
              </div>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Price & Website Link Responder"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Platform</label>
                  <select
                    value={platform}
                    onChange={(e: any) => setPlatform(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  >
                    <option value="all">All (YT + IG)</option>
                    <option value="youtube">YouTube Only</option>
                    <option value="instagram">Instagram Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Match Type</label>
                  <select
                    value={triggerType}
                    onChange={(e: any) => setTriggerType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  >
                    <option value="contains">Contains any</option>
                    <option value="exact">Exact match</option>
                    <option value="starts_with">Starts with</option>
                    <option value="regex">Regex</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cooldown (sec)</label>
                  <input
                    type="number"
                    min={0}
                    value={cooldownSeconds}
                    onChange={(e) => setCooldownSeconds(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trigger Keywords <span className="font-normal text-slate-400">(separated by commas)</span>
                </label>
                <input
                  type="text"
                  required
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="price, cost, link, how much, buy"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Reply Message</label>
                  <span className="text-[10px] text-slate-400">Use <code className="text-indigo-600 font-bold">&#123;name&#125;</code> for author's name</span>
                </div>
                <textarea
                  required
                  rows={3}
                  value={replyTemplate}
                  onChange={(e) => setReplyTemplate(e.target.value)}
                  placeholder="Hey {name}! Thanks for asking. You can check out all the pricing details here: https://example.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* AI Polish Option */}
              <div className="p-3.5 bg-gradient-to-r from-purple-50/70 to-indigo-50/50 border border-purple-100 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useAiPolish}
                    onChange={(e) => setUseAiPolish(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded-sm focus:ring-purple-500"
                  />
                  <span className="text-xs font-bold text-purple-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    Polish with AI (Gemini / OpenAI)
                  </span>
                </label>
                <p className="text-[11px] text-purple-800/80 leading-normal">
                  Intelligently rephrases each reply naturally in response to the specific comment, keeping your channel from sounding like a repetitive bot.
                </p>

                {useAiPolish && (
                  <div className="pt-2">
                    <label className="block text-[11px] font-semibold text-purple-900 mb-1">Custom Tone / Instruction (Optional)</label>
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g. Enthusiastic, grateful, under 15 words"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-purple-200 rounded-lg focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save & Activate Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
