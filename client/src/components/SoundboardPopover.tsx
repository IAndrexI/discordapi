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
      setAddError('Please select an audio file (.mp3, .wav, .ogg, .webm, .m4a).');
      return;
    }
    const cleanName = customName.trim();
    if (!cleanName) {
      setAddError('Please enter a clip name.');
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
      setAddError(err instanceof Error ? err.message : 'Failed to save custom sound.');
    } finally {
      setIsAdding(false);
    }
  };

  const panelContent = (
    <div
      data-testid="soundboard-popover"
      onClick={(e) => e.stopPropagation()}
      className="w-[450px] max-w-[calc(100vw-24px)] max-h-[75vh] bg-[#111214] border border-[#1e1f22] rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col text-[#dbdee1] animate-fadeIn"
    >
      {/* Discord-style Header */}
      <div className="bg-[#2b2d31] px-3.5 py-2.5 border-b border-[#1e1f22] flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#5865f2]/20 border border-[#5865f2]/40 flex items-center justify-center text-[#5865f2] flex-shrink-0">
            <Music className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#f2f3f5] leading-tight flex items-center gap-1.5">
              <span>Soundboard</span>
              {playingIds.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#5865f2] text-white">
                  {playingIds.length} playing
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Master Volume, Mute, Stop All, Close */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className="flex items-center gap-1.5 bg-[#1e1f22] rounded-md px-2 py-1 border border-white/5"
            title={`Soundboard Volume: ${masterVolume}%`}
          >
            <Volume2 className="w-3.5 h-3.5 text-[#949ba4] flex-shrink-0" />
            <input
              type="range"
              min={0}
              max={200}
              step={1}
              aria-label="Soundboard Master Volume"
              value={masterVolume}
              onChange={(e) => {
                const vol = Number(e.target.value);
                setMasterVolume(vol);
                soundboardService.setMasterVolume(vol);
              }}
              className="w-16 sm:w-20 accent-[#5865f2] cursor-pointer h-1 bg-[#383a40] rounded-lg"
            />
            <span className="text-[10px] font-mono text-[#949ba4] w-8 text-right">
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
            title={isMuted ? 'Unmute Soundboard' : 'Mute Soundboard'}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              isMuted
                ? 'bg-[#f23f43]/20 text-[#f23f43] border border-[#f23f43]/40'
                : 'bg-[#1e1f22] text-[#dbdee1] hover:bg-[#35373c] hover:text-white'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => soundboardService.stopAll()}
            title="Stop All Playing Sounds"
            aria-label="Stop All"
            className="px-2 py-1 rounded-md bg-[#1e1f22] hover:bg-[#f23f43]/20 text-[#dbdee1] hover:text-[#f23f43] border border-white/5 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Square className="w-3 h-3 fill-current" />
            <span className="hidden sm:inline">Stop All</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Soundboard"
            title="Close Soundboard"
            className="w-7 h-7 rounded-md hover:bg-white/10 text-[#949ba4] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Bar & Filter Tabs */}
      <div className="px-3 py-2 bg-[#1e1f22]/75 border-b border-[#1e1f22] space-y-2 flex-shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[#949ba4] absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sounds..."
            className="w-full bg-[#111214] border border-white/10 focus:border-[#5865f2] rounded-md pl-8 pr-7 py-1.5 text-xs text-[#f2f3f5] placeholder-[#949ba4] outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear sound search"
              className="absolute right-2 text-[#949ba4] hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1">
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
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#5865f2] text-white'
                      : 'bg-[#2b2d31] text-[#949ba4] hover:text-white hover:bg-[#35373c]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <span className="text-[10px] text-[#949ba4] font-medium">
            {filteredSounds.length} {filteredSounds.length === 1 ? 'sound' : 'sounds'}
          </span>
        </div>
      </div>

      {/* 3-Column Tactile Discord Sound Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {filteredSounds.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="text-2xl">🔇</div>
            <div className="text-xs font-semibold text-[#f2f3f5]">No sounds found</div>
            <p className="text-[11px] text-[#949ba4]">
              {activeTab === 'custom'
                ? 'Upload your own MP3/WAV/OGG sound clips below.'
                : 'Try clearing your search or switching filter tabs.'}
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
                      ? 'bg-[#5865f2]/20 border-[#5865f2] ring-2 ring-[#5865f2]/60 animate-pulse'
                      : 'bg-[#1e1f22] hover:bg-[#35373c] border-white/[0.06] hover:border-white/15'
                  }`}
                >
                  <button
                    type="button"
                    data-testid={`soundboard-tile-${clip.id}`}
                    onClick={() => void soundboardService.play(clip.id, { senderName })}
                    title={`Play ${clip.name}${clip.hotkey ? ` (${clip.hotkey})` : ''}`}
                    className="w-full h-full min-h-[80px] p-2.5 pt-4 flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
                  >
                    <span className="text-2xl leading-none select-none">{clip.emoji}</span>
                    <span className="text-[11px] font-semibold text-[#f2f3f5] truncate w-full px-1">
                      {clip.name}
                    </span>
                    {clip.hotkey && (
                      <span className="text-[9px] font-mono text-[#949ba4] bg-black/35 px-1.5 py-0.2 rounded">
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
                    title={clip.favorite ? 'Remove Favorite' : 'Favorite Sound'}
                    aria-label={clip.favorite ? `Unfavorite ${clip.name}` : `Favorite ${clip.name}`}
                    className={`absolute top-1 left-1 w-5 h-5 rounded flex items-center justify-center transition-opacity cursor-pointer ${
                      clip.favorite
                        ? 'opacity-100 text-[#f0b232] bg-black/40'
                        : 'opacity-0 group-hover:opacity-100 focus:opacity-100 text-[#949ba4] hover:text-[#f0b232] bg-black/50'
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
                      title="Preview Locally (Not Broadcast)"
                      aria-label={`Preview ${clip.name} locally`}
                      className="w-5 h-5 rounded bg-black/60 hover:bg-[#5865f2] text-[#dbdee1] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
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
                        title="Delete Custom Sound"
                        aria-label={`Delete ${clip.name}`}
                        className="w-5 h-5 rounded bg-black/60 hover:bg-[#f23f43] text-[#dbdee1] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
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

      {/* Expandable + Add Custom Sound Drawer */}
      <div className="border-t border-[#1e1f22] bg-[#2b2d31] flex-shrink-0">
        <button
          type="button"
          onClick={() => setShowAddDrawer((v) => !v)}
          className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-semibold text-[#f2f3f5] hover:bg-white/[0.04] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-[#5865f2]" />
            <span>Add Custom Sound</span>
          </span>
          {showAddDrawer ? (
            <ChevronDown className="w-4 h-4 text-[#949ba4]" />
          ) : (
            <ChevronUp className="w-4 h-4 text-[#949ba4]" />
          )}
        </button>

        {showAddDrawer && (
          <form
            onSubmit={handleAddCustomSound}
            className="px-3.5 pb-3 pt-1 space-y-2.5 border-t border-white/5 bg-[#1e1f22]/70 max-h-[260px] overflow-y-auto"
          >
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
                className="w-full px-3 py-2 rounded-md border border-dashed border-white/20 hover:border-[#5865f2] bg-[#111214] text-xs text-[#dbdee1] flex items-center justify-between gap-2 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2 truncate">
                  <Upload className="w-3.5 h-3.5 text-[#5865f2] flex-shrink-0" />
                  <span className="truncate">
                    {customFile ? customFile.name : 'Choose audio file (.mp3, .wav, .ogg, .webm, .m4a)'}
                  </span>
                </span>
                {customFile && (
                  <span className="text-[10px] text-[#949ba4] flex-shrink-0">
                    {Math.max(1, Math.round(customFile.size / 1024))} KB
                  </span>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#949ba4] mb-1">
                  Clip Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  maxLength={32}
                  placeholder="e.g. Bruh"
                  className="w-full bg-[#111214] border border-white/10 focus:border-[#5865f2] rounded px-2.5 py-1.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#949ba4] mb-1">
                  Hotkey (Optional)
                </label>
                <div className="relative flex items-center">
                  <Keyboard className="w-3 h-3 text-[#949ba4] absolute left-2 pointer-events-none" />
                  <input
                    type="text"
                    value={customHotkey}
                    onChange={(e) => setCustomHotkey(e.target.value)}
                    maxLength={16}
                    placeholder="e.g. Alt+1"
                    className="w-full bg-[#111214] border border-white/10 focus:border-[#5865f2] rounded pl-7 pr-2 py-1.5 text-xs text-white outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#949ba4] mb-1">
                Emoji ({customEmoji})
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                {QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setCustomEmoji(em)}
                    className={`w-7 h-7 rounded flex items-center justify-center text-sm cursor-pointer transition-colors ${
                      customEmoji === em
                        ? 'bg-[#5865f2] ring-1 ring-white/40'
                        : 'bg-[#111214] hover:bg-[#35373c]'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {addError && (
              <div className="text-[11px] text-[#f23f43] font-medium">{addError}</div>
            )}

            <div className="flex items-center justify-end gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setShowAddDrawer(false)}
                className="px-3 py-1.5 rounded text-xs font-medium text-[#949ba4] hover:text-white hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAdding}
                className="px-3.5 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
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
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3"
      >
        {panelContent}
      </div>
    );
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[69] bg-transparent" />
      <div className="fixed bottom-[62px] left-3 sm:left-[84px] z-[70] max-w-[calc(100vw-24px)]">
        {panelContent}
      </div>
    </>
  );
};
