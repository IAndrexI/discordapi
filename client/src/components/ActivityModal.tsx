import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Gamepad2,
  Globe,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Maximize2,
  Play,
  Search,
} from 'lucide-react';
import type { MatrixRoom } from '../types';
import { SharedBrowserStage } from './SharedBrowserStage';

export interface ActivityItem {
  id: string;
  name: string;
  category: 'game' | 'watch' | 'browse';
  description: string;
  embedUrl: string;
  thumbnail: string;
  tag: string;
  badgeColor: string;
  initialQueryOrUrl?: string;
}

const BUILT_IN_ACTIVITIES: ActivityItem[] = [
  {
    id: 'youtube_together',
    name: 'Watch Together (YouTube)',
    category: 'watch',
    description: 'Search and watch synchronized YouTube or HTML5 videos with everyone in this channel.',
    embedUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    thumbnail: '🎬',
    tag: 'Synchronized Media',
    badgeColor: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  {
    id: 'web_browser',
    name: 'Shared Web Browser',
    category: 'browse',
    description: 'Built-in web & Wikipedia search engine + anti-block synchronized co-browser.',
    embedUrl: '',
    thumbnail: '🌐',
    tag: 'Co-Browse & Search',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  {
    id: 'retro_arcade',
    name: '2048 & Puzzle Arcade',
    category: 'game',
    description: 'Classic single & multiplayer 2048 puzzle mini-game.',
    embedUrl: 'https://play2048.co/',
    thumbnail: '🧩',
    tag: 'Mini Game',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  {
    id: 'snake_game',
    name: 'Neon Snake Arena',
    category: 'game',
    description: 'Classic high-speed neon Snake mini-game with competitive scoreboards.',
    embedUrl: 'https://playsnake.org/',
    thumbnail: '🐍',
    tag: 'Mini Game',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'chess_together',
    name: 'Chess Blitz Together',
    category: 'game',
    description: 'Play casual or competitive chess directly inside your channel.',
    embedUrl: 'https://lichess.org/tv/frame?theme=dark&bg=dark',
    thumbnail: '♟️',
    tag: 'Board Game',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
  {
    id: 'synth_piano',
    name: 'Multiplayer Virtual Piano',
    category: 'game',
    description: 'Collaborative synthesizer and virtual piano with real-time audio keys.',
    embedUrl: 'https://virtualpiano.net/',
    thumbnail: '🎹',
    tag: 'Music & Audio',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  },
];

export interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: MatrixRoom;
  onLaunchActivity: (activity: ActivityItem, customUrl?: string) => void;
  onOpenCoBrowse?: (initialQueryOrUrl?: string) => void;
}

export const ActivityModal: React.FC<ActivityModalProps> = ({
  isOpen,
  onClose,
  room,
  onLaunchActivity,
  onOpenCoBrowse,
}) => {
  const [filter, setFilter] = useState<'all' | 'game' | 'watch' | 'browse'>('all');
  const [search, setSearch] = useState('');
  const [customBrowseUrl, setCustomBrowseUrl] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [cardInputs, setCardInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = BUILT_IN_ACTIVITIES.filter((act) => {
    if (filter !== 'all' && act.category !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return act.name.toLowerCase().includes(q) || act.description.toLowerCase().includes(q);
    }
    return true;
  });

  const launchCoBrowseOrActivity = (act: ActivityItem, queryOrUrl?: string) => {
    const trimmed = (queryOrUrl || '').trim();
    if (act.category === 'browse' || act.category === 'watch') {
      if (onOpenCoBrowse) {
        onOpenCoBrowse(trimmed || (act.id === 'youtube_together' ? act.embedUrl : undefined));
        onClose();
        return;
      }
      onLaunchActivity(
        {
          ...act,
          initialQueryOrUrl:
            trimmed || (act.id === 'youtube_together' ? act.embedUrl : undefined),
        },
        trimmed || act.embedUrl
      );
      onClose();
      return;
    }

    onLaunchActivity(act, trimmed || undefined);
    onClose();
  };

  const handleLaunchCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = customBrowseUrl.trim();
    if (!raw) return;

    if (onOpenCoBrowse) {
      onOpenCoBrowse(raw);
      onClose();
      return;
    }

    const isUrl = /^https?:\/\//i.test(raw) || /^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(raw);
    const url = isUrl ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) : raw;

    let label = raw;
    if (isUrl) {
      try {
        label = `Web: ${new URL(url).hostname}`;
      } catch {
        label = `Web: ${raw}`;
      }
    } else {
      label = `Search: ${raw}`;
    }

    const customAct: ActivityItem = {
      id: `cobrowse_${Date.now()}`,
      name: label,
      category: 'browse',
      description: `Co-Browsing ${raw}`,
      embedUrl: isUrl ? url : '',
      thumbnail: '🌐',
      tag: 'Shared Co-Browser',
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      initialQueryOrUrl: raw,
    };

    onLaunchActivity(customAct, raw);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fadeIn"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-modal-title"
        className="w-[min(42rem,100%)] max-w-full max-h-full bg-[var(--bg-chat)] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-[var(--border-subtle)] relative"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-userpanel)] flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--discord-blurple)] flex items-center justify-center text-white shadow-lg flex-shrink-0">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="activity-modal-title" className="text-base font-bold text-[var(--text-header)] flex items-center gap-2 flex-wrap">
                <span>Activities &amp; Co-Browse</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[var(--bg-channels)] text-[var(--text-link)] border border-[var(--border-subtle)]">
                  #{room.name}
                </span>
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Launch shared games, web search, or synchronized video.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Activities"
            className="w-8 h-8 rounded-full hover:bg-[var(--bg-item-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search, Filter Pills & Custom Browser Input */}
        <div className="p-3.5 sm:p-4 space-y-3 border-b border-[var(--border-subtle)] bg-[var(--bg-channels)] flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <input
              type="text"
              aria-label="Filter activities"
              placeholder="Filter activities or mini-games..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--discord-blurple)]"
            />
            <button
              type="button"
              onClick={() => setShowCustomInput(!showCustomInput)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0 ${
                showCustomInput
                  ? 'bg-[var(--discord-blurple)] text-white'
                  : 'bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] border border-[var(--border-subtle)]'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-[var(--text-link)]" />
              <span>Search Web / URL</span>
            </button>
          </div>

          {/* Custom Web Search / URL Prompt */}
          {showCustomInput && (
            <form onSubmit={handleLaunchCustomUrl} className="flex items-center gap-2 animate-fadeIn pt-1">
              <input
                type="text"
                aria-label="Search query or URL"
                placeholder="Search anything or enter URL (e.g. wikipedia.org)..."
                value={customBrowseUrl}
                onChange={(e) => setCustomBrowseUrl(e.target.value)}
                className="flex-1 min-w-0 bg-[var(--bg-message-input)] border border-[var(--discord-blurple)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white rounded-lg text-xs font-bold shadow-md cursor-pointer flex items-center gap-1 flex-shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Open</span>
              </button>
            </form>
          )}

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'game', label: '🎮 Mini Games' },
                { id: 'watch', label: '🎬 Watch Together' },
                { id: 'browse', label: '🌐 Web Browser' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilter(cat.id)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                  filter === cat.id
                    ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] border border-[var(--discord-blurple)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-header)] bg-[var(--bg-userpanel)] border border-[var(--border-subtle)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Activities Cards Grid */}
        <div className="flex-1 min-h-0 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 overflow-y-auto content-start">
          {filtered.map((act) => {
            const isCoBrowseCard = act.category === 'browse' || act.category === 'watch';
            const cardQuery = cardInputs[act.id] || '';
            return (
              <div
                key={act.id}
                className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] hover:border-[var(--discord-blurple)] transition-all flex flex-col justify-between group shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl p-2 rounded-lg bg-[var(--bg-channels)] border border-[var(--border-subtle)] flex items-center justify-center">
                        {act.thumbnail}
                      </span>
                      <div>
                        <h3 className="font-bold text-[var(--text-header)] text-sm group-hover:text-[var(--text-link)] transition-colors">
                          {act.name}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${act.badgeColor}`}
                        >
                          {act.tag}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2 mt-1">
                    {act.description}
                  </p>

                  {isCoBrowseCard && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        launchCoBrowseOrActivity(act, cardQuery);
                      }}
                      className="mt-2.5 flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        aria-label={`Query or URL for ${act.name}`}
                        value={cardQuery}
                        onChange={(e) =>
                          setCardInputs((prev) => ({ ...prev, [act.id]: e.target.value }))
                        }
                        placeholder={
                          act.category === 'watch'
                            ? 'Search video or paste YouTube URL...'
                            : 'Search web/wiki or enter URL...'
                        }
                        className="flex-1 min-w-0 bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded-md px-2.5 py-1 text-[11px] text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none"
                      />
                    </form>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[var(--text-link)]" />
                    <span>{isCoBrowseCard ? 'Synced Co-Browse' : 'Shared Visual'}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => launchCoBrowseOrActivity(act, cardQuery)}
                    className="px-3.5 py-1.5 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isCoBrowseCard ? 'Launch Co-Browse' : 'Start'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export interface EmbeddedActivityStageProps {
  activity: ActivityItem;
  onClose: () => void;
  roomName?: string;
  roomId?: string;
  onShareToChat?: (text: string) => void;
}

export const EmbeddedActivityStage: React.FC<EmbeddedActivityStageProps> = ({
  activity,
  onClose,
  roomName,
  roomId,
  onShareToChat,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentUrl, setCurrentUrl] = useState(activity.embedUrl);
  const [urlInput, setUrlInput] = useState(activity.embedUrl);

  // Seamlessly render SharedBrowserStage for Shared Web Browser & Watch Together activities
  if (
    activity.category === 'browse' ||
    activity.category === 'watch' ||
    activity.id === 'web_browser' ||
    activity.id === 'youtube_together'
  ) {
    return (
      <SharedBrowserStage
        isOpen
        roomName={roomName || activity.name}
        roomId={roomId || activity.id}
        onClose={onClose}
        onShareToChat={onShareToChat}
        initialQueryOrUrl={activity.initialQueryOrUrl ?? (activity.embedUrl || undefined)}
      />
    );
  }

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    let target = urlInput.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`;
    }
    setCurrentUrl(target);
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = currentUrl;
    }
  };

  return (
    <div className="w-full bg-[var(--bg-popout)] border-b border-[var(--border-subtle)] flex flex-col h-[520px] max-h-[calc(65vh/var(--app-zoom,1))] relative animate-fadeIn">
      {/* Activity Navigation / Header Bar */}
      <div className="h-10 bg-[var(--bg-userpanel)] border-b border-[var(--border-subtle)] px-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{activity.thumbnail}</span>
          <span className="font-bold text-[var(--text-header)] text-xs truncate">{activity.name}</span>
          <span className="px-1.5 py-0.2 rounded bg-[var(--bg-channels)] text-[var(--text-link)] border border-[var(--border-subtle)] text-[10px] font-bold">
            Synced
          </span>
        </div>

        <form onSubmit={handleNavigate} className="flex-1 max-w-md flex items-center gap-1">
          <input
            type="text"
            aria-label="Activity URL"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded px-2.5 py-1 text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--discord-blurple)]"
          />
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refresh Activity"
            className="p-1 hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] rounded cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open in external tab"
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] rounded cursor-pointer"
            title="Open In External Tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={() => {
              if (iframeRef.current?.requestFullscreen) {
                void iframeRef.current.requestFullscreen().catch(() => {});
              }
            }}
            aria-label="Fullscreen Activity"
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] rounded cursor-pointer"
            title="Full Screen Activity"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Activity"
            className="p-1 text-[var(--text-muted)] hover:text-[var(--status-dnd)] hover:bg-red-500/10 rounded cursor-pointer"
            title="Close Activity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Embedded Iframe */}
      <div className="flex-1 w-full bg-black relative">
        <iframe
          ref={iframeRef}
          src={currentUrl}
          title={activity.name}
          allow="autoplay; encrypted-media; fullscreen; camera; microphone"
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
        />
      </div>
    </div>
  );
};
