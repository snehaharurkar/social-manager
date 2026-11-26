import React, { useState, useRef } from 'react';
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
  Film
} from 'lucide-react';
import type { ScheduledPost, Channel } from '../types';
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
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'failed'>('all');

  // Form State
  const [channelId, setChannelId] = useState(channels.length > 0 ? channels[0].id : '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'unlisted' | 'private'>('public');
  const [mediaSourceType, setMediaSourceType] = useState<'file' | 'url'>('file');
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    originalName: string;
    size: number;
    url: string;
    mediaType: 'video' | 'image';
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isModalVisible = modalOpen || showCreateModal;

  const selectedChannel = channels.find(c => c.id === channelId) || channels[0];
  const isYouTube = selectedChannel?.platform === 'youtube';

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

  // Helper for quick time shortcuts
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

      // Auto-populate title if empty from filename
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

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelId) {
      alert('Please select a Channel.');
      return;
    }

    if (isYouTube && !mediaUrl) {
      alert('Please upload a video file for YouTube.');
      return;
    }

    if (!content.trim() && !title.trim()) {
      alert('Please provide a title or description.');
      return;
    }

    if (!scheduledAt) {
      alert('Please select a scheduled date and time.');
      return;
    }

    setSaving(true);
    try {
      await api.createPost({
        channel_id: channelId,
        platform: selectedChannel?.platform || 'youtube',
        title: title ? title.trim() : undefined,
        content: content.trim(),
        media_url: mediaUrl ? mediaUrl.trim() : undefined,
        privacy_status: privacyStatus,
        media_type: uploadedFileInfo?.mediaType || (isYouTube ? 'video' : 'image'),
        scheduled_at: scheduledAt
      });
      handleClose();
      onRefresh();
    } catch (err: any) {
      alert(`Scheduling error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublishNow = async (id: number) => {
    if (confirm('Publish this post/video immediately to the channel?')) {
      try {
        await api.publishPostNow(id);
        onRefresh();
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this scheduled post?')) {
      try {
        await api.deletePost(id);
        onRefresh();
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  const filteredPosts = posts.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Post Scheduler & Video Publishing</h2>
          <p className="text-xs text-slate-500 mt-1">Upload videos from your media, schedule posts for a decided date & time, and manage your publishing queue.</p>
        </div>
        <button
          onClick={() => {
            if (channels.length > 0 && !channelId) setChannelId(channels[0].id);
            setQuickTime(2); // default to 2 hours from now
            setModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs shadow-indigo-200"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Video / Schedule Post</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium">
          {(['all', 'pending', 'published', 'failed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-lg capitalize transition-all ${
                filter === tab 
                  ? 'bg-white text-slate-800 font-semibold shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab} ({posts.filter(p => tab === 'all' ? true : p.status === tab).length})
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredPosts.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <CalendarClock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No scheduled posts found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Upload a video or photo to automatically publish to YouTube or Instagram at your decided time.
          </p>
          <button
            onClick={() => {
              if (channels.length > 0 && !channelId) setChannelId(channels[0].id);
              setQuickTime(2);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule your first post</span>
          </button>
        </div>
      ) : (
        /* Post Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPosts.map((post) => {
            const isYt = post.platform === 'youtube';
            const isTg = post.platform === 'telegram';
            const isPending = post.status === 'pending';
            const isPublished = post.status === 'published';
            const isFailed = post.status === 'failed';

            return (
              <div 
                key={post.id} 
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  {/* Top: Platform, Privacy & Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        isYt ? 'bg-rose-100 text-rose-700' :
                        isTg ? 'bg-sky-100 text-sky-700' :
                        'bg-pink-100 text-pink-700'
                      }`}>
                        {post.platform}
                      </span>

                      {post.privacy_status && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 flex items-center gap-1">
                          {post.privacy_status === 'public' && <Globe className="w-2.5 h-2.5" />}
                          {post.privacy_status === 'unlisted' && <EyeOff className="w-2.5 h-2.5" />}
                          {post.privacy_status === 'private' && <Lock className="w-2.5 h-2.5" />}
                          <span className="capitalize">{post.privacy_status}</span>
                        </span>
                      )}
                    </div>

                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      isPending ? 'bg-amber-50 text-amber-800 border border-amber-200/60' :
                      isPublished ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60' :
                      'bg-rose-50 text-rose-800 border border-rose-200/60'
                    }`}>
                      {isPending && <Clock className="w-3 h-3 text-amber-600" />}
                      {isPublished && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                      {isFailed && <AlertCircle className="w-3 h-3 text-rose-600" />}
                      <span className="capitalize">{post.status}</span>
                    </span>
                  </div>

                  {/* Channel Tag */}
                  {post.channel_name && (
                    <div className="text-xs font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                      <Tv2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{post.channel_name}</span>
                    </div>
                  )}

                  {/* Title if present */}
                  {post.title && (
                    <h4 className="font-semibold text-slate-900 text-sm mb-1">{post.title}</h4>
                  )}

                  {/* Content / Description */}
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed font-sans mb-3 whitespace-pre-line">
                    {post.content}
                  </p>

                  {/* Media Indicator */}
                  {post.media_url && (
                    <div className="mb-3 p-2 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-2">
                      {isYt ? (
                        <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <FileVideo className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                      <div className="text-[11px] text-slate-700 truncate font-mono">
                        {post.media_url.split('/').pop()}
                      </div>
                    </div>
                  )}

                  {/* Published URL Link */}
                  {post.published_url && (
                    <div className="mb-3">
                      <a
                        href={post.published_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                          isYt
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200/60'
                            : isTg
                            ? 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200/60'
                            : 'bg-pink-50 hover:bg-pink-100 text-pink-700 border-pink-200/60'
                        }`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{isYt ? 'Watch on YouTube' : isTg ? 'View on Telegram' : 'View on Instagram'}</span>
                      </a>
                    </div>
                  )}

                  {/* Scheduled Time Banner */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Scheduled for:</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {new Date(post.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>

                  {post.error_message && (
                    <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-100 text-[11px] text-rose-700">
                      Error: {post.error_message}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                  {isPending ? (
                    <button
                      onClick={() => handlePublishNow(post.id)}
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium text-[11px]"
                    >
                      <Send className="w-3 h-3" /> Publish Now
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      {isPublished ? `Published ${new Date(post.published_at || '').toLocaleDateString()}` : 'Execution failed'}
                    </span>
                  )}

                  <button
                    onClick={() => handleDelete(post.id)}
                    className="flex items-center gap-1 text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="Delete post"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule / Upload Modal */}
      {isModalVisible && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Film className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {isYouTube ? 'Upload & Schedule YouTube Video' : 'Schedule Social Post'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Choose media from your PC, pick publishing time and settings.</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSchedule} className="space-y-4">
              {/* Channel Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Channel</label>
                {channels.length === 0 ? (
                  <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200">
                    No connected channels yet. Connect YouTube or Instagram first under Connected Channels!
                  </div>
                ) : (
                  <select
                    required
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  >
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.platform.toUpperCase()}] {c.display_name} {c.username ? `(${c.username})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* MEDIA UPLOAD SECTION: DIRECT FILE UPLOAD FROM PC */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    {isYouTube ? <FileVideo className="w-3.5 h-3.5 text-rose-500" /> : <ImageIcon className="w-3.5 h-3.5 text-pink-500" />}
                    <span>{isYouTube ? 'Upload Video from your Media' : 'Upload Media File'}</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>

                  {/* Toggle between Local File and Direct URL */}
                  <div className="flex text-[10px] bg-slate-100 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setMediaSourceType('file')}
                      className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                        mediaSourceType === 'file' ? 'bg-white text-slate-800 shadow-2xs font-semibold' : 'text-slate-500'
                      }`}
                    >
                      From Media / PC
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaSourceType('url')}
                      className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                        mediaSourceType === 'url' ? 'bg-white text-slate-800 shadow-2xs font-semibold' : 'text-slate-500'
                      }`}
                    >
                      Direct URL
                    </button>
                  </div>
                </div>

                {mediaSourceType === 'file' ? (
                  <div>
                    {uploadedFileInfo ? (
                      <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            {uploadedFileInfo.mediaType === 'video' ? <FileVideo className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-semibold text-slate-800 truncate">{uploadedFileInfo.originalName}</p>
                            <p className="text-[10px] text-emerald-700 font-medium">Ready ({formatFileSize(uploadedFileInfo.size)})</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedFileInfo(null);
                            setMediaUrl('');
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center"
                      >
                        {uploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                            <span className="text-xs font-medium text-slate-600">Uploading media to local storage...</span>
                          </div>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                              <UploadCloud className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-semibold text-slate-800">
                              {isYouTube ? 'Click to select Video from your PC' : 'Click to select Photo / Video from your PC'}
                            </span>
                            <span className="text-[11px] text-slate-400 mt-1">
                              {isYouTube ? 'Supports MP4, MOV, WebM, AVI (up to 500 MB)' : 'Supports JPG, PNG, WebP, MP4'}
                            </span>
                          </>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={isYouTube ? 'video/mp4,video/quicktime,video/webm,video/x-msvideo,video/*' : 'image/*,video/*'}
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder={isYouTube ? 'https://example.com/video.mp4' : 'https://example.com/photo.jpg'}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                )}
              </div>

              {/* Title (Required for YouTube Video) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isYouTube ? 'Video Title' : 'Post Title'}
                  {isYouTube ? <span className="text-rose-500 font-bold ml-1">*</span> : <span className="font-normal text-slate-400 ml-1">(Optional)</span>}
                </label>
                <input
                  type="text"
                  required={isYouTube}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isYouTube ? "e.g. My New Acoustic Guitar Cover 🎸" : "e.g. Weekly Updates"}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* YouTube Privacy Status */}
              {isYouTube && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">YouTube Privacy Setting</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'public', label: 'Public', icon: Globe, desc: 'Visible to everyone' },
                      { key: 'unlisted', label: 'Unlisted', icon: EyeOff, desc: 'Anyone with link' },
                      { key: 'private', label: 'Private', icon: Lock, desc: 'Only you' },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const active = privacyStatus === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setPrivacyStatus(opt.key as any)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            active 
                              ? 'border-indigo-600 bg-indigo-50/40 text-indigo-900 shadow-2xs' 
                              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-semibold text-xs mb-0.5">
                            <Icon className={`w-3.5 h-3.5 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <span>{opt.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description / Content */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {isYouTube ? 'Video Description' : 'Caption / Post Text'}
                  </label>
                  <span className="text-[10px] text-slate-400">{content.length} characters</span>
                </div>
                <textarea
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={isYouTube ? "Write video description, timestamps, links, and hashtags..." : "Write post caption..."}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Scheduled Date & Time */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Decided Publishing Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                />
                
                {/* Quick Presets */}
                <div className="flex gap-2 pt-1 text-[11px]">
                  <span className="text-slate-400 self-center">Quick pick:</span>
                  <button
                    type="button"
                    onClick={() => setQuickTime(1)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                  >
                    +1 Hour
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickTime(3)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                  >
                    +3 Hours
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickTime(24)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                  >
                    Tomorrow
                  </button>
                </div>
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
                  disabled={saving || uploading || channels.length === 0}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? 'Scheduling...' : 'Schedule & Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
