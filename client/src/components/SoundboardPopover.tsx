import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Music,
  Volume2,
  VolumeX,
  Square,
  X,
  Search,
  Star,
  Headphones,
  Trash2,
  Plus,
  Upload,
  Keyboard,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { SoundboardClip } from '../types';
import { soundboardService } from '../services/soundboard';

export interface SoundboardPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  senderName?: string;
  anchor?: 'bottom-left' | 'center';
}

type SoundFilterTab = 'all' | 'favorites' | 'builtin' | 'custom';

const QUICK_EMOJIS = ['🔊', '🎵', '🔥', '😂', '💀', '🎉', '🚨', '🦆', '💥', '✨', '🎮', '⚡'];

export const SoundboardPopover: React.FC<SoundboardPopoverProps> = ({
  isOpen,
  onClose,
  senderName,
  anchor = 'bottom-left',
}) => {
  const [sounds, setSounds] = useState<SoundboardClip[]>(() => soundboardService.getSounds());
  const [masterVolume, setMasterVolume] = useState<number>(() => soundboardService.getMasterVolume());
  const [isMuted, setIsMuted] = useState<boolean>(() => soundboardService.isMuted());
  const [playingIds, setPlayingIds] = useState<string[]>(() => soundboardService.getPlayingIds());

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SoundFilterTab>('all');

  // Expandable custom sound drawer state
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState('');
  const [customEmoji, setCustomEmoji] = useState('🔊');
  const [customHotkey, setCustomHotkey] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void soundboardService.init();
    const syncState = () => {
      setSounds(soundboardService.getSounds());
      setMasterVolume(soundboardService.getMasterVolume());
      setIsMuted(soundboardService.isMuted());
      setPlayingIds(soundboardService.getPlayingIds());
    };
    syncState();
    const unsub = soundboardService.subscribe(syncState);
    return unsub;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const filteredSounds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sounds.filter((clip) => {
      if (activeTab === 'favorites' && !clip.favorite) return false;
      if (activeTab === 'builtin' && clip.category !== 'builtin') return false;
      if (activeTab === 'custom' && clip.category !== 'custom') return false;
      if (!q) return true;
      return (
        clip.name.toLowerCase().includes(q) ||
        clip.emoji.includes(q) ||
        (clip.hotkey && clip.hotkey.toLowerCase().includes(q))
      );
    });
  }, [sounds, searchQuery, activeTab]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setCustomFile(file);
    setAddError(null);
    if (file && !customName.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').slice(0, 28);
      setCustomName(baseName);
    }
  };

  const handleAddCustomSound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFile) {
      setAddError('Select an audio file (.mp3, .wav, .ogg, .webm, .m4a).');
      return;
    }
    const cleanName = customName.trim();
    if (!cleanName) {
      setAddError('Enter a clip name.');
      return;
    }

    setIsAdding(true);
    setAddError(null);
    try {
      await soundboardService.addCustomSound(customFile, {
        name: cleanName,
        emoji: customEmoji || '🔊',
        hotkey: customHotkey.trim() || undefined,
      });
      setCustomFile(null);
      setCustomName('');
      setCustomEmoji('🔊');
      setCustomHotkey('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowAddDrawer(false);
      setActiveTab('custom');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to save sound.');
    } finally {
      setIsAdding(false);
    }
  };

  const sizeBoundsClass =
    anchor === 'center'
      ? 'max-w-full max-h-full'
      : 'max-w-[calc(100vw/var(--app-zoom,1)-24px)] max-h-[calc(100vh/var(--app-zoom,1)-96px)]';

  const panelContent = (
    <div
      data-testid="soundboard-popover"
      role="dialog"
      aria-modal="true"
      aria-label="Soundboard"
      onClick={(e) => e.stopPropagation()}
      className={`w-[450px] ${sizeBoundsClass} z-[95] bg-[var(--bg-popout)] border border-[var(--border-subtle)] rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col text-[var(--text-normal)] animate-fadeIn`}
    >
      {/* Header */}
      <div className="bg-[var(--bg-channels)] px-3.5 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[var(--discord-blurple)]/20 border border-[var(--discord-blurple)]/40 flex items-center justify-center text-[var(--discord-blurple)] flex-shrink-0">
            <Music className="w-4 h-4" />
          </div>
          <div className="text-sm font-bold text-[var(--text-header)] leading-tight flex items-center gap-1.5">
            <span>Soundboard</span>
            {playingIds.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[var(--discord-blurple)] text-white">
                {playingIds.length} playing
              </span>
            )}
          </div>
        </div>

        {/* Master Volume, Mute, Stop All, Close */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div
            className="flex items-center gap-1.5 bg-[var(--bg-card)] rounded-md px-2 py-1 border border-[var(--border-subtle)]"
            title={`Volume: ${masterVolume}%`}
          >
            <Volume2 className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
            <input
              type="range"
              min={0}
              max={200}
              step={1}
              aria-label="Soundboard Volume"
              value={masterVolume}
              onChange={(e) => {
                const vol = Number(e.target.value);
                setMasterVolume(vol);
                soundboardService.setMasterVolume(vol);
              }}
              className="w-16 sm:w-20 accent-[var(--discord-blurple)] cursor-pointer h-1 bg-[var(--bg-message-input)] rounded-lg"
            />
            <span className="text-[10px] font-mono text-[var(--text-muted)] w-8 text-right">
              {masterVolume}%
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              soundboardService.setMuted(next);
            }}
            aria-label={isMuted ? 'Unmute Soundboard' : 'Mute Soundboard'}
            aria-pressed={isMuted}
            title={isMuted ? 'Unmute' : 'Mute'}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer border ${
              isMuted
                ? 'bg-[var(--status-dnd)]/20 text-[var(--status-dnd)] border-[var(--status-dnd)]/40'
                : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-normal)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)]'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => soundboardService.stopAll()}
            title="Stop All"
            aria-label="Stop All Sounds"
            className="px-2 py-1 rounded-md bg-[var(--bg-card)] hover:bg-[var(--status-dnd)]/20 text-[var(--text-normal)] hover:text-[var(--status-dnd)] border border-[var(--border-subtle)] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Square className="w-3 h-3 fill-current" />
            <span className="hidden sm:inline">Stop</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Soundboard"
            title="Close"
            className="w-7 h-7 rounded-md hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Bar & Filter Tabs */}
      <div className="px-3 py-2 bg-[var(--bg-channels)]/60 border-b border-[var(--border-subtle)] space-y-2 flex-shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search sounds"
            placeholder="Search sounds..."
            className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded-md pl-8 pr-7 py-1.5 text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1" role="tablist" aria-label="Sound categories">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'favorites', label: 'Favorites' },
                { id: 'builtin', label: 'Built-in' },
                { id: 'custom', label: 'Custom' },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--discord-blurple)] text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <span className="text-[10px] text-[var(--text-muted)] font-medium">
            {filteredSounds.length} {filteredSounds.length === 1 ? 'sound' : 'sounds'}
          </span>
        </div>
      </div>

      {/* 3-Column Sound Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {filteredSounds.length === 0 ? (
          <div className="py-8 text-center space-y-1.5">
            <div className="text-2xl">🔇</div>
            <div className="text-xs font-semibold text-[var(--text-header)]">No sounds found</div>
            <p className="text-[11px] text-[var(--text-muted)]">
              {activeTab === 'custom'
                ? 'Add a custom clip below.'
                : 'Try another search or tab.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filteredSounds.map((clip) => {
              const isPlaying = playingIds.includes(clip.id);
              return (
                <div
                  key={clip.id}
                  className={`relative group rounded-lg border transition-all overflow-hidden ${
                    isPlaying
                      ? 'bg-[var(--discord-blurple)]/20 border-[var(--discord-blurple)] ring-2 ring-[var(--discord-blurple)]/60 animate-pulse'
                      : 'bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] border-[var(--border-subtle)] hover:border-[var(--discord-blurple)]/50'
                  }`}
                >
                  <button
                    type="button"
                    data-testid={`soundboard-tile-${clip.id}`}
                    aria-label={`Play ${clip.name}`}
                    onClick={() => void soundboardService.play(clip.id, { senderName })}
                    title={`Play ${clip.name}${clip.hotkey ? ` (${clip.hotkey})` : ''}`}
                    className="w-full h-full min-h-[76px] p-2.5 pt-4 flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
                  >
                    <span className="text-2xl leading-none select-none">{clip.emoji}</span>
                    <span className="text-[11px] font-semibold text-[var(--text-header)] truncate w-full px-1">
                      {clip.name}
                    </span>
                    {clip.hotkey && (
                      <span className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-popout)] px-1.5 py-0.2 rounded border border-[var(--border-subtle)]">
                        {clip.hotkey}
                      </span>
                    )}
                  </button>

                  {/* Top-left Favorite Star */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundboardService.toggleFavorite(clip.id);
                    }}
                    title={clip.favorite ? 'Unfavorite' : 'Favorite'}
                    aria-label={clip.favorite ? `Unfavorite ${clip.name}` : `Favorite ${clip.name}`}
                    aria-pressed={Boolean(clip.favorite)}
                    className={`absolute top-1 left-1 w-5 h-5 rounded flex items-center justify-center transition-opacity cursor-pointer ${
                      clip.favorite
                        ? 'opacity-100 text-[var(--status-idle)] bg-[var(--bg-popout)]/80'
                        : 'opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--text-muted)] hover:text-[var(--status-idle)] bg-[var(--bg-popout)]/80'
                    }`}
                  >
                    <Star className={`w-3 h-3 ${clip.favorite ? 'fill-current' : ''}`} />
                  </button>

                  {/* Top-right Local Preview & Delete Custom */}
                  <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void soundboardService.play(clip.id, { localOnly: true, senderName });
                      }}
                      title="Preview Locally"
                      aria-label={`Preview ${clip.name} locally`}
                      className="w-5 h-5 rounded bg-[var(--bg-popout)]/85 hover:bg-[var(--discord-blurple)] text-[var(--text-normal)] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Headphones className="w-3 h-3" />
                    </button>

                    {clip.category === 'custom' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void soundboardService.deleteCustomSound(clip.id);
                        }}
                        title="Delete"
                        aria-label={`Delete ${clip.name}`}
                        className="w-5 h-5 rounded bg-[var(--bg-popout)]/85 hover:bg-[var(--status-dnd)] text-[var(--text-normal)] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expandable Add Custom Sound Drawer (viewport-safe with sticky submit footer) */}
      <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-channels)] flex-shrink-0 max-h-[min(320px,calc(100vh/var(--app-zoom,1)-270px))] flex flex-col overflow-hidden">
        <button
          type="button"
          data-testid="soundboard-add-toggle-btn"
          aria-expanded={showAddDrawer}
          aria-label="Add Custom Sound"
          onClick={() => setShowAddDrawer((v) => !v)}
          className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-semibold text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] transition-colors cursor-pointer flex-shrink-0"
        >
          <span className="flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
            <span>Add Custom Sound</span>
          </span>
          {showAddDrawer ? (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </button>

        {showAddDrawer && (
          <form
            onSubmit={handleAddCustomSound}
            className="flex-1 min-h-0 flex flex-col overflow-hidden border-t border-[var(--border-subtle)] bg-[var(--bg-popout)]/75"
          >
            <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5 space-y-2">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Choose audio file"
                  className="w-full px-3 py-1.5 rounded-md border border-dashed border-[var(--border-subtle)] hover:border-[var(--discord-blurple)] bg-[var(--bg-card)] text-xs text-[var(--text-normal)] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Upload className="w-3.5 h-3.5 text-[var(--discord-blurple)] flex-shrink-0" />
                    <span className="truncate">
                      {customFile ? customFile.name : 'Choose audio (.mp3, .wav, .ogg, .webm, .m4a)'}
                    </span>
                  </span>
                  {customFile && (
                    <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">
                      {Math.max(1, Math.round(customFile.size / 1024))} KB
                    </span>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    maxLength={32}
                    placeholder="e.g. Bruh"
                    className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded px-2.5 py-1 text-xs text-[var(--text-header)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Hotkey
                  </label>
                  <div className="relative flex items-center">
                    <Keyboard className="w-3 h-3 text-[var(--text-muted)] absolute left-2 pointer-events-none" />
                    <input
                      type="text"
                      value={customHotkey}
                      onChange={(e) => setCustomHotkey(e.target.value)}
                      maxLength={16}
                      placeholder="Alt+1"
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded pl-7 pr-2 py-1 text-xs text-[var(--text-header)] outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Icon ({customEmoji})
                </label>
                <div className="flex items-center gap-1 flex-wrap">
                  {QUICK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      aria-label={`Select emoji ${em}`}
                      aria-pressed={customEmoji === em}
                      onClick={() => setCustomEmoji(em)}
                      className={`w-6 h-6 rounded flex items-center justify-center text-sm cursor-pointer transition-colors ${
                        customEmoji === em
                          ? 'bg-[var(--discord-blurple)] text-white ring-1 ring-white/40'
                          : 'bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)]'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {addError && (
                <div className="text-[11px] text-[var(--status-dnd)] font-medium">{addError}</div>
              )}
            </div>

            <div className="px-3.5 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-channels)] flex items-center justify-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowAddDrawer(false)}
                className="px-3 py-1 rounded text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAdding}
                className="px-3.5 py-1 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                {isAdding ? 'Saving...' : 'Upload Sound'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  if (anchor === 'center') {
    return (
      <div
        onClick={onClose}
        className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3"
      >
        {panelContent}
      </div>
    );
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[94] bg-transparent" />
      <div className="fixed bottom-[62px] left-3 sm:left-[84px] z-[95] max-w-[calc(100vw/var(--app-zoom,1)-24px)] max-h-[calc(100vh/var(--app-zoom,1)-96px)] flex flex-col">
        {panelContent}
      </div>
    </>
  );
};
