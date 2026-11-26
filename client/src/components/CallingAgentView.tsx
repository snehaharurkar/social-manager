import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneCall,
  PhoneOff,
  PhoneOutgoing,
  Volume2,
  Play,
  Square,
  Upload,
  FileSpreadsheet,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Download,
  Search,
  RefreshCw,
  Trash2,
  Sparkles,
  Settings,
  Loader2,
  ListOrdered,
  Radio,
  ExternalLink,
  ShieldCheck,
  Key,
  UserPlus,
  Users
} from 'lucide-react';
import type { CallingLead, CallingCampaign, CallingSettings, ParsedSheetPreview, FollowUpsResponse } from '../types';
import { api } from '../api';

export const CallingAgentView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dialer' | 'upload' | 'leads' | 'followups' | 'settings'>('upload');

  // Campaigns & Leads State
  const [campaigns, setCampaigns] = useState<CallingCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [leads, setLeads] = useState<CallingLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload Sheet State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sheetPreview, setSheetPreview] = useState<ParsedSheetPreview | null>(null);
  const [campaignTitle, setCampaignTitle] = useState('');
  const [customScript, setCustomScript] = useState('Hello {name}! This is Aria from Sneha Harmony. I noticed you were interested in guitar lessons and music sessions. Do you have a moment to chat?');
  const [delaySeconds, setDelaySeconds] = useState(6);
  const [launchingCampaign, setLaunchingCampaign] = useState(false);

  // Auto-Dialer State
  const [isDialing, setIsDialing] = useState(false);
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0);
  const [activeCallLead, setActiveCallLead] = useState<CallingLead | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const [callTranscript, setCallTranscript] = useState<string>('');
  const [callOutcome, setCallOutcome] = useState<string>('');
  const [isCallingSingle, setIsCallingSingle] = useState(false);
  const [countdownNext, setCountdownNext] = useState<number | null>(null);
  const [speechEnabled, setSpeechEnabled] = useState(true);

  // Follow-Ups State
  const [followUpsData, setFollowUpsData] = useState<FollowUpsResponse | null>(null);
  const [followUpFilter, setFollowUpFilter] = useState<'all' | 'today' | 'overdue' | 'upcoming' | 'completed'>('today');
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);

  // Follow-up Schedule Modal
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [selectedLeadForFollowUp, setSelectedLeadForFollowUp] = useState<CallingLead | null>(null);
  const [followUpDateInput, setFollowUpDateInput] = useState('');
  const [followUpNotesInput, setFollowUpNotesInput] = useState('');

  // Transcript View Modal
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const [selectedLeadForTranscript, setSelectedLeadForTranscript] = useState<CallingLead | null>(null);

  // Add Individual Lead Modal State
  const [addLeadModalOpen, setAddLeadModalOpen] = useState(false);
  const [quickCallModalOpen, setQuickCallModalOpen] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    phone_number: '',
    email: '',
    interest: 'Acoustic Guitar Lessons',
    notes: '',
    follow_up_date: '',
    call_immediately: false
  });
  const [savingNewLead, setSavingNewLead] = useState(false);

  // Quick Direct Call State
  const [directCallName, setDirectCallName] = useState('');
  const [directCallPhone, setDirectCallPhone] = useState('');
  const [directCallInterest, setDirectCallInterest] = useState('Beginner Acoustic Lessons');
  const [callingDirect, setCallingDirect] = useState(false);

  // Settings State
  const [callingSettings, setCallingSettings] = useState<CallingSettings>({
    agentName: 'Aria (Sneharmony)',
    defaultScript: 'Hello {name}! This is Sneha Harmony calling to see if you had any questions about our music classes or guitar sessions.',
    systemPrompt: `You are Aria, an empathetic, cheerful, and professional AI Voice Caller representing Sneha from Sneharmony (Sneha's YouTube channel & acoustic guitar learning academy).
Your goal on this phone call:
1. Politely greet the customer by their name and mention their music inquiry.
2. Keep your answers short and conversational (1-2 sentences), exactly like a real phone call.
3. Understand their musical goal (beginner acoustic guitar, fingerstyle, vocal coaching, or artist collaboration).
4. If they are busy or driving, ask when would be a good time to call back.
5. Offer to send our complete lesson schedule and WhatsApp brochure immediately after the call.
6. Be warm, friendly, natural, and never sound robotic.`,
    delayBetweenCalls: 6,
    voiceGender: 'female',
    callingMode: 'simulation',
    callingProvider: 'vapi',
    vapiApiKey: '',
    vapiPhoneNumberId: '',
    vapiAssistantId: '',
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Floating Toast Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Refs for timers and audio
  const dialerAbortRef = useRef(false);
  const callTimerRef = useRef<any>(null);

  // Global Escape key listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAddLeadModalOpen(false);
        setQuickCallModalOpen(false);
        setFollowUpModalOpen(false);
        setTranscriptModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load campaigns on mount
  useEffect(() => {
    loadCampaigns();
    loadCallingSettings();
  }, []);

  // When selectedCampaignId changes, load leads
  useEffect(() => {
    if (selectedCampaignId) {
      loadLeads(selectedCampaignId);
    }
  }, [selectedCampaignId, statusFilter, searchQuery]);

  // When activeTab is followups, load followups
  useEffect(() => {
    if (activeTab === 'followups') {
      loadFollowUps();
    }
  }, [activeTab, followUpFilter]);

  const loadCampaigns = async () => {
    try {
      const list = await api.getCallingCampaigns();
      setCampaigns(list);
      if (list.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    }
  };

  const loadLeads = async (campaignId: number, filterOverride?: { status?: string; search?: string }) => {
    setLoadingLeads(true);
    try {
      const statusToUse = filterOverride?.status !== undefined ? filterOverride.status : statusFilter;
      const searchToUse = filterOverride?.search !== undefined ? filterOverride.search : searchQuery;
      const data = await api.getCampaignLeads(campaignId, {
        status: statusToUse,
        search: searchToUse
      });
      setLeads(data);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  };

  const loadFollowUps = async () => {
    setLoadingFollowUps(true);
    try {
      const data = await api.getCallingFollowUps();
      setFollowUpsData(data);
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
    } finally {
      setLoadingFollowUps(false);
    }
  };

  const loadCallingSettings = async () => {
    try {
      const s = await api.getCallingSettings();
      if (s) {
        setCallingSettings(prev => ({ ...prev, ...s }));
        setCustomScript(s.defaultScript || customScript);
        setDelaySeconds(s.delayBetweenCalls || 6);
      }
    } catch (err) {
      console.error('Failed to load calling settings:', err);
    }
  };

  // Browser TTS Speech Synthesis Helper (for simulation / demo audio)
  const speakText = (text: string) => {
    if (!speechEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const lines = text.split('\n');
      const agentLines = lines
        .filter(l => l.includes('[Agent]:') || l.includes('Aria:'))
        .map(l => l.replace(/\[Agent\]:|Aria:/g, '').replace(/"/g, '').trim());

      const toSpeak = agentLines.length > 0 ? agentLines.join('. ') : text.slice(0, 150);

      const utterance = new SpeechSynthesisUtterance(toSpeak);
      utterance.rate = 1.0;
      utterance.pitch = callingSettings.voiceGender === 'female' ? 1.2 : 0.9;

      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v =>
        callingSettings.voiceGender === 'female'
          ? (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Google UK English Female'))
          : (v.name.includes('Male') || v.name.includes('David') || v.name.includes('Google UK English Male'))
      );
      if (preferred) utterance.voice = preferred;

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('SpeechSynthesis error:', err);
    }
  };

  // Upload Excel Sheet
  const handleFileUpload = async (file: File) => {
    setUploadFile(file);
    setUploading(true);
    try {
      const res = await api.uploadCallingSheet(file);
      setSheetPreview(res);
      setCampaignTitle(`Campaign - ${file.name.replace(/\.[^/.]+$/, '')}`);
    } catch (err: any) {
      alert(`Upload Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Load Built-in Demo Leads
  const loadDemoSheet = () => {
    const demoLeads = [
      { name: 'Rahul Sharma', phone_number: '+919876543210', email: 'rahul.music@gmail.com', interest: 'Acoustic Guitar Mastery', notes: 'Inquired from YouTube cover video' },
      { name: 'Pooja Verma', phone_number: '+919812345678', email: 'pooja.verma@outlook.com', interest: 'Beginner Vocal & Rhythm', notes: 'Requested fee structure' },
      { name: 'Arjun Mehta', phone_number: '+919823456789', email: 'arjun.mehta@gmail.com', interest: 'Fingerstyle Guitar Lessons', notes: 'Watched latest Instagram Reel' },
      { name: 'Snehal Rao', phone_number: '+919834567890', email: 'snehal.rao@yahoo.com', interest: '1-on-1 Online Masterclass', notes: 'Wants weekend evening batch' },
      { name: 'Vikram Patel', phone_number: '+919845678901', email: 'vikram.patel@gmail.com', interest: 'Guitar Equipment & Collab', notes: 'Creator collaboration inquiry' }
    ];

    setSheetPreview({
      success: true,
      fileName: 'Demo_Guitar_Leads.xlsx',
      storedFileName: 'demo_sheet.xlsx',
      filePath: 'demo',
      sheetName: 'Sheet1',
      totalRows: 5,
      detectedColumns: ['Name', 'Phone', 'Email', 'Interest', 'Notes'],
      validLeads: demoLeads
    });
    setCampaignTitle('Demo Guitar & Music Outbound Campaign');
  };

  // Create Campaign and Launch
  const handleLaunchCampaign = async () => {
    if (!sheetPreview || sheetPreview.validLeads.length === 0) {
      alert('Please upload an Excel sheet with valid leads first.');
      return;
    }

    setLaunchingCampaign(true);
    try {
      const res = await api.createCallingCampaign({
        title: campaignTitle || `Campaign - ${sheetPreview.fileName}`,
        fileName: sheetPreview.fileName,
        leads: sheetPreview.validLeads,
        customScript,
        delaySeconds
      });

      await loadCampaigns();
      setSelectedCampaignId(res.campaignId);
      setActiveTab('dialer');
      setSheetPreview(null);
      setUploadFile(null);
    } catch (err: any) {
      alert(`Failed to launch campaign: ${err.message}`);
    } finally {
      setLaunchingCampaign(false);
    }
  };

  // Single Call Trigger for any lead
  const handleCallSingleLead = async (lead: CallingLead) => {
    setActiveTab('dialer');
    setIsCallingSingle(true);
    setActiveCallLead(lead);
    setCallTimer(0);
    setCallTranscript('Dialing lead ' + lead.phone_number + '...');
    setCallOutcome('');

    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallTimer(prev => prev + 1);
    }, 1000);

    try {
      const result = await api.callLead(lead.id);
      setCallTranscript(result.transcript);
      setCallOutcome(result.outcome);
      speakText(result.transcript);

      const targetCampId = lead.campaign_id || selectedCampaignId;
      if (targetCampId) {
        await loadLeads(targetCampId);
      }
      await loadCampaigns();
    } catch (err: any) {
      setCallTranscript(`Call failed: ${err.message}`);
    } finally {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setIsCallingSingle(false);
    }
  };

  // Save Single Individual Lead Manually
  const handleSaveIndividualLead = async () => {
    if (!newLeadForm.name.trim() || !newLeadForm.phone_number.trim()) {
      alert('Please enter both Name and Phone Number.');
      return;
    }

    setSavingNewLead(true);
    try {
      const shouldCall = newLeadForm.call_immediately;
      const res = await api.createIndividualLead({
        campaign_id: selectedCampaignId,
        name: newLeadForm.name.trim(),
        phone_number: newLeadForm.phone_number.trim(),
        email: newLeadForm.email.trim() || undefined,
        interest: newLeadForm.interest.trim() || undefined,
        notes: newLeadForm.notes.trim() || undefined,
        follow_up_date: newLeadForm.follow_up_date ? newLeadForm.follow_up_date.replace('T', ' ') : null
      });

      setAddLeadModalOpen(false);
      const created = res.lead;
      setNewLeadForm({
        name: '',
        phone_number: '',
        email: '',
        interest: 'Acoustic Guitar Lessons',
        notes: '',
        follow_up_date: '',
        call_immediately: false
      });

      setStatusFilter('all');
      setSearchQuery('');

      await loadCampaigns();
      const targetCampId = created?.campaign_id || selectedCampaignId;
      if (targetCampId) {
        setSelectedCampaignId(targetCampId);
        await loadLeads(targetCampId, { status: 'all', search: '' });
      }

      if (shouldCall && created) {
        setActiveTab('dialer');
        await handleCallSingleLead(created);
      } else {
        setActiveTab('leads');
        showToast(`Lead "${created.name}" added successfully to CRM!`);
      }
    } catch (err: any) {
      showToast(`Failed to add lead: ${err.message}`, 'error');
    } finally {
      setSavingNewLead(false);
    }
  };

  // Direct Instant Call to an Individual Number
  const handleQuickCallIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directCallPhone.trim()) {
      alert('Please enter a phone number to call.');
      return;
    }

    setActiveTab('dialer');
    setQuickCallModalOpen(false);
    setCallingDirect(true);
    setIsCallingSingle(true);
    setCallTimer(0);
    setCallTranscript(`Dialing ${directCallPhone}...`);
    setCallOutcome('');

    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallTimer(prev => prev + 1);
    }, 1000);

    try {
      const res = await api.callDirectIndividual({
        name: directCallName.trim() || 'Direct Inquiry',
        phone_number: directCallPhone.trim(),
        interest: directCallInterest.trim(),
        campaign_id: selectedCampaignId
      });

      setActiveCallLead(res.lead);
      setCallTranscript(res.callResult.transcript || 'Call placed.');
      setCallOutcome(res.callResult.outcome || 'Call in progress.');
      speakText(res.callResult.transcript || '');

      await loadCampaigns();
      const targetCampId = res.lead?.campaign_id || selectedCampaignId;
      if (targetCampId) {
        setSelectedCampaignId(targetCampId);
        await loadLeads(targetCampId, { status: 'all', search: '' });
      }

      setDirectCallPhone('');
      setDirectCallName('');
      showToast(`Call to ${res.lead?.name || directCallPhone} completed (${res.callResult.outcome})`);
    } catch (err: any) {
      setCallTranscript(`Call error: ${err.message}`);
      showToast(`Call error: ${err.message}`, 'error');
    } finally {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallingDirect(false);
      setIsCallingSingle(false);
    }
  };

  // Start Sequential Auto-Dialer Loop
  const startSequentialDialer = async () => {
    if (!selectedCampaignId) return;

    dialerAbortRef.current = false;
    setIsDialing(true);

    const freshLeads = await api.getCampaignLeads(selectedCampaignId);
    const callableLeads = freshLeads.filter(l => l.call_status === 'pending' || l.call_status === 'busy');

    if (callableLeads.length === 0) {
      alert('All leads in this campaign have already been called!');
      setIsDialing(false);
      return;
    }

    for (let i = 0; i < callableLeads.length; i++) {
      if (dialerAbortRef.current) break;

      const lead = callableLeads[i];
      setCurrentLeadIndex(i + 1);
      setActiveCallLead(lead);
      setCallTimer(0);
      setCallTranscript(`[Dialing ${lead.phone_number}] Connecting to ${lead.name}...`);
      setCallOutcome('');

      if (callTimerRef.current) clearInterval(callTimerRef.current);
      callTimerRef.current = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);

      try {
        const result = await api.callLead(lead.id);
        if (callTimerRef.current) clearInterval(callTimerRef.current);

        setCallTranscript(result.transcript);
        setCallOutcome(result.outcome);
        speakText(result.transcript);

        await loadLeads(selectedCampaignId);
        await loadCampaigns();

        if (i < callableLeads.length - 1 && !dialerAbortRef.current) {
          let count = delaySeconds;
          setCountdownNext(count);

          while (count > 0 && !dialerAbortRef.current) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            count--;
            setCountdownNext(count);
          }
          setCountdownNext(null);
        }
      } catch (err: any) {
        console.error('Call failed:', err);
        setCallTranscript(`Call error: ${err.message}`);
      }
    }

    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setIsDialing(false);
    setCountdownNext(null);
  };

  // Stop Sequential Auto-Dialer
  const stopSequentialDialer = () => {
    dialerAbortRef.current = true;
    setIsDialing(false);
    setCountdownNext(null);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  // Open Follow-up Modal
  const openFollowUpModal = (lead: CallingLead) => {
    setSelectedLeadForFollowUp(lead);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(16, 0, 0, 0);
    const dateStr = tomorrow.toISOString().slice(0, 16);
    setFollowUpDateInput(lead.follow_up_date ? lead.follow_up_date.slice(0, 16) : dateStr);
    setFollowUpNotesInput(lead.follow_up_notes || `Callback regarding ${lead.interest || 'guitar lessons'}`);
    setFollowUpModalOpen(true);
  };

  const handleSaveFollowUp = async () => {
    if (!selectedLeadForFollowUp || !followUpDateInput) return;
    try {
      await api.scheduleCallingFollowUp(
        selectedLeadForFollowUp.id,
        followUpDateInput.replace('T', ' '),
        followUpNotesInput
      );
      setFollowUpModalOpen(false);
      if (selectedCampaignId) await loadLeads(selectedCampaignId);
      if (activeTab === 'followups') await loadFollowUps();
      showToast('Follow-up scheduled successfully!');
    } catch (err: any) {
      showToast(`Error scheduling follow-up: ${err.message}`, 'error');
    }
  };

  // Change lead status manually
  const handleUpdateLeadStatus = async (leadId: number, newStatus: CallingLead['call_status']) => {
    try {
      await api.updateCallingLead(leadId, { call_status: newStatus });
      if (selectedCampaignId) await loadLeads(selectedCampaignId);
      if (activeTab === 'followups') await loadFollowUps();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // Delete lead
  const handleDeleteLead = async (leadId: number) => {
    if (!confirm('Are you sure you want to remove this lead?')) return;
    try {
      await api.deleteCallingLead(leadId);
      if (selectedCampaignId) await loadLeads(selectedCampaignId);
      await loadCampaigns();
    } catch (err: any) {
      alert(`Failed to delete lead: ${err.message}`);
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.saveCallingSettings(callingSettings);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  // Open WhatsApp Link
  const openWhatsApp = (phone: string, name: string) => {
    const cleanDigits = phone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(`Hi ${name}! This is Sneha Harmony following up on our call regarding your guitar lessons inquiry. How can I assist you today?`);
    window.open(`https://wa.me/${cleanDigits}?text=${text}`, '_blank');
  };

  const currentCampaign = campaigns.find(c => c.id === selectedCampaignId);

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'interested':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Interested</span>;
      case 'needs_follow_up':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3" /> Follow-Up</span>;
      case 'busy':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200"><PhoneOff className="w-3 h-3" /> Busy / Voicemail</span>;
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"><CheckCircle2 className="w-3 h-3" /> Completed</span>;
      case 'calling':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 animate-pulse"><PhoneCall className="w-3 h-3" /> In Call</span>;
      case 'not_interested':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><AlertCircle className="w-3 h-3" /> Not Interested</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">Pending</span>;
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
          toastMessage.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : toastMessage.type === 'info'
            ? 'bg-sky-50 border-sky-200 text-sky-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
      )}

      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                AI Outbound Calling Agent
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                  callingSettings.callingMode === 'live'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}>
                  {callingSettings.callingMode === 'live' ? '🟢 Live Voice AI (Real Calls)' : '🧪 Simulation Mode'}
                </span>
              </h1>
              <p className="text-sm text-slate-500">
                Upload lead sheets, add individual leads, trigger automated sequential calling, and dial individual contacts with Voice AI.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action / Switch */}
        <div className="flex items-center gap-2">
          {campaigns.length > 0 && (
            <select
              value={selectedCampaignId || ''}
              onChange={(e) => setSelectedCampaignId(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm font-medium"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.completed_calls}/{c.total_leads} called)
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setQuickCallModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
            title="Dial any phone number directly to test Voice AI"
          >
            <PhoneCall className="w-4 h-4" />
            📞 Quick Call Number
          </button>

          <button
            type="button"
            onClick={() => setAddLeadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            + Add Lead
          </button>

          {selectedCampaignId && (
            <a
              href={api.getCallingExportUrl(selectedCampaignId)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg shadow-sm transition"
              title="Download Excel with all outcomes & follow-up dates"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export .xlsx
            </a>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl shadow-sm gap-2">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'upload'
              ? 'border-sky-600 text-sky-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Upload className="w-4 h-4" />
          1. Upload Excel Sheet
        </button>

        <button
          onClick={() => setActiveTab('dialer')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'dialer'
              ? 'border-sky-600 text-sky-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PhoneOutgoing className="w-4 h-4" />
          2. Auto-Dialer & Quick Call
          {isDialing && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping ml-1" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('leads')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'leads'
              ? 'border-sky-600 text-sky-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          3. Leads CRM & Statuses
          {leads.length > 0 && (
            <span className="px-1.5 py-0.2 text-xs bg-slate-100 text-slate-600 rounded-full">
              {leads.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('followups')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'followups'
              ? 'border-sky-600 text-sky-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          4. Follow-Up Hub
          {followUpsData && followUpsData.counts.today > 0 && (
            <span className="px-1.5 py-0.2 text-xs bg-amber-100 text-amber-800 font-bold rounded-full">
              {followUpsData.counts.today}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ml-auto ${
            activeTab === 'settings'
              ? 'border-sky-600 text-sky-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          Voice AI Settings
        </button>
      </div>

      {/* TAB 1: UPLOAD EXCEL SHEET */}
      {activeTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-sky-600" />
                Upload Leads Spreadsheet
              </h2>
              <p className="text-sm text-slate-500 mb-5">
                Drop your `.xlsx`, `.xls`, or `.csv` file. Our AI column parser automatically detects columns for <b>Name</b>, <b>Phone Number</b>, <b>Email</b>, <b>Interest</b>, and <b>Notes</b>.
              </p>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-2xl p-8 text-center bg-slate-50 hover:bg-sky-50/40 transition cursor-pointer"
                onClick={() => document.getElementById('sheet-file-input')?.click()}
              >
                <input
                  id="sheet-file-input"
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 mx-auto flex items-center justify-center text-sky-600 mb-3">
                  {uploading ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <Upload className="w-7 h-7" />
                  )}
                </div>
                <h3 className="text-sm font-semibold text-slate-800">
                  {uploadFile ? uploadFile.name : 'Click to select or drag & drop spreadsheet'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Supports Microsoft Excel (.xlsx, .xls) and CSV files up to 25 MB</p>

                <div className="mt-4 flex items-center justify-center gap-2">
                  <span className="text-xs text-slate-400">or try without a file:</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadDemoSheet();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Load Sample 5 Guitar Inquiries
                  </button>
                </div>
              </div>

              {/* Preview Table if sheet parsed */}
              {sheetPreview && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Parsed Successfully: {sheetPreview.validLeads.length} Leads Found
                      </h4>
                      <p className="text-xs text-slate-500">
                        Sheet: <span className="font-medium text-slate-700">{sheetPreview.sheetName}</span> • Columns matched: {sheetPreview.detectedColumns.join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-64 border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider sticky top-0">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Lead Name</th>
                          <th className="px-3 py-2">Phone Number</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Interest</th>
                          <th className="px-3 py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {sheetPreview.validLeads.map((l, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono text-slate-400">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium text-slate-900">{l.name}</td>
                            <td className="px-3 py-2 font-mono text-sky-700">{l.phone_number}</td>
                            <td className="px-3 py-2 text-slate-500">{l.email || '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{l.interest || 'Guitar Lessons'}</td>
                            <td className="px-3 py-2 text-slate-400 truncate max-w-xs">{l.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Campaign Configuration Box */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-4 h-4 text-sky-600" />
                Configure Calling Campaign
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Campaign Title
                </label>
                <input
                  type="text"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="e.g. October Acoustic Guitar Leads"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  AI Caller Opening Pitch
                </label>
                <textarea
                  value={customScript}
                  onChange={(e) => setCustomScript(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Hello {name}! This is Aria from Sneha Harmony..."
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Use <code>{'{name}'}</code> to personalize each greeting.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Delay Between Calls (Seconds)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="3"
                    max="30"
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Number(e.target.value))}
                    className="flex-1 accent-sky-600"
                  />
                  <span className="text-xs font-bold text-slate-700 font-mono w-12 text-right">
                    {delaySeconds}s
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Allows time to review notes before dialing next lead.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={!sheetPreview || sheetPreview.validLeads.length === 0 || launchingCampaign}
                  onClick={handleLaunchCampaign}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-md shadow-sky-600/20 transition"
                >
                  {launchingCampaign ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PhoneOutgoing className="w-4 h-4" />
                  )}
                  Launch Calling Campaign ({sheetPreview ? sheetPreview.validLeads.length : 0} Leads)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE AUTO-DIALER & QUICK INDIVIDUAL CALL */}
      {activeTab === 'dialer' && (
        <div className="space-y-6">
          {/* Active Call Live Control Console */}
          <div className="bg-gradient-to-br from-white to-sky-50/50 p-6 rounded-2xl border border-sky-100 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                  isDialing || isCallingSingle ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-100 text-slate-600'
                }`}>
                  <PhoneCall className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {currentCampaign ? currentCampaign.title : 'Select a Campaign'}
                  </h2>
                  <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{currentCampaign ? `${currentCampaign.completed_calls} of ${currentCampaign.total_leads} leads dialed` : 'No campaign active'}</span>
                    {isDialing && <span>• Calling Lead #{currentLeadIndex}</span>}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      callingSettings.callingMode === 'live'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {callingSettings.callingMode === 'live' ? '🟢 Live Outbound AI' : '🧪 Simulation Mode'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Start / Stop / TTS controls */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSpeechEnabled(!speechEnabled)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition ${
                    speechEnabled
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}
                  title="Enable speech synthesizer audio"
                >
                  <Volume2 className="w-4 h-4" />
                  {speechEnabled ? 'Audio TTS: On' : 'Audio TTS: Muted'}
                </button>

                {!isDialing ? (
                  <button
                    type="button"
                    onClick={startSequentialDialer}
                    disabled={!selectedCampaignId}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-600/20 transition"
                  >
                    <Play className="w-4 h-4" />
                    Start Auto-Dialer Loop
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopSequentialDialer}
                    className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-rose-600/20 transition"
                  >
                    <Square className="w-4 h-4" />
                    Stop Dialing
                  </button>
                )}
              </div>
            </div>

            {/* Live Call Screen / Dialogue Display */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Live Call & Dialogue Card */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold text-sm">
                        {activeCallLead ? activeCallLead.name.charAt(0) : '?'}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {activeCallLead ? activeCallLead.name : 'Waiting for dialer...'}
                        </h3>
                        <p className="text-xs text-sky-700 font-mono">
                          {activeCallLead ? activeCallLead.phone_number : 'Ready to call'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {(isDialing || isCallingSingle) && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-mono font-bold animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          00:{callTimer < 10 ? `0${callTimer}` : callTimer}
                        </div>
                      )}

                      {countdownNext !== null && (
                        <div className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-semibold">
                          Next call in {countdownNext}s...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Audio Wave Visualizer Simulation */}
                  {(isDialing || isCallingSingle) && (
                    <div className="flex items-center justify-center gap-1.5 py-3 bg-slate-50 rounded-xl border border-slate-100">
                      {[40, 70, 30, 90, 60, 80, 50, 95, 65, 45, 85, 55, 75, 35, 60].map((h, i) => (
                        <span
                          key={i}
                          className="w-1.5 bg-sky-500 rounded-full animate-pulse"
                          style={{
                            height: `${(h * (callTimer % 5 + 1)) / 5}px`,
                            transition: 'height 0.2s ease'
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Live Transcript / Dialogue Box */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      Live AI Conversation Transcript
                    </label>
                    <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto border border-slate-800 shadow-inner">
                      {callTranscript || 'Transcript will stream here once the call connects...'}
                    </div>
                  </div>

                  {/* Outcome summary */}
                  {callOutcome && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold">Call Outcome: </span>
                        {callOutcome}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Col: Campaign Performance + Quick Call Individual */}
              <div className="space-y-4">
                {/* Campaign Progress */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Campaign Performance
                  </h4>

                  {currentCampaign ? (
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                          <span>Progress</span>
                          <span>
                            {Math.round((currentCampaign.completed_calls / (currentCampaign.total_leads || 1)) * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.round((currentCampaign.completed_calls / (currentCampaign.total_leads || 1)) * 100)}%`
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
                          <div className="text-[11px] font-semibold text-emerald-700">Interested</div>
                          <div className="text-lg font-bold text-emerald-900">{currentCampaign.count_interested || 0}</div>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-xl">
                          <div className="text-[11px] font-semibold text-amber-700">Follow-Ups</div>
                          <div className="text-lg font-bold text-amber-900">{currentCampaign.count_needs_follow_up || 0}</div>
                        </div>

                        <div className="bg-orange-50 border border-orange-100 p-2.5 rounded-xl">
                          <div className="text-[11px] font-semibold text-orange-700">Busy / Retries</div>
                          <div className="text-lg font-bold text-orange-900">{currentCampaign.count_busy || 0}</div>
                        </div>

                        <div className="bg-slate-100 border border-slate-200 p-2.5 rounded-xl">
                          <div className="text-[11px] font-semibold text-slate-600">Pending</div>
                          <div className="text-lg font-bold text-slate-800">{currentCampaign.count_pending || 0}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No active campaign selected</p>
                  )}
                </div>

                {/* Quick Call Individual Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                      Quick Call Individual
                    </h4>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Direct Dial
                    </span>
                  </div>

                  <form onSubmit={handleQuickCallIndividual} className="space-y-2.5">
                    <div>
                      <input
                        type="text"
                        placeholder="Contact Name (e.g. Vikram)"
                        value={directCallName}
                        onChange={(e) => setDirectCallName(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <input
                        type="tel"
                        placeholder="Phone Number (e.g. +91 98765 43210)"
                        value={directCallPhone}
                        onChange={(e) => setDirectCallPhone(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="Inquiry (e.g. Acoustic Guitar Lessons)"
                        value={directCallInterest}
                        onChange={(e) => setDirectCallInterest(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={callingDirect || isDialing}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
                    >
                      {callingDirect ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <PhoneCall className="w-3.5 h-3.5" />
                      )}
                      Call Individual with Voice AI
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LEADS CRM & DETAILED STATUSES */}
      {activeTab === 'leads' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ListOrdered className="w-5 h-5 text-sky-600" />
                Leads Status & Call Logs
              </h2>
              <p className="text-xs text-slate-500">
                View real-time status of each lead, read AI transcripts, update statuses, add individual leads, and trigger manual calls.
              </p>
            </div>

            {/* Filter, Search & Add Lead Button */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAddLeadModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Individual Lead
              </button>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 w-44"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="interested">Interested</option>
                <option value="needs_follow_up">Needs Follow-Up</option>
                <option value="busy">Busy / Voicemail</option>
                <option value="completed">Completed</option>
                <option value="not_interested">Not Interested</option>
              </select>

              <button
                type="button"
                onClick={() => selectedCampaignId && loadLeads(selectedCampaignId)}
                className="p-1.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100"
                title="Refresh leads"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Leads Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Lead Info</th>
                  <th className="px-4 py-3">Interest / Course</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Transcript</th>
                  <th className="px-4 py-3">Scheduled Follow-Up</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{lead.name}</div>
                      <div className="font-mono text-sky-700">{lead.phone_number}</div>
                      {lead.email && <div className="text-[11px] text-slate-400">{lead.email}</div>}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {lead.interest || 'Guitar Lessons'}
                      {lead.notes && (
                        <div className="text-[11px] text-slate-400 italic truncate max-w-xs">{lead.notes}</div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {renderStatusBadge(lead.call_status)}
                        <select
                          value={lead.call_status}
                          onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value as any)}
                          className="text-[11px] border border-slate-200 rounded px-1 py-0.5 bg-slate-50 text-slate-600"
                        >
                          <option value="pending">Pending</option>
                          <option value="interested">Interested</option>
                          <option value="needs_follow_up">Follow-Up</option>
                          <option value="busy">Busy</option>
                          <option value="completed">Completed</option>
                          <option value="not_interested">Not Interested</option>
                        </select>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono text-slate-600">
                      {lead.call_duration ? `${lead.call_duration}s` : '-'}
                      {lead.call_attempts > 0 && (
                        <div className="text-[10px] text-slate-400">({lead.call_attempts} attempts)</div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {lead.call_transcript ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLeadForTranscript(lead);
                            setTranscriptModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-semibold hover:underline"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          View Log ({lead.call_transcript.length > 40 ? `${lead.call_transcript.slice(0, 35)}...` : lead.call_transcript})
                        </button>
                      ) : (
                        <span className="text-slate-400 italic">Not called yet</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {lead.follow_up_date ? (
                        <div>
                          <span className="font-semibold text-slate-800 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-500" />
                            {lead.follow_up_date.slice(0, 16)}
                          </span>
                          {lead.follow_up_notes && (
                            <span className="text-[11px] text-slate-400 block truncate max-w-xs">
                              {lead.follow_up_notes}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openFollowUpModal(lead)}
                          className="text-xs text-amber-700 hover:underline font-medium"
                        >
                          + Set Date
                        </button>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCallSingleLead(lead)}
                          className="p-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg border border-sky-200 transition"
                          title="Call this lead now"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openFollowUpModal(lead)}
                          className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg border border-amber-200 transition"
                          title="Schedule Follow-up"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openWhatsApp(lead.phone_number, lead.name)}
                          className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
                          title="Message on WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteLead(lead.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                          title="Remove lead"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {leads.length === 0 && !loadingLeads && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Users className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold text-slate-700">No leads found in this view</p>
                        <p className="text-[11px] text-slate-500">Add an individual contact or upload an Excel lead sheet to start outbound dialing.</p>
                        <div className="flex justify-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setAddLeadModalOpen(true)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs flex items-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Add Lead
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('upload')}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Upload Sheet
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FOLLOW-UP HUB */}
      {activeTab === 'followups' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              onClick={() => setFollowUpFilter('today')}
              className={`p-4 rounded-2xl border transition cursor-pointer shadow-sm ${
                followUpFilter === 'today'
                  ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20'
                  : 'bg-white border-slate-200 hover:border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Due Today</span>
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {followUpsData?.counts.today || 0}
              </div>
            </div>

            <div
              onClick={() => setFollowUpFilter('overdue')}
              className={`p-4 rounded-2xl border transition cursor-pointer shadow-sm ${
                followUpFilter === 'overdue'
                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/20'
                  : 'bg-white border-slate-200 hover:border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between text-rose-700 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Overdue</span>
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {followUpsData?.counts.overdue || 0}
              </div>
            </div>

            <div
              onClick={() => setFollowUpFilter('upcoming')}
              className={`p-4 rounded-2xl border transition cursor-pointer shadow-sm ${
                followUpFilter === 'upcoming'
                  ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-400/20'
                  : 'bg-white border-slate-200 hover:border-sky-200'
              }`}
            >
              <div className="flex items-center justify-between text-sky-700 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Upcoming</span>
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {followUpsData?.counts.upcoming || 0}
              </div>
            </div>

            <div
              onClick={() => setFollowUpFilter('completed')}
              className={`p-4 rounded-2xl border transition cursor-pointer shadow-sm ${
                followUpFilter === 'completed'
                  ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/20'
                  : 'bg-white border-slate-200 hover:border-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Completed</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {followUpsData?.counts.completed || 0}
              </div>
            </div>
          </div>

          {/* Follow-up Leads List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sky-600" />
                Scheduled Callbacks & Follow-Ups
                {loadingFollowUps && <Loader2 className="w-4 h-4 animate-spin text-sky-600" />}
              </h3>

              <div className="flex gap-2">
                {(['today', 'overdue', 'upcoming', 'completed', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setFollowUpFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
                      followUpFilter === filter
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(followUpsData?.followUps || [])
                .filter(item => {
                  if (followUpFilter === 'all') return true;
                  if (followUpFilter === 'today') {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    return item.follow_up_date?.startsWith(todayStr) && item.follow_up_status !== 'completed';
                  }
                  if (followUpFilter === 'overdue') {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    return item.follow_up_date && item.follow_up_date.slice(0, 10) < todayStr && item.follow_up_status !== 'completed';
                  }
                  if (followUpFilter === 'upcoming') {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    return item.follow_up_date && item.follow_up_date.slice(0, 10) > todayStr && item.follow_up_status !== 'completed';
                  }
                  if (followUpFilter === 'completed') {
                    return item.follow_up_status === 'completed';
                  }
                  return true;
                })
                .map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-sky-300 bg-white shadow-sm transition space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                        <div className="font-mono text-xs text-sky-700">{item.phone_number}</div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          Interest: {item.interest || 'Guitar Lessons'}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          {item.follow_up_date ? item.follow_up_date.slice(0, 16) : 'Needs Callback'}
                        </span>
                        {item.campaign_title && (
                          <span className="block text-[10px] text-slate-400 mt-1">
                            {item.campaign_title}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.follow_up_notes && (
                      <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-700">
                        <span className="font-semibold text-slate-500">Note: </span>
                        {item.follow_up_notes}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCallSingleLead(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          Call Now
                        </button>

                        <button
                          type="button"
                          onClick={() => openWhatsApp(item.phone_number, item.name)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openFollowUpModal(item)}
                          className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                        >
                          Reschedule
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await api.updateCallingLead(item.id, { follow_up_status: 'completed', call_status: 'completed' });
                            loadFollowUps();
                          }}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-bold"
                        >
                          Mark Done
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {(followUpsData?.followUps || []).length === 0 && (
                <div className="col-span-2 text-center py-10 text-slate-400">
                  No scheduled follow-ups found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: VOICE AI & TELEPHONY SETTINGS */}
      {activeTab === 'settings' && (
        <div className="max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-sky-600" />
              Real-Time Voice AI & Outbound Telephony Configuration
            </h2>
            <p className="text-xs text-slate-500">
              Configure your autonomous Voice AI agent, connect your telephony provider (Vapi.ai or Twilio), customize the AI brain prompt, and switch between live calling and simulation.
            </p>
          </div>

          {settingsSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Calling agent & Voice AI settings saved successfully!
            </div>
          )}

          <div className="space-y-6">
            {/* 1. CALLING MODE */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                1. Calling Execution Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCallingSettings({ ...callingSettings, callingMode: 'live' })}
                  className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
                    callingSettings.callingMode === 'live'
                      ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-400/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    callingSettings.callingMode === 'live' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      Live Voice AI Calling
                      <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">Real Telephony</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Dials real phone numbers in real time. The Voice AI agent speaks with the lead on their mobile phone.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCallingSettings({ ...callingSettings, callingMode: 'simulation' })}
                  className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
                    callingSettings.callingMode === 'simulation'
                      ? 'bg-sky-50/60 border-sky-300 ring-2 ring-sky-400/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    callingSettings.callingMode === 'simulation' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      Interactive Simulation Mode
                      <span className="text-[10px] px-1.5 py-0.2 bg-sky-100 text-sky-800 rounded font-bold">Free Demo</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tests call queue and dialogue scripts locally with browser TTS audio. Zero phone costs or credentials needed.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. TELEPHONY PROVIDER */}
            {callingSettings.callingMode === 'live' && (
              <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    2. Select Voice AI Provider
                  </label>
                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> 100% Safe: Uses dedicated business numbers
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCallingSettings({ ...callingSettings, callingProvider: 'vapi' })}
                    className={`p-3 rounded-xl border text-left transition ${
                      callingSettings.callingProvider === 'vapi'
                        ? 'bg-white border-sky-500 shadow-sm ring-2 ring-sky-500/20'
                        : 'bg-white/60 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">Vapi.ai</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">Recommended</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Turnkey real-time Voice AI. Ultra-low latency, handles interruptions naturally.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCallingSettings({ ...callingSettings, callingProvider: 'twilio' })}
                    className={`p-3 rounded-xl border text-left transition ${
                      callingSettings.callingProvider === 'twilio'
                        ? 'bg-white border-sky-500 shadow-sm ring-2 ring-sky-500/20'
                        : 'bg-white/60 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <span className="text-sm font-bold text-slate-900">Twilio Voice</span>
                    <p className="text-xs text-slate-500 mt-1">
                      Standard enterprise cloud telephony with TwiML and programmable voice.
                    </p>
                  </button>
                </div>

                {/* VAPI CREDENTIALS */}
                {callingSettings.callingProvider === 'vapi' && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-indigo-600" />
                        Vapi.ai API Credentials
                      </span>
                      <a
                        href="https://vapi.ai"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-sky-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        Get Free $10 Trial Key on Vapi.ai <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Vapi Private API Key
                      </label>
                      <input
                        type="password"
                        value={callingSettings.vapiApiKey || ''}
                        onChange={(e) => setCallingSettings({ ...callingSettings, vapiApiKey: e.target.value })}
                        placeholder="e.g. 4d7b2a9e-...."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Vapi Phone Number ID
                        </label>
                        <input
                          type="text"
                          value={callingSettings.vapiPhoneNumberId || ''}
                          onChange={(e) => setCallingSettings({ ...callingSettings, vapiPhoneNumberId: e.target.value })}
                          placeholder="e.g. 7f8a9b..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <div className="mt-1.5 p-2 bg-indigo-50/60 border border-indigo-100 rounded-lg text-[11px] text-slate-600 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-indigo-900">Where to find this in Vapi?</span>
                            <a
                              href="https://dashboard.vapi.ai/phone-numbers"
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline font-bold inline-flex items-center gap-0.5"
                            >
                              Open Numbers <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight">
                            Go to <strong>Phone Numbers</strong> in Vapi and click <strong>[+ Create Phone Number]</strong> to generate a free trial number or import from Twilio. Copy the Number ID and paste here.
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Assistant ID (Optional)
                        </label>
                        <input
                          type="text"
                          value={callingSettings.vapiAssistantId || ''}
                          onChange={(e) => setCallingSettings({ ...callingSettings, vapiAssistantId: e.target.value })}
                          placeholder="Optional if using custom prompt below"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TWILIO CREDENTIALS */}
                {callingSettings.callingProvider === 'twilio' && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-indigo-600" />
                        Twilio Cloud Telephony Credentials
                      </span>
                      <a
                        href="https://console.twilio.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-sky-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        Open Twilio Console <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Account SID
                        </label>
                        <input
                          type="text"
                          value={callingSettings.twilioAccountSid || ''}
                          onChange={(e) => setCallingSettings({ ...callingSettings, twilioAccountSid: e.target.value })}
                          placeholder="ACxxxxxxxx..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Auth Token
                        </label>
                        <input
                          type="password"
                          value={callingSettings.twilioAuthToken || ''}
                          onChange={(e) => setCallingSettings({ ...callingSettings, twilioAuthToken: e.target.value })}
                          placeholder="xxxxxxxx..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Twilio Caller Phone Number
                      </label>
                      <input
                        type="text"
                        value={callingSettings.twilioPhoneNumber || ''}
                        onChange={(e) => setCallingSettings({ ...callingSettings, twilioPhoneNumber: e.target.value })}
                        placeholder="+1234567890 or +91..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. AI CALLER BRAIN & SYSTEM PROMPT */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                3. Voice AI System Prompt (Agent Brain & Knowledge)
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Instruct the AI on how to conduct the phone call, what musical packages Sneha offers, how to answer pricing inquiries, and how to handle objections.
              </p>
              <textarea
                value={callingSettings.systemPrompt || ''}
                onChange={(e) => setCallingSettings({ ...callingSettings, systemPrompt: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono leading-relaxed bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="You are Aria, an AI phone assistant for Sneha Harmony..."
              />
            </div>

            {/* 4. CALLER IDENTITY & VOICE TONE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Caller Identity / Agent Name
                </label>
                <input
                  type="text"
                  value={callingSettings.agentName}
                  onChange={(e) => setCallingSettings({ ...callingSettings, agentName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Voice Tone Model
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCallingSettings({ ...callingSettings, voiceGender: 'female' })}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                      callingSettings.voiceGender === 'female'
                        ? 'bg-sky-50 text-sky-700 border-sky-300 ring-2 ring-sky-400/20'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    Female (Warm)
                  </button>

                  <button
                    type="button"
                    onClick={() => setCallingSettings({ ...callingSettings, voiceGender: 'male' })}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                      callingSettings.voiceGender === 'male'
                        ? 'bg-sky-50 text-sky-700 border-sky-300 ring-2 ring-sky-400/20'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    Male (Calm)
                  </button>
                </div>
              </div>
            </div>

            {/* 5. GREETING SCRIPT & PACING */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Master Pitch / Opening Script
              </label>
              <textarea
                value={callingSettings.defaultScript}
                onChange={(e) => setCallingSettings({ ...callingSettings, defaultScript: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs leading-relaxed bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Use <code>{'{name}'}</code> to dynamically greet each contact by their name.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pacing Delay Between Leads (Seconds)
              </label>
              <input
                type="number"
                min="3"
                max="60"
                value={callingSettings.delayBetweenCalls}
                onChange={(e) => setCallingSettings({ ...callingSettings, delayBetweenCalls: Number(e.target.value) })}
                className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-sky-600/20 transition flex items-center gap-2"
              >
                {savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Voice AI Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD SINGLE INDIVIDUAL LEAD */}
      {addLeadModalOpen && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setAddLeadModalOpen(false); }}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-600" />
                Add Individual Lead
              </h3>
              <button
                onClick={() => setAddLeadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rohan Verma"
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={newLeadForm.phone_number}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, phone_number: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. rohan@gmail.com"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Inquiry / Interest
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Guitar Lessons"
                    value={newLeadForm.interest}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, interest: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  placeholder="Inquiry notes, preferred time, etc."
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Schedule Callback Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={newLeadForm.follow_up_date}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, follow_up_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 font-medium">
                  <input
                    type="checkbox"
                    checked={newLeadForm.call_immediately}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, call_immediately: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Call this lead immediately after saving</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAddLeadModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveIndividualLead}
                disabled={savingNewLead}
                className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm flex items-center gap-1.5"
              >
                {savingNewLead && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1B: QUICK CALL NUMBER MODAL */}
      {quickCallModalOpen && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setQuickCallModalOpen(false); }}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Quick Call Phone Number
                  </h3>
                  <p className="text-xs text-slate-500">Test voice call immediately with AI Voice Caller</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickCallModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickCallIndividual} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact / Lead Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sneha or Test Contact"
                  value={directCallName}
                  onChange={(e) => setDirectCallName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number to Dial <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210 or 9876543210"
                  value={directCallPhone}
                  onChange={(e) => setDirectCallPhone(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Inquiry / Topic
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acoustic Guitar Lessons"
                  value={directCallInterest}
                  onChange={(e) => setDirectCallInterest(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  What happens when you click "Dial & Call Now":
                </div>
                <ul className="list-disc pl-4 text-[11px] text-emerald-700 space-y-0.5">
                  <li>Switches directly to the live auto-dialer console.</li>
                  <li>Aria greets the contact with conversational Voice AI.</li>
                  <li>Real-time speech synthesizer plays audio through your browser speakers.</li>
                  <li>Full live transcript & outcome are automatically recorded in CRM.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickCallModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={callingDirect}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-1.5 transition"
                >
                  {callingDirect ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PhoneCall className="w-3.5 h-3.5" />
                  )}
                  📞 Dial & Call Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SCHEDULE FOLLOW-UP MODAL */}
      {followUpModalOpen && selectedLeadForFollowUp && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setFollowUpModalOpen(false); }}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sky-600" />
                Schedule Follow-up Call
              </h3>
              <button
                onClick={() => setFollowUpModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <span className="text-xs text-slate-500">Lead:</span>
              <div className="font-bold text-slate-800 text-sm">
                {selectedLeadForFollowUp.name} ({selectedLeadForFollowUp.phone_number})
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={followUpDateInput}
                onChange={(e) => setFollowUpDateInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Follow-up Agenda / Notes
              </label>
              <textarea
                value={followUpNotesInput}
                onChange={(e) => setFollowUpNotesInput(e.target.value)}
                rows={3}
                placeholder="e.g. Call to confirm trial lesson slot, share WhatsApp brochure..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFollowUpModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFollowUp}
                className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm"
              >
                Confirm Follow-Up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW FULL TRANSCRIPT MODAL */}
      {transcriptModalOpen && selectedLeadForTranscript && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setTranscriptModalOpen(false); }}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Call Transcript: {selectedLeadForTranscript.name}
                </h3>
                <p className="text-xs font-mono text-slate-500">
                  {selectedLeadForTranscript.phone_number} • {selectedLeadForTranscript.call_duration}s call
                </p>
              </div>
              <button
                onClick={() => setTranscriptModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
              {selectedLeadForTranscript.call_transcript}
            </div>

            {selectedLeadForTranscript.follow_up_notes && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <span className="font-bold">Follow-Up Note: </span>
                {selectedLeadForTranscript.follow_up_notes}
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => openWhatsApp(selectedLeadForTranscript.phone_number, selectedLeadForTranscript.name)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp Lead
              </button>

              <button
                type="button"
                onClick={() => setTranscriptModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
