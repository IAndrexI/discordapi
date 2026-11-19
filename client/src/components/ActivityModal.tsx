import React, { useState, useRef } from 'react';
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
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-[var(--bg-chat)] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-white/10 relative max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[var(--bg-userpanel)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Activities &amp; Shared Co-Browser</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  #{room.name}
                </span>
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Launch synchronized games, search the web, or watch videos together in real-time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search, Filter Pills & Custom Browser Input */}
        <div className="p-4 space-y-3 border-b border-white/5 bg-[var(--bg-channels)]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter activities or mini-games..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-[var(--bg-userpanel)] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-400 outline-none focus:border-purple-400"
            />
            <button
              type="button"
              onClick={() => setShowCustomInput(!showCustomInput)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showCustomInput
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 hover:bg-white/15 text-gray-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-cyan-300" />
              <span>Search Web / URL</span>
            </button>
          </div>

          {/* Custom Web Search / URL Prompt */}
          {showCustomInput && (
            <form onSubmit={handleLaunchCustomUrl} className="flex items-center gap-2 animate-fadeIn pt-1">
              <input
                type="text"
                placeholder="Search anything (e.g. Minecraft) or enter URL (e.g. wikipedia.org)..."
                value={customBrowseUrl}
                onChange={(e) => setCustomBrowseUrl(e.target.value)}
                className="flex-1 bg-black/40 border border-purple-500/40 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-400 outline-none focus:border-purple-400"
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer flex items-center gap-1"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Open Co-Browse</span>
              </button>
            </form>
          )}

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            {(
              [
                { id: 'all', label: 'All Activities' },
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
                    ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                    : 'text-[var(--text-muted)] hover:text-white bg-white/5'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Activities Cards Grid */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 overflow-y-auto max-h-[420px]">
          {filtered.map((act) => {
            const isCoBrowseCard = act.category === 'browse' || act.category === 'watch';
            const cardQuery = cardInputs[act.id] || '';
            return (
              <div
                key={act.id}
                className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-white/5 hover:border-purple-500/40 transition-all flex flex-col justify-between group shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl p-2 rounded-lg bg-black/30 border border-white/5 flex items-center justify-center">
                        {act.thumbnail}
                      </span>
                      <div>
                        <h3 className="font-bold text-white text-sm group-hover:text-purple-300 transition-colors">
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
                        value={cardQuery}
                        onChange={(e) =>
                          setCardInputs((prev) => ({ ...prev, [act.id]: e.target.value }))
                        }
                        placeholder={
                          act.category === 'watch'
                            ? 'Search video or paste YouTube URL...'
                            : 'Search web/wiki or enter URL...'
                        }
                        className="flex-1 min-w-0 bg-black/40 border border-white/10 focus:border-cyan-400 rounded-md px-2.5 py-1 text-[11px] text-white placeholder-gray-500 outline-none"
                      />
                    </form>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span>{isCoBrowseCard ? 'Synced Co-Browse' : 'Shared Visual'}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => launchCoBrowseOrActivity(act, cardQuery)}
                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isCoBrowseCard ? 'Launch Co-Browse' : 'Start Activity'}</span>
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
    <div className="w-full bg-black/90 border-b border-black/30 flex flex-col h-[520px] relative animate-fadeIn">
      {/* Activity Navigation / Header Bar */}
      <div className="h-10 bg-[var(--bg-userpanel)] border-b border-white/10 px-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{activity.thumbnail}</span>
          <span className="font-bold text-white text-xs truncate">{activity.name}</span>
          <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
            Synchronized
          </span>
        </div>

        <form onSubmit={handleNavigate} className="flex-1 max-w-md flex items-center gap-1">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-white placeholder-gray-400 outline-none focus:border-cyan-400"
          />
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1 hover:bg-white/10 text-gray-300 rounded cursor-pointer"
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
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded cursor-pointer"
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
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded cursor-pointer"
            title="Full Screen Activity"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer"
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
