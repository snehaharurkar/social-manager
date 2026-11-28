import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  PhoneForwarded, 
  Upload, 
  Play, 
  Pause, 
  Square, 
  RotateCw, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Users, 
  Bot, 
  Calendar, 
  Download, 
  Trash2, 
  Edit3, 
  Eye, 
  EyeOff, 
  FileSpreadsheet, 
  Sparkles, 
  Loader2, 
  ShieldCheck, 
  X, 
  ChevronRight, 
  Check, 
  ExternalLink, 
  FileText, 
  Sliders,
  Settings as SettingsIcon,
  HelpCircle,
  TrendingUp,
  Volume2,
  Layers,
  Globe,
  Key
} from 'lucide-react';
import type { 
  CallingLead, 
  CallingCampaign, 
  CallingDiagnostics, 
  ParsedSheetPreview,
  ProviderStatusCard,
  CallingProviderId
} from '../types';
import { api } from '../api';

const DEFAULT_PROVIDERS: ProviderStatusCard[] = [
  {
    id: 'vapi',
    name: 'Vapi',
    isActive: true,
    isConfigured: true,
    missingFields: [],
    details: { apiKeyConfigured: true, agentConfigured: true, phoneConfigured: true },
    capabilities: { supportsRecordings: true, supportsTranscripts: true, supportsEndingCall: true, supportsDynamicPrompts: true, supportsWebhooks: true }
  },
  {
    id: 'retell',
    name: 'Retell AI',
    isActive: false,
    isConfigured: false,
    missingFields: ['RETELL_API_KEY', 'RETELL_AGENT_ID'],
    details: {},
    capabilities: { supportsRecordings: true, supportsTranscripts: true, supportsEndingCall: true, supportsDynamicPrompts: true, supportsWebhooks: true }
  },
  {
    id: 'omnidimension',
    name: 'OmniDimension',
    isActive: false,
    isConfigured: false,
    missingFields: ['OMNIDIMENSION_API_KEY', 'OMNIDIMENSION_AGENT_ID'],
    details: {},
    capabilities: { supportsRecordings: true, supportsTranscripts: true, supportsEndingCall: true, supportsDynamicPrompts: true, supportsWebhooks: true }
  }
];

