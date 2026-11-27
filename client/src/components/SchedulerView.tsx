import React, { useState, useRef, useEffect } from 'react';
import { 
  CalendarClock, 
  Plus, 
  Trash2, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Image as ImageIcon,
  Tv2,
  UploadCloud,
  FileVideo,
  ExternalLink,
  Globe,
  Lock,
  EyeOff,
  X,
  Loader2,
  Film,
  Calendar,
  ListFilter,
  RotateCw,
  FileText,
  Sparkles,
  Smartphone,
  Check,
  AlertTriangle,
  Layers,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  CheckCheck
} from 'lucide-react';
import type { ScheduledPost, Channel, MultiPublishResult } from '../types';
import { api } from '../api';

interface SchedulerViewProps {
  posts: ScheduledPost[];
  channels: Channel[];
  onRefresh: () => void;
  showCreateModal?: boolean;
  onCloseCreateModal?: () => void;
}

export const SchedulerView: React.FC<SchedulerViewProps> = ({
  posts,
  channels,
  onRefresh,
  showCreateModal = false,
  onCloseCreateModal
}) => {
  const [modalOpen, setModalOpen] = useState(showCreateModal);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'drafts'>('list');
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'failed'>('all');
  const [platformFilter, setPlatformFilter] = useState('all');

  // Multi-Platform Form State
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>(
    channels.length > 0 ? channels.map(c => String(c.id)) : []
  );

  useEffect(() => {
    if (channels.length > 0 && selectedChannelIds.length === 0) {
      setSelectedChannelIds(channels.map(c => String(c.id)));
    }
  }, [channels]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'unlisted' | 'private'>('public');
  const [previewPlatform, setPreviewPlatform] = useState<'youtube' | 'instagram' | 'telegram'>('youtube');
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    originalName: string;
    size: number;
    url: string;
    mediaType: 'video' | 'image';
  } | null>(null);

  // Multi-Publish Results Modal State
  const [publishResult, setPublishResult] = useState<MultiPublishResult | null>(null);
  const [retryingBatch, setRetryingBatch] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isModalVisible = modalOpen || showCreateModal;

  const handleClose = () => {
    setModalOpen(false);
    if (onCloseCreateModal) onCloseCreateModal();
    setTitle('');
    setContent('');
    setMediaUrl('');
    setScheduledAt('');
    setUploadedFileInfo(null);
    setPrivacyStatus('public');
  };

  const toggleChannel = (id: string) => {
    setSelectedChannelIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const setQuickTime = (hoursFromNow: number) => {
    const target = new Date(Date.now() + hoursFromNow * 3600 * 1000);
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledAt(localIso);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await api.uploadMedia(file);
      setUploadedFileInfo({
        originalName: res.originalName,
        size: res.size,
        url: res.url,
        mediaType: res.mediaType
      });
      setMediaUrl(res.url);

      if (!title) {
        const cleanName = res.originalName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Platform Validation Calculations
  const selectedChannels = channels.filter(c => selectedChannelIds.includes(String(c.id)));
  const hasYouTube = selectedChannels.some(c => c.platform === 'youtube');
  const hasInstagram = selectedChannels.some(c => c.platform === 'instagram');
  const hasTelegram = selectedChannels.some(c => c.platform === 'telegram');

  const isVideo = uploadedFileInfo?.mediaType === 'video' || (mediaUrl && /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl));
  const isImage = uploadedFileInfo?.mediaType === 'image' || (mediaUrl && /\.(jpg|jpeg|png|webp|gif)$/i.test(mediaUrl));

  const youtubeValidationWarning = hasYouTube && !isVideo ? 'YouTube requires a video file. Image or text cannot be uploaded.' : null;
  const instagramValidationWarning = hasInstagram && !mediaUrl ? 'Instagram requires an image or video asset. Text-only posts are not supported by the Instagram API.' : null;

  const handleMultiPublish = async (action: 'publish_now' | 'schedule', asDraft = false) => {
    if (selectedChannelIds.length === 0) {
      alert('Please select at least one target social media account.');
      return;
    }

    if (!content.trim() && !title.trim()) {
      alert('Please provide a title or content description.');
      return;
    }

    if (!asDraft && hasYouTube && !isVideo) {
      alert('YouTube requires a video file upload. Please upload a video file or uncheck YouTube.');
      return;
    }

    if (!asDraft && hasInstagram && !mediaUrl) {
      alert('Instagram requires a photo or video. Text-only posts are not supported by the Instagram API.');
      return;
    }

    if (!asDraft && action === 'schedule' && !scheduledAt) {
      alert('Please select a scheduled date and time.');
      return;
    }

    setSaving(true);
    try {
      const result = await api.multiPublishPosts({
        channel_ids: selectedChannelIds,
        title: title.trim() || undefined,
        content: content.trim(),
        media_url: mediaUrl.trim() || undefined,
        media_type: uploadedFileInfo?.mediaType || (hasYouTube ? 'video' : 'image'),
        scheduled_at: asDraft ? new Date().toISOString() : (scheduledAt || new Date().toISOString()),
        privacy_status: privacyStatus,
        action: asDraft ? 'schedule' : action,
        is_draft: asDraft
      });

      if (action === 'publish_now') {
        setPublishResult(result);
        onRefresh();
      } else {
        alert(asDraft ? 'Post saved as draft!' : `Successfully scheduled across ${selectedChannelIds.length} social account(s)!`);
        handleClose();
        onRefresh();
      }
    } catch (err: any) {
      alert(`Publishing failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRetryBatch = async (batchId: string) => {
    setRetryingBatch(true);
    try {
      const res = await api.retryFailedBatch(batchId);
      if (publishResult) {
        setPublishResult({
          ...publishResult,
          summary: res.summary,
          results: res.results
        });
      }
      onRefresh();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingBatch(false);
    }
  };

  const handlePublishSingleNow = async (id: number) => {
    if (confirm('Publish this post immediately to the platform?')) {
      try {
        await api.publishPostNow(id);
        onRefresh();
      } catch (err: any) {
        alert(`Publish failed: ${err.message}`);
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this post?')) {
      try {
        await api.deletePost(id);
        onRefresh();
      } catch (err: any) {
        alert(`Delete failed: ${err.message}`);
      }
    }
  };

  const filteredPosts = posts.filter(p => {
    const matchesPlatform = platformFilter === 'all' || p.platform === platformFilter;
    if (viewMode === 'drafts') {
      return matchesPlatform && p.status === 'pending' && !p.scheduled_at;
    }
    const matchesStatus = filter === 'all' ? true : p.status === filter;
    return matchesPlatform && matchesStatus;
  });

  const currentMonthPosts = posts.filter(p => p.scheduled_at && p.status === 'pending');

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-indigo-600" />
            Content & Multi-Platform Scheduler
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Author once, validate per-platform media rules, and publish or schedule simultaneously across YouTube, Instagram, and Telegram.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === 'list' ? 'bg-white text-slate-800 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === 'calendar' ? 'bg-white text-slate-800 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Calendar Grid
            </button>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs shadow-indigo-200"
          >
            <Plus className="w-4 h-4" />
            <span>Create & Multi-Publish</span>
          </button>
        </div>
      </div>

      {/* Filter Bar (List View) */}
      {viewMode === 'list' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
            {(['all', 'pending', 'published', 'failed'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-lg capitalize transition ${
                  filter === tab ? 'bg-white text-slate-800 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none shadow-2xs"
          >
            <option value="all">All Platforms</option>
            <option value="youtube">YouTube Videos</option>
            <option value="instagram">Instagram Posts</option>
            <option value="telegram">Telegram Broadcasts</option>
          </select>
        </div>
      )}

      {/* Main View: Calendar vs List */}
      {viewMode === 'calendar' ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Monthly Publishing Schedule
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {currentMonthPosts.length} posts pending this month
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 uppercase py-2">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 28 }).map((_, idx) => {
              const dayNum = idx + 1;
              const dayPosts = currentMonthPosts.filter(p => new Date(p.scheduled_at).getDate() === dayNum);

              return (
                <div key={idx} className="min-h-[90px] p-2 bg-slate-50/60 border border-slate-100 rounded-xl space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400">{dayNum}</div>
                  {dayPosts.map(dp => (
                    <div 
                      key={dp.id}
                      onClick={() => handlePublishSingleNow(dp.id)}
                      className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs text-[10px] space-y-0.5 cursor-pointer hover:border-indigo-400 transition"
                      title="Click to publish now"
                    >
                      <span className={`px-1 rounded font-bold uppercase text-[9px] ${
                        dp.platform === 'youtube' ? 'bg-rose-100 text-rose-700' :
                        dp.platform === 'instagram' ? 'bg-pink-100 text-pink-700' : 'bg-sky-100 text-sky-700'
                      }`}>
                        {dp.platform}
                      </span>
                      <p className="font-semibold text-slate-800 truncate">{dp.title || dp.content}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {filteredPosts.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center max-w-md mx-auto space-y-3">
              <CalendarClock className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-800">No scheduled posts found</h3>
              <p className="text-xs text-slate-500">
                Click "+ Create & Multi-Publish" to author content, select multiple platforms, preview feeds, and publish.
              </p>
            </div>
          ) : (
            filteredPosts.map(post => {
              const isPending = post.status === 'pending';
              const isPublished = post.status === 'published';
              const isFailed = post.status === 'failed';

              return (
                <div 
                  key={post.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden">
                      {post.media_url ? (
                        post.media_type === 'video' ? (
                          <div className="w-full h-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                            <Film className="w-6 h-6 text-indigo-400" />
                          </div>
                        ) : (
                          <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                        )
                      ) : (
                        <FileText className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          post.platform === 'youtube' ? 'bg-rose-100 text-rose-800' :
                          post.platform === 'instagram' ? 'bg-pink-100 text-pink-800' : 'bg-sky-100 text-sky-800'
                        }`}>
                          {post.platform}
                        </span>
                        <span className="font-bold text-slate-800 text-sm truncate">{post.title || 'Untitled Post'}</span>
                        {post.batch_id && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-mono">
                            Multi-Platform Batch
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 font-sans">{post.content}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          {new Date(post.scheduled_at).toLocaleString()}
                        </span>
                        {post.published_url && (
                          <a
                            href={post.published_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline flex items-center gap-0.5 font-medium"
                          >
                            View Post <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {post.error_message && (
                          <span className="text-rose-600 font-semibold truncate max-w-xs">
                            Error: {post.error_message}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {isPending && (
                      <button
                        onClick={() => handlePublishSingleNow(post.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Publish Now
                      </button>
                    )}

                    {isFailed && (
                      post.batch_id ? (
                        <button
                          onClick={() => handleRetryBatch(post.batch_id!)}
                          disabled={retryingBatch}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                        >
                          <RotateCw className={`w-3.5 h-3.5 ${retryingBatch ? 'animate-spin' : ''}`} />
                          Retry Batch
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePublishSingleNow(post.id)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          Retry Post
                        </button>
                      )
                    )}

                    <button
                      onClick={() => handleDelete(post.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition"
                      title="Delete post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MULTI-PLATFORM PUBLISHING STUDIO MODAL */}
      {isModalVisible && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-5xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Multi-Platform Publishing Studio</h3>
                  <p className="text-xs text-slate-500">Upload once, validate requirements, preview each platform, and publish or schedule simultaneously.</p>
                </div>
              </div>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: Inputs, Account Selection & Media */}
              <div className="lg:col-span-7 space-y-4">
                {/* 1. Account Selection Grid */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>1. Select Target Accounts ({selectedChannelIds.length} Selected)</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedChannelIds.length === channels.length) {
                          setSelectedChannelIds([]);
                        } else {
                          setSelectedChannelIds(channels.map(c => String(c.id)));
                        }
                      }}
                      className="text-[11px] text-indigo-600 hover:underline font-semibold"
                    >
                      {selectedChannelIds.length === channels.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {channels.map(c => {
                      const isSelected = selectedChannelIds.includes(String(c.id));
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleChannel(String(c.id))}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start gap-2.5 ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/40 text-slate-900 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                c.platform === 'youtube' ? 'bg-rose-100 text-rose-700' :
                                c.platform === 'instagram' ? 'bg-pink-100 text-pink-700' : 'bg-sky-100 text-sky-700'
                              }`}>
                                {c.platform}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-800 truncate">{c.display_name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{c.username || c.platform_id}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Platform Validation Badges */}
                {(youtubeValidationWarning || instagramValidationWarning) && (
                  <div className="space-y-1.5">
                    {youtubeValidationWarning && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{youtubeValidationWarning}</span>
                      </div>
                    )}
                    {instagramValidationWarning && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{instagramValidationWarning}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Media Upload Asset */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>2. Media Upload (Video or Image)</span>
                    {mediaUrl && (
                      <button
                        type="button"
                        onClick={() => { setMediaUrl(''); setUploadedFileInfo(null); }}
                        className="text-[11px] text-rose-600 hover:underline font-semibold"
                      >
                        Remove Media
                      </button>
                    )}
                  </label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/60 p-4 rounded-xl text-center cursor-pointer transition space-y-1.5"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*,image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <UploadCloud className="w-6 h-6 text-indigo-500 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700">
                      {uploading ? 'Uploading to server...' : uploadedFileInfo ? `${uploadedFileInfo.originalName} (${(uploadedFileInfo.size / (1024*1024)).toFixed(1)} MB)` : 'Click or drop video (MP4/MOV) or photo (PNG/JPG)'}
                    </p>
                    <p className="text-[10px] text-slate-400">Supported by all platforms. YouTube requires MP4/MOV video.</p>
                  </div>
                </div>

                {/* 3. Title & Content */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Post Title {hasYouTube && <span className="text-rose-500">* (YouTube Video Title)</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Master Acoustic Fingerstyle Guitar - Complete Tutorial"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Caption, Description & Hashtags
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Write your cross-platform caption, details, links, and hashtags (#guitar #acoustic #music)..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>

                {/* Platform specific settings */}
                {hasYouTube && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">YouTube Privacy Status</label>
                    <select
                      value={privacyStatus}
                      onChange={(e) => setPrivacyStatus(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white font-medium"
                    >
                      <option value="public">Public (Visible to everyone)</option>
                      <option value="unlisted">Unlisted (Anyone with link)</option>
                      <option value="private">Private (Only you)</option>
                    </select>
                  </div>
                )}

                {/* Schedule Time Pickers */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Schedule Publish Date & Time</label>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setQuickTime(2)}
                      className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-medium"
                    >
                      +2 hrs
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickTime(24)}
                      className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-medium"
                    >
                      Tomorrow
                    </button>
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Platform-Specific Previews & Action Buttons */}
              <div className="lg:col-span-5 space-y-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Live Feed Mockup
                    </span>
                    {/* Preview Platform Switcher */}
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[10px] font-semibold">
                      {(['youtube', 'instagram', 'telegram'] as const).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPreviewPlatform(p)}
                          className={`px-2 py-0.5 rounded capitalize transition ${
                            previewPlatform === p
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* PREVIEW 1: YOUTUBE MOCKUP */}
                  {previewPlatform === 'youtube' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
                      <div className="h-44 bg-slate-900 text-white flex items-center justify-center relative">
                        {mediaUrl ? (
                          isVideo ? (
                            <div className="text-center space-y-1">
                              <Film className="w-8 h-8 mx-auto text-rose-500" />
                              <span className="text-[11px] font-bold text-slate-200">YouTube Video Asset</span>
                            </div>
                          ) : (
                            <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                          )
                        ) : (
                          <div className="text-center text-slate-500 space-y-1">
                            <ImageIcon className="w-6 h-6 mx-auto" />
                            <span className="text-[10px]">No video selected</span>
                          </div>
                        )}
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-white">
                          04:30
                        </span>
                      </div>

                      <div className="p-3 space-y-2">
                        <p className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                          {title || 'Your YouTube Video Title Goes Here'}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-[10px]">
                            S
                          </div>
                          <span className="font-semibold text-slate-700 text-xs">Sneha Harmony</span>
                          <span className="text-[10px] text-slate-400">• 1.2K views • Just now</span>
                        </div>
                        <p className="text-slate-600 line-clamp-2 text-[11px] leading-relaxed pt-1 border-t border-slate-100">
                          {content || 'Video description, session links, and details will appear here...'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* PREVIEW 2: INSTAGRAM FEED MOCKUP */}
                  {previewPlatform === 'instagram' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
                      <div className="p-2.5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-pink-600 text-white flex items-center justify-center font-bold text-[10px]">
                            S
                          </div>
                          <span className="font-bold text-slate-900 text-[11px]">sneharmony_music</span>
                        </div>
                        <span className="text-slate-400 font-bold">•••</span>
                      </div>

                      <div className="h-44 bg-slate-100 text-slate-400 flex items-center justify-center overflow-hidden">
                        {mediaUrl ? (
                          isVideo ? (
                            <div className="w-full h-full bg-slate-900 text-white flex items-center justify-center">
                              <Film className="w-8 h-8 text-pink-400" />
                            </div>
                          ) : (
                            <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                          )
                        ) : (
                          <div className="text-center text-slate-400">
                            <ImageIcon className="w-6 h-6 mx-auto mb-1" />
                            <span className="text-[10px]">Instagram Photo / Reel</span>
                          </div>
                        )}
                      </div>

                      <div className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-slate-700">
                          <div className="flex items-center gap-3">
                            <Heart className="w-4 h-4 hover:text-rose-600 cursor-pointer" />
                            <MessageCircle className="w-4 h-4 cursor-pointer" />
                            <Share2 className="w-4 h-4 cursor-pointer" />
                          </div>
                          <Bookmark className="w-4 h-4 cursor-pointer" />
                        </div>
                        <p className="text-[11px] text-slate-800 leading-relaxed pt-1">
                          <strong className="font-bold mr-1">sneharmony_music</strong>
                          {content || 'Your captivating Instagram caption, lesson highlights, and hashtags #guitar #acoustic...'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* PREVIEW 3: TELEGRAM CHANNEL MOCKUP */}
                  {previewPlatform === 'telegram' && (
                    <div className="bg-[#e7ebf0] p-3 rounded-xl border border-slate-200 shadow-sm text-xs space-y-2">
                      <div className="bg-white rounded-xl p-3 shadow-xs max-w-sm space-y-2 border border-slate-200/60">
                        <div className="flex items-center gap-1.5 text-sky-600 font-bold text-[11px]">
                          <span>Sneha Harmony Channel</span>
                        </div>
                        {mediaUrl && (
                          <div className="h-32 rounded-lg bg-slate-900 overflow-hidden flex items-center justify-center text-white">
                            {isVideo ? <Film className="w-6 h-6 text-sky-400" /> : <img src={mediaUrl} alt="" className="w-full h-full object-cover" />}
                          </div>
                        )}
                        {title && <p className="font-bold text-slate-900 text-xs">{title}</p>}
                        <p className="text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {content || 'Your Telegram broadcast message with announcement, links, and updates...'}
                        </p>
                        <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 pt-1">
                          <span>12:00 PM</span>
                          <CheckCheck className="w-3 h-3 text-sky-500" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Multi-Publish Action Controls */}
                <div className="space-y-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleMultiPublish('publish_now')}
                    disabled={saving || selectedChannelIds.length === 0}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Publish to Selected Now ({selectedChannelIds.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMultiPublish('schedule')}
                    disabled={saving || selectedChannelIds.length === 0}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                  >
                    <CalendarClock className="w-4 h-4" />
                    Schedule for Selected ({selectedChannelIds.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMultiPublish('schedule', true)}
                    disabled={saving}
                    className="w-full py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs rounded-xl transition"
                  >
                    Save as Draft
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MULTI-PUBLISH RESULTS & RETRY MODAL */}
      {publishResult && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setPublishResult(null); }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Multi-Platform Publishing Results</h3>
              </div>
              <button
                onClick={() => { setPublishResult(null); handleClose(); }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="font-mono text-slate-500">Batch: {publishResult.batchId}</span>
              <div className="flex items-center gap-3 font-semibold">
                <span className="text-emerald-700">{publishResult.summary?.successful || 0} Successful</span>
                <span className="text-rose-700">{publishResult.summary?.failed || 0} Failed</span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {publishResult.results?.map(res => (
                <div key={res.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                        res.platform === 'youtube' ? 'bg-rose-100 text-rose-700' :
                        res.platform === 'instagram' ? 'bg-pink-100 text-pink-700' : 'bg-sky-100 text-sky-700'
                      }`}>
                        {res.platform}
                      </span>
                      <span className="font-bold text-slate-800 truncate">{res.channel_name}</span>
                    </div>
                    {res.error && (
                      <p className="text-[10px] text-rose-600 truncate mt-0.5">{res.error}</p>
                    )}
                  </div>

                  <div>
                    {res.status === 'published' ? (
                      res.published_url ? (
                        <a
                          href={res.published_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                        >
                          View <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                          Published
                        </span>
                      )
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[10px] font-bold">
                        Failed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              {(publishResult.summary?.failed || 0) > 0 && (
                <button
                  type="button"
                  disabled={retryingBatch}
                  onClick={() => handleRetryBatch(publishResult.batchId)}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${retryingBatch ? 'animate-spin' : ''}`} />
                  Retry Failed Platforms Only
                </button>
              )}
              <button
                type="button"
                onClick={() => { setPublishResult(null); handleClose(); }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
