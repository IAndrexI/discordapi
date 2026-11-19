import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Globe,
  Search,
  Play,
  Pause,
  ExternalLink,
  Share2,
  X,
  RefreshCw,
  ArrowLeft,
  Tv,
  BookOpen,
  Sparkles,
  Check,
  ShieldCheck,
  Radio,
  Maximize2,
} from 'lucide-react';

export interface SharedBrowserStageProps {
  isOpen?: boolean;
  roomName?: string;
  roomId?: string;
  onClose: () => void;
  onShareToChat?: (text: string) => void;
  initialQueryOrUrl?: string;
}

export type CoBrowseSearchType = 'all' | 'video' | 'wiki';

export interface SearchResultCard {
  title: string;
  url: string;
  snippet: string;
  type?: 'web' | 'video' | 'wiki';
  source?: string;
  videoEmbedUrl?: string;
}

interface CoBrowseSyncPayload {
  roomKey: string;
  url: string;
  videoUrl?: string;
  title?: string;
  isPlaying: boolean;
  currentTime: number;
  searchQuery: string;
  searchType: CoBrowseSearchType;
  updatedBy: string;
  updatedAt: number;
}

const COBROWSE_CHANNEL_NAME = 'protutech_cobrowse_sync';

function resolveBackendBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const { protocol } = window.location;
  if (protocol === 'file:' || protocol === 'tauri:') {
    return 'http://127.0.0.1:4175';
  }
  return '';
}

function isLikelyUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(trimmed);
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const seg = parsed.pathname.split('/').filter(Boolean)[0];
      return seg || null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }
      if (parsed.pathname.startsWith('/embed/') || parsed.pathname.startsWith('/shorts/')) {
        const seg = parsed.pathname.split('/')[2];
        return seg || null;
      }
    }
  } catch {
    // Ignore malformed URLs
  }
  return null;
}

function isDirectVideoFile(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);
}

function buildCuratedFallbackResults(query: string, type: CoBrowseSearchType): SearchResultCard[] {
  const q = query.trim();
  const encoded = encodeURIComponent(q);
  const slug = encodeURIComponent(q.replace(/\s+/g, '_'));

  const wikiResult: SearchResultCard = {
    title: `${q} - Wikipedia`,
    url: `https://en.wikipedia.org/wiki/${slug}`,
    snippet: `Encyclopedia overview, history, and references for "${q}" on Wikipedia.`,
    type: 'wiki',
    source: 'Wikipedia',
  };

  const webResult: SearchResultCard = {
    title: `${q} — Web Search (DuckDuckGo)`,
    url: `https://duckduckgo.com/?q=${encoded}`,
    snippet: `Explore live web articles, documentation, and discussions matching "${q}".`,
    type: 'web',
    source: 'DuckDuckGo',
  };

  const videoSamples: SearchResultCard[] = [
    {
      title: `${q} — Watch Together Video Search (YouTube)`,
      url: `https://www.youtube.com/results?search_query=${encoded}`,
      snippet: `Browse videos related to "${q}" or launch synchronized Watch Together playback.`,
      type: 'video',
      source: 'YouTube',
    },
    {
      title: 'Big Buck Bunny 1080p60 (Direct HTML5 Watch Together Stream)',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      videoEmbedUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      snippet: 'Synchronized HD HTML5 sample stream ready for instant play/pause call testing.',
      type: 'video',
      source: 'HTML5 Video',
    },
    {
      title: 'Lofi Hip Hop Radio — Watch Together Embed',
      url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      videoEmbedUrl: 'https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?autoplay=1&enablejsapi=1',
      snippet: '24/7 synchronized music & ambient stream via YouTube nocookie embed.',
      type: 'video',
      source: 'YouTube Together',
    },
  ];

  if (type === 'wiki') return [wikiResult];
  if (type === 'video') return videoSamples;
  return [wikiResult, webResult, videoSamples[1], videoSamples[2]];
}

async function fetchClientWikipediaFallback(query: string): Promise<SearchResultCard[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3500);
  try {
    const endpoint = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
      query
    )}&limit=5&namespace=0&format=json&origin=*`;
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as [string, string[], string[], string[]];
    const titles = Array.isArray(data[1]) ? data[1] : [];
    const snippets = Array.isArray(data[2]) ? data[2] : [];
    const urls = Array.isArray(data[3]) ? data[3] : [];
    return titles
      .map((title, idx) => ({
        title,
        snippet: snippets[idx] || `Wikipedia article for ${title}`,
        url: urls[idx] || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`,
        type: 'wiki' as const,
        source: 'Wikipedia',
      }))
      .filter((item) => Boolean(item.title && item.url));
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

