import React, { useState, useRef, useEffect } from 'react';
import { 
  Share2, 
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
  Calendar,
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
  CheckCheck,
  Search,
  Filter
} from 'lucide-react';
import type { ScheduledPost, Channel, MultiPublishResult } from '../types';
import { api } from '../api';

interface ContentPublishingViewProps {
  posts: ScheduledPost[];
  channels: Channel[];
  onRefresh: () => void;
  showCreateModal?: boolean;
  onCloseCreateModal?: () => void;
}

export const ContentPublishingView: React.FC<ContentPublishingViewProps> = ({
  posts,
  channels,
  onRefresh,
  showCreateModal = false,
  onCloseCreateModal
}) => {
  // Navigation Tabs: all | scheduled | published | failed | drafts | calendar
  const [activeTab, setActiveTab] = useState<'all' | 'scheduled' | 'published' | 'failed' | 'drafts' | 'calendar'>('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Post Creator Modal State
  const [createModalOpen, setCreateModalOpen] = useState(showCreateModal);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Multi-Platform Composer Form State
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>(
    channels.length > 0 ? channels.map(c => String(c.id)) : []
  );

  useEffect(() => {
    if (channels.length > 0 && selectedChannelIds.length === 0) {
      setSelectedChannelIds(channels.map(c => String(c.id)));
    }
  }, [channels]);

  useEffect(() => {
    if (showCreateModal) {
      setCreateModalOpen(true);
    }
  }, [showCreateModal]);

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
  const [retryingPostId, setRetryingPostId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCloseModal = () => {
    setCreateModalOpen(false);
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

  // Channel selections & validation
  const selectedChannels = channels.filter(c => selectedChannelIds.includes(String(c.id)));
  const hasYouTube = selectedChannels.some(c => c.platform === 'youtube');
  const hasInstagram = selectedChannels.some(c => c.platform === 'instagram');
  const hasTelegram = selectedChannels.some(c => c.platform === 'telegram');

  const isVideo = uploadedFileInfo?.mediaType === 'video' || (mediaUrl && /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl));
  const isImage = uploadedFileInfo?.mediaType === 'image' || (mediaUrl && /\.(jpg|jpeg|png|webp|gif)$/i.test(mediaUrl));

  const youtubeValidationWarning = hasYouTube && !isVideo ? 'YouTube requires a video file. Image or text cannot be uploaded.' : null;
  const instagramValidationWarning = hasInstagram && !mediaUrl ? 'Instagram requires an image or video asset. Text-only posts are not supported.' : null;

  const handleMultiPublish = async (action: 'publish_now' | 'schedule', asDraft = false) => {
    if (selectedChannelIds.length === 0) {
      alert('Please select at least one target social media account.');
      return;
    }

    if (!content.trim() && !title.trim()) {
      alert('Please provide a title or caption.');
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
        media_type: uploadedFileInfo?.mediaType || (hasYouTube ? 'video' : (isImage ? 'image' : 'text')),
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
        handleCloseModal();
        onRefresh();
      }
    } catch (err: any) {
      alert(`Publishing failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePost = async (id: number) => {
    if (confirm('Delete this post?')) {
      await api.deletePost(id);
      onRefresh();
    }
  };

  const handleRetryPost = async (post: ScheduledPost) => {
    setRetryingPostId(post.id);
    try {
      const result = await api.multiPublishPosts({
        channel_ids: [String(post.channel_id)],
        title: post.title,
        content: post.content,
        media_url: post.media_url,
        media_type: (post.media_type as any) || (post.media_url ? 'video' : 'text'),
        scheduled_at: new Date().toISOString(),
        action: 'publish_now',
        is_draft: false
      });
      setPublishResult(result);
      onRefresh();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingPostId(null);
    }
  };

  // Tab Filtering Logic
  const drafts = posts.filter(p => p.is_draft === 1);
  const scheduled = posts.filter(p => p.status === 'pending' && (!p.is_draft || p.is_draft === 0));
  const published = posts.filter(p => p.status === 'published');
  const failed = posts.filter(p => p.status === 'failed');

  const getFilteredList = () => {
    let list: ScheduledPost[] = [];
    switch (activeTab) {
      case 'scheduled':
        list = scheduled;
        break;
      case 'published':
        list = published;
        break;
      case 'failed':
        list = failed;
        break;
      case 'drafts':
        list = drafts;
        break;
      case 'all':
      default:
        list = posts;
        break;
    }

    if (platformFilter !== 'all') {
      list = list.filter(p => p.platform === platformFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        (p.title && p.title.toLowerCase().includes(q)) || 
        (p.content && p.content.toLowerCase().includes(q))
      );
    }

    return list;
  };

  const displayedPosts = getFilteredList();

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">YouTube</span>;
      case 'instagram':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-700 bg-pink-50 px-2 py-0.5 rounded-md border border-pink-200">Instagram</span>;
      case 'telegram':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">Telegram</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{platform}</span>;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header and Primary "Create Post" action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Content & Publishing</h1>
            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
              Multi-Platform Studio
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Compose, preview, schedule, and publish posts to YouTube, Instagram, and Telegram simultaneously with real delivery tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={onRefresh}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-2xs"
            title="Refresh posts"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Post</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar: All | Scheduled | Published | Failed | Drafts | Calendar */}
      <div className="flex items-center justify-between border-b border-slate-200 text-xs overflow-x-auto">
        <div className="flex items-center gap-1">
          {[
            { id: 'all', label: 'All Posts', count: posts.length },
            { id: 'scheduled', label: 'Scheduled', count: scheduled.length },
            { id: 'published', label: 'Published', count: published.length },
            { id: 'failed', label: 'Failed', count: failed.length },
            { id: 'drafts', label: 'Drafts', count: drafts.length },
            { id: 'calendar', label: 'Calendar View' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2.5 font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  tab.id === 'failed' && tab.count > 0 
                    ? 'bg-rose-100 text-rose-700' 
                    : (activeTab === tab.id ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600')
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search & Platform Filter Toolbar */}
        {activeTab !== 'calendar' && (
          <div className="flex items-center gap-2 pb-2 self-end">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none"
            >
              <option value="all">All Platforms</option>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="telegram">Telegram</option>
            </select>
          </div>
        )}
      </div>

      {/* VIEW: CALENDAR */}
      {activeTab === 'calendar' ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Upcoming Scheduled Timeline
            </h3>
            <span className="text-xs text-slate-500 font-mono">{scheduled.length} scheduled posts</span>
          </div>

          {scheduled.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No posts scheduled for this period. Click "Create Post" to schedule your next release.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {scheduled.map(post => (
                <div key={post.id} className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/60 hover:bg-white transition space-y-2">
                  <div className="flex items-center justify-between">
                    {getPlatformIcon(post.platform)}
                    <span className="text-[11px] font-mono text-indigo-700 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(post.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-800 truncate">{post.title || post.content}</h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{post.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VIEW: LIST (All, Scheduled, Published, Failed, Drafts) */
        displayedPosts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Share2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No posts in this view</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {activeTab === 'failed' 
                ? 'Great! There are zero failed posts.' 
                : activeTab === 'drafts' 
                  ? 'No saved drafts. Click "Create Post" to start drafting.' 
                  : 'Start composing content across your connected channels.'}
            </p>
            <div className="mt-4">
              <button
                onClick={() => setCreateModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-xs"
              >
                Create a Post
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Post Title & Caption</th>
                    <th className="px-4 py-3">Platform</th>
                    <th className="px-4 py-3">Media</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 max-w-sm">
                        <div className="font-semibold text-slate-900 truncate">
                          {post.title || post.content || 'Untitled Post'}
                        </div>
                        {post.title && post.content && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">{post.content}</div>
                        )}
                        {post.error_message && (
                          <div className="text-[11px] text-rose-600 font-mono mt-0.5 truncate max-w-xs">
                            Error: {post.error_message}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {getPlatformIcon(post.platform)}
                      </td>

                      <td className="px-4 py-3 text-[11px] text-slate-600 capitalize font-mono">
                        {post.media_type || (post.media_url ? 'media' : 'text')}
                      </td>

                      <td className="px-4 py-3">
                        {post.is_draft === 1 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                            Draft
                          </span>
                        ) : post.status === 'published' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Published
                          </span>
                        ) : post.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                            <AlertCircle className="w-3 h-3 text-rose-600" /> Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3 text-amber-600" /> Scheduled
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {post.status === 'published' && post.published_at ? (
                          <span>{new Date(post.published_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        ) : (
                          <span>{new Date(post.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {post.status === 'failed' && (
                            <button
                              onClick={() => handleRetryPost(post)}
                              disabled={retryingPostId === post.id}
                              className="px-2 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                            >
                              {retryingPostId === post.id ? 'Retrying...' : 'Retry'}
                            </button>
                          )}

                          {post.published_url && (
                            <a
                              href={post.published_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg transition"
                              title="View post on platform"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete post"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* MULTI-PLATFORM PUBLISHING COMPOSER MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Multi-Platform Publishing Studio</h3>
                  <p className="text-[11px] text-slate-500">Publish immediately or schedule across your connected channels</p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Channels Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Select Connected Platforms ({selectedChannelIds.length} selected)
              </label>
              {channels.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  No social channels connected yet. Go to Connected Accounts to add YouTube, Instagram, or Telegram.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {channels.map((ch) => {
                    const isSelected = selectedChannelIds.includes(String(ch.id));
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => toggleChannel(String(ch.id))}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                        <span className="capitalize">{ch.platform}:</span>
                        <span>{ch.display_name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Main Form & Live Previews Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left Column: Title, Caption, Media Upload */}
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Post Title (YouTube / Broadcast)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter engaging title..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Caption & Description</label>
                    <span className="text-[10px] text-slate-400 font-mono">{content.length} characters</span>
                  </div>
                  <textarea
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write caption, hashtags, and description..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed font-sans"
                  />
                </div>

                {/* Media Upload Area */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Upload Media (Video / Photo)</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="video/*,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-400 transition bg-slate-50/50"
                  >
                    {uploading ? (
                      <div className="flex items-center justify-center gap-2 text-indigo-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Uploading file to local media store...</span>
                      </div>
                    ) : uploadedFileInfo ? (
                      <div className="flex items-center justify-between text-left">
                        <div className="flex items-center gap-2">
                          {uploadedFileInfo.mediaType === 'video' ? <FileVideo className="w-5 h-5 text-indigo-600" /> : <ImageIcon className="w-5 h-5 text-indigo-600" />}
                          <div>
                            <div className="font-semibold text-slate-800">{uploadedFileInfo.originalName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{(uploadedFileInfo.size / (1024 * 1024)).toFixed(2)} MB • {uploadedFileInfo.mediaType}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedFileInfo(null);
                            setMediaUrl('');
                          }}
                          className="text-rose-600 font-bold px-2 py-1 hover:bg-rose-50 rounded"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <UploadCloud className="w-6 h-6 text-slate-400 mx-auto" />
                        <div className="font-medium text-indigo-600">Click to upload video (.mp4) or photo (.png, .jpg)</div>
                        <div className="text-[10px] text-slate-400">Max size: 500 MB</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Validation Warnings */}
                {youtubeValidationWarning && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{youtubeValidationWarning}</span>
                  </div>
                )}
                {instagramValidationWarning && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{instagramValidationWarning}</span>
                  </div>
                )}
              </div>

              {/* Right Column: Platform Preview & Scheduling Config */}
              <div className="space-y-4">
                {/* Platform Preview Selector */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Live Platform Preview:</span>
                  <div className="flex items-center gap-1">
                    {(['youtube', 'instagram', 'telegram'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPreviewPlatform(p)}
                        className={`px-2.5 py-1 rounded-lg font-semibold capitalize text-[11px] transition ${
                          previewPlatform === p 
                            ? 'bg-slate-900 text-white' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Device Mockup Preview */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 min-h-[220px] flex flex-col justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                        SM
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 leading-tight">SocialManager Brand</div>
                        <div className="text-[10px] text-slate-400 capitalize">{previewPlatform} Preview</div>
                      </div>
                    </div>

                    {mediaUrl ? (
                      isVideo ? (
                        <video src={mediaUrl} controls className="w-full max-h-40 rounded-xl object-cover bg-black mb-2" />
                      ) : (
                        <img src={mediaUrl} alt="Preview" className="w-full max-h-40 rounded-xl object-cover mb-2" />
                      )
                    ) : (
                      <div className="w-full h-24 bg-slate-200/70 rounded-xl flex items-center justify-center text-slate-400 text-[11px] mb-2">
                        No media attached (Text post)
                      </div>
                    )}

                    <div className="text-slate-800 font-medium leading-relaxed">
                      {title && <div className="font-bold mb-0.5">{title}</div>}
                      <div className="text-slate-600 text-[11px] line-clamp-3">{content || 'Caption text will appear here...'}</div>
                    </div>
                  </div>
                </div>

                {/* Schedule Time & Quick Presets */}
                <div className="space-y-2 text-xs">
                  <label className="block font-semibold text-slate-700">Schedule Date & Time</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span>Quick presets:</span>
                    <button type="button" onClick={() => setQuickTime(1)} className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-md font-medium">+1 hour</button>
                    <button type="button" onClick={() => setQuickTime(3)} className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-md font-medium">+3 hours</button>
                    <button type="button" onClick={() => setQuickTime(24)} className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-md font-medium">Tomorrow</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => handleMultiPublish('schedule', true)}
                disabled={saving}
                className="text-slate-600 hover:text-slate-900 font-medium"
              >
                Save as Draft
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-3.5 py-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium"
                >
                  Cancel
                </button>

                {scheduledAt && (
                  <button
                    type="button"
                    onClick={() => handleMultiPublish('schedule', false)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition shadow-2xs"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Schedule Release</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleMultiPublish('publish_now', false)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Publish to Selected Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MULTI-PUBLISH RESULTS CONFIRMATION MODAL */}
      {publishResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Publishing Report</h3>
              </div>
              <button onClick={() => setPublishResult(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
              <div className="font-semibold text-slate-800">
                {publishResult.summary?.successful || 0} of {publishResult.summary?.total || 0} accounts published successfully.
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {publishResult.results?.map((res: any, idx: number) => (
                <div key={idx} className="py-2 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800 capitalize">{res.platform}: </span>
                    <span className="text-slate-500">{res.displayName}</span>
                  </div>
                  {res.status === 'success' ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Delivered
                    </span>
                  ) : (
                    <span className="text-rose-600 font-semibold truncate max-w-[150px]" title={res.error}>
                      Failed: {res.error}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setPublishResult(null);
                  handleCloseModal();
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
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

// Also export as SchedulerView for backwards compatibility
export { ContentPublishingView as SchedulerView };