export const CallingAgentView: React.FC = () => {
  // Navigation Tabs: Overview, Leads, Campaigns, Follow-ups, Call History, AI Caller Settings
  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'campaigns' | 'followups' | 'history' | 'settings'>('overview');

  // Stats & Diagnostics State
  const [stats, setStats] = useState<any>({
    totalLeads: 0,
    eligibleLeads: 0,
    pendingCalls: 0,
    inProgressCalls: 0,
    completedCalls: 0,
    interestedLeads: 0,
    failedCalls: 0,
    followUpsDue: 0,
    totalCampaigns: 0,
    totalCallLogs: 0
  });
  const [diagnostics, setDiagnostics] = useState<CallingDiagnostics | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);

  // Leads Tab State
  const [leads, setLeads] = useState<CallingLead[]>([]);
  const [leadCampaignFilter, setLeadCampaignFilter] = useState<string>('all');
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>('all');
  const [leadSearch, setLeadSearch] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [selectedLeadForDetails, setSelectedLeadForDetails] = useState<CallingLead | null>(null);
  const [leadCallHistory, setLeadCallHistory] = useState<any[]>([]);

  // Campaigns Tab State
  const [campaigns, setCampaigns] = useState<CallingCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Follow-ups Tab State
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);

  // Call History Tab State
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historyProviderFilter, setHistoryProviderFilter] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedCallDetails, setSelectedCallDetails] = useState<any | null>(null);

  // Multi-Provider Calling State (Vapi, Retell AI, OmniDimension)
  const [providers, setProviders] = useState<ProviderStatusCard[]>(DEFAULT_PROVIDERS);
  const [activeProviderId, setActiveProviderId] = useState<CallingProviderId>('vapi');
  const [selectedConfigProviderTab, setSelectedConfigProviderTab] = useState<'vapi' | 'retell' | 'omnidimension'>('vapi');
  const [showProviderKey, setShowProviderKey] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [providerTestResult, setProviderTestResult] = useState<{ [id: string]: { success: boolean; message: string } }>({});
  const [editingProvider, setEditingProvider] = useState<ProviderStatusCard | null>(null);
  const [providerConfigForm, setProviderConfigForm] = useState<any>({});
  const [callProvider, setCallProvider] = useState<CallingProviderId>('vapi');
  const [newCampaignProvider, setNewCampaignProvider] = useState<CallingProviderId>('vapi');

  // Settings Tab State
  const [settings, setSettings] = useState<any>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [dncList, setDncList] = useState<any[]>([]);
  const [newDncNumber, setNewDncNumber] = useState('');
  const [newDncReason, setNewDncReason] = useState('');

  // Individual Call Modal State
  const [callModalLead, setCallModalLead] = useState<CallingLead | null>(null);
  const [callOpeningMessage, setCallOpeningMessage] = useState('');
  const [callingInProgress, setCallingInProgress] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [activeCallStatus, setActiveCallStatus] = useState<string>('initiating');
  const [activeCallDuration, setActiveCallDuration] = useState(0);
  const [activeCallError, setActiveCallError] = useState<string | null>(null);
  const durationTimerRef = useRef<any>(null);

  // Spreadsheet Upload & Import Wizard Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<'upload' | 'mapping' | 'confirm'>('upload');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<any | null>(null);
  const [customMapping, setCustomMapping] = useState<any>({});
  const [newCampaignTitle, setNewCampaignTitle] = useState('');
  const [newCampaignDelay, setNewCampaignDelay] = useState(8);
  const [importingLeads, setImportingLeads] = useState(false);

  // Manual Add Lead Modal State
  const [addLeadModalOpen, setAddLeadModalOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadCompany, setNewLeadCompany] = useState('');
  const [newLeadInterest, setNewLeadInterest] = useState('');
  const [newLeadNotes, setNewLeadNotes] = useState('');
  const [newLeadCampaignId, setNewLeadCampaignId] = useState<string>('');

  // Initial Data Fetch
  useEffect(() => {
    fetchStats();
    fetchDiagnostics();
    fetchProviders();
  }, []);

  // Tab change fetcher
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchStats();
      fetchDiagnostics();
      fetchProviders();
    } else if (activeTab === 'leads') {
      fetchLeads();
      fetchCampaigns();
    } else if (activeTab === 'campaigns') {
      fetchCampaigns();
    } else if (activeTab === 'followups') {
      fetchFollowUps();
    } else if (activeTab === 'history') {
      fetchCallHistory();
    } else if (activeTab === 'settings') {
      fetchSettings();
      fetchProviders();
      fetchDncList();
    }
  }, [activeTab, leadCampaignFilter, leadStatusFilter, leadSearch, historyStatusFilter, historyProviderFilter, historySearch]);

  // Live Call Duration Timer
  useEffect(() => {
    if (activeCallId && (activeCallStatus === 'calling' || activeCallStatus === 'in-progress')) {
      durationTimerRef.current = setInterval(() => {
        setActiveCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [activeCallId, activeCallStatus]);

  // Sync active call status polling
  useEffect(() => {
    let pollInterval: any = null;
    if (activeCallId && activeCallStatus !== 'completed' && activeCallStatus !== 'failed') {
      pollInterval = setInterval(async () => {
        try {
          const sync = await api.syncCallStatus(activeCallId);
          if (sync) {
            setActiveCallStatus(sync.status);
            if (sync.status === 'ended') {
              if (sync.endedReason?.includes('error')) {
                setActiveCallError(sync.outcomeText || sync.endedReason);
                setActiveCallStatus('failed');
              } else {
                setActiveCallStatus('completed');
              }
              fetchStats();
            }
          }
        } catch (e) {
          // Silent polling fail
        }
      }, 3000);
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activeCallId, activeCallStatus]);

  // ----------------------------------------------------
  // API Fetch Helpers
  // ----------------------------------------------------
  const fetchStats = async () => {
    try {
      const data = await api.getCallingStats();
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  };

  const fetchDiagnostics = async () => {
    setLoadingDiag(true);
    try {
      const diag = await api.getCallingDiagnostics();
      setDiagnostics(diag);
    } catch (e) {
      console.error('Failed to fetch diagnostics:', e);
    } finally {
      setLoadingDiag(false);
    }
  };

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const params = new URLSearchParams();
      if (leadCampaignFilter !== 'all') params.append('campaignId', leadCampaignFilter);
      if (leadStatusFilter !== 'all') params.append('status', leadStatusFilter);
      if (leadSearch.trim()) params.append('search', leadSearch.trim());

      const res = await fetch(`/api/calling/leads?${params.toString()}`);
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (e) {
      console.error('Failed to fetch leads:', e);
    } finally {
      setLoadingLeads(false);
    }
  };

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch('/api/calling/campaigns');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (e) {
      console.error('Failed to fetch campaigns:', e);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const fetchFollowUps = async () => {
    setLoadingFollowUps(true);
    try {
      const res = await fetch('/api/calling/follow-ups');
      const data = await res.json();
      setFollowUps(data.followUps || []);
    } catch (e) {
      console.error('Failed to fetch follow-ups:', e);
    } finally {
      setLoadingFollowUps(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const data = await api.getCallingProviders();
      if (data && data.providers && data.providers.length > 0) {
        setProviders(data.providers);
      }
      if (data && data.activeProvider) {
        setActiveProviderId(data.activeProvider);
        if (!callProvider) setCallProvider(data.activeProvider);
        if (!newCampaignProvider) setNewCampaignProvider(data.activeProvider);
      }
    } catch (e) {
      console.error('Failed to fetch providers:', e);
    }
  };

  const handleSetActiveProvider = async (providerId: CallingProviderId) => {
    try {
      await api.setActiveCallingProvider(providerId);
      setActiveProviderId(providerId);
      setCallProvider(providerId);
      await fetchProviders();
      setSettingsMsg(`Switched active calling provider to ${providerId.toUpperCase()}`);
      setTimeout(() => setSettingsMsg(null), 4000);
    } catch (err: any) {
      alert(`Failed to set active provider: ${err.message}`);
    }
  };

  const handleTestProvider = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      const res = await api.testCallingProvider(providerId);
      setProviderTestResult(prev => ({ ...prev, [providerId]: res }));
    } catch (err: any) {
      setProviderTestResult(prev => ({
        ...prev,
        [providerId]: { success: false, message: err.message }
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleOpenConfigModal = (provider: ProviderStatusCard) => {
    setSelectedConfigProviderTab(provider.id);
    setEditingProvider(provider);
    if (provider.id === 'vapi') {
      setProviderConfigForm({
        apiKey: settings.VAPI_API_KEY || '',
        assistantId: settings.VAPI_ASSISTANT_ID || '',
        phoneNumberId: settings.VAPI_PHONE_NUMBER_ID || ''
      });
    } else if (provider.id === 'retell') {
      setProviderConfigForm({
        apiKey: settings.RETELL_API_KEY || '',
        agentId: settings.RETELL_AGENT_ID || '',
        phoneNumber: settings.RETELL_PHONE_NUMBER || ''
      });
    } else if (provider.id === 'omnidimension') {
      setProviderConfigForm({
        apiKey: settings.OMNIDIMENSION_API_KEY || '',
        agentId: settings.OMNIDIMENSION_AGENT_ID || '',
        phoneNumber: settings.OMNIDIMENSION_PHONE_NUMBER || '',
        baseUrl: settings.OMNIDIMENSION_BASE_URL || 'https://omnidim.io/api/v1'
      });
    }
  };

  const handleSaveProviderConfig = async () => {
    if (!editingProvider) return;
    try {
      await api.saveProviderConfig(editingProvider.id, providerConfigForm);
      setEditingProvider(null);
      await fetchProviders();
      await fetchSettings();
      setSettingsMsg(`Successfully saved credentials for ${editingProvider.name}`);
      setTimeout(() => setSettingsMsg(null), 4000);
    } catch (err: any) {
      alert(`Failed to save provider config: ${err.message}`);
    }
  };

  const fetchCallHistory = async () => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (historyStatusFilter !== 'all') params.append('status', historyStatusFilter);
      if (historyProviderFilter !== 'all') params.append('provider', historyProviderFilter);
      if (historySearch.trim()) params.append('search', historySearch.trim());

      const res = await fetch(`/api/calling/history?${params.toString()}`);
      const data = await res.json();
      setCallHistory(data.logs || []);
    } catch (e) {
      console.error('Failed to fetch history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const s = await api.getCallingSettings();
      setSettings(s || {});
    } catch (e) {
      console.error('Failed to fetch settings:', e);
    }
  };

  const fetchDncList = async () => {
    try {
      const list = await api.getDncList();
      setDncList(list || []);
    } catch (e) {
      console.error('Failed to fetch DNC:', e);
    }
  };

  // ----------------------------------------------------
  // Action Handlers
  // ----------------------------------------------------
  const handleOpenCallModal = (lead: CallingLead) => {
    setCallModalLead(lead);
    setCallProvider(lead.provider || activeProviderId);
    const company = settings.CALLING_COMPANY_NAME || 'Sneharmony';
    const agent = settings.CALLING_AGENT_NAME || 'Aria';
    setCallOpeningMessage(`Hello ${lead.name}! This is ${agent} calling on behalf of ${company}. I noticed you were interested in our acoustic guitar lessons. Is now a good time for a quick 2-minute conversation?`);
    setActiveCallId(null);
    setActiveCallStatus('initiating');
    setActiveCallDuration(0);
    setActiveCallError(null);
  };

  const handleStartCall = async () => {
    if (!callModalLead) return;
    setCallingInProgress(true);
    setActiveCallError(null);
    try {
      const res = await fetch(`/api/calling/leads/${callModalLead.id}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider: callProvider,
          customOpeningMessage: callOpeningMessage 
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to dispatch call');
      }

      setActiveCallId(data.call.callId);
      setActiveCallStatus('calling');
      fetchStats();
      fetchLeads();
    } catch (err: any) {
      setActiveCallError(err.message);
      setActiveCallStatus('failed');
    } finally {
      setCallingInProgress(false);
    }
  };

  const handleEndCall = async () => {
    if (!activeCallId) return;
    try {
      await api.endActiveCall(activeCallId);
      setActiveCallStatus('completed');
      fetchStats();
      fetchLeads();
    } catch (err: any) {
      alert(`Error ending call: ${err.message}`);
    }
  };

  const handleOpenLeadDetails = async (lead: CallingLead) => {
    setSelectedLeadForDetails(lead);
    try {
      const res = await fetch(`/api/calling/leads/${lead.id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedLeadForDetails(data.lead);
        setLeadCallHistory(data.callHistory || []);
      }
    } catch (e) {
      // Non-blocking
    }
  };

  const handleMarkDnc = async (leadId: number) => {
    if (confirm('Are you sure you want to add this number to the Do Not Contact (DNC) list? All future automated calls will be suppressed.')) {
      try {
        await api.markLeadDnc(leadId);
        fetchLeads();
        fetchStats();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleRetryLead = async (leadId: number) => {
    try {
      await api.retryCallingLead(leadId);
      alert('Call dispatched successfully.');
      fetchLeads();
      fetchStats();
    } catch (err: any) {
      alert(`Retry error: ${err.message}`);
    }
  };

  const handleStartCampaign = async (campaignId: number) => {
    try {
      await api.startCallingCampaign(campaignId);
      fetchCampaigns();
      fetchStats();
    } catch (err: any) {
      alert(`Error starting campaign: ${err.message}`);
    }
  };

  const handlePauseCampaign = async (campaignId: number) => {
    try {
      await api.pauseCallingCampaign(campaignId);
      fetchCampaigns();
    } catch (err: any) {
      alert(`Error pausing campaign: ${err.message}`);
    }
  };

  const handleStopCampaign = async (campaignId: number) => {
    if (confirm('Stop automated calling for this campaign?')) {
      try {
        await api.stopCallingCampaign(campaignId);
        fetchCampaigns();
      } catch (err: any) {
        alert(`Error stopping campaign: ${err.message}`);
      }
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      await api.saveCallingSettings(settings);
      setSettingsMsg('Configuration saved successfully!');
      fetchDiagnostics();
      setTimeout(() => setSettingsMsg(null), 3000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('sheet', file);

    try {
      const res = await fetch('/api/calling/upload-sheet', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');

      setParsedPreview(data);
      setCustomMapping(data.suggestedMapping || {});
      setNewCampaignTitle(data.fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') + ' Campaign');
      setUploadStep('mapping');
    } catch (err: any) {
      alert(`Failed to parse spreadsheet: ${err.message}`);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedPreview) return;
    setImportingLeads(true);
    try {
      await api.confirmSpreadsheetImport({
        campaignTitle: newCampaignTitle || 'Outbound Calling Campaign',
        fileName: parsedPreview.fileName,
        leads: parsedPreview.parsedRows || [],
        delaySeconds: Number(newCampaignDelay) || 8,
        assistantId: settings.VAPI_ASSISTANT_ID,
        provider: newCampaignProvider
      });

      setUploadModalOpen(false);
      setParsedPreview(null);
      setUploadStep('upload');
      fetchCampaigns();
      fetchLeads();
      fetchStats();
      setActiveTab('campaigns');
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setImportingLeads(false);
    }
  };

  const handleAddManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadPhone.trim()) {
      alert('Phone number is required.');
      return;
    }

    try {
      await api.addCallingLead({
        name: newLeadName.trim() || 'Unnamed Contact',
        phone_number: newLeadPhone.trim(),
        email: newLeadEmail.trim() || undefined,
        company: newLeadCompany.trim() || undefined,
        interest: newLeadInterest.trim() || undefined,
        notes: newLeadNotes.trim() || undefined,
        campaign_id: newLeadCampaignId ? Number(newLeadCampaignId) : undefined
      });

      setAddLeadModalOpen(false);
      setNewLeadName('');
      setNewLeadPhone('');
      setNewLeadEmail('');
      setNewLeadCompany('');
      setNewLeadInterest('');
      setNewLeadNotes('');
      fetchLeads();
      fetchStats();
    } catch (err: any) {
      alert(`Failed to create lead: ${err.message}`);
    }
  };

  const handleAddDnc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDncNumber.trim()) return;
    try {
      await api.addToDnc(newDncNumber.trim(), newDncReason.trim());
      setNewDncNumber('');
      setNewDncReason('');
      fetchDncList();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemoveDnc = async (id: number) => {
    try {
      await api.removeFromDnc(id);
      fetchDncList();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* SaaS Telecaller Operations Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Bot className="w-3.5 h-3.5 text-indigo-400" /> Outbound AI Telecaller & CRM
            </span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {diagnostics?.apiKeyValid ? 'Vapi Live Telephony Ready' : 'Configuration Required'}
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">AI Outbound Telecalling Operations</h2>
          <p className="text-xs text-slate-400 max-w-xl">
            Conduct human-like outbound sales and qualification calls, track outcomes, schedule follow-ups, and automate lead pipelines.
          </p>
        </div>

        {/* Global Quick Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setAddLeadModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition shadow-xs"
          >
            <PhoneCall className="w-3.5 h-3.5 text-slate-300" />
            <span>Add Lead</span>
          </button>

          <button
            onClick={() => {
              setUploadStep('upload');
              setParsedPreview(null);
              setUploadModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-xs shadow-indigo-500/30"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Import Leads (Excel/CSV)</span>
          </button>
        </div>
      </div>

      {/* 6 Top Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200/90 overflow-x-auto pb-px">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'leads', label: `Leads (${stats.totalLeads})`, icon: Users },
          { id: 'campaigns', label: `Campaigns (${stats.totalCampaigns})`, icon: Calendar },
          { id: 'followups', label: `Follow-ups (${stats.followUpsDue})`, icon: Clock },
          { id: 'history', label: `Call History (${stats.totalCallLogs})`, icon: FileText },
          { id: 'settings', label: 'AI Caller Settings', icon: SettingsIcon },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                isActive 
                  ? 'text-indigo-600 border-indigo-600 bg-indigo-50/40' 
                  : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW DASHBOARD */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary KPI Cards Grid (Real DB numbers only) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Leads</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{stats.totalLeads}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">{stats.eligibleLeads} callable leads</p>
            </div>

            <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Calls Queued</span>
              <div className="text-2xl font-bold text-amber-600 mt-1">{stats.pendingCalls}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Awaiting outbound dial</p>
            </div>

            <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Calls Completed</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{stats.completedCalls}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">{stats.totalCallLogs} logged interactions</p>
            </div>

            <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Interested Leads</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.interestedLeads}</div>
              <p className="text-[11px] text-emerald-600 mt-0.5">Qualified & ready to enroll</p>
            </div>
          </div>

          {/* Telephony & Vapi Diagnostics Banner (Highlights real caller health & phone restrictions) */}
          <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Telephony Engine Diagnostics</h3>
                  <p className="text-xs text-slate-500">Real-time status of Vapi API, active assistant, and outbound phone number.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchDiagnostics}
                  disabled={loadingDiag}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${loadingDiag ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
                  <span>Refresh Health</span>
                </button>

                <button
                  onClick={async () => {
                    await api.autoConfigureCalling();
                    fetchDiagnostics();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-2xs"
                >
                  Auto-Link Assistant
                </button>
              </div>
            </div>

            {/* Diagnostics Component Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Vapi API Key */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600">Vapi API Key</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    diagnostics?.apiKeyValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {diagnostics?.apiKeyValid ? 'Active & Valid' : 'Invalid / Missing'}
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-700 truncate">{diagnostics?.apiKeyMasked || 'None configured'}</p>
              </div>

              {/* Active Assistant */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600">Selected Assistant</span>
                  <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">
                    {diagnostics?.selectedAssistant?.model || 'gpt-4'}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {diagnostics?.selectedAssistant?.name || 'No assistant selected'}
                </p>
              </div>

              {/* Outbound Phone */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600">Calling Number</span>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full uppercase">
                    Provider: {diagnostics?.selectedPhoneNumber?.provider || 'none'}
                  </span>
                </div>
                <p className="text-xs font-mono font-bold text-slate-800">
                  {diagnostics?.selectedPhoneNumber?.number || 'No number linked'}
                </p>
              </div>
            </div>

            {/* Outbound Capability Warning (Crucial discovery explaining failed calls to India) */}
            {diagnostics?.outboundCapability && !diagnostics.outboundCapability.canCallIndia && (
              <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-2 text-xs text-amber-900">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Outbound Telephony Restriction: International Dialing (+91)</span>
                </div>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  {diagnostics.outboundCapability.reason}
                </p>
                <div className="p-2.5 bg-white/80 rounded-lg border border-amber-100 text-[11px] text-slate-700 space-y-1">
                  <p className="font-semibold text-slate-800">How to call Indian (+91) numbers successfully:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Link your <strong>Twilio account</strong> in Vapi (Vapi Dashboard → Phone Numbers → Import Twilio) with international voice enabled.</li>
                    <li>Or add your Twilio Account SID & Auth Token directly in the <strong>AI Caller Settings</strong> tab.</li>
                    <li>For immediate testing with the current Vapi number ({diagnostics.selectedPhoneNumber?.number}), test calls will connect to any US or Canadian (+1) number.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Live Call Widget if Active */}
          {activeCallId && (
            <div className="p-5 bg-gradient-to-r from-indigo-900 to-indigo-950 text-white rounded-2xl shadow-md border border-indigo-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-800 flex items-center justify-center animate-pulse">
                  <PhoneCall className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-white">{callModalLead?.name || 'Live Lead'}</h4>
                    <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      {activeCallStatus}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200 font-mono mt-0.5">{callModalLead?.phone_number}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-indigo-300 font-medium">Duration</div>
                  <div className="text-base font-bold font-mono text-emerald-400">
                    {Math.floor(activeCallDuration / 60)}:{(activeCallDuration % 60).toString().padStart(2, '0')}
                  </div>
                </div>

                <button
                  onClick={handleEndCall}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>End Call</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LEADS (TABLE WITH FUNCTIONAL CALL BUTTON ON EVERY ROW) */}
      {/* ========================================================================= */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          {/* Filters & Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200/90 rounded-2xl shadow-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, phone, notes..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              {/* Campaign Filter */}
              <select
                value={leadCampaignFilter}
                onChange={(e) => setLeadCampaignFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
              >
                <option value="all">All Campaigns</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={leadStatusFilter}
                onChange={(e) => setLeadStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
              >
                <option value="all">All Call Statuses</option>
                <option value="pending">Pending Calls</option>
                <option value="calling">Calling / In-Progress</option>
                <option value="interested">Interested</option>
                <option value="needs_follow_up">Callback Requested</option>
                <option value="completed">Completed</option>
                <option value="busy">Busy / Unreachable</option>
                <option value="not_interested">Not Interested</option>
                <option value="failed">Failed</option>
                <option value="dnc">Do Not Contact (DNC)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddLeadModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs flex items-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Add Lead</span>
              </button>
            </div>
          </div>

          {/* Leads Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <th className="py-3 px-4">Lead Name</th>
                    <th className="py-3 px-3">Phone Number</th>
                    <th className="py-3 px-3">Campaign</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Last Outcome</th>
                    <th className="py-3 px-3">Callback Due</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        {loadingLeads ? 'Loading leads...' : 'No leads matching the selected filter.'}
                      </td>
                    </tr>
                  ) : (
                    leads.map(lead => {
                      const isDnc = lead.do_not_contact === 1 || lead.call_status === 'dnc';
                      return (
                        <tr key={lead.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800">{lead.name}</div>
                            {lead.company && <div className="text-[10px] text-slate-400">{lead.company}</div>}
                          </td>

                          <td className="py-3 px-3 font-mono font-medium text-slate-700">
                            {lead.phone_number}
                          </td>

                          <td className="py-3 px-3 text-slate-500 truncate max-w-[140px]">
                            <div className="truncate">{lead.campaign_title || 'Direct Lead'}</div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                              {lead.provider || 'vapi'}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              lead.call_status === 'interested' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              lead.call_status === 'calling' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                              lead.call_status === 'needs_follow_up' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                              lead.call_status === 'not_interested' || lead.call_status === 'dnc' ? 'bg-slate-100 text-slate-600' :
                              lead.call_status === 'failed' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-indigo-50 text-indigo-700'
                            }`}>
                              {lead.call_status.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-slate-600 truncate max-w-[180px]" title={lead.last_call_outcome || ''}>
                            {lead.last_call_outcome || (lead.call_duration ? `${lead.call_duration}s call` : 'Pending dial')}
                          </td>

                          <td className="py-3 px-3 text-slate-500 text-[11px]">
                            {lead.follow_up_date ? new Date(lead.follow_up_date).toLocaleDateString() : '—'}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* FUNCTIONAL CALL BUTTON */}
                              <button
                                onClick={() => handleOpenCallModal(lead)}
                                disabled={isDnc}
                                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition ${
                                  isDnc 
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                }`}
                                title={isDnc ? 'Number is on Do Not Contact list' : 'Initiate Outbound Call'}
                              >
                                <PhoneCall className="w-3 h-3" />
                                <span>Call</span>
                              </button>

                              {/* Details Button */}
                              <button
                                onClick={() => handleOpenLeadDetails(lead)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100"
                                title="View Lead & Call History"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* DNC Button */}
                              {!isDnc && (
                                <button
                                  onClick={() => handleMarkDnc(lead.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                  title="Mark Do Not Contact"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CAMPAIGNS */}
      {/* ========================================================================= */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Calling Campaigns ({campaigns.length})</h3>
            <button
              onClick={() => {
                setUploadStep('upload');
                setParsedPreview(null);
                setUploadModalOpen(true);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Create Campaign from File</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.length === 0 ? (
              <div className="col-span-full p-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">No campaigns created yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Upload an Excel or CSV file to start an outbound automated campaign.</p>
              </div>
            ) : (
              campaigns.map(c => (
                <div key={c.id} className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 text-sm">{c.title}</h4>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            c.provider === 'retell'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                              : c.provider === 'omnidimension'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200/60'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                          }`}>
                            {c.provider || 'vapi'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">File: {c.file_name || 'leads.xlsx'}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        c.status === 'calling' || c.status === 'running' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                        c.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        c.status === 'paused' ? 'bg-slate-100 text-slate-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {c.status}
                      </span>
                    </div>

                    {/* Progress metrics */}
                    <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-slate-50 rounded-xl my-3 border border-slate-100 text-center">
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium">Total</div>
                        <div className="text-xs font-bold text-slate-800 mt-0.5 font-mono">{c.total_lead_count || c.total_leads}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium">Completed</div>
                        <div className="text-xs font-bold text-emerald-600 mt-0.5 font-mono">{c.completed_count || c.completed_calls}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium">Remaining</div>
                        <div className="text-xs font-bold text-amber-600 mt-0.5 font-mono">{c.pending_count || 0}</div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-1">
                      <div className="flex justify-between">
                        <span>Delay Between Calls:</span>
                        <span className="font-semibold text-slate-700">{c.delay_seconds || 8}s</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Interested Leads:</span>
                        <span className="font-bold text-emerald-700">{c.interested_count || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Campaign Action Controls */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {c.status !== 'calling' && c.status !== 'running' ? (
                        <button
                          onClick={() => handleStartCampaign(c.id)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>Start</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePauseCampaign(c.id)}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                        >
                          <Pause className="w-3 h-3" />
                          <span>Pause</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleStopCampaign(c.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Stop Campaign"
                      >
                        <Square className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={`/api/calling/campaigns/${c.id}/export`}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100"
                        title="Export Leads to Excel"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => {
                          setLeadCampaignFilter(String(c.id));
                          setActiveTab('leads');
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        View Leads
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: FOLLOW-UPS (DEDICATED CALLBACK MANAGEMENT) */}
      {/* ========================================================================= */}
      {activeTab === 'followups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Scheduled Follow-ups & Callbacks ({followUps.length})</h3>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Scheduled Date & Time</th>
                    <th className="py-3 px-3">Callback Notes / Reason</th>
                    <th className="py-3 px-3">Campaign</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {followUps.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        {loadingFollowUps ? 'Loading follow-ups...' : 'No upcoming follow-ups scheduled.'}
                      </td>
                    </tr>
                  ) : (
                    followUps.map(f => (
                      <tr key={f.lead_id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-bold text-slate-800">{f.lead_name}</td>
                        <td className="py-3 px-3 font-mono text-slate-700">{f.phone_number}</td>
                        <td className="py-3 px-3 font-semibold text-indigo-700">
                          {f.follow_up_date ? new Date(f.follow_up_date).toLocaleString() : 'Not scheduled'}
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-[200px] truncate">{f.follow_up_notes || 'Callback requested'}</td>
                        <td className="py-3 px-3 text-slate-500">{f.campaign_title || 'Direct'}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            f.follow_up_status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                            f.follow_up_status === 'cancelled' ? 'bg-slate-100 text-slate-600' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {f.follow_up_status || 'pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenCallModal(f as any)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 shadow-2xs"
                            >
                              <PhoneCall className="w-3 h-3" />
                              <span>Call Now</span>
                            </button>

                            <button
                              onClick={async () => {
                                await api.completeFollowUp(f.lead_id);
                                fetchFollowUps();
                                fetchStats();
                              }}
                              className="p-1 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50"
                              title="Mark Completed"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={async () => {
                                await api.cancelFollowUp(f.lead_id);
                                fetchFollowUps();
                                fetchStats();
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                              title="Cancel Follow-up"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CALL HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200/90 rounded-2xl shadow-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search logs, transcripts, outcomes..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
              >
                <option value="all">All Outcomes</option>
                <option value="interested">Interested</option>
                <option value="needs_follow_up">Callback Requested</option>
                <option value="completed">Completed</option>
                <option value="busy">Busy / Voicemail</option>
                <option value="failed">Failed Dial</option>
              </select>

              <select
                value={historyProviderFilter}
                onChange={(e) => setHistoryProviderFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
              >
                <option value="all">All Providers</option>
                <option value="vapi">Vapi</option>
                <option value="retell">Retell AI</option>
                <option value="omnidimension">OmniDimension</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Provider</th>
                    <th className="py-3 px-3">Duration</th>
                    <th className="py-3 px-3">Outcome / Summary</th>
                    <th className="py-3 px-3">Call Time</th>
                    <th className="py-3 px-4 text-right">Transcript</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {callHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        {loadingHistory ? 'Loading history...' : 'No call logs recorded yet.'}
                      </td>
                    </tr>
                  ) : (
                    callHistory.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-bold text-slate-800">{log.lead_name}</td>
                        <td className="py-3 px-3 font-mono text-slate-700">{log.phone_number}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            log.provider === 'retell'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                              : log.provider === 'omnidimension'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200/60'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                          }`}>
                            {log.provider === 'retell' ? 'Retell' : log.provider === 'omnidimension' ? 'OmniDim' : 'Vapi'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">{log.duration ? `${log.duration}s` : '0s'}</td>
                        <td className="py-3 px-3 text-slate-600 max-w-[240px] truncate" title={log.outcome}>
                          {log.outcome || log.ai_summary || log.end_reason || 'Call concluded'}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedCallDetails(log)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg"
                          >
                            Read Transcript
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: AI CALLER SETTINGS & BUSINESS KNOWLEDGE BASE */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {settingsMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{settingsMsg}</span>
            </div>
          )}

          {/* Section 1: Multi-Provider AI Calling Hub (Vapi, Retell AI, OmniDimension) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  <span>AI Voice Providers (Multi-Provider Architecture)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your active calling engine. SocialManager supports Vapi, Retell AI, and OmniDimension interchangeably using unified CRM context.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Mode:</span>
                <select
                  value={settings.CALLING_MODE || 'live'}
                  onChange={(e) => setSettings({ ...settings, CALLING_MODE: e.target.value })}
                  className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium"
                >
                  <option value="live">Live Telephony</option>
                  <option value="simulation">Simulation Mode</option>
                </select>
              </div>
            </div>

            {/* Provider Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {providers.map((p) => {
                const isActive = p.id === activeProviderId;
                const testRes = providerTestResult[p.id];
                const isTesting = testingProvider === p.id;

                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl p-4 border transition flex flex-col justify-between ${
                      isActive
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-xs ring-1 ring-indigo-600/20'
                        : 'border-slate-200/90 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Provider Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            p.id === 'retell'
                              ? 'bg-purple-100 text-purple-700'
                              : p.id === 'omnidimension'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {p.id === 'retell' ? 'RT' : p.id === 'omnidimension' ? 'OD' : 'VP'}
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-800 text-sm">{p.name}</h5>
                            <span className="text-[10px] text-slate-400 capitalize">{p.id} engine</span>
                          </div>
                        </div>

                        {isActive ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-200/50">
                            <Check className="w-3 h-3" /> ACTIVE
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetActiveProvider(p.id)}
                            className="text-[11px] font-semibold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg px-2.5 py-1 transition"
                          >
                            Set Active
                          </button>
                        )}
                      </div>

                      {/* Status & Capabilities */}
                      <div className="space-y-2 text-xs py-2 border-y border-slate-100/80 my-3">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">Configuration</span>
                          {p.isConfigured ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Configured
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold flex items-center gap-1 text-[11px]" title={`Missing: ${p.missingFields.join(', ')}`}>
                              <AlertCircle className="w-3.5 h-3.5" /> Needs Setup
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">Agent / Assistant</span>
                          <span className="font-mono text-[11px] text-slate-700 truncate max-w-[140px]" title={p.details?.assistantName || p.details?.agentId || 'None'}>
                            {p.details?.assistantName || (p.details?.agentId ? `${p.details.agentId.slice(0, 10)}...` : 'Not set')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">Phone Number</span>
                          <span className="font-mono text-[11px] text-slate-700">
                            {p.details?.phoneNumberName || p.details?.phoneNumber || (p.details?.phoneConfigured ? 'Assigned' : 'None')}
                          </span>
                        </div>
                      </div>

                      {/* Live Test Outcome Pill */}
                      {testRes && (
                        <div className={`p-2 rounded-xl text-[11px] mb-3 flex items-start gap-1.5 ${
                          testRes.success
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {testRes.success ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div className="leading-tight">
                            <span className="font-bold">{testRes.success ? 'Connection verified' : 'Test failed'}</span>
                            <p className="text-[10px] opacity-90 truncate mt-0.5">{testRes.message}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleTestProvider(p.id)}
                        disabled={isTesting}
                        className="flex-1 py-1.5 px-2 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center gap-1 transition"
                      >
                        {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3 text-slate-500" />}
                        <span>{isTesting ? 'Testing...' : 'Test API'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenConfigModal(p)}
                        className="flex-1 py-1.5 px-2 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded-xl flex items-center justify-center gap-1 transition"
                      >
                        <SettingsIcon className="w-3 h-3" />
                        <span>Configure</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Direct Inline Provider API Key & Credentials Editor */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h5 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Configure Provider Credentials & Telephony Keys</span>
                  </h5>
                  <p className="text-[11px] text-slate-400">Enter your API keys, agent IDs, and outbound phone numbers for each voice provider below.</p>
                </div>

                {/* Tabs to choose between Vapi, Retell, and OmniDimension */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/90 self-start">
                  {(['vapi', 'retell', 'omnidimension'] as const).map(pId => (
                    <button
                      key={pId}
                      type="button"
                      onClick={() => setSelectedConfigProviderTab(pId)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                        selectedConfigProviderTab === pId
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="capitalize">{pId === 'retell' ? 'Retell AI' : pId === 'omnidimension' ? 'OmniDimension' : 'Vapi'}</span>
                      {pId === activeProviderId && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Active Engine"></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vapi Credentials Form */}
              {selectedConfigProviderTab === 'vapi' && (
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                    <span className="font-bold text-slate-700">Vapi Telephony Credentials</span>
                    <span className="text-[11px] text-slate-400">Used for Vapi native voice & telephony routing</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-semibold text-slate-700">Vapi Private API Key</label>
                        <button type="button" onClick={() => setShowProviderKey(!showProviderKey)} className="text-[10px] text-indigo-600 hover:underline">
                          {showProviderKey ? 'Hide' : 'Reveal'}
                        </button>
                      </div>
                      <input
                        type={showProviderKey ? 'text' : 'password'}
                        value={settings.VAPI_API_KEY || ''}
                        onChange={(e) => setSettings({ ...settings, VAPI_API_KEY: e.target.value })}
                        placeholder="Paste Vapi Private API Key"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Vapi Assistant ID</label>
                      <input
                        type="text"
                        value={settings.VAPI_ASSISTANT_ID || ''}
                        onChange={(e) => setSettings({ ...settings, VAPI_ASSISTANT_ID: e.target.value })}
                        placeholder="e.g. d4eef714-3d96-41f2-8ce1-e5d070b435ae"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Vapi Phone Number ID</label>
                      <input
                        type="text"
                        value={settings.VAPI_PHONE_NUMBER_ID || ''}
                        onChange={(e) => setSettings({ ...settings, VAPI_PHONE_NUMBER_ID: e.target.value })}
                        placeholder="e.g. 04d7c0f1-4db5-4e78-9f1e-f35c5c935ee5"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Retell AI Credentials Form */}
              {selectedConfigProviderTab === 'retell' && (
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                    <span className="font-bold text-slate-700">Retell AI Telephony Credentials</span>
                    <span className="text-[11px] text-slate-400">Used for Retell AI outbound voice engine</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-semibold text-slate-700">Retell API Key</label>
                        <button type="button" onClick={() => setShowProviderKey(!showProviderKey)} className="text-[10px] text-indigo-600 hover:underline">
                          {showProviderKey ? 'Hide' : 'Reveal'}
                        </button>
                      </div>
                      <input
                        type={showProviderKey ? 'text' : 'password'}
                        value={settings.RETELL_API_KEY || ''}
                        onChange={(e) => setSettings({ ...settings, RETELL_API_KEY: e.target.value })}
                        placeholder="Paste key_... from Retell AI dashboard"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Retell Agent ID</label>
                      <input
                        type="text"
                        value={settings.RETELL_AGENT_ID || ''}
                        onChange={(e) => setSettings({ ...settings, RETELL_AGENT_ID: e.target.value })}
                        placeholder="e.g. agent_58b29..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Outbound Phone Number</label>
                      <input
                        type="text"
                        value={settings.RETELL_PHONE_NUMBER || ''}
                        onChange={(e) => setSettings({ ...settings, RETELL_PHONE_NUMBER: e.target.value })}
                        placeholder="e.g. +14155552671"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* OmniDimension Credentials Form */}
              {selectedConfigProviderTab === 'omnidimension' && (
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                    <span className="font-bold text-slate-700">OmniDimension Telephony Credentials</span>
                    <span className="text-[11px] text-slate-400">Used for OmniDimension conversational voice engine</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-semibold text-slate-700">OmniDimension API Key</label>
                        <button type="button" onClick={() => setShowProviderKey(!showProviderKey)} className="text-[10px] text-indigo-600 hover:underline">
                          {showProviderKey ? 'Hide' : 'Reveal'}
                        </button>
                      </div>
                      <input
                        type={showProviderKey ? 'text' : 'password'}
                        value={settings.OMNIDIMENSION_API_KEY || ''}
                        onChange={(e) => setSettings({ ...settings, OMNIDIMENSION_API_KEY: e.target.value })}
                        placeholder="Paste OmniDimension API Key"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Agent ID</label>
                      <input
                        type="text"
                        value={settings.OMNIDIMENSION_AGENT_ID || ''}
                        onChange={(e) => setSettings({ ...settings, OMNIDIMENSION_AGENT_ID: e.target.value })}
                        placeholder="e.g. agent_123"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Caller Phone Number</label>
                      <input
                        type="text"
                        value={settings.OMNIDIMENSION_PHONE_NUMBER || ''}
                        onChange={(e) => setSettings({ ...settings, OMNIDIMENSION_PHONE_NUMBER: e.target.value })}
                        placeholder="e.g. +919876543210"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Base API URL</label>
                      <input
                        type="text"
                        value={settings.OMNIDIMENSION_BASE_URL || 'https://omnidim.io/api/v1'}
                        onChange={(e) => setSettings({ ...settings, OMNIDIMENSION_BASE_URL: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Business Knowledge Base (AI Context) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h4 className="font-bold text-sm text-slate-800">Business Knowledge Base</h4>
              <p className="text-xs text-slate-500">The AI telecaller dynamically uses these business parameters to explain your services, pricing, and answer questions accurately without making up details.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Academy Name</label>
                <input
                  type="text"
                  value={settings.CALLING_COMPANY_NAME || ''}
                  onChange={(e) => setSettings({ ...settings, CALLING_COMPANY_NAME: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">AI Telecaller Persona Name</label>
                <input
                  type="text"
                  value={settings.CALLING_AGENT_NAME || ''}
                  onChange={(e) => setSettings({ ...settings, CALLING_AGENT_NAME: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Business Description</label>
                <textarea
                  rows={2}
                  value={settings.CALLING_BUSINESS_DESCRIPTION || ''}
                  onChange={(e) => setSettings({ ...settings, CALLING_BUSINESS_DESCRIPTION: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Products / Courses Offered</label>
                <textarea
                  rows={3}
                  value={settings.CALLING_PRODUCT_DETAILS || ''}
                  onChange={(e) => setSettings({ ...settings, CALLING_PRODUCT_DETAILS: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pricing & Packages</label>
                <textarea
                  rows={3}
                  value={settings.CALLING_PRICING || ''}
                  onChange={(e) => setSettings({ ...settings, CALLING_PRICING: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Active Offers & Discounts</label>
                <input
                  type="text"
                  value={settings.CALLING_OFFERS || ''}
                  onChange={(e) => setSettings({ ...settings, CALLING_OFFERS: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Human Handoff Contact</label>
                <input
                  type="text"
                  value={settings.CALLING_HUMAN_HANDOFF_CONTACT || ''}
                  onChange={(e) => setSettings({ ...settings, CALLING_HUMAN_HANDOFF_CONTACT: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Frequently Asked Questions (FAQs)</label>
                <textarea
                  rows={3}
                  value={settings.CALLING_FAQS || ''}
                  onChange={(e) => setSettings({ ...settings, CALLING_FAQS: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Call Conversation Protocols */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <h4 className="font-bold text-sm text-slate-800 pb-2 border-b border-slate-100">
              Call Flow & Objection Protocols
            </h4>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Opening Script (Personalized greeting with {'{name}'}, {'{company_name}'})
                </label>
                <textarea
                  rows={2}
                  value={settings.CALLING_DEFAULT_SCRIPT || ''}
                  onChange={(e) => setSettings({ ...settings, CALLING_DEFAULT_SCRIPT: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lead Qualification Questions</label>
                <textarea
                  rows={3}
                  value={settings.CALLING_QUALIFICATION_QUESTIONS || ''}
                  onChange={(e) => setSettings({ ...settings, CALLING_QUALIFICATION_QUESTIONS: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Objection Handling Guidelines</label>
                <textarea
                  rows={3}
                  value={settings.CALLING_OBJECTION_HANDLING || ''}
                  onChange={(e) => setSettings({ ...settings, CALLING_OBJECTION_HANDLING: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Do Not Contact (DNC) List Manager */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <h4 className="font-bold text-sm text-slate-800 pb-2 border-b border-slate-100">
              Compliance & Do Not Contact (DNC) Suppression
            </h4>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="+91..."
                value={newDncNumber}
                onChange={(e) => setNewDncNumber(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono flex-1"
              />
              <input
                type="text"
                placeholder="Reason (e.g. Opted out)"
                value={newDncReason}
                onChange={(e) => setNewDncReason(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl flex-1"
              />
              <button
                type="button"
                onClick={handleAddDnc}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl"
              >
                Add to DNC
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs">
              {dncList.length === 0 ? (
                <p className="text-slate-400 text-center py-4">No numbers currently suppressed.</p>
              ) : (
                dncList.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <span className="font-mono font-bold text-slate-800">{item.phone_number}</span>
                      <span className="text-[11px] text-slate-400 ml-2">({item.reason})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDnc(item.id)}
                      className="text-slate-400 hover:text-rose-600 text-xs p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              {savingSettings && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{savingSettings ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: INDIVIDUAL OUTBOUND CALL CONFIRMATION (REQUIREMENT 14) */}
      {/* ========================================================================= */}
      {callModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Outbound AI Call Confirmation</h3>
                  <p className="text-[11px] text-slate-400">Review parameters before initiating real phone call.</p>
                </div>
              </div>
              <button
                onClick={() => setCallModalLead(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Lead & Call Summary Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Lead Name:</span>
                <span className="font-bold text-slate-800">{callModalLead.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Destination Phone:</span>
                <span className="font-mono font-bold text-indigo-700">{callModalLead.phone_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">AI Telecaller:</span>
                <span className="font-medium text-slate-800">{diagnostics?.selectedAssistant?.name || 'Aria Voice Agent'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Calling From:</span>
                <span className="font-mono text-slate-700">{diagnostics?.selectedPhoneNumber?.number || 'Vapi Number'}</span>
              </div>
            </div>

            {/* Provider Selector for this call */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Calling Provider
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['vapi', 'retell', 'omnidimension'] as const).map(pId => {
                  const isSel = callProvider === pId;
                  const provInfo = providers.find(p => p.id === pId);
                  return (
                    <button
                      key={pId}
                      type="button"
                      onClick={() => setCallProvider(pId)}
                      className={`p-2.5 rounded-xl text-left border transition ${
                        isSel 
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-xs ring-1 ring-indigo-600/20' 
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">
                          {pId === 'retell' ? 'Retell AI' : pId === 'omnidimension' ? 'OmniDim' : 'Vapi'}
                        </span>
                        {isSel && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {pId === activeProviderId ? '(Default)' : provInfo?.isConfigured ? 'Configured' : 'Needs setup'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Outbound International Warning if Applicable */}
            {callProvider === 'vapi' && diagnostics?.outboundCapability && !diagnostics.outboundCapability.canCallIndia && callModalLead.phone_number.includes('+91') && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Vapi International Calling Notice</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Destination is in India (+91). Your current Vapi number is a US domestic number (+1). Vapi restricts international dials unless a Twilio number is connected. You can also switch to Retell or OmniDimension above.
                </p>
              </div>
            )}

            {/* Error Message if Call Failed */}
            {activeCallError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Call Error Response</span>
                </div>
                <p className="text-[11px] leading-relaxed font-mono">{activeCallError}</p>
              </div>
            )}

            {/* Opening Pitch Preview */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Personalized Opening Message
              </label>
              <textarea
                rows={3}
                value={callOpeningMessage}
                onChange={(e) => setCallOpeningMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCallModalLead(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleStartCall}
                disabled={callingInProgress}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs flex items-center gap-1.5"
              >
                {callingInProgress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
                <span>{callingInProgress ? 'Dialing...' : 'Start Call Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EXCEL / CSV IMPORT WIZARD (REQUIREMENT 5) */}
      {/* ========================================================================= */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Bulk Lead Import & Campaign Setup</h3>
                  <p className="text-[11px] text-slate-400">Upload Excel (.xlsx, .xls) or CSV with phone numbers.</p>
                </div>
              </div>
              <button onClick={() => setUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Upload */}
            {uploadStep === 'upload' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-3 hover:border-indigo-400 transition cursor-pointer relative">
                  <Upload className="w-8 h-8 text-indigo-600 mx-auto" />
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Choose an Excel (.xlsx, .xls) or CSV file</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Supports contact names, phone numbers, notes, and custom fields.</p>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                {uploadingFile && (
                  <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing spreadsheet columns and rows...</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Column Mapping & Validation Summary */}
            {uploadStep === 'mapping' && parsedPreview && (
              <div className="space-y-4 text-xs">
                {/* Validation Statistics */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400">Total Rows</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">{parsedPreview.totalRows}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Valid Callable</div>
                    <div className="text-xs font-bold text-emerald-600 mt-0.5">{parsedPreview.validCallableLeads}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Excluded / Invalid</div>
                    <div className="text-xs font-bold text-rose-600 mt-0.5">{parsedPreview.excludedLeadsCount}</div>
                  </div>
                </div>

                {/* Column Mapping Selectors */}
                <div className="space-y-2.5 pt-2">
                  <h5 className="font-bold text-slate-700">Column Mapping</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Phone Number Column *</label>
                      <select
                        value={customMapping.phoneCol || ''}
                        onChange={(e) => setCustomMapping({ ...customMapping, phoneCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        {parsedPreview.detectedColumns?.map((col: string) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Contact Name Column</label>
                      <select
                        value={customMapping.nameCol || ''}
                        onChange={(e) => setCustomMapping({ ...customMapping, nameCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        {parsedPreview.detectedColumns?.map((col: string) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Campaign Name</label>
                    <input
                      type="text"
                      value={newCampaignTitle}
                      onChange={(e) => setNewCampaignTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Calling Provider</label>
                    <select
                      value={newCampaignProvider}
                      onChange={(e) => setNewCampaignProvider(e.target.value as any)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="vapi">Vapi</option>
                      <option value="retell">Retell AI</option>
                      <option value="omnidimension">OmniDimension</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setUploadStep('upload')}
                    className="px-4 py-2 font-semibold text-slate-600 border border-slate-200 rounded-xl"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={importingLeads}
                    className="px-5 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1.5"
                  >
                    {importingLeads && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm & Create Campaign</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MANUAL ADD LEAD */}
      {/* ========================================================================= */}
      {addLeadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">Add Lead</h3>
              <button onClick={() => setAddLeadModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualLead} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number (E.164) *</label>
                <input
                  type="text"
                  required
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newLeadEmail}
                  onChange={(e) => setNewLeadEmail(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Musical Interest / Goal</label>
                <input
                  type="text"
                  value={newLeadInterest}
                  onChange={(e) => setNewLeadInterest(e.target.value)}
                  placeholder="e.g. Beginner Acoustic Guitar"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={newLeadNotes}
                  onChange={(e) => setNewLeadNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddLeadModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: READ CALL TRANSCRIPT */}
      {/* ========================================================================= */}
      {selectedCallDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base">{selectedCallDetails.lead_name}</h3>
                <p className="text-[11px] text-slate-400 font-mono">{selectedCallDetails.phone_number}</p>
              </div>
              <button onClick={() => setSelectedCallDetails(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-bold text-slate-800">{selectedCallDetails.duration}s</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Outcome:</span>
                  <span className="font-bold text-indigo-700">{selectedCallDetails.outcome || 'Completed'}</span>
                </div>
              </div>

              <div>
                <h5 className="font-bold text-slate-700 mb-1.5">Conversation Transcript</h5>
                <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl whitespace-pre-wrap font-mono text-[11px] text-slate-700 leading-relaxed max-h-60 overflow-y-auto">
                  {selectedCallDetails.transcript || 'No transcript text available for this call.'}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedCallDetails(null)}
                className="px-4 py-2 font-semibold text-slate-600 border border-slate-200 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CONFIGURE PROVIDER CREDENTIALS */}
      {/* ========================================================================= */}
      {editingProvider && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Configure {editingProvider.name}</h3>
                  <p className="text-[11px] text-slate-400">Manage credentials & telephony routing</p>
                </div>
              </div>
              <button onClick={() => setEditingProvider(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {editingProvider.name} API Key
                </label>
                <input
                  type="password"
                  value={providerConfigForm.apiKey || ''}
                  onChange={(e) => setProviderConfigForm({ ...providerConfigForm, apiKey: e.target.value })}
                  placeholder={`Paste ${editingProvider.name} API Key`}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {editingProvider.id === 'vapi' ? 'Assistant ID' : 'Agent ID'}
                </label>
                <input
                  type="text"
                  value={editingProvider.id === 'vapi' ? (providerConfigForm.assistantId || '') : (providerConfigForm.agentId || '')}
                  onChange={(e) => setProviderConfigForm({
                    ...providerConfigForm,
                    [editingProvider.id === 'vapi' ? 'assistantId' : 'agentId']: e.target.value
                  })}
                  placeholder="e.g. 4f27a2f3-3248-46a3-b1ec..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {editingProvider.id === 'vapi' ? 'Phone Number ID' : 'Outbound Phone Number'}
                </label>
                <input
                  type="text"
                  value={editingProvider.id === 'vapi' ? (providerConfigForm.phoneNumberId || '') : (providerConfigForm.phoneNumber || '')}
                  onChange={(e) => setProviderConfigForm({
                    ...providerConfigForm,
                    [editingProvider.id === 'vapi' ? 'phoneNumberId' : 'phoneNumber']: e.target.value
                  })}
                  placeholder={editingProvider.id === 'vapi' ? 'e.g. 2e79a5b3-ba4f...' : '+1234567890'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:outline-none"
                />
              </div>

              {editingProvider.id === 'omnidimension' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Base API URL</label>
                  <input
                    type="text"
                    value={providerConfigForm.baseUrl || 'https://omnidim.io/api/v1'}
                    onChange={(e) => setProviderConfigForm({ ...providerConfigForm, baseUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:outline-none"
                  />
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                Credentials are stored securely in your database settings and used only for outbound calling workflows.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingProvider(null)}
                className="px-4 py-2 font-semibold text-slate-600 border border-slate-200 rounded-xl text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProviderConfig}
                className="px-5 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs shadow-xs"
              >
                Save Credentials
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