export const SharedBrowserStage: React.FC<SharedBrowserStageProps> = ({
  isOpen = true,
  roomName = 'Voice Lounge',
  roomId = 'global',
  onClose,
  onShareToChat,
  initialQueryOrUrl,
}) => {
  const [searchInput, setSearchInput] = useState(initialQueryOrUrl || '');
  const [searchType, setSearchType] = useState<CoBrowseSearchType>('all');
  const [results, setResults] = useState<SearchResultCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchSourceLabel, setSearchSourceLabel] = useState<string>('');

  // Synchronized browser / video state
  const [activeUrl, setActiveUrl] = useState<string>('');
  const [activeVideoEmbedUrl, setActiveVideoEmbedUrl] = useState<string>('');
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [useProxyBypass, setUseProxyBypass] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [sharedFeedbackUrl, setSharedFeedbackUrl] = useState<string | null>(null);
  const [lastSyncedLabel, setLastSyncedLabel] = useState<string>('Synced with Call');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const htmlVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>(Math.random().toString(36).slice(2, 10));
  const lastSyncTimestampRef = useRef<number>(0);
  const searchInputRef = useRef<string>(searchInput);
  useEffect(() => {
    searchInputRef.current = searchInput;
  }, [searchInput]);

  const roomKey = roomId || roomName || 'global';
  const baseUrl = resolveBackendBaseUrl();

  const publishCoBrowseState = useCallback(
    async (partial: Partial<CoBrowseSyncPayload>) => {
      const now = Date.now();
      lastSyncTimestampRef.current = now;

      const payload: CoBrowseSyncPayload = {
        roomKey,
        url: partial.url ?? activeUrl,
        videoUrl: partial.videoUrl ?? activeVideoEmbedUrl,
        title: partial.title ?? activeTitle,
        isPlaying: partial.isPlaying ?? isPlaying,
        currentTime: partial.currentTime ?? htmlVideoRef.current?.currentTime ?? 0,
        searchQuery: partial.searchQuery ?? searchInput,
        searchType: partial.searchType ?? searchType,
        updatedBy: tabIdRef.current,
        updatedAt: now,
      };

      try {
        channelRef.current?.postMessage(payload);
      } catch {
        // Ignore BroadcastChannel post errors
      }

      try {
        await fetch(`${baseUrl}/api/cobrowse/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setLastSyncedLabel(`Synced (${new Date(now).toLocaleTimeString()})`);
      } catch {
        // Keep local BroadcastChannel sync active even if backend is offline
      }
    },
    [activeTitle, activeUrl, activeVideoEmbedUrl, baseUrl, isPlaying, roomKey, searchInput, searchType]
  );

  const openUrlInCoBrowser = useCallback(
    (rawUrl: string, explicitVideoEmbedUrl?: string, title?: string, broadcast = true) => {
      const normalized = normalizeUrl(rawUrl);
      if (!normalized) return;

      const ytId = extractYouTubeId(normalized);
      const computedVideoEmbed =
        explicitVideoEmbedUrl ||
        (ytId
          ? `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&enablejsapi=1`
          : isDirectVideoFile(normalized)
            ? normalized
            : '');

      setActiveUrl(normalized);
      setActiveVideoEmbedUrl(computedVideoEmbed);
      setActiveTitle(title || normalized);
      setIsPlaying(true);

      if (broadcast) {
        void publishCoBrowseState({
          url: normalized,
          videoUrl: computedVideoEmbed,
          title: title || normalized,
          isPlaying: true,
        });
      }
    },
    [publishCoBrowseState]
  );

  const runSearch = useCallback(
    async (rawQuery: string, typeOverride?: CoBrowseSearchType, broadcast = true) => {
      const q = rawQuery.trim();
      if (!q) return;
      const effectiveType = typeOverride ?? searchType;

      if (isLikelyUrl(q)) {
        openUrlInCoBrowser(q, undefined, q, broadcast);
        return;
      }

      setIsSearching(true);
      setHasSearched(true);
      setActiveUrl('');
      setActiveVideoEmbedUrl('');

      if (broadcast) {
        void publishCoBrowseState({
          url: '',
          videoUrl: '',
          searchQuery: q,
          searchType: effectiveType,
        });
      }

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 4500);
        const res = await fetch(
          `${baseUrl}/api/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(effectiveType)}`,
          { signal: controller.signal }
        ).finally(() => window.clearTimeout(timeoutId));

        if (res.ok) {
          const data = (await res.json()) as {
            query?: string;
            results?: SearchResultCard[];
          };
          if (Array.isArray(data.results) && data.results.length > 0) {
            setResults(data.results);
            setSearchSourceLabel('Self-Hosted Search Engine');
            setIsSearching(false);
            return;
          }
        }
      } catch {
        // Fall through to client-side Wikipedia & curated search fallback
      }

      const wikiCards =
        effectiveType === 'video' ? [] : await fetchClientWikipediaFallback(q);
      const curated = buildCuratedFallbackResults(q, effectiveType);
      const merged = [...wikiCards];
      curated.forEach((item) => {
        if (!merged.some((existing) => existing.url === item.url)) {
          merged.push(item);
        }
      });

      setResults(merged);
      setSearchSourceLabel(
        wikiCards.length > 0 ? 'Wikipedia + Built-In Fallback' : 'Offline Smart Search'
      );
      setIsSearching(false);
    },
    [baseUrl, openUrlInCoBrowser, publishCoBrowseState, searchType]
  );

  // Sync via BroadcastChannel('protutech_cobrowse_sync') and backend /api/cobrowse/state
  useEffect(() => {
    if (!isOpen) return;

    const applyRemoteState = (incoming: Partial<CoBrowseSyncPayload>) => {
      if (!incoming || incoming.updatedBy === tabIdRef.current) return;
      if (incoming.roomKey && incoming.roomKey !== roomKey && incoming.roomKey !== 'global') {
        return;
      }
      if (typeof incoming.updatedAt === 'number' && incoming.updatedAt <= lastSyncTimestampRef.current) {
        return;
      }
      lastSyncTimestampRef.current = incoming.updatedAt || Date.now();

      if (typeof incoming.searchQuery === 'string' && incoming.searchQuery !== searchInputRef.current) {
        setSearchInput(incoming.searchQuery);
      }
      if (incoming.searchType) {
        setSearchType(incoming.searchType);
      }
      if (typeof incoming.url === 'string') {
        setActiveUrl(incoming.url);
        setActiveVideoEmbedUrl(incoming.videoUrl || '');
        setActiveTitle(incoming.title || incoming.url);
      }
      if (typeof incoming.isPlaying === 'boolean') {
        setIsPlaying(incoming.isPlaying);
        if (htmlVideoRef.current) {
          if (incoming.isPlaying) {
            void htmlVideoRef.current.play().catch(() => {});
          } else {
            htmlVideoRef.current.pause();
          }
        }
      }
      setLastSyncedLabel('Synced from Peer');
    };

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const ch = new BroadcastChannel(COBROWSE_CHANNEL_NAME);
        channelRef.current = ch;
        ch.onmessage = (evt: MessageEvent<CoBrowseSyncPayload>) => {
          applyRemoteState(evt.data);
        };
      } catch {
        channelRef.current = null;
      }
    }

    const pollServerState = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/cobrowse/state`);
        if (!res.ok) return;
        const data = (await res.json()) as Partial<CoBrowseSyncPayload>;
        if (data && (data.url || data.searchQuery)) {
          applyRemoteState(data);
        }
      } catch {
        // Ignore transient backend poll errors
      }
    };

    const pollTimer = window.setInterval(() => {
      void pollServerState();
    }, 4000);

    return () => {
      window.clearInterval(pollTimer);
      if (channelRef.current) {
        try {
          channelRef.current.close();
        } catch {
          // Ignore close errors
        }
        channelRef.current = null;
      }
    };
  }, [baseUrl, isOpen, roomKey]);

  // Handle initialQueryOrUrl on open or prop change
  useEffect(() => {
    if (!isOpen || !initialQueryOrUrl?.trim()) return;
    const target = initialQueryOrUrl.trim();
    lastSyncTimestampRef.current = Date.now();
    setSearchInput(target);
    if (isLikelyUrl(target)) {
      openUrlInCoBrowser(target, undefined, target, false);
    } else {
      void runSearch(target, undefined, false);
    }
    // Run only when initialQueryOrUrl / isOpen changes explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQueryOrUrl, isOpen]);

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(searchInput);
  };

  const handleTogglePlayPause = () => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);

    if (htmlVideoRef.current) {
      if (nextPlaying) {
        void htmlVideoRef.current.play().catch(() => {});
      } else {
        htmlVideoRef.current.pause();
      }
    } else if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: nextPlaying ? 'playVideo' : 'pauseVideo',
            args: '',
          }),
          '*'
        );
      } catch {
        // Ignore cross-origin postMessage restrictions
      }
    }

    void publishCoBrowseState({ isPlaying: nextPlaying });
  };

  const handleShareItem = (title: string, url: string) => {
    const message = `🌐 **Shared from Co-Browse (${roomName}):** ${title}\n${url}`;
    if (onShareToChat) {
      onShareToChat(message);
    } else if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(message).catch(() => {});
    }
    setSharedFeedbackUrl(url);
    window.setTimeout(() => {
      setSharedFeedbackUrl((prev) => (prev === url ? null : prev));
    }, 2000);
  };

  const isHtml5Video = Boolean(activeVideoEmbedUrl && isDirectVideoFile(activeVideoEmbedUrl));
  const isYouTubeOrVideoEmbed = Boolean(activeVideoEmbedUrl && !isHtml5Video);
  const iframeSrc = activeUrl
    ? isYouTubeOrVideoEmbed
      ? activeVideoEmbedUrl
      : useProxyBypass
        ? `${baseUrl}/api/proxy-page?url=${encodeURIComponent(activeUrl)}`
        : activeUrl
    : '';

  return (
    <div
      ref={containerRef}
      data-testid="shared-browser-stage"
      className="bg-[#0b101d] border-b border-cyan-500/30 flex flex-col max-h-[600px] min-h-[380px] shadow-2xl animate-fadeIn"
    >
      {/* Top Bar: Co-Browse Title + Smart Search/URL Bar + Sync Pill + Close */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-[#0e1629] via-[#111c34] to-[#0e1629] border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
            <Globe className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Co-Browse &amp; Search Together</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                <Radio className="w-2.5 h-2.5" />
                <span>{lastSyncedLabel}</span>
              </span>
            </div>
            <div className="text-[10px] text-gray-400">#{roomName}</div>
          </div>
        </div>

        {/* Search & URL Form */}
        <form onSubmit={handleFormSubmit} className="flex-1 min-w-[240px] max-w-xl flex items-center gap-1.5">
          {activeUrl && (
            <button
              type="button"
              onClick={() => {
                setActiveUrl('');
                setActiveVideoEmbedUrl('');
                void publishCoBrowseState({ url: '', videoUrl: '' });
              }}
              className="px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-gray-200 text-xs font-semibold flex items-center gap-1 cursor-pointer flex-shrink-0"
              title="Back to Search Results"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Results</span>
            </button>
          )}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              data-testid="cobrowse-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search web, videos, Wikipedia or enter any URL..."
              className="w-full bg-black/50 border border-white/15 focus:border-cyan-400 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-400 outline-none"
            />
          </div>
          <button
            type="submit"
            data-testid="cobrowse-search-btn"
            disabled={isSearching}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow cursor-pointer flex items-center gap-1.5 disabled:opacity-60 flex-shrink-0"
          >
            {isSearching ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>Search</span>
          </button>
        </form>

        <div className="flex items-center gap-1.5">
          {activeUrl && (
            <button
              type="button"
              onClick={() => handleShareItem(activeTitle || activeUrl, activeUrl)}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{sharedFeedbackUrl === activeUrl ? 'Shared ✓' : 'Share to Chat'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (containerRef.current?.requestFullscreen) {
                void containerRef.current.requestFullscreen().catch(() => {});
              }
            }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white cursor-pointer"
            title="Fullscreen Co-Browse"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            data-testid="cobrowse-close-btn"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-300 cursor-pointer"
            title="Close Co-Browse Stage"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Filter Tabs */}
      {!activeUrl && (
        <div className="px-4 py-2 bg-[#090e1a] border-b border-white/5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All Web', icon: Globe },
                { id: 'video', label: 'Videos / Watch Together', icon: Tv },
                { id: 'wiki', label: 'Wikipedia', icon: BookOpen },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = searchType === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`cobrowse-tab-${tab.id}`}
                  onClick={() => {
                    setSearchType(tab.id);
                    if (searchInput.trim()) {
                      void runSearch(searchInput, tab.id);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    active
                      ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40'
                      : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          {searchSourceLabel && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>{searchSourceLabel}</span>
            </span>
          )}
        </div>
      )}

      {/* Main Content Area: Either Synchronized Viewport OR Search Results */}
      {activeUrl ? (
        <div className="flex-1 flex flex-col min-h-[300px] bg-black relative">
          {/* Viewer Toolbar */}
          <div className="px-3 py-1.5 bg-[#0e1526] border-b border-white/10 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {(isHtml5Video || isYouTubeOrVideoEmbed) && (
                <button
                  type="button"
                  onClick={handleTogglePlayPause}
                  className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1 cursor-pointer flex-shrink-0"
                >
                  {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{isPlaying ? 'Pause Together' : 'Play Together'}</span>
                </button>
              )}
              <span className="text-gray-300 font-mono text-[11px] truncate">{activeUrl}</span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {!isHtml5Video && !isYouTubeOrVideoEmbed && (
                <button
                  type="button"
                  onClick={() => setUseProxyBypass((v) => !v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 cursor-pointer ${
                    useProxyBypass
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-white/10 text-gray-300 border-white/10'
                  }`}
                  title="Proxies webpages through local backend to bypass X-Frame-Options restrictions"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>{useProxyBypass ? 'Anti-Block Proxy ON' : 'Direct Frame'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (iframeRef.current) {
                    iframeRef.current.src = iframeSrc;
                  }
                }}
                className="p-1 rounded hover:bg-white/10 text-gray-300 cursor-pointer"
                title="Reload Viewport"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <a
                href={activeUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white"
                title="Open in External Browser"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Video or Proxied Web Frame */}
          <div className="flex-1 w-full h-[360px] bg-black relative">
            {isHtml5Video ? (
              <video
                ref={htmlVideoRef}
                src={activeVideoEmbedUrl}
                controls
                autoPlay
                playsInline
                onPlay={() => {
                  setIsPlaying(true);
                  void publishCoBrowseState({ isPlaying: true });
                }}
                onPause={() => {
                  setIsPlaying(false);
                  void publishCoBrowseState({ isPlaying: false });
                }}
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title={activeTitle || 'Shared Co-Browser'}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                className="w-full h-full border-none bg-white"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!hasSearched ? (
            <div className="rounded-xl bg-[#0f172a]/80 border border-white/10 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center">
                  <Search className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Built-In Search Engine &amp; Watch Together
                  </h3>
                  <p className="text-xs text-gray-400">
                    Search Wikipedia, web pages, or videos and open any link inside the synchronized call browser.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: '🔎 Search "Minecraft"', action: () => { setSearchInput('Minecraft'); void runSearch('Minecraft', 'all'); } },
                  { label: '📚 Wikipedia: WebRTC', action: () => { setSearchInput('WebRTC'); setSearchType('wiki'); void runSearch('WebRTC', 'wiki'); } },
                  {
                    label: '🎬 Watch Together: Big Buck Bunny',
                    action: () =>
                      openUrlInCoBrowser(
                        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                        'Big Buck Bunny (1080p)'
                      ),
                  },
                  {
                    label: '🎵 Watch Together: Lofi Radio',
                    action: () =>
                      openUrlInCoBrowser(
                        'https://www.youtube.com/watch?v=jfKfPfyJRdk',
                        'https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?autoplay=1&enablejsapi=1',
                        'Lofi Hip Hop Radio'
                      ),
                  },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={preset.action}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 text-xs font-semibold text-gray-200 hover:text-white transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          ) : isSearching ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2 text-xs text-gray-400">
              <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
              <span>Searching web, Wikipedia &amp; videos for "{searchInput}"...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              No results found. Try another search query or enter a direct URL above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {results.map((item) => {
                const isShared = sharedFeedbackUrl === item.url;
                return (
                  <div
                    key={`${item.url}-${item.title}`}
                    data-testid="cobrowse-result-card"
                    className="p-3.5 rounded-xl bg-[#10182b] border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          {item.source || item.type || 'Web'}
                        </span>
                        <span className="text-[10px] text-gray-500 truncate max-w-[200px]">
                          {item.url}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white line-clamp-1">{item.title}</h4>
                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                        {item.snippet}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() =>
                          openUrlInCoBrowser(item.url, item.videoEmbedUrl, item.title)
                        }
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Open in Co-Browser</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleShareItem(item.title, item.url)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {isShared ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Share2 className="w-3.5 h-3.5 text-indigo-300" />
                        )}
                        <span>{isShared ? 'Shared' : 'Share to Call Chat'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
