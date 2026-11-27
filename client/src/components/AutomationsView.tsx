import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Plus, 
  Trash2, 
  Sparkles, 
  Search, 
  Play, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText,
  Filter,
  Check,
  Loader2,
  Copy
} from 'lucide-react';
import type { Rule, AutomationExecution, AutomationTemplate } from '../types';
import { api } from '../api';

interface AutomationsViewProps {
  rules: Rule[];
  onRefresh: () => void;
  showCreateModal?: boolean;
  onCloseCreateModal?: () => void;
}

export const AutomationsView: React.FC<AutomationsViewProps> = ({
  rules,
  onRefresh,
  showCreateModal = false,
  onCloseCreateModal
}) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'templates' | 'simulator' | 'history'>('rules');
  const [modalOpen, setModalOpen] = useState(showCreateModal);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');

  // Form State
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<'all' | 'youtube' | 'instagram' | 'telegram'>('all');
  const [triggerType, setTriggerType] = useState<'contains' | 'exact' | 'starts_with' | 'regex'>('contains');
  const [keywords, setKeywords] = useState('');
  const [replyTemplate, setReplyTemplate] = useState('');
  const [useAiPolish, setUseAiPolish] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(60);

  // Templates & Executions
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Simulator State
  const [simMessage, setSimMessage] = useState('');
  const [simPlatform, setSimPlatform] = useState('all');
  const [simResult, setSimResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);

  const isModalVisible = modalOpen || showCreateModal;

  const loadExtraData = async () => {
    setLoadingData(true);
    try {
      const [tmpl, execs] = await Promise.all([
        api.getAutomationTemplates().catch(() => []),
        api.getAutomationExecutions().catch(() => [])
      ]);
      setTemplates(tmpl);
      setExecutions(execs);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadExtraData();
  }, [activeTab]);

  const handleClose = () => {
    setModalOpen(false);
    if (onCloseCreateModal) onCloseCreateModal();
    setName('');
    setKeywords('');
    setReplyTemplate('');
    setUseAiPolish(false);
    setAiPrompt('');
  };

  const handleApplyTemplate = (tmpl: AutomationTemplate) => {
    setName(tmpl.name);
    setPlatform(tmpl.platform);
    setTriggerType(tmpl.trigger_type);
    setKeywords(tmpl.keywords);
    setReplyTemplate(tmpl.reply_template);
    setUseAiPolish(Boolean(tmpl.use_ai_polish));
    setAiPrompt(tmpl.ai_prompt);
    setModalOpen(true);
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !keywords.trim() || !replyTemplate.trim()) {
      alert('Please fill out Name, Keywords, and Reply Template.');
      return;
    }

    setSaving(true);
    try {
      await api.createRule({
        name: name.trim(),
        platform,
        trigger_type: triggerType,
        keywords: keywords.trim(),
        reply_template: replyTemplate.trim(),
        use_ai_polish: useAiPolish ? 1 : 0,
        ai_prompt: aiPrompt ? aiPrompt.trim() : undefined,
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

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simMessage.trim()) return;

    setSimulating(true);
    setSimResult(null);
    try {
      const res = await api.testAutomation({
        message: simMessage.trim(),
        platform: simPlatform
      });
      setSimResult(res);
      loadExtraData();
    } catch (err: any) {
      setSimResult({ success: false, message: err.message });
    } finally {
      setSimulating(false);
    }
  };

  const filteredRules = rules.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || 
                          r.keywords.toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || r.platform === platformFilter || r.platform === 'all';
    return matchesSearch && matchesPlatform;
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            AI Automation Engine & Rule Workflows
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Build keyword triggers, configure AI tone rephrasing, test with dry-run simulations, and monitor live executions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub-tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'rules' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Active Rules ({rules.length})
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'templates' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Templates
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'simulator' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Simulator Sandbox
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'history' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Execution Logs
            </button>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs shadow-indigo-200"
          >
            <Plus className="w-4 h-4" />
            <span>Create Rule</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ACTIVE RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rule title or keywords..."
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium self-stretch sm:self-auto">
              {['all', 'youtube', 'instagram', 'telegram'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={`px-3 py-1 rounded-lg capitalize transition ${
                    platformFilter === p ? 'bg-white text-slate-800 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Rules List */}
          {filteredRules.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center max-w-md mx-auto space-y-3">
              <Zap className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-800">No automation rules found</h3>
              <p className="text-xs text-slate-500">Create a rule or adopt an instant pre-built template.</p>
              <button
                onClick={() => setActiveTab('templates')}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition"
              >
                Browse Automation Templates
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRules.map(rule => (
                <div 
                  key={rule.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        rule.platform === 'youtube' ? 'bg-rose-100 text-rose-700' :
                        rule.platform === 'instagram' ? 'bg-pink-100 text-pink-700' :
                        rule.platform === 'telegram' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {rule.platform}
                      </span>

                      <button
                        onClick={() => handleToggle(rule)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition ${
                          rule.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {rule.is_active ? 'Active' : 'Paused'}
                      </button>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-800 text-sm truncate">{rule.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Trigger: <span className="font-semibold text-slate-600">{rule.trigger_type}</span> · {rule.match_count} triggers
                      </p>
                    </div>

                    {/* Keywords Chips */}
                    <div className="flex flex-wrap gap-1">
                      {rule.keywords.split(',').map((kw, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-mono text-slate-600">
                          {kw.trim()}
                        </span>
                      ))}
                    </div>

                    {/* Template Preview */}
                    <div className="p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      "{rule.reply_template}"
                    </div>

                    {rule.use_ai_polish === 1 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                        <Sparkles className="w-3 h-3 text-purple-600" /> AI Tone Polish
                      </span>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 font-mono">Cooldown: {rule.cooldown_seconds}s</span>
                    <button
                      onClick={() => handleDelete(rule.id, rule.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      title="Delete rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(tmpl => (
            <div key={tmpl.id} className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700">
                    Template
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">{tmpl.keywords.split(',').length} keywords</span>
                </div>
                <h4 className="font-bold text-slate-800 text-sm">{tmpl.name}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{tmpl.description}</p>
                <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-700 font-sans border border-slate-100">
                  "{tmpl.reply_template}"
                </div>
              </div>

              <button
                onClick={() => handleApplyTemplate(tmpl)}
                className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Use This Template</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: SIMULATOR SANDBOX */}
      {activeTab === 'simulator' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs max-w-2xl mx-auto space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Interactive Automation Test Sandbox
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Verify trigger detection, keyword condition matching, and AI tone formatting with 100% zero side-effects.
            </p>
          </div>

          <form onSubmit={handleRunSimulation} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Simulated Incoming Message</label>
              <textarea
                rows={3}
                placeholder="Enter sample comment or direct message..."
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <select
                value={simPlatform}
                onChange={(e) => setSimPlatform(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none"
              >
                <option value="all">Any Platform</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="telegram">Telegram</option>
              </select>

              <button
                type="submit"
                disabled={simulating || !simMessage.trim()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run Test Simulation
              </button>
            </div>
          </form>

          {simResult && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Simulation Trace</h4>
              {simResult.matched ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2 text-xs text-emerald-900">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Matched Rule: {simResult.rule?.name}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-mono">{simResult.executionTimeMs}ms</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-emerald-100 text-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Generated Output:</span>
                    "{simResult.finalReply}"
                  </div>
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Simulated Actions:</span>
                    <ul className="list-disc pl-4 text-[11px] text-emerald-700 space-y-0.5">
                      {simResult.actions?.map((act: string, idx: number) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>No rule matched this message. Adjust keywords or create a new trigger.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: EXECUTION HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Recent Automation Execution Logs</h3>
            <button
              onClick={async () => {
                await api.clearAutomationExecutions();
                loadExtraData();
              }}
              className="text-xs text-slate-400 hover:text-rose-600 font-semibold"
            >
              Clear Log History
            </button>
          </div>

          {executions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No executions logged yet. Rules log audit trails whenever a comment or message triggers them.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {executions.map(exec => (
                <div key={exec.id} className="p-3.5 hover:bg-slate-50 transition flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{exec.rule_name}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                        exec.status === 'success' ? 'bg-emerald-100 text-emerald-800' :
                        exec.status === 'simulated' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {exec.status}
                      </span>
                    </div>
                    <p className="text-slate-600 truncate">Input: "{exec.input_content}"</p>
                    {exec.output_content && (
                      <p className="text-[11px] text-slate-400 truncate">Output: "{exec.output_content}"</p>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-slate-400 shrink-0 font-mono">
                    {new Date(exec.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE RULE MODAL */}
      {isModalVisible && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Create Auto-Reply Rule</h3>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Guitar Lessons Inquiry Responder"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                  >
                    <option value="all">All Platforms</option>
                    <option value="youtube">YouTube</option>
                    <option value="instagram">Instagram</option>
                    <option value="telegram">Telegram</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Matching Condition</label>
                  <select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                  >
                    <option value="contains">Contains Keyword</option>
                    <option value="exact">Exact Match</option>
                    <option value="starts_with">Starts With</option>
                    <option value="regex">Regular Expression</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Trigger Keywords (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. price, guitar, fees, learn, syllabus"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Response Template (Supports &#123;name&#125;)</label>
                <textarea
                  rows={3}
                  placeholder="Hello {name}! Thank you for your inquiry..."
                  value={replyTemplate}
                  onChange={(e) => setReplyTemplate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={useAiPolish}
                    onChange={(e) => setUseAiPolish(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Enable AI Tone Polish (Varies replies naturally)</span>
                </label>
              </div>

              {useAiPolish && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">AI Prompt / Persona Instructions</label>
                  <input
                    type="text"
                    placeholder="e.g. Warm, cheerful, encouraging, 1-2 sentences"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Automation Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
