import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  PhoneCall, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  ExternalLink,
  Kanban,
  Table as TableIcon,
  RefreshCw,
  Sparkles,
  MessageCircle,
  Tag,
  Star,
  Globe,
  Radio,
  FileSpreadsheet,
  X,
  Check
} from 'lucide-react';
import type { CrmLead, CrmStats } from '../types';
import { api } from '../api';

interface CrmViewProps {
  onNavigate?: (tab: string) => void;
}

export const CrmView: React.FC<CrmViewProps> = ({ onNavigate }) => {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [stats, setStats] = useState<CrmStats | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // New Lead Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    phone_number: '',
    interest: 'Acoustic Guitar Lessons',
    notes: '',
    source: 'manual'
  });
  const [savingLead, setSavingLead] = useState(false);

  const fetchCrmData = async () => {
    setLoading(true);
    try {
      const [leadsRes, statsRes] = await Promise.all([
        api.getCrmLeads({
          platform: platformFilter,
          stage: stageFilter,
          search
        }),
        api.getCrmStats()
      ]);
      setLeads(leadsRes.leads || []);
      setStats(statsRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrmData();
  }, [platformFilter, stageFilter]);

  const handleStageChange = async (lead: CrmLead, newStage: string) => {
    try {
      await api.updateCrmLead(lead.platform, lead.id, { stage: newStage });
      fetchCrmData();
    } catch (err: any) {
      alert(`Failed to move lead: ${err.message}`);
    }
  };

  const handleDeleteLead = async (lead: CrmLead) => {
    if (confirm(`Remove lead "${lead.name}" from CRM?`)) {
      try {
        await api.deleteCrmLead(lead.platform, lead.id);
        fetchCrmData();
      } catch (err: any) {
        alert(`Failed to delete lead: ${err.message}`);
      }
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.name.trim() || !newLeadForm.phone_number.trim()) {
      alert('Name and contact number are required.');
      return;
    }

    setSavingLead(true);
    try {
      await api.createIndividualLead({
        name: newLeadForm.name.trim(),
        phone_number: newLeadForm.phone_number.trim(),
        interest: newLeadForm.interest.trim(),
        notes: `[Source: ${newLeadForm.source}] ${newLeadForm.notes.trim()}`
      });
      setModalOpen(false);
      setNewLeadForm({ name: '', phone_number: '', interest: 'Acoustic Guitar Lessons', notes: '', source: 'manual' });
      fetchCrmData();
    } catch (err: any) {
      alert(`Error saving lead: ${err.message}`);
    } finally {
      setSavingLead(false);
    }
  };

  const pipelineStages: Array<{ id: CrmLead['stage']; title: string; color: string }> = [
    { id: 'new', title: 'New Leads', color: 'border-t-blue-500' },
    { id: 'contacted', title: 'Contacted', color: 'border-t-amber-500' },
    { id: 'interested', title: 'Interested', color: 'border-t-purple-500' },
    { id: 'qualified', title: 'Qualified', color: 'border-t-indigo-500' },
    { id: 'converted', title: 'Converted Customer', color: 'border-t-emerald-500' },
    { id: 'lost', title: 'Lost / Closed', color: 'border-t-slate-400' }
  ];

  // Distinct Source Badge Component
  const getSourceBadge = (lead: CrmLead) => {
    const p = (lead.platform || '').toLowerCase();
    const src = (lead.source || '').toLowerCase();

    if (p === 'instagram' || src.includes('instagram')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-200">
          <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
          Instagram
        </span>
      );
    }
    if (p === 'whatsapp' || src.includes('whatsapp')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          WhatsApp
        </span>
      );
    }
    if (p === 'telegram' || src.includes('telegram')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          Telegram
        </span>
      );
    }
    if (p === 'youtube' || src.includes('youtube')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          YouTube
        </span>
      );
    }
    if (p === 'manual' || src.includes('manual')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          Manual Entry
        </span>
      );
    }
    if (p === 'website' || src.includes('website')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
          Website
        </span>
      );
    }
    // Default AI Calling
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
        AI Calling
      </span>
    );
  };

  const filteredLeads = leads.filter(l => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.identifier && l.identifier.toLowerCase().includes(q)) ||
      (l.source && l.source.toLowerCase().includes(q)) ||
      (l.platform && l.platform.toLowerCase().includes(q)) ||
      (l.notes && l.notes.toLowerCase().includes(q)) ||
      (l.interest && l.interest.toLowerCase().includes(q))
    );
  });

  const sourceCounts = stats?.byPlatform || {
    all: leads.length,
    calling: 0,
    whatsapp: 0,
    instagram: 0,
    telegram: 0,
    youtube: 0,
    manual: 0,
    website: 0
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Leads & CRM</h1>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Cross-Platform Pipeline
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Unified lead capture across Outbound AI Calling, Instagram DMs, WhatsApp inquiries, Telegram bots, and YouTube comments with distinct source tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                viewMode === 'kanban' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                viewMode === 'table' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          <a
            href={api.getCrmExportUrl()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-2xs"
            title="Download unified CSV of all cross-platform leads"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Source Breakdown Filter Pills (Requirement 2) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: 'All Sources', count: stats?.totalLeads || leads.length, color: 'text-slate-700' },
          { id: 'instagram', label: 'Instagram', count: sourceCounts.instagram || 0, color: 'text-pink-700' },
          { id: 'whatsapp', label: 'WhatsApp', count: sourceCounts.whatsapp || 0, color: 'text-emerald-700' },
          { id: 'telegram', label: 'Telegram', count: sourceCounts.telegram || 0, color: 'text-blue-700' },
          { id: 'youtube', label: 'YouTube', count: sourceCounts.youtube || 0, color: 'text-rose-700' },
          { id: 'calling', label: 'AI Calling', count: sourceCounts.calling || 0, color: 'text-sky-700' },
          { id: 'manual', label: 'Manual Entry', count: sourceCounts.manual || 0, color: 'text-amber-700' },
          { id: 'website', label: 'Website', count: sourceCounts.website || 0, color: 'text-purple-700' },
        ].map(pill => (
          <button
            key={pill.id}
            onClick={() => setPlatformFilter(pill.id)}
            className={`px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 whitespace-nowrap border ${
              platformFilter === pill.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{pill.label}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              platformFilter === pill.id ? 'bg-slate-700 text-slate-100' : 'bg-slate-100 text-slate-700'
            }`}>
              {pill.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search & Stage Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search leads by name, phone, notes, or source..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none shadow-2xs"
          >
            <option value="all">All Stages</option>
            <option value="new">New Leads</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Converted Customer</option>
            <option value="lost">Lost / Closed</option>
          </select>

          <button
            onClick={fetchCrmData}
            className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl shadow-2xs"
            title="Refresh leads"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KANBAN VIEW */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3.5 items-start">
          {pipelineStages.map(stage => {
            const stageLeads = filteredLeads.filter(l => l.stage === stage.id);

            return (
              <div 
                key={stage.id}
                className={`bg-slate-50/70 border border-slate-200/90 rounded-2xl p-3 space-y-3 min-h-[440px] border-t-4 ${stage.color}`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-1">
                  <h4 className="text-[11px] font-bold text-slate-800 tracking-tight">{stage.title}</h4>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="space-y-2.5">
                  {stageLeads.map(lead => (
                    <div 
                      key={lead.id}
                      className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-slate-300 transition"
                    >
                      <div className="flex items-center justify-between">
                        {/* Source/Platform Badge (Requirement 2) */}
                        {getSourceBadge(lead)}

                        <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 font-mono">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{lead.score}</span>
                        </div>
                      </div>

                      <div>
                        <h5 className="font-bold text-slate-900 text-xs truncate">{lead.name}</h5>
                        <p className="text-[10px] text-slate-500 font-mono truncate">{lead.identifier}</p>
                      </div>

                      {lead.interest && (
                        <p className="text-[10px] text-indigo-700 font-medium bg-indigo-50/70 px-2 py-0.5 rounded-lg truncate">
                          {lead.interest}
                        </p>
                      )}

                      {lead.notes && (
                        <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                          {lead.notes}
                        </p>
                      )}

                      {/* Quick Stage Mover Dropdown */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <select
                          value={lead.stage}
                          onChange={(e) => handleStageChange(lead, e.target.value)}
                          className="text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5 font-medium text-slate-700 focus:outline-none"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="interested">Interested</option>
                          <option value="qualified">Qualified</option>
                          <option value="converted">Converted</option>
                          <option value="lost">Lost</option>
                        </select>

                        <button
                          onClick={() => handleDeleteLead(lead)}
                          className="text-slate-400 hover:text-rose-600 p-0.5"
                          title="Delete lead"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {stageLeads.length === 0 && (
                    <div className="py-6 text-center text-[11px] text-slate-400">
                      Empty stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/75 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Lead / Contact</th>
                  <th className="px-4 py-3">Source Platform</th>
                  <th className="px-4 py-3">Pipeline Stage</th>
                  <th className="px-4 py-3">Interest / Topic</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{lead.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{lead.identifier}</div>
                    </td>

                    <td className="px-4 py-3">
                      {getSourceBadge(lead)}
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={lead.stage}
                        onChange={(e) => handleStageChange(lead, e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-800 focus:outline-none"
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="interested">Interested</option>
                        <option value="qualified">Qualified</option>
                        <option value="converted">Converted</option>
                        <option value="lost">Lost</option>
                      </select>
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-800 max-w-xs truncate">
                      {lead.interest || '—'}
                    </td>

                    <td className="px-4 py-3 font-mono font-bold text-amber-600">
                      {lead.score} / 100
                    </td>

                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {lead.notes || '—'}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteLead(lead)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Delete lead"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Showing {filteredLeads.length} leads</span>
            <span className="font-mono">Total CRM: {stats?.totalLeads || leads.length}</span>
          </div>
        </div>
      )}

      {/* ADD LEAD MODAL */}
      {modalOpen && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add New CRM Lead</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Vikram Sharma"
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone Number *</label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={newLeadForm.phone_number}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, phone_number: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lead Source Origin</label>
                <select
                  value={newLeadForm.source}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-medium"
                >
                  <option value="manual">Manual Entry</option>
                  <option value="instagram">Instagram Direct</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram Bot</option>
                  <option value="youtube">YouTube Comments</option>
                  <option value="calling">AI Voice Calling</option>
                  <option value="website">Website Inbound</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Interest / Inquiry Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Beginner Guitar Lessons or Brand Collaboration"
                  value={newLeadForm.interest}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, interest: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Initial notes, preferred contact time, etc."
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLead}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
