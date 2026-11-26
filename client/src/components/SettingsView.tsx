import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  Copy, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { api } from '../api';

export const SettingsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Settings State
  const [settings, setSettings] = useState<Record<string, string>>({
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    META_APP_ID: '',
    META_APP_SECRET: '',
    GEMINI_API_KEY: '',
    OPENAI_API_KEY: '',
    AI_BASE_URL: 'https://api.openai.com/v1',
    AI_MODEL: 'gpt-4o-mini'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings((prev) => ({ ...prev, ...data }));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await api.updateSettings(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      await loadSettings();
    } catch (err: any) {
      alert(`Error saving settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const ytRedirectUri = `${window.location.protocol}//${window.location.hostname}:5000/api/auth/youtube/callback`;
  const igRedirectUri = `${window.location.protocol}//${window.location.hostname}:5000/api/auth/instagram/callback`;

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-xs">Loading settings...</div>;
  }

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200/80">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">API Keys & Platform Configuration</h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure your Google, Meta, and AI keys. All keys are stored securely in your local SQLite database on your computer.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
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

          {/* Redirect URI copy box */}
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

          {/* Redirect URI copy box */}
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

        {/* Section 2.5: Uplika & MCP Instagram Connector */}
        <div className="bg-white border border-purple-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">Instagram via Uplika / MCP (No Meta Dev Setup)</h3>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Connect Instagram without creating a Facebook app. 1-click connect via uplika.com.</p>
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
                placeholder="https://api.uplika.com/mcp"
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
    </div>
  );
};
