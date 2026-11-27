import React, { useState, useEffect } from 'react';
import { 
  Key,
  Sparkles, 
  CheckCircle2, 
  Copy, 
  ExternalLink,
  ShieldCheck,
  BookOpen,
  Plus,
  Trash2,
  Tag,
  Server,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';
import type { BrandKnowledgeItem, BrandVoiceSettings } from '../types';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'keys' | 'voice' | 'knowledge'>('keys');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Settings State (API Keys)
  const [settings, setSettings] = useState<Record<string, string>>({
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    META_APP_ID: '',
    META_APP_SECRET: '',
    GEMINI_API_KEY: '',
    OPENAI_API_KEY: '',
    UPLIKA_API_KEY: '',
    UPLIKA_MCP_URL: 'https://api.uplika.com/mcp'
  });

  // Custom Backend URL State
  const [customBackendUrl, setCustomBackendUrl] = useState('');
  const [backendStatus, setBackendStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [backendStatusMsg, setBackendStatusMsg] = useState('');

  // Brand Voice State
  const [brandVoice, setBrandVoice] = useState<BrandVoiceSettings>({
    brandName: 'Sneharmony',
    brandDescription: 'Acoustic guitar learning academy, lifestyle covers, and creator music brand founded by Sneha.',
    brandTone: 'warm, encouraging, cheerful, patient, and artistic',
    restrictedTopics: 'politics, explicit content, unverified medical claims, financial guarantees',
    humanEscalationName: 'Sneha (Support Manager)',
    humanEscalationPhone: '+91 98765 43210',
    humanEscalationEmail: 'support@sneharmony.com'
  });
  const [savingVoice, setSavingVoice] = useState(false);
  const [voiceSavedSuccess, setVoiceSavedSuccess] = useState(false);

  // Knowledge Base State
  const [knowledgeItems, setKnowledgeItems] = useState<BrandKnowledgeItem[]>([]);
  const [knowledgeCategory, setKnowledgeCategory] = useState('all');
  const [addKnowledgeModalOpen, setAddKnowledgeModalOpen] = useState(false);
  const [newKnowledgeForm, setNewKnowledgeForm] = useState({
    title: '',
    category: 'faq',
    content: '',
    tags: ''
  });
  const [savingKnowledge, setSavingKnowledge] = useState(false);

  const loadAllSettings = async () => {
    try {
      setLoading(true);
      const [settingsData, knowledgeRes] = await Promise.all([
        api.getSettings().catch(() => ({})),
        api.getBrandKnowledge().catch(() => ({ items: [], brandVoice: null }))
      ]);

      setSettings(prev => ({ ...prev, ...settingsData }));
      if (knowledgeRes?.brandVoice) {
        setBrandVoice(knowledgeRes.brandVoice);
      }
      if (knowledgeRes?.items) {
        setKnowledgeItems(knowledgeRes.items);
      }

      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('custom_backend_url') || '';
        setCustomBackendUrl(stored);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllSettings();
  }, []);

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await api.updateSettings(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      await loadAllSettings();
    } catch (err: any) {
      alert(`Error saving settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVoice(true);
    setVoiceSavedSuccess(false);
    try {
      await api.saveBrandVoice(brandVoice);
      setVoiceSavedSuccess(true);
      setTimeout(() => setVoiceSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Error saving brand voice: ${err.message}`);
    } finally {
      setSavingVoice(false);
    }
  };

  const handleTestBackendConnection = async () => {
    setBackendStatus('checking');
    setBackendStatusMsg('Testing connection to backend...');
    try {
      const urlToTest = customBackendUrl.trim() || 'http://localhost:5000';
      const cleanUrl = urlToTest.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/settings/stats`);
      if (res.ok) {
        setBackendStatus('connected');
        setBackendStatusMsg(`Connected successfully! Server is healthy at ${cleanUrl}`);
      } else {
        setBackendStatus('error');
        setBackendStatusMsg(`Server responded with HTTP ${res.status}`);
      }
    } catch (err: any) {
      setBackendStatus('error');
      setBackendStatusMsg(`Connection failed: ${err.message}. Make sure server is running.`);
    }
  };

  const handleSaveBackendUrl = () => {
    if (customBackendUrl.trim()) {
      localStorage.setItem('custom_backend_url', customBackendUrl.trim());
      alert('Custom backend URL saved! The page will now reload to apply the endpoint.');
      window.location.reload();
    } else {
      localStorage.removeItem('custom_backend_url');
      alert('Reset to default backend routing. Page will reload.');
      window.location.reload();
    }
  };

  const handleAddKnowledgeItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKnowledgeForm.title.trim() || !newKnowledgeForm.content.trim()) {
      alert('Please enter both Title and Content');
      return;
    }
    setSavingKnowledge(true);
    try {
      await api.addBrandKnowledge({
        title: newKnowledgeForm.title.trim(),
        category: newKnowledgeForm.category,
        content: newKnowledgeForm.content.trim(),
        tags: newKnowledgeForm.tags.trim()
      });
      setAddKnowledgeModalOpen(false);
      setNewKnowledgeForm({ title: '', category: 'faq', content: '', tags: '' });
      const res = await api.getBrandKnowledge(knowledgeCategory);
      setKnowledgeItems(res.items || []);
    } catch (err: any) {
      alert(`Failed to add entry: ${err.message}`);
    } finally {
      setSavingKnowledge(false);
    }
  };

  const handleDeleteKnowledgeItem = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to remove "${title}"?`)) return;
    try {
      await api.deleteBrandKnowledge(id);
      setKnowledgeItems(prev => prev.filter(item => item.id !== id));
    } catch (err: any) {
      alert(`Error deleting item: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const ytRedirectUri = `${window.location.protocol}//${window.location.hostname}:5000/api/auth/youtube/callback`;
  const igRedirectUri = `${window.location.protocol}//${window.location.hostname}:5000/api/auth/instagram/callback`;

  const filteredKnowledge = knowledgeCategory === 'all' 
    ? knowledgeItems 
    : knowledgeItems.filter(item => item.category === knowledgeCategory);

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-xs">Loading settings & knowledge base...</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header & Section Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Settings & Brand Intelligence</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage your API credentials, define your AI persona and voice guidelines, and curate verified business FAQs.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('keys')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'keys'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            API Keys & Proxy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'voice'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Brand Voice & Persona
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('knowledge')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'knowledge'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Business Knowledge Base
          </button>
        </div>
      </div>

      {/* TAB 1: API KEYS & PROXY CONFIGURATION */}
      {activeTab === 'keys' && (
        <form onSubmit={handleSaveKeys} className="space-y-6">
          {/* Section 0: Remote Backend Proxy URL */}
          <div className="bg-white border border-sky-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Backend Server Connection</h3>
                  <p className="text-[11px] text-slate-400">
                    Connect Netlify frontend to your self-hosted backend or local instance.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTestBackendConnection}
                className="text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-200 flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${backendStatus === 'checking' ? 'animate-spin' : ''}`} />
                Test Connection
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Custom Backend Endpoint URL (e.g. Render / ngrok / Tunnel)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={customBackendUrl}
                  onChange={(e) => setCustomBackendUrl(e.target.value)}
                  placeholder="http://localhost:5000 or https://your-server.onrender.com"
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveBackendUrl}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-xs shrink-0"
                >
                  Save & Reload
                </button>
              </div>
              {backendStatusMsg && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  backendStatus === 'connected' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : backendStatus === 'checking'
                    ? 'bg-sky-50 text-sky-800 border border-sky-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {backendStatus === 'connected' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{backendStatusMsg}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 1: Google & YouTube */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
                  YT
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Google Cloud & YouTube Data API</h3>
                  <p className="text-[11px] text-slate-400">Enables connecting YouTube channels, polling comments, and replying.</p>
                </div>
              </div>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Google Cloud Console <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Google Client ID</label>
                <input
                  type="text"
                  value={settings.GOOGLE_CLIENT_ID || ''}
                  onChange={(e) => setSettings({ ...settings, GOOGLE_CLIENT_ID: e.target.value })}
                  placeholder="123456789-xxxx.apps.googleusercontent.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Google Client Secret</label>
                <input
                  type="password"
                  value={settings.GOOGLE_CLIENT_SECRET || ''}
                  onChange={(e) => setSettings({ ...settings, GOOGLE_CLIENT_SECRET: e.target.value })}
                  placeholder="GOCSPX-xxxxxxxxxxxx"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-[11px] font-semibold text-slate-700 block">Authorized redirect URI for Google Console:</span>
                <code className="text-slate-600 font-mono text-[11px] select-all">{ytRedirectUri}</code>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(ytRedirectUri, 'yt_uri')}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg shrink-0 flex items-center gap-1"
              >
                <Copy className="w-3 h-3 text-slate-400" />
                {copiedKey === 'yt_uri' ? 'Copied!' : 'Copy URI'}
              </button>
            </div>
          </div>

          {/* Section 2: Meta & Instagram */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center font-bold text-xs">
                  IG
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Meta App (Instagram Graph API)</h3>
                  <p className="text-[11px] text-slate-400">Enables connecting Instagram Professional/Creator accounts and photo publishing.</p>
                </div>
              </div>
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Meta App Dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Meta App ID</label>
                <input
                  type="text"
                  value={settings.META_APP_ID || ''}
                  onChange={(e) => setSettings({ ...settings, META_APP_ID: e.target.value })}
                  placeholder="e.g. 123456789012345"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Meta App Secret</label>
                <input
                  type="password"
                  value={settings.META_APP_SECRET || ''}
                  onChange={(e) => setSettings({ ...settings, META_APP_SECRET: e.target.value })}
                  placeholder="Paste App Secret"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-[11px] font-semibold text-slate-700 block">Valid OAuth Redirect URI for Meta App:</span>
                <code className="text-slate-600 font-mono text-[11px] select-all">{igRedirectUri}</code>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(igRedirectUri, 'ig_uri')}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg shrink-0 flex items-center gap-1"
              >
                <Copy className="w-3 h-3 text-slate-400" />
                {copiedKey === 'ig_uri' ? 'Copied!' : 'Copy URI'}
              </button>
            </div>
          </div>

          {/* Section 2.5: Uplika Instagram Connector */}
          <div className="bg-white border border-purple-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 text-sm">Instagram via Uplika / MCP</h3>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Direct Instagram connection without requiring Meta App review.</p>
                </div>
              </div>
              <a
                href="https://uplika.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                Uplika.com <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Uplika API Key / Token</label>
                <input
                  type="password"
                  value={settings.UPLIKA_API_KEY || ''}
                  onChange={(e) => setSettings({ ...settings, UPLIKA_API_KEY: e.target.value })}
                  placeholder="Paste your Uplika API key"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Uplika MCP URL</label>
                <input
                  type="text"
                  value={settings.UPLIKA_MCP_URL || 'https://api.uplika.com/mcp'}
                  onChange={(e) => setSettings({ ...settings, UPLIKA_MCP_URL: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: AI Rephrasing Keys (Gemini & OpenAI) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">AI Rephrasing Engine (Free BYOK)</h3>
                  <p className="text-[11px] text-slate-400">Makes auto-replies sound natural and authentic instead of robotic.</p>
                </div>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                Get Free Gemini Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Google Gemini API Key (Recommended - Free Tier)</label>
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">Generous Free Tier</span>
                </div>
                <input
                  type="password"
                  value={settings.GEMINI_API_KEY || ''}
                  onChange={(e) => setSettings({ ...settings, GEMINI_API_KEY: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Or OpenAI / Groq Compatible API Key (Optional)
                </label>
                <input
                  type="password"
                  value={settings.OPENAI_API_KEY || ''}
                  onChange={(e) => setSettings({ ...settings, OPENAI_API_KEY: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Encrypted & stored locally in SQLite</span>
            </div>

            <div className="flex items-center gap-3">
              {savedSuccess && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Settings Saved!
                </span>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs shadow-indigo-200 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: BRAND VOICE & PERSONA */}
      {activeTab === 'voice' && (
        <form onSubmit={handleSaveVoice} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Brand Voice, Tone & Persona Guidelines</h3>
                <p className="text-[11px] text-slate-500">
                  Defines the communication style used across AI auto-replies, Copilot responses, and Voice Agent scripts.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name / Creator Identity</label>
                <input
                  type="text"
                  value={brandVoice.brandName}
                  onChange={(e) => setBrandVoice({ ...brandVoice, brandName: e.target.value })}
                  placeholder="e.g. Sneharmony"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tone & Communication Style</label>
                <input
                  type="text"
                  value={brandVoice.brandTone}
                  onChange={(e) => setBrandVoice({ ...brandVoice, brandTone: e.target.value })}
                  placeholder="warm, encouraging, cheerful, patient, and artistic"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Description & Mission</label>
              <textarea
                value={brandVoice.brandDescription}
                onChange={(e) => setBrandVoice({ ...brandVoice, brandDescription: e.target.value })}
                rows={3}
                placeholder="Describe your academy, music brand, products, or creative mission..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Restricted Topics & Prohibited Claims (Safety Guardrails)
              </label>
              <textarea
                value={brandVoice.restrictedTopics}
                onChange={(e) => setBrandVoice({ ...brandVoice, restrictedTopics: e.target.value })}
                rows={2}
                placeholder="Comma separated topics the AI must never mention (e.g. politics, medical claims, unauthorized discounts)"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
            </div>

            {/* Human Escalation Contacts */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-800">Human Escalation & Support Hand-off Contacts</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={brandVoice.humanEscalationName}
                    onChange={(e) => setBrandVoice({ ...brandVoice, humanEscalationName: e.target.value })}
                    placeholder="Sneha (Support Manager)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Escalation WhatsApp/Phone</label>
                  <input
                    type="text"
                    value={brandVoice.humanEscalationPhone}
                    onChange={(e) => setBrandVoice({ ...brandVoice, humanEscalationPhone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Escalation Email</label>
                  <input
                    type="email"
                    value={brandVoice.humanEscalationEmail}
                    onChange={(e) => setBrandVoice({ ...brandVoice, humanEscalationEmail: e.target.value })}
                    placeholder="support@sneharmony.com"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Grounds AI prompt templates and eliminates robotic voice hallucination.
              </span>
              <div className="flex items-center gap-2">
                {voiceSavedSuccess && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Brand Voice Saved!
                  </span>
                )}
                <button
                  type="submit"
                  disabled={savingVoice}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {savingVoice ? 'Saving Voice...' : 'Save Brand Persona'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: BUSINESS KNOWLEDGE BASE */}
      {activeTab === 'knowledge' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {['all', 'faq', 'curriculum', 'policy', 'voice'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setKnowledgeCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize whitespace-nowrap transition ${
                    knowledgeCategory === cat
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat === 'all' ? 'All Knowledge' : cat}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setAddKnowledgeModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Knowledge Entry
            </button>
          </div>

          {/* Knowledge Cards Grid */}
          {filteredKnowledge.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">No knowledge entries found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Add business FAQs, pricing tables, refund policies, and course curriculums so the AI never invents facts.
              </p>
              <button
                type="button"
                onClick={() => setAddKnowledgeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add First Entry
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredKnowledge.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-indigo-200 transition space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        {item.category}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteKnowledgeItem(item.id, item.title)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                      {item.content}
                    </p>
                  </div>

                  {item.tags && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                      <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{item.tags}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD KNOWLEDGE BASE ENTRY */}
      {addKnowledgeModalOpen && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setAddKnowledgeModalOpen(false); }}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                Add Business Knowledge Entry
              </h3>
              <button
                onClick={() => setAddKnowledgeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddKnowledgeItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Title / Topic *</label>
                <input
                  type="text"
                  required
                  value={newKnowledgeForm.title}
                  onChange={(e) => setNewKnowledgeForm({ ...newKnowledgeForm, title: e.target.value })}
                  placeholder="e.g. Acoustic Guitar Beginners Fee Structure"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Knowledge Category</label>
                <select
                  value={newKnowledgeForm.category}
                  onChange={(e) => setNewKnowledgeForm({ ...newKnowledgeForm, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                >
                  <option value="faq">FAQ (Common Inquiries)</option>
                  <option value="curriculum">Curriculum / Syllabus</option>
                  <option value="policy">Policy (Refunds, Rescheduling, Equipment)</option>
                  <option value="voice">Brand Voice & Persona Example</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Verified Factual Content *</label>
                <textarea
                  required
                  rows={4}
                  value={newKnowledgeForm.content}
                  onChange={(e) => setNewKnowledgeForm({ ...newKnowledgeForm, content: e.target.value })}
                  placeholder="Enter exact pricing, dates, lesson topics, or answers. The AI will ground its replies on this exact text."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Search Keywords / Tags</label>
                <input
                  type="text"
                  value={newKnowledgeForm.tags}
                  onChange={(e) => setNewKnowledgeForm({ ...newKnowledgeForm, tags: e.target.value })}
                  placeholder="e.g. fees, guitar, monthly, beginners"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddKnowledgeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingKnowledge}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs disabled:opacity-50"
                >
                  {savingKnowledge ? 'Saving...' : 'Save Knowledge Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
